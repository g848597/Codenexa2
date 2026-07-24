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
import time
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.web import repo
from app.web.deps import get_current_user, get_current_user_optional
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

    # Избранные команды — их матчи поднимаются в начало дня (см. владелец
    # продукта: "показывать её матчи первыми на главной"). Сам список и
    # порядок остальных матчей не меняется — только избранные всплывают
    # наверх, ничего не скрывается и не удаляется.
    favorite_ids: set[str] = set()
    if user:
        favorite_ids = repo.get_favorite_team_ids(user["id"])
    if favorite_ids:
        def _is_favorite(f: dict) -> bool:
            return str((f.get("home") or {}).get("id")) in favorite_ids or str((f.get("away") or {}).get("id")) in favorite_ids

        found = sorted(found, key=lambda f: 0 if _is_favorite(f) else 1)

    return {
        **payload,
        "matches": found,
        "configured": True,
        "dayLocked": False,
        "total": total,
        "predictedCount": predicted_count,
    }


# --- Турнирная таблица лиги --------------------------------------------------

@router.get("/leagues/{league_id}/standings")
async def league_standings(league_id: str):
    if not sport.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        table = await sport.league_standings(league_id)
    except SportProviderError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return {"standings": table}


# --- Очная история (head-to-head) -------------------------------------------

@router.get("/teams/{team_id}/h2h/{opponent_id}")
async def team_h2h(team_id: str, opponent_id: str):
    if not sport.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        h2h = await sport.head_to_head(team_id, opponent_id)
    except SportProviderError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return {"matches": h2h}


# --- Экран одного матча ------------------------------------------------------

@router.get("/matches/{match_id}")
async def match_detail(match_id: str, user: dict | None = Depends(get_current_user_optional)):
    if not sport.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        fixture = await sport.match_detail(match_id)
    except SportProviderError as e:
        raise HTTPException(status_code=e.status, detail=str(e))

    h2h: list[dict] = []
    home_id = (fixture.get("home") or {}).get("id")
    away_id = (fixture.get("away") or {}).get("id")
    if home_id and away_id:
        try:
            h2h = await sport.head_to_head(home_id, away_id)
        except SportProviderError:
            h2h = []  # необязательно для экрана — матч показываем в любом случае

    prediction = None
    if fixture.get("statusShort") == "NS" and home_id and away_id:
        tier = _user_tier(user)
        rule = tier_rule(tier)
        if rule["pred_max"] > 0:
            try:
                predictions_by_key = await sport.predict_matches([fixture])
                prediction = predictions_by_key.get(_fixture_key(fixture))
            except Exception:  # noqa: BLE001 — прогноз необязателен для экрана матча
                prediction = None

    fixture["prediction"] = prediction
    return {"match": fixture, "h2h": h2h}


# --- Избранные команды (watchlist) ------------------------------------------

class FavoriteTeamIn(BaseModel):
    teamId: str
    teamName: str = ""
    teamLogo: str | None = None


@router.get("/favorites")
async def list_favorites(user: dict = Depends(get_current_user)):
    rows = repo.list_favorite_teams(user["id"])
    return {"teams": [
        {"teamId": r["team_id"], "teamName": r["team_name"], "teamLogo": r["team_logo"]} for r in rows
    ]}


@router.post("/favorites")
async def add_favorite(body: FavoriteTeamIn, user: dict = Depends(get_current_user)):
    if not body.teamId:
        raise HTTPException(status_code=400, detail="teamId обязателен")
    row = repo.add_favorite_team(user["id"], body.teamId, body.teamName, body.teamLogo)
    return {"team": {"teamId": row["team_id"], "teamName": row["team_name"], "teamLogo": row["team_logo"]}}


@router.delete("/favorites/{team_id}")
async def remove_favorite(team_id: str, user: dict = Depends(get_current_user)):
    repo.remove_favorite_team(user["id"], team_id)
    return {"ok": True}


# --- Напоминания о матче (Telegram) -----------------------------------------

class ReminderIn(BaseModel):
    matchId: str
    homeName: str = ""
    awayName: str = ""
    matchTimestamp: int
    minutesBefore: int = 30


@router.get("/reminders")
async def list_reminders(user: dict = Depends(get_current_user)):
    rows = repo.list_match_reminders(user["id"])
    return {"reminders": [
        {
            "matchId": r["match_id"], "homeName": r["home_name"], "awayName": r["away_name"],
            "matchTimestamp": r["match_timestamp"], "minutesBefore": r["minutes_before"],
        } for r in rows
    ]}


@router.post("/reminders")
async def create_reminder(body: ReminderIn, user: dict = Depends(get_current_user)):
    if not user.get("telegram_id"):
        # Напоминание шлётся только через Telegram-бота (см.
        # app/web/integrations/stars.py, app/web/server.py: _reminder_worker) —
        # у аккаунтов без Telegram (вход по email/паролю) отправлять некуда.
        # Честно отказываем вместо того, чтобы притвориться, что уведомление
        # придёт.
        raise HTTPException(
            status_code=400,
            detail="Напоминания приходят через Telegram-бота — войдите через Telegram, чтобы их получать",
        )
    if body.matchTimestamp <= int(time.time()):
        raise HTTPException(status_code=400, detail="Матч уже начался или время матча некорректно")
    if body.minutesBefore < 1 or body.minutesBefore > 24 * 60:
        raise HTTPException(status_code=400, detail="minutesBefore должно быть от 1 до 1440")
    row = repo.create_match_reminder(
        user["id"], body.matchId, body.homeName, body.awayName, body.matchTimestamp, body.minutesBefore
    )
    return {
        "reminder": {
            "matchId": row["match_id"], "homeName": row["home_name"], "awayName": row["away_name"],
            "matchTimestamp": row["match_timestamp"], "minutesBefore": row["minutes_before"],
        }
    }


@router.delete("/reminders/{match_id}")
async def cancel_reminder(match_id: str, user: dict = Depends(get_current_user)):
    repo.cancel_match_reminder(user["id"], match_id)
    return {"ok": True}
