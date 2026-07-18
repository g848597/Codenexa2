"""Клиент ClearSports API (https://www.clearsportsapi.com/) — второй источник
в цепочке AI Sport (см. sport_provider.py), подключается автоматически, когда
footballdata.io исчерпал лимит или недоступен.

ОБНОВЛЕНО 2026-07-18: реальная документация — https://www.clearsportsapi.com/docs.
У ClearSports НЕТ общего эндпоинта "/soccer/...": соккер разбит по лигам —
/api/v1/epl/teams, /api/v1/laliga/teams, /api/v1/bundesliga/teams,
/api/v1/seriea/teams, /api/v1/ligue1/teams и т.д. (полный список: epl, laliga,
bundesliga, mls, ligue1, ligaportugal, uefa, eredivisie, seriea, ligamx,
brazilian-serie-a, world-cup). Эндпоинт /games НЕ принимает фильтр по
team_id ("returns the full set and does not accept filter parameters") — его
приходится тянуть целиком и фильтровать на нашей стороне.

Прошлая версия этого файла била в несуществующий путь "/soccer/teams" —
угаданный по аналогии с NBA-примером, а не проверенный по докам — поэтому
провайдер падал с 404 на каждый вызов.
"""
import asyncio
import time

import httpx

from app.web.config import settings
from app.web.integrations.sport_common import SportProviderError, first

# Топ-5 лиг — держим тот же охват, что и у footballdata.io (5 лиг на бесплатном
# тарифе), чтобы оба источника были сопоставимы по объёму данных.
_LEAGUES = ["epl", "laliga", "bundesliga", "seriea", "ligue1"]

_cache: dict[str, tuple[float, dict]] = {}


def _cache_get(key: str):
    hit = _cache.get(key)
    if not hit:
        return None
    ts, data = hit
    if (time.monotonic() - ts) > settings.SPORT_CACHE_TTL:
        return None
    return data


def _cache_set(key: str, data: dict):
    _cache[key] = (time.monotonic(), data)


def is_configured() -> bool:
    return bool(settings.CLEARSPORTS_API_KEY)


async def _get(path: str, params: dict | None = None, cache_key: str | None = None) -> dict:
    if not is_configured():
        raise SportProviderError("CLEARSPORTS_API_KEY не задан на сервере", 503)

    if cache_key:
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    headers = {"Authorization": f"Bearer {settings.CLEARSPORTS_API_KEY}"}
    last_err: Exception | None = None

    for attempt in range(settings.SPORT_API_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.SPORT_API_TIMEOUT) as client:
                res = await client.get(
                    f"{settings.CLEARSPORTS_BASE_URL}{path}", headers=headers, params=params or {}
                )
            if res.status_code in (401, 403):
                raise SportProviderError("clearsportsapi.com отклонил ключ или закончились credits (401/403)", 502)
            if res.status_code == 429:
                raise SportProviderError("clearsportsapi.com: превышен лимит запросов", 429, rate_limited=True)
            res.raise_for_status()
            try:
                data = res.json()
            except ValueError as e:
                raise SportProviderError(f"clearsportsapi.com вернул не-JSON ответ: {e}", 502, rate_limited=True)
            if cache_key:
                _cache_set(cache_key, data)
            return data
        except SportProviderError:
            raise
        except httpx.HTTPStatusError as e:
            raise SportProviderError(
                f"clearsportsapi.com вернул ошибку {e.response.status_code}", 502,
                rate_limited=(e.response.status_code >= 500),
            )
        except (httpx.TimeoutException, httpx.TransportError) as e:
            last_err = e
            if attempt < settings.SPORT_API_RETRIES and settings.SPORT_REQUEST_DELAY_MS:
                await asyncio.sleep(settings.SPORT_REQUEST_DELAY_MS / 1000)
            continue
        except Exception as e:  # noqa: BLE001 — последний рубеж: источник не должен уронить весь эндпоинт 500-й ошибкой
            raise SportProviderError(f"clearsportsapi.com: непредвиденная ошибка ({type(e).__name__}: {e})", 502, rate_limited=True)

    raise SportProviderError(f"Не удалось связаться с clearsportsapi.com: {last_err}", 502, rate_limited=True)


def _map_team(raw: dict, league: str | None = None) -> dict:
    venue = raw.get("venue")
    venue_dict = venue if isinstance(venue, dict) else ({"name": venue} if isinstance(venue, str) else {})
    return {
        "id": first(raw, "id", "team_id", default=f"{league}_?" if league else None),
        "name": first(raw, "name", "team_name", default="?"),
        "country": first(raw, "country"),
        "logo": first(raw, "logo", "logo_url"),
        "founded": first(raw, "founded"),
        "venue": {
            "name": first(venue_dict, "name"),
            "city": first(venue_dict, "city"),
            "capacity": first(venue_dict, "capacity"),
        } if venue_dict else {},
    }


def _map_team_ref(raw: dict) -> dict:
    return {
        "id": first(raw, "id", "team_id", "abbreviation"),
        "name": first(raw, "name", "team_name", default="?"),
        "logo": first(raw, "logo", "logo_url"),
    }


_STATUS_MAP = {
    "scheduled": "NS", "live": "LIVE", "in_progress": "LIVE",
    "final": "FT", "finished": "FT", "postponed": "PST", "cancelled": "CANC",
}


def _map_fixture(raw: dict) -> dict:
    home = raw.get("home_team") or {}
    away = raw.get("away_team") or {}
    status_raw = str(first(raw, "status", default="")).strip().lower()
    scheduled_at = first(raw, "scheduled_at", "start_time")
    timestamp = None
    if isinstance(scheduled_at, str):
        try:
            from datetime import datetime
            timestamp = int(datetime.fromisoformat(scheduled_at.replace("Z", "+00:00")).timestamp())
        except ValueError:
            timestamp = None
    return {
        "statusShort": _STATUS_MAP.get(status_raw, status_raw.upper() or "NS"),
        "elapsed": first(raw, "elapsed", "minute"),
        "timestamp": timestamp,
        "goalsHome": first(raw, "home_score", "home_points"),
        "goalsAway": first(raw, "away_score", "away_points"),
        "home": _map_team_ref(home if isinstance(home, dict) else {}),
        "away": _map_team_ref(away if isinstance(away, dict) else {}),
    }


def _league_of(team_id: str) -> str | None:
    """ClearSports ID команд — с префиксом лиги, например 'epl_ars'
    (см. примеры в доках: team_id=epl_ars, nfl_ari). Достаём лигу из префикса,
    чтобы обратиться сразу к нужному эндпоинту, а не перебирать все подряд."""
    if not team_id:
        return None
    prefix = team_id.split("_", 1)[0]
    return prefix if prefix in _LEAGUES else None


async def popular_teams() -> list[dict]:
    teams: list[dict] = []
    for league in _LEAGUES:
        try:
            data = await _get(f"/{league}/teams", cache_key=f"cs_teams:{league}")
        except SportProviderError:
            continue
        raw_teams = data.get("data") or data.get("teams") or []
        if isinstance(raw_teams, list):
            teams.extend(_map_team(t, league) for t in raw_teams[:6] if isinstance(t, dict))
        if len(teams) >= 18:
            break
    return teams[:18]


async def search_teams(query: str) -> list[dict]:
    q = query.strip().lower()
    matched: list[dict] = []
    for league in _LEAGUES:
        try:
            data = await _get(f"/{league}/teams", cache_key=f"cs_teams:{league}")
        except SportProviderError:
            continue
        raw_teams = data.get("data") or data.get("teams") or []
        if not isinstance(raw_teams, list):
            continue
        for t in raw_teams:
            if isinstance(t, dict) and q in str(first(t, "name", "team_name", default="")).lower():
                matched.append(_map_team(t, league))
        if len(matched) >= 20:
            break
    return matched[:20]


async def team_detail(team_id: str) -> dict:
    league = _league_of(team_id) or _LEAGUES[0]
    data = await _get(f"/{league}/teams/{team_id}", cache_key=f"cs_team:{team_id}")
    raw = data.get("data") if isinstance(data.get("data"), dict) else data.get("team") if isinstance(data.get("team"), dict) else data
    return _map_team(raw, league)


async def team_matches(team_id: str) -> dict:
    # /games не принимает фильтр по team_id ("returns the full set") — тянем
    # весь список игр лиги команды и фильтруем сами.
    league = _league_of(team_id) or _LEAGUES[0]
    data = await _get(f"/{league}/games", cache_key=f"cs_games:{league}")
    raw_matches = data.get("data") or data.get("games") or []
    if not isinstance(raw_matches, list):
        raw_matches = []
    own = [
        m for m in raw_matches
        if isinstance(m, dict) and team_id in (
            first(m.get("home_team") or {}, "id", "team_id"),
            first(m.get("away_team") or {}, "id", "team_id"),
        )
    ]
    mapped = [_map_fixture(m) for m in own]
    recent = [m for m in mapped if m["statusShort"] == "FT"][-5:]
    upcoming = [m for m in mapped if m["statusShort"] == "NS"][:5]
    return {"recent": recent, "upcoming": upcoming}


async def live_matches() -> list[dict]:
    live: list[dict] = []
    for league in _LEAGUES:
        try:
            data = await _get(f"/{league}/games", cache_key=f"cs_games:{league}")
        except SportProviderError:
            continue
        raw_matches = data.get("data") or data.get("games") or []
        if not isinstance(raw_matches, list):
            continue
        for m in raw_matches:
            if isinstance(m, dict) and str(first(m, "status", default="")).strip().lower() in ("live", "in_progress"):
                live.append(_map_fixture(m))
    return live
