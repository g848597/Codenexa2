"""Опциональный Redis-клиент для состояния, которое раньше жило только в
памяти процесса (rate-limit на /auth/*, аудит раздел 3 и раздел "Высокий
приоритет").

Без REDIS_URL поведение не меняется: get_redis() возвращает None, и вызывающий
код (см. app/web/api/auth.py) сам падает обратно на in-memory реализацию —
как и раньше, этого достаточно для одного воркера/локальной разработки.
С заданным REDIS_URL то же состояние становится общим для всех воркеров и
переживает рестарт процесса.

Если Redis сконфигурирован, но временно недоступен (упал, сеть моргнула),
мы не роняем запрос 500-й ошибкой — логируем предупреждение и используем
in-memory фолбэк на этот конкретный вызов, ровно как если бы REDIS_URL не
был задан вовсе.
"""
import logging

from app.web.config import settings

logger = logging.getLogger("codenexa.cache")

try:
    import redis
except ImportError:  # пакет не установлен — работаем как без REDIS_URL
    redis = None

_client = None
_client_init_attempted = False


def get_redis():
    """Возвращает живой redis-клиент или None (не сконфигурирован/недоступен).

    Клиент создаётся один раз и переиспользуется (redis-py сам управляет
    пулом соединений). Если создание клиента или пинг падают — не бросаем
    исключение наружу, чтобы вызывающий код мог тихо уйти на фолбэк.
    """
    global _client, _client_init_attempted

    if not settings.REDIS_URL or redis is None:
        return None

    if _client is None and not _client_init_attempted:
        _client_init_attempted = True
        try:
            _client = redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=1,
                socket_timeout=1,
            )
            _client.ping()
        except Exception as exc:  # noqa: BLE001 — любая ошибка = нет Redis
            logger.warning("Redis недоступен (%s) — использую in-memory фолбэк", exc)
            _client = None

    return _client


def reset_for_tests():
    """Только для тестов: сбросить закешированный клиент, чтобы можно было
    переиспользовать модуль между тестами с разным REDIS_URL/состоянием."""
    global _client, _client_init_attempted
    _client = None
    _client_init_attempted = False
