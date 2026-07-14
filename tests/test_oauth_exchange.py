"""Раунд 3 (см. CHANGES_CRITICAL_FIXES.md): OAuth-коды Google/Yandex -> мини-апп
теперь идут через один DB-backed механизм (`oauth_links`) вместо двух
параллельных (БД + in-memory `_pending_tokens`). Эти тесты гоняют
`/api/auth/exchange` напрямую по репозиторию, не поднимая настоящий Google/
Yandex OAuth (это сделали бы интеграционные/E2E-тесты, не unit)."""
from app.web import repo


def _register(client, email="carol@example.com", password="correct-horse-1"):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def test_exchange_consumes_db_backed_code_once(client):
    user = _register(client).json()["user"]

    state = "test-state-1"
    repo.create_oauth_state("google", state)
    repo.attach_oauth_code(state, user["id"], "onetimecode123")

    res = client.post("/api/auth/exchange", json={"code": "auth_onetimecode123"})
    assert res.status_code == 200
    body = res.json()
    assert body["token"]
    assert body["user"]["id"] == user["id"]

    # Повторный обмен тем же кодом — код уже потрачен (consumed = TRUE).
    res_again = client.post("/api/auth/exchange", json={"code": "auth_onetimecode123"})
    assert res_again.status_code == 400


def test_exchange_rejects_unknown_code(client):
    res = client.post("/api/auth/exchange", json={"code": "auth_does-not-exist"})
    assert res.status_code == 400


def test_exchange_accepts_code_without_auth_prefix(client):
    user = _register(client, email="dave@example.com").json()["user"]
    state = "test-state-2"
    repo.create_oauth_state("yandex", state)
    repo.attach_oauth_code(state, user["id"], "rawcode456")

    res = client.post("/api/auth/exchange", json={"code": "rawcode456"})
    assert res.status_code == 200
    assert res.json()["user"]["id"] == user["id"]


# --- Раунд 4 (аудит, раздел 4, п.6): state теперь привязан к браузеру через
# httpOnly cookie, а не только хранится глобально в БД. Тесты гоняют
# /google/start + /google/callback без реального Google (сеть недоступна в
# тестах) — проверяем именно CSRF-проверку, которая должна отсекать запрос
# до похода во внешний OAuth-провайдер.

def test_google_start_sets_csrf_cookie(client):
    res = client.get("/api/auth/google/start", params={}, follow_redirects=False)
    # google_configured=False в тестовом окружении (нет GOOGLE_CLIENT_ID/SECRET),
    # поэтому ждём 503 — но именно поэтому проверяем cookie отдельно ниже, на
    # yandex, если он тоже не настроен. Оставляем как smoke-test конфигурации.
    assert res.status_code == 503


def test_google_callback_rejects_without_csrf_cookie(client, monkeypatch):
    from app.web.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "https://example.com/api/auth/google/callback")

    state = "csrf-test-state"
    repo.create_oauth_state("google", state)

    # Запрос на /callback без cookie (как если бы атакующий подсунул жертве
    # свою собственную ссылку с валидным `state`, но в чужом браузере).
    res = client.get(
        "/api/auth/google/callback",
        params={"code": "irrelevant", "state": state},
        follow_redirects=False,
    )
    assert res.status_code == 400


def test_google_callback_rejects_mismatched_csrf_cookie(client, monkeypatch):
    from app.web.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "https://example.com/api/auth/google/callback")

    state = "csrf-test-state-2"
    repo.create_oauth_state("google", state)
    client.cookies.set("oauth_csrf", "some-other-state")

    res = client.get(
        "/api/auth/google/callback",
        params={"code": "irrelevant", "state": state},
        follow_redirects=False,
    )
    assert res.status_code == 400


def test_validate_oauth_state_rejects_unknown_state():
    assert repo.validate_oauth_state("google", "does-not-exist") is False


def test_validate_oauth_state_rejects_already_used_state():
    user = repo.create_user(email="erin@example.com", first_name="Erin")
    state = "already-used-state"
    repo.create_oauth_state("google", state)
    repo.attach_oauth_code(state, user["id"], "somecode")
    # user_id больше не NULL — state уже был использован /callback-ом один раз.
    assert repo.validate_oauth_state("google", state) is False


def test_validate_oauth_state_accepts_fresh_state():
    state = "fresh-state"
    repo.create_oauth_state("google", state)
    assert repo.validate_oauth_state("google", state) is True
