"""Раунд 4 (см. аудит, раздел 2, "Где можно ускорить" и раздел 13, п.9.14):
is_session_valid() теперь опционально кэшируется в Redis (TTL 90 сек), а
revoke_session()/revoke_all_sessions() инвалидируют кэш немедленно, а не
ждут протухания TTL. Без REDIS_URL поведение не меняется — прямой SELECT на
каждый вызов, это покрыто остальными тестами (test_auth.py и т.д.), которые
все гоняются без Redis по умолчанию.

Эти тесты требуют реального Redis по адресу REDIS_URL (по умолчанию
redis://localhost:6379/1 — отдельная БД от продовой/дев, на всякий случай) —
если он недоступен в окружении, тесты пропускаются."""
import pytest

from app.web import repo
from app.web.cache import get_redis, reset_for_tests
from app.web.config import settings

REDIS_URL = "redis://localhost:6379/1"


@pytest.fixture()
def redis_enabled(monkeypatch):
    monkeypatch.setattr(settings, "REDIS_URL", REDIS_URL)
    reset_for_tests()
    r = get_redis()
    if r is None:
        pytest.skip("Redis недоступен в этом окружении")
    r.flushdb()
    yield r
    reset_for_tests()


def _register_and_login(client, email="fiona@example.com", password="correct-horse-1"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.json()


def test_session_valid_is_cached_in_redis(client, redis_enabled):
    body = _register_and_login(client)
    token = body["token"]

    from app.web import security
    decoded = security.decode_session_token(token)
    token_id = decoded["jti"]

    assert repo.is_session_valid(token_id) is True
    cached = redis_enabled.get(repo._session_cache_key(token_id))
    assert cached == "1"


def test_revoke_session_invalidates_cache_immediately(client, redis_enabled):
    body = _register_and_login(client)
    token = body["token"]
    headers = {"Authorization": f"Bearer {token}"}

    from app.web import security
    decoded = security.decode_session_token(token)
    token_id = decoded["jti"]

    # Прогреваем кэш положительным результатом (TTL 90 сек).
    assert repo.is_session_valid(token_id) is True

    sessions = client.get("/api/auth/sessions", headers=headers).json()["sessions"]
    session_row_id = next(s["id"] for s in sessions if s["token_id"] == token_id)

    res = client.post(f"/api/auth/sessions/{session_row_id}/revoke", headers=headers)
    assert res.status_code == 200

    # Без активной инвалидации кэш ещё 90 сек считал бы сессию валидной.
    assert repo.is_session_valid(token_id) is False


def test_revoke_all_sessions_invalidates_cache_immediately(client, redis_enabled):
    email, password = "gina@example.com", "correct-horse-1"
    client.post("/api/auth/register", json={"email": email, "password": password})

    from app.web import security

    # Первая "сессия" (например, другое устройство) — именно её и должен
    # отозвать revoke-all, вызванный из второй сессии (текущая исключается
    # по дизайну, см. auth.py::revoke_all).
    first_login = client.post("/api/auth/login", json={"email": email, "password": password}).json()
    first_token_id = security.decode_session_token(first_login["token"])["jti"]
    assert repo.is_session_valid(first_token_id) is True

    second_login = client.post("/api/auth/login", json={"email": email, "password": password}).json()
    second_headers = {"Authorization": f"Bearer {second_login['token']}"}

    res = client.post("/api/auth/sessions/revoke-all", headers=second_headers)
    assert res.status_code == 200

    # Без активной инвалидации кэш ещё 90 сек считал бы первую сессию валидной.
    assert repo.is_session_valid(first_token_id) is False
