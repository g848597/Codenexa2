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
