"""Очередь источников данных AI Sport.

Пробует провайдеров по порядку из списка PROVIDERS: сначала footballdata.io,
при ошибке (лимит запросов, недоступность, отклонённый ключ) — переходит к
следующему (сейчас — clearsportsapi.com). Возвращает первый успешный
результат; если все источники отказали — пробрасывает последнюю ошибку.

Чтобы добавить третий источник в будущем: написать модуль с тем же
контрактом (is_configured, popular_teams, search_teams, team_detail,
team_matches, live_matches — все async, кроме is_configured), импортировать
его здесь и дописать в конец списка PROVIDERS. Порядок в списке = порядок
использования.
"""
from app.web.integrations import clearsports, footballdata, predictions
from app.web.integrations.sport_common import SportProviderError

PROVIDERS = [footballdata, clearsports]


def is_configured() -> bool:
    return any(p.is_configured() for p in PROVIDERS)


def _configured_providers():
    return [p for p in PROVIDERS if p.is_configured()]


async def _call(method_name: str, *args, **kwargs):
    providers = _configured_providers()
    if not providers:
        return None

    errors: list[str] = []
    for provider in providers:
        try:
            method = getattr(provider, method_name)
            return await method(*args, **kwargs)
        except SportProviderError as e:
            errors.append(f"{provider.__name__.rsplit('.', 1)[-1]}: {e}")
            continue  # следующий источник в очереди
        except Exception as e:  # noqa: BLE001 — баг в разборе одного источника не должен ронять весь эндпоинт
            errors.append(f"{provider.__name__.rsplit('.', 1)[-1]}: непредвиденная ошибка ({type(e).__name__}: {e})")
            continue

    raise SportProviderError("Все источники недоступны — " + "; ".join(errors), 502, rate_limited=True)


async def popular_teams() -> list[dict]:
    result = await _call("popular_teams")
    return result or []


async def search_teams(query: str) -> list[dict]:
    result = await _call("search_teams", query)
    return result or []


async def team_detail(team_id: str) -> dict:
    result = await _call("team_detail", team_id)
    if result is None:
        raise SportProviderError("Ни один источник данных не настроен", 503)
    return result


async def team_matches(team_id: str) -> dict:
    result = await _call("team_matches", team_id)
    return result or {"recent": [], "upcoming": []}


async def live_matches() -> list[dict]:
    result = await _call("live_matches")
    return result or []


async def matches_by_date(date_str: str) -> list[dict]:
    result = await _call("matches_by_date", date_str)
    return result or []


async def predict_matches(fixtures: list[dict]) -> dict:
    """Прогнозы (см. predictions.py) для переданного списка матчей — вызывающий
    код (sport_routes.py) сам решает, сколько матчей входит в квоту тарифа и
    передаёт сюда только их, а не весь день целиком."""
    if not fixtures:
        return {}
    return await predictions.predict_many(fixtures, team_matches)
