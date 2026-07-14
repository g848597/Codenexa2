"""В CI REDIS_URL задан (см. .github/workflows/ci.yml), поэтому
`test_login_rate_limited_after_too_many_attempts` в test_auth.py уже гоняет
rate-limit через настоящий Redis. Этот файл отдельно проверяет два фолбэка,
которые тем самым не покрыты: REDIS_URL не задан вовсе, и Redis задан, но
недоступен (например упал/сеть моргнула) — в обоих случаях логин не должен
падать 500-й, а rate-limit должен продолжать работать через память процесса."""
from app.web.api import auth as auth_module


def _register(client, email="erin@example.com", password="correct-horse-1"):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def test_rate_limit_falls_back_to_memory_when_no_redis(client, monkeypatch):
    monkeypatch.setattr("app.web.api.auth.get_redis", lambda: None)
    _register(client)
    for _ in range(8):
        client.post("/api/auth/login", json={"email": "erin@example.com", "password": "wrong-password"})
    res = client.post("/api/auth/login", json={"email": "erin@example.com", "password": "wrong-password"})
    assert res.status_code == 429


class _BrokenRedis:
    """Симулирует Redis, который сконфигурирован (REDIS_URL задан), но
    недоступен в момент запроса — INCR кидает исключение."""

    def incr(self, key):
        raise ConnectionError("redis is down")


def test_rate_limit_falls_back_to_memory_when_redis_errors(client, monkeypatch):
    monkeypatch.setattr("app.web.api.auth.get_redis", lambda: _BrokenRedis())
    _register(client, email="frank@example.com")
    for _ in range(8):
        client.post("/api/auth/login", json={"email": "frank@example.com", "password": "wrong-password"})
    res = client.post("/api/auth/login", json={"email": "frank@example.com", "password": "wrong-password"})
    assert res.status_code == 429
    # Убедимся, что фолбэк реально писал в память процесса, а не тихо терял попытки.
    assert any(k.startswith("login:frank@example.com") for k in auth_module._attempts)
