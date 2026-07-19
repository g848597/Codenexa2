"""Общее для всех источников данных AI Sport (footballdata.py, clearsports.py).

Единая ошибка с признаком rate_limited — по нему sport_provider.py решает,
переходить ли к следующему источнику в цепочке или сразу вернуть ошибку.
"""


class SportProviderError(Exception):
    def __init__(self, message: str, status: int = 502, rate_limited: bool = False):
        super().__init__(message)
        self.status = status
        self.rate_limited = rate_limited


def first(d: dict, *keys, default=None):
    """Первое непустое значение из нескольких вероятных названий поля —
    внешние API документированы не полностью, поэтому вместо жёсткой
    привязки к одному названию пробуем несколько кандидатов."""
    for k in keys:
        if isinstance(d, dict) and d.get(k) not in (None, ""):
            return d.get(k)
    return default


def with_winner(team_ref: dict, own_goals, opp_goals, status_short: str) -> dict:
    """Достраивает team_ref (_map_team_ref) полем "winner" — True/False/None —
    на основе счёта завершённого матча. Раньше ни footballdata.py, ни
    clearsports.py этого поля не считали вовсе, хотя фронтенд (sportApp.js,
    matchResult()) на него рассчитывает для "формы" команды — из-за этого
    кружки формы на карточке команды ВСЕГДА показывали "ничья", какой бы ни
    была реальная история встреч. Считается только по итогу отыгранного
    матча (FT/AET/PEN); для остальных статусов "winner" остаётся None, как
    и раньше."""
    winner = None
    if status_short in ("FT", "AET", "PEN") and own_goals is not None and opp_goals is not None:
        if own_goals > opp_goals:
            winner = True
        elif own_goals < opp_goals:
            winner = False
        else:
            winner = None  # ничья — считается отдельно на фронте (winner=None и без W/L)
    return {**team_ref, "winner": winner}


# --- Тарифные уровни AI Sport ------------------------------------------------
#
# Раньше весь раздел был бинарным (см. историю sport_routes.py: либо PRO —
# полный доступ, либо бесплатно — 1 матч и точка). Владелец продукта попросил
# честную лестницу тарифов: чем выше тариф, тем больше дней вперёд открыто и
# тем больше матчей в день получают реальный ИИ-прогноз (остальные матчи дня
# по-прежнему видно — считаются только сами прогнозы).
#
# "days" — на сколько дней вперёд (считая сегодня, day=0) открыт просмотр.
# "pred_min"/"pred_max" — вилка числа прогнозов в день; фактическое число —
# min(pred_max, сколько сегодня вообще есть предстоящих матчей), но не меньше
# pred_min, если матчей достаточно — так тариф не выглядит "недодачей" в тихий
# день и не рассыпает прогнозы на все 9 матчей без разбора в загруженный.
TIER_ORDER = ["free", "start", "pro", "business"]

TIER_RULES = {
    "free":     {"title": "Бесплатный", "days": 1, "pred_min": 1, "pred_max": 3},
    "start":    {"title": "Старт",      "days": 2, "pred_min": 2, "pred_max": 6},
    "pro":      {"title": "Про",        "days": 3, "pred_min": 3, "pred_max": 9},
    "business": {"title": "Бизнес",     "days": 4, "pred_min": 4, "pred_max": 12},
}


def tier_from_plan_code(plan_code: str | None) -> str:
    """Тариф по коду оплаченного плана (payments.plan / plans.code).
    Коды тарифов ожидаются вида "<tier>_monthly"/"<tier>_yearly" и т.п.
    (см. scripts/seed_new_sport_plans.py) — берём префикс до первого "_".
    Существующие "pro_monthly"/"pro_yearly" (см. db.py: _DEFAULT_PLANS)
    попадают в tier "pro" без каких-либо миграций — обратная совместимость
    сохранена. Нераспознанный/будущий код тарифа безопаснее всего трактовать
    как "pro" (уже оплаченная подписка не должна тихо превращаться в free
    из-за опечатки в code), а не как free."""
    if not plan_code:
        return "free"
    prefix = str(plan_code).lower().split("_", 1)[0]
    if prefix in TIER_RULES:
        return prefix
    return "pro"


def tier_rule(tier: str) -> dict:
    return TIER_RULES.get(tier, TIER_RULES["free"])
