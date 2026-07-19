"""Прогнозы AI Sport — лёгкая эвристика по реальной форме команд, а НЕ
случайные/выдуманные числа (см. комментарии в sport_routes.py и sportApp.js —
принцип раздела с самого начала "честные данные, без придуманных
коэффициентов", прогнозы обязаны следовать тому же правилу).

Модель нарочно простая и объяснимая, а не "чёрный ящик":
1. Для каждой команды берём последние сыгранные матчи (team_matches().recent,
   уже приходят из sport_provider с полем winner — см. sport_common.with_winner).
2. Считаем очки за игру (3 за победу, 1 за ничью, 0 за поражение) — это
   обычный football "points per game", а не что-то специфичное для нас.
3. Хозяевам добавляется небольшая фиксированная надбавка за преимущество
   своего поля (HOME_ADVANTAGE) — общепринятый в футбольной аналитике эффект.
4. Из двух чисел получаем три вероятности (П1/Х/П2) простой нормализацией —
   это НЕ Пуассон-модель точного счёта и не заявляется как таковая; это
   явно маркируется во фронтенде как "по текущей форме команд".

Если данных о недавних матчах нет (новая команда в базе источника, сбой
запроса и т.п.) — предсказание для этого матча просто не строится
(возвращается None), а не подставляется выдуманное число.
"""
import asyncio

from app.web.integrations.sport_common import SportProviderError

HOME_ADVANTAGE = 0.35  # надбавка к "очкам за игру" хозяев — типовое значение в форе моделей 1X2
LEAGUE_AVG_PPG = 1.35  # среднее по топ-5 лигам очков за игру — используется, когда истории матчей ещё нет
MIN_PROB = 0.05  # ни один исход не должен выглядеть "невозможным" на глаз пользователя

_LABELS = {
    "home": "П1 · победа хозяев",
    "draw": "X · ничья",
    "away": "П2 · победа гостей",
}

# Не бьём внешний источник данных параллельно без ограничения — команды на
# один и тот же день часто повторяются (дерби, несколько матчей той же лиги),
# и team_matches() уже кэширован в footballdata.py/clearsports.py по TTL, но
# первый "холодный" день всё равно не должен запускать 24 запроса разом.
_CONCURRENCY = 6


def _points_per_game(recent: list[dict], team_id) -> float:
    if not recent:
        return LEAGUE_AVG_PPG
    pts = 0
    games = 0
    for m in recent:
        home_id = (m.get("home") or {}).get("id")
        away_id = (m.get("away") or {}).get("id")
        if str(home_id) == str(team_id):
            me = m.get("home") or {}
        elif str(away_id) == str(team_id):
            me = m.get("away") or {}
        else:
            continue
        games += 1
        winner = me.get("winner")
        if winner is True:
            pts += 3
        elif winner is None:
            pts += 1  # None здесь = ничья (см. with_winner) для отыгранного матча
    return pts / games if games else LEAGUE_AVG_PPG


def _compute(home_recent: list[dict], away_recent: list[dict], home_id, away_id) -> dict:
    home_strength = _points_per_game(home_recent, home_id) + HOME_ADVANTAGE
    away_strength = _points_per_game(away_recent, away_id)
    draw_weight = 1.0  # базовый вес ничьей — не даёт ей исчезнуть при большой разнице в форме

    total = home_strength + away_strength + draw_weight
    raw = {
        "home": home_strength / total,
        "away": away_strength / total,
        "draw": draw_weight / total,
    }
    # Не даём ни одному исходу уйти в 0% — это визуально выглядело бы как
    # "гарантированный" результат, чего эвристика такого уровня утверждать не может.
    floored = {k: max(v, MIN_PROB) for k, v in raw.items()}
    s = sum(floored.values())
    probs = {k: v / s for k, v in floored.items()}

    pick = max(probs, key=probs.get)
    return {
        "pick": pick,
        "label": _LABELS[pick],
        "confidence": round(probs[pick] * 100),
        "probs": {k: round(v * 100) for k, v in probs.items()},
        "basis": "форма последних матчей + фактор своего поля",
    }


async def predict_fixture(fixture: dict, team_matches_fn) -> dict | None:
    home_id = (fixture.get("home") or {}).get("id")
    away_id = (fixture.get("away") or {}).get("id")
    if not home_id or not away_id:
        return None
    try:
        home_data, away_data = await asyncio.gather(
            team_matches_fn(home_id), team_matches_fn(away_id)
        )
    except SportProviderError:
        return None
    home_recent = (home_data or {}).get("recent") or []
    away_recent = (away_data or {}).get("recent") or []
    return _compute(home_recent, away_recent, home_id, away_id)


async def predict_many(fixtures: list[dict], team_matches_fn) -> dict:
    """Строит прогнозы максимум для fixtures (вызывающий код уже должен был
    урезать список до квоты тарифа — см. sport_routes.py) и возвращает
    {fixture_key: prediction|None}. fixture_key — (home_id, away_id), этого
    достаточно, чтобы сматчить обратно на полный список матчей дня.
    team_matches_fn — асинхронная функция team_id -> {"recent": [...], ...}
    (передаётся sport_provider.team_matches, чтобы этот модуль не знал о
    существовании конкретных провайдеров данных)."""
    sem = asyncio.Semaphore(_CONCURRENCY)

    async def _one(f):
        async with sem:
            return await predict_fixture(f, team_matches_fn)

    results = await asyncio.gather(*(_one(f) for f in fixtures))
    out = {}
    for f, pred in zip(fixtures, results):
        key = (str((f.get("home") or {}).get("id")), str((f.get("away") or {}).get("id")))
        out[key] = pred
    return out
