"""Клиент Footballdata.io (https://footballdata.io/documentation/) для AI
Sport (см. app/web/api/sport_routes.py, webapp/src/config/sportApi.js).

Этот файл раньше отсутствовал в проекте вообще — фронтенд (sportApi.js)
десятки раундов подряд стучался в /api/sport/*, а на сервере не было ни
одного обработчика, поэтому раздел всегда отвечал 404 (см. историю чата:
пользователь подключил ключи в Railway, но 404 никуда не делся, пока не
появился именно этот файл + sport_routes.py).

Свободный тариф footballdata.io — 5 лиг, 2000 запросов/месяц. Официальный
список путей задокументирован (endpoints/), но страницы с точной схемой
полей ответа (teams/, matches/) на момент написания не отдавались ботам —
поэтому парсинг ниже сделан defensively: пробуем несколько вероятных
названий на каждое поле (_first()) и просто не показываем то, чего нет,
вместо падения. Если реальные названия полей окажутся другими — компонент
sportApp.js уже написан честно (см. crestHTML/venue-карточка): недостающее
поле там просто не рендерится, а не ломает экран.
"""
import asyncio
import time

import httpx

from app.web.config import settings
from app.web.integrations.sport_common import SportProviderError, first as _first

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
    return bool(settings.FOOTBALLDATA_API_KEY)


async def _get(path: str, params: dict | None = None, cache_key: str | None = None) -> dict:
    if not is_configured():
        raise SportProviderError("FOOTBALLDATA_API_KEY не задан на сервере", 503)

    if cache_key:
        cached = _cache_get(cache_key)
        if cached is not None:
            return cached

    headers = {"Authorization": f"Bearer {settings.FOOTBALLDATA_API_KEY}"}
    last_err: Exception | None = None

    for attempt in range(settings.SPORT_API_RETRIES + 1):
        try:
            async with httpx.AsyncClient(timeout=settings.SPORT_API_TIMEOUT) as client:
                res = await client.get(
                    f"{settings.FOOTBALLDATA_BASE_URL}{path}", headers=headers, params=params or {}
                )
            if res.status_code in (401, 403):
                raise SportProviderError("footballdata.io отклонил ключ (401/403)", 502)
            if res.status_code == 429:
                raise SportProviderError("footballdata.io: превышен лимит запросов", 429, rate_limited=True)
            res.raise_for_status()
            data = res.json()
            if cache_key:
                _cache_set(cache_key, data)
            return data
        except SportProviderError:
            raise
        except httpx.HTTPStatusError as e:
            raise SportProviderError(f"footballdata.io вернул ошибку {e.response.status_code}", 502, rate_limited=(e.response.status_code >= 500))
        except (httpx.TimeoutException, httpx.TransportError) as e:
            last_err = e
            if attempt < settings.SPORT_API_RETRIES and settings.SPORT_REQUEST_DELAY_MS:
                await asyncio.sleep(settings.SPORT_REQUEST_DELAY_MS / 1000)
            continue

    raise SportProviderError(f"Не удалось связаться с footballdata.io: {last_err}", 502, rate_limited=True)


def _map_venue(raw) -> dict:
    if not isinstance(raw, dict) or not raw:
        return {}
    return {
        "name": _first(raw, "name", "stadium_name", "venue_name"),
        "city": _first(raw, "city"),
        "capacity": _first(raw, "capacity"),
    }


def _map_team(raw: dict) -> dict:
    venue = raw.get("venue") or raw.get("stadium") or {}
    return {
        "id": _first(raw, "id", "team_id"),
        "name": _first(raw, "name", "team_name", default="?"),
        "country": _first(raw, "country", "country_name"),
        "logo": _first(raw, "logo", "logo_url", "crest", "crest_url"),
        "founded": _first(raw, "founded", "founded_year"),
        "venue": _map_venue(venue),
    }


def _map_team_ref(raw: dict) -> dict:
    return {
        "id": _first(raw, "id", "team_id"),
        "name": _first(raw, "name", "team_name", default="?"),
        "logo": _first(raw, "logo", "logo_url", "crest", "crest_url"),
    }


_STATUS_MAP = {
    "live": "LIVE", "in_play": "LIVE", "inplay": "LIVE",
    "1h": "1H", "first_half": "1H",
    "2h": "2H", "second_half": "2H",
    "ht": "HT", "half_time": "HT",
    "et": "ET", "extra_time": "ET",
    "pen": "P", "penalties": "P",
    "finished": "FT", "complete": "FT", "completed": "FT", "ft": "FT",
    "scheduled": "NS", "not_started": "NS", "upcoming": "NS",
    "postponed": "PST", "cancelled": "CANC",
}


def _map_fixture(raw: dict) -> dict:
    home = raw.get("home_team") or raw.get("home") or {}
    away = raw.get("away_team") or raw.get("away") or {}
    score = raw.get("score") if isinstance(raw.get("score"), dict) else {}
    status_raw = str(_first(raw, "status", "status_short", default="")).strip().lower()
    return {
        "statusShort": _STATUS_MAP.get(status_raw, status_raw.upper() or "NS"),
        "elapsed": _first(raw, "elapsed", "minute"),
        "timestamp": _first(raw, "timestamp", "kickoff_timestamp", "start_timestamp"),
        "goalsHome": _first(score, "home") if score else _first(raw, "goals_home", "home_score", "home_goals"),
        "goalsAway": _first(score, "away") if score else _first(raw, "goals_away", "away_score", "away_goals"),
        "home": _map_team_ref(home if isinstance(home, dict) else {}),
        "away": _map_team_ref(away if isinstance(away, dict) else {}),
    }


# Бесплатный тариф покрывает только 5 лиг — берём команды первых нескольких
# доступных лиг как "популярные" (у footballdata.io нет отдельного понятия
# "популярные команды").
async def popular_teams() -> list[dict]:
    data = await _get("/leagues", cache_key="leagues")
    leagues = data.get("data") or data.get("leagues") or []
    teams: list[dict] = []
    for lg in leagues[:3]:
        lid = _first(lg, "id", "league_id")
        if lid is None:
            continue
        try:
            td = await _get(f"/leagues/{lid}/teams", cache_key=f"league_teams:{lid}")
        except SportProviderError:
            continue
        raw_teams = td.get("data") or td.get("teams") or []
        teams.extend(_map_team(t) for t in raw_teams[:8] if isinstance(t, dict))
        if len(teams) >= 18:
            break
    return teams[:18]


async def search_teams(query: str) -> list[dict]:
    data = await _get("/teams", params={"q": query})
    raw_teams = data.get("data") or data.get("teams") or []
    return [_map_team(t) for t in raw_teams[:20] if isinstance(t, dict)]


async def team_detail(team_id: str) -> dict:
    data = await _get(f"/teams/{team_id}", cache_key=f"team:{team_id}")
    raw = data.get("data") if isinstance(data.get("data"), dict) else data.get("team") if isinstance(data.get("team"), dict) else data
    return _map_team(raw)


async def team_matches(team_id: str) -> dict:
    data = await _get(f"/teams/{team_id}/matches", cache_key=f"team_matches:{team_id}")
    raw_matches = data.get("data") or data.get("matches") or []
    mapped = [_map_fixture(m) for m in raw_matches if isinstance(m, dict)]
    recent = [m for m in mapped if m["statusShort"] == "FT"][-5:]
    upcoming = [m for m in mapped if m["statusShort"] == "NS"][:5]
    return {"recent": recent, "upcoming": upcoming}


async def live_matches() -> list[dict]:
    data = await _get("/fixtures/live")
    raw_matches = data.get("data") or data.get("matches") or []
    return [_map_fixture(m) for m in raw_matches if isinstance(m, dict)]
