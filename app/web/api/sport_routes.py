"""AI Sport — REST-обёртка над очередью источников данных (см.
app/web/integrations/sport_provider.py: footballdata.io -> clearsportsapi.com
-> ...) для мини-аппа.

Этот файл — тот самый app/web/api/sport_routes.py, на который ссылался
комментарий в webapp/src/config/sportApi.js, но которого не было ни в одном
присланном архиве проекта. Без него /api/sport/* всегда отвечал 404
независимо от того, какие ключи вписаны в Railway.

Раздел публичный: список команд и live-счёт одинаковы для всех
пользователей, поэтому, в отличие от /api/billing, /api/referrals и т.д.,
авторизация здесь не требуется.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app.web import repo
from app.web.deps import get_current_user_optional
from app.web.integrations import sport_provider as sport
from app.web.integrations.sport_common import SportProviderError

router = APIRouter(prefix="/api/sport", tags=["sport"])

# Бесплатный показ ограничен, чтобы не отдавать полную сетку матчей без
# подписки (см. чат — просьба владельца проекта). "PRO" здесь — та же самая
# проверка, что и в личном кабинете (webapp/src/components/profile/
# subscriptionCard.js): есть хотя бы один платёж со статусом paid. Отдельного
# expires_at в схеме payments пока нет (см. комментарий там же), поэтому это
# намеренно простая проверка "платил хоть раз", а не строгая проверка
# активной подписки на сегодняшний день.
FREE_MATCHES_LIMIT = 1


def _has_paid(user: dict | None) -> bool:
    if not user:
        return False
    return any(p["status"] == "paid" for p in repo.list_payments(user["id"]))


@router.get("/status")
async def status():
    return {"configured": sport.is_configured()}


@router.get("/teams/popular")
async def teams_popular():
    if not sport.is_configured():
        # Честно пусто, а не ошибка — фронтенд покажет sa-hint-block вместо
        # красного экрана ошибки (см. sportApp.js: apiConfigured === false).
        return {"teams": []}
    try:
        teams = await sport.popular_teams()
    except SportProviderError:
        # Все источники отказали (лимит/ключ/сбой) — не роняем весь раздел
        # 502-м на всю страницу, отдаём честно пустой список. Фронтенд уже
        # умеет показывать sa-hint-block для пустого teams (как и при
        # apiConfigured === false), так что это не выглядит поломкой.
        return {"teams": [], "degraded": True}
    return {"teams": teams}


@router.get("/teams/search")
async def teams_search(q: str = Query(..., min_length=2, max_length=80)):
    if not sport.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        teams = await sport.search_teams(q)
    except SportProviderError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return {"teams": teams}


@router.get("/teams/{team_id}")
async def team_detail(team_id: str):
    if not sport.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        team = await sport.team_detail(team_id)
    except SportProviderError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return {"team": team}


@router.get("/teams/{team_id}/matches")
async def team_matches(team_id: str):
    if not sport.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        matches = await sport.team_matches(team_id)
    except SportProviderError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return matches


@router.get("/live")
async def live():
    if not sport.is_configured():
        return {"matches": [], "configured": False}
    try:
        matches = await sport.live_matches()
    except SportProviderError:
        return {"matches": [], "configured": True, "degraded": True}
    return {"matches": matches, "configured": True}


@router.get("/matches")
async def matches(
    when: str = Query("today", pattern="^(today|tomorrow)$"),
    user: dict | None = Depends(get_current_user_optional),
):
    if not sport.is_configured():
        return {"matches": [], "configured": False, "limited": False, "total": 0}

    target_date = date.today() if when == "today" else date.today() + timedelta(days=1)
    try:
        found = await sport.matches_by_date(target_date.isoformat())
    except SportProviderError:
        return {"matches": [], "configured": True, "degraded": True, "limited": False, "total": 0}

    total = len(found)
    if _has_paid(user):
        return {"matches": found, "configured": True, "limited": False, "total": total}

    return {"matches": found[:FREE_MATCHES_LIMIT], "configured": True, "limited": total > FREE_MATCHES_LIMIT, "total": total}
