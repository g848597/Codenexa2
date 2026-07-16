"""Клиент ClearSports API (https://www.clearsportsapi.com/) — второй источник
в цепочке AI Sport (см. sport_provider.py), подключается автоматически, когда
footballdata.io исчерпал лимит или недоступен.

ВАЖНО про надёжность этого файла: у ClearSports в открытом доступе
задокументирован только пример для NBA (`/v1/nba/games?date=today`,
поля home_team/away_team/status/venue). Публичной документации по разделу
Soccer на момент написания найти не удалось (сайт не отдаёт её ботам) —
поэтому пути ниже (`/v1/soccer/...`) выбраны по аналогии с NBA-примером, а
не проверены напрямую. Если реальные пути/поля отличаются, этот провайдер
будет просто падать с ошибкой на каждый вызов — sport_provider.py в этом
случае продолжит использовать footballdata.io (если тот ещё не исчерпал
лимит) и ни на что не повлияет для пользователя. Если увидите в логах
Railway ошибки от clearsports.py — пришлите их, поправим пути/поля по факту.
"""
import asyncio
import time

import httpx

from app.web.config import settings
from app.web.integrations.sport_common import SportProviderError, first

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
                raise SportProviderError("clearsportsapi.com отклонил ключ (401/403)", 502)
            if res.status_code == 429:
                raise SportProviderError("clearsportsapi.com: превышен лимит запросов", 429, rate_limited=True)
            res.raise_for_status()
            data = res.json()
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

    raise SportProviderError(f"Не удалось связаться с clearsportsapi.com: {last_err}", 502, rate_limited=True)


def _map_team(raw: dict) -> dict:
    venue = raw.get("venue")
    venue_dict = venue if isinstance(venue, dict) else ({"name": venue} if isinstance(venue, str) else {})
    return {
        "id": first(raw, "id", "team_id"),
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


async def popular_teams() -> list[dict]:
    data = await _get("/soccer/teams", cache_key="cs_teams")
    raw_teams = data.get("data") or data.get("teams") or []
    return [_map_team(t) for t in raw_teams[:18] if isinstance(t, dict)]


async def search_teams(query: str) -> list[dict]:
    # Явного поиска по названию в примерах ClearSports не встречалось —
    # берём общий список и фильтруем по подстроке на нашей стороне.
    data = await _get("/soccer/teams", cache_key="cs_teams")
    raw_teams = data.get("data") or data.get("teams") or []
    q = query.strip().lower()
    matched = [t for t in raw_teams if isinstance(t, dict) and q in str(first(t, "name", "team_name", default="")).lower()]
    return [_map_team(t) for t in matched[:20]]


async def team_detail(team_id: str) -> dict:
    data = await _get(f"/soccer/teams/{team_id}", cache_key=f"cs_team:{team_id}")
    raw = data.get("data") if isinstance(data.get("data"), dict) else data.get("team") if isinstance(data.get("team"), dict) else data
    return _map_team(raw)


async def team_matches(team_id: str) -> dict:
    data = await _get("/soccer/games", params={"team_id": team_id}, cache_key=f"cs_team_matches:{team_id}")
    raw_matches = data.get("data") or data.get("games") or []
    mapped = [_map_fixture(m) for m in raw_matches if isinstance(m, dict)]
    recent = [m for m in mapped if m["statusShort"] == "FT"][-5:]
    upcoming = [m for m in mapped if m["statusShort"] == "NS"][:5]
    return {"recent": recent, "upcoming": upcoming}


async def live_matches() -> list[dict]:
    data = await _get("/soccer/games", params={"status": "live"})
    raw_matches = data.get("data") or data.get("games") or []
    return [_map_fixture(m) for m in raw_matches if isinstance(m, dict)]
