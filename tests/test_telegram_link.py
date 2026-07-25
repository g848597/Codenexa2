"""Привязка Telegram к уже вошедшему аккаунту (email/Google/Яндекс) — см.
app/web/api/auth.py: /telegram/link, /telegram/dismiss-prompt. Показывается
как мини-баннер на фронтенде после регистрации/входа любым способом, пока
у пользователя нет telegram_id и он явно не нажал "Не показывать больше".
"""
import hashlib
import hmac
import json

from app.web import repo
from app.web.config import settings


def _sign_init_data(user: dict, bot_token: str | None = None) -> str:
    """Та же схема подписи, что и в tests/test_round8_referrals.py /
    app/web/api/telegram_auth.py."""
    bot_token = bot_token or settings.TELEGRAM_BOT_TOKEN
    pairs = {"user": json.dumps(user), "auth_date": "9999999999"}
    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs.keys()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    pairs["hash"] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return "&".join(f"{k}={v}" for k, v in pairs.items())


def _register(client, email="alice@example.com", password="correct-horse-1"):
    return client.post("/api/auth/register", json={"email": email, "password": password})


def test_new_email_user_has_telegram_prompt_visible(client):
    res = _register(client)
    user = res.json()["user"]
    assert user["hasTelegram"] is False
    assert user["telegramPromptDismissed"] is False


def test_link_telegram_to_email_account(client):
    token = _register(client, email="bob@example.com").json()["token"]
    init_data = _sign_init_data({"id": 700001, "first_name": "Bob"})

    res = client.post(
        "/api/auth/telegram/link",
        json={"initData": init_data},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    body = res.json()["user"]
    assert body["hasTelegram"] is True

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["user"]["hasTelegram"] is True


def test_link_telegram_requires_auth(client):
    init_data = _sign_init_data({"id": 700002, "first_name": "Nobody"})
    res = client.post("/api/auth/telegram/link", json={"initData": init_data})
    assert res.status_code in (401, 403)


def test_link_telegram_rejects_bad_signature(client):
    token = _register(client, email="carol@example.com").json()["token"]
    res = client.post(
        "/api/auth/telegram/link",
        json={"initData": "user=%7B%22id%22%3A1%7D&auth_date=1&hash=deadbeef"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 401


def test_link_telegram_rejects_id_already_taken(client):
    # Кто-то уже вошёл этим telegram_id напрямую (обычный /telegram логин).
    other_init_data = _sign_init_data({"id": 700003, "first_name": "Other"})
    client.post("/api/auth/telegram", json={"initData": other_init_data})

    token = _register(client, email="dave@example.com").json()["token"]
    res = client.post(
        "/api/auth/telegram/link",
        json={"initData": other_init_data},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 409


def test_link_telegram_idempotent_for_same_account(client):
    """Повторная привязка того же Telegram к тому же аккаунту (например,
    двойной клик по кнопке) не должна падать с 409 против самого себя."""
    token = _register(client, email="erin@example.com").json()["token"]
    init_data = _sign_init_data({"id": 700004, "first_name": "Erin"})

    first = client.post(
        "/api/auth/telegram/link",
        json={"initData": init_data},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert first.status_code == 200

    second = client.post(
        "/api/auth/telegram/link",
        json={"initData": init_data},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert second.status_code == 200
    assert second.json()["user"]["hasTelegram"] is True


def test_dismiss_prompt_persists(client):
    token = _register(client, email="frank@example.com").json()["token"]

    res = client.post("/api/auth/telegram/dismiss-prompt", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["user"]["telegramPromptDismissed"] is True

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.json()["user"]["telegramPromptDismissed"] is True


def test_dismiss_prompt_requires_auth(client):
    res = client.post("/api/auth/telegram/dismiss-prompt")
    assert res.status_code in (401, 403)
