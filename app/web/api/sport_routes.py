"""AI Sport — REST-обёртка над очередью источников данных (см.
app/web/integrations/sport_provider.py: footballdata.io -> clearsportsapi.com
-> ...) для мини-аппа.

РАУНД 9 — тарифная лестница вместо бинарного free/PRO (см. беседу с
владельцем продукта): 4 тарифа (free/start/pro/business), каждый открывает
больше дней вперёд и больше матчей в день с реальным ИИ-прогнозом (см.
app/web/integrations/predictions.py и app/web/integrations/sport_common.py —
TIER_RULES). Раздел остаётся публичным для базового просмотра (список
команд/live-счёт), но конкретно /matches теперь всегда учитывает
пользователя — даже анонимного (тариф free), — чтобы отдать честную квоту.
"""
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query

from app.web import repo
from app.web.deps import get_current_user_optional
from app.web.integrations import sport_provider as sport
from app.web.integrations.sport_common import SportProviderError, tier_from_plan_code, tier_rule

router = APIRouter(prefix="/api/sport", tags=["sport"])


def _active_plan_code(user: dict | None) -> str | None:
    if not user:
        return None
    sub = repo.get_active_subscription(user["id"])
    return sub["plan"] if sub else None


def _user_tier(user: dict | None) -> str:
    return tier_from_plan_code(_active_plan_code(user))


def _tier_payload(tier: str) -> dict:
    rule = tier_rule(tier)
    return {
        "tier": tier,
        "tierTitle": rule["title"],
        "daysUnlocked": rule["days"],
        "predMin": rule["pred_min"],
        "predMax": rule["pred_max"],
    }


@router.get("/status")
async def status():
    return {"configured": sport.is_configured()}


@router.get("/tier")
async def tier_info(user: dict | None = Depends(get_current_user_optional)):
    """Тариф текущего пользователя (или free для анонимных/гостей) — фронтенд
    строит по этому вкладки дней и подписи квоты прогнозов (см. sportApp.js),
    не дублируя правила тарифов на своей стороне."""
    return _tier_payload(_user_tier(user))


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


def _fixture_key(f: dict) -> tuple[str, str]:
    return (str((f.get("home") or {}).get("id")), str((f.get("away") or {}).get("id")))


@router.get("/matches")
async def matches(
    day: int = Query(0, ge=0, le=3, description="Смещение от сегодня: 0=сегодня, 1=завтра, …, 3"),
    user: dict | None = Depends(get_current_user_optional),
):
    tier = _user_tier(user)
    rule = tier_rule(tier)
    payload = _tier_payload(tier)

    if not sport.is_configured():
        return {**payload, "matches": [], "configured": False, "dayLocked": False, "total": 0, "predictedCount": 0}

    # День вне лестницы тарифа — не дёргаем источник данных вообще (нет
    # смысла тратить лимит внешнего API на день, который всё равно не
    # покажем): фронтенд получает чёткий "закрыто с тарифа X", а не пустой
    # список матчей, который выглядел бы как "матчей просто нет".
    if day >= rule["days"]:
        return {**payload, "matches": [], "configured": True, "dayLocked": True, "total": 0, "predictedCount": 0}

    target_date = date.today() + timedelta(days=day)
    try:
        found = await sport.matches_by_date(target_date.isoformat())
    except SportProviderError:
        return {**payload, "matches": [], "configured": True, "degraded": True, "dayLocked": False, "total": 0, "predictedCount": 0}

    total = len(found)

    # Прогноз строим только для ближайших предстоящих матчей (NS) и только на
    # квоту тарифа — так тариф ограничивает именно число прогнозов, а не
    # список самих матчей (матчи все настоящие и видны все — см. переписку с
    # владельцем продукта: "матчи всегда реальные").
    upcoming = [f for f in found if f["statusShort"] == "NS"]
    quota = min(rule["pred_max"], len(upcoming))
    to_predict = upcoming[:quota]

    predictions_by_key = {}
    if to_predict:
        try:
            predictions_by_key = await sport.predict_matches(to_predict)
        except Exception:  # noqa: BLE001 — прогноз необязателен, список матчей важнее
            predictions_by_key = {}

    for f in found:
        pred = predictions_by_key.get(_fixture_key(f))
        f["prediction"] = pred

    predicted_count = sum(1 for f in found if f.get("prediction"))

    return {
        **payload,
        "matches": found,
        "configured": True,
        "dayLocked": False,
        "total": total,
        "predictedCount": predicted_count,
    }
