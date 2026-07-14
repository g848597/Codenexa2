import pyotp


def _register(client, email="alice@example.com", password="correct-horse-1"):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def test_register_returns_token_and_user(client):
    res = _register(client)
    assert res.status_code == 200
    body = res.json()
    assert body["token"]
    assert body["user"]["email"] == "alice@example.com"
    assert body["user"]["twoFaEnabled"] is False


def test_register_rejects_weak_password(client):
    res = _register(client, password="short")
    assert res.status_code == 422


def test_register_rejects_duplicate_email(client):
    _register(client)
    res = _register(client)
    assert res.status_code == 409


def test_login_wrong_password_rejected(client):
    _register(client)
    res = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrong-password"})
    assert res.status_code == 401


def test_login_correct_password_succeeds(client):
    _register(client)
    res = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "correct-horse-1"})
    assert res.status_code == 200
    assert res.json()["token"]


def test_me_requires_auth(client):
    res = client.get("/api/auth/me")
    assert res.status_code in (401, 403)


def test_me_returns_current_user(client):
    token = _register(client).json()["token"]
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["user"]["email"] == "alice@example.com"


def test_login_rate_limited_after_too_many_attempts(client):
    _register(client)
    for _ in range(8):
        client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrong-password"})
    res = client.post("/api/auth/login", json={"email": "alice@example.com", "password": "wrong-password"})
    assert res.status_code == 429


# ---------- 2FA (TOTP) ----------

def test_2fa_full_flow(client):
    token = _register(client).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    setup_res = client.post("/api/auth/2fa/setup", headers=headers)
    assert setup_res.status_code == 200
    secret = setup_res.json()["secret"]

    code = pyotp.TOTP(secret).now()
    confirm_res = client.post("/api/auth/2fa/confirm", json={"code": code}, headers=headers)
    assert confirm_res.status_code == 200

    # После включения 2FA логин без кода должен требовать его явно.
    res_no_code = client.post(
        "/api/auth/login", json={"email": "alice@example.com", "password": "correct-horse-1"}
    )
    assert res_no_code.status_code == 401
    assert res_no_code.headers.get("x-requires-2fa") == "1"

    fresh_code = pyotp.TOTP(secret).now()
    res_with_code = client.post(
        "/api/auth/login",
        json={"email": "alice@example.com", "password": "correct-horse-1", "totpCode": fresh_code},
    )
    assert res_with_code.status_code == 200


def test_2fa_confirm_rejects_wrong_code(client):
    token = _register(client).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    client.post("/api/auth/2fa/setup", headers=headers)
    res = client.post("/api/auth/2fa/confirm", json={"code": "000000"}, headers=headers)
    assert res.status_code == 401


def test_logout_revokes_session(client):
    token = _register(client).json()["token"]
    headers = {"Authorization": f"Bearer {token}"}
    res = client.post("/api/auth/logout", headers=headers)
    assert res.status_code == 200
    # Сессия отозвана — повторный /me с тем же токеном должен отвалиться.
    res_me = client.get("/api/auth/me", headers=headers)
    assert res_me.status_code in (401, 403)
