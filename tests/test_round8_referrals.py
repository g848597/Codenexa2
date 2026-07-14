"""Раунд 8, модуль 2 (аудит, раздел 13, "Средний приоритет" — см.
CHANGES_ROUND8.md): реферальная программа. Код ссылки = telegram_id
пригласившего (`ref_<telegram_id>`, см. webapp/src/components/partners.js).
Привязка происходит при регистрации через /api/auth/telegram (start_param
из initData), подтверждение — при первой успешной оплате приглашённого
(Stars или CryptoBot), не раньше."""
import hashlib
import hmac
import json

from app.web import repo
from app.web.config import settings


def _sign_init_data(user: dict, start_param: str | None = None, bot_token: str = "test") -> str:
    """Строит валидную initData той же схемой, что и validate_init_data()
    в app/web/api/telegram_auth.py — тестовое окружение задаёт
    TELEGRAM_BOT_TOKEN=test (см. conftest.py/pytest env)."""
    pairs = {"user": json.dumps(user), "auth_date": "9999999999"}
    if start_param:
        pairs["start_param"] = start_param
    data_check_string = "\n".join(f"{k}={pairs[k]}" for k in sorted(pairs.keys()))
    secret_key = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    pairs["hash"] = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    return "&".join(f"{k}={v}" for k, v in pairs.items())


def _telegram_login(client, tg_id: int, start_param: str | None = None, first_name: str = "Tester"):
    init_data = _sign_init_data({"id": tg_id, "first_name": first_name}, start_param=start_param)
    return client.post("/api/auth/telegram", json={"initData": init_data})


# ---------- привязка при регистрации ----------

def test_referral_linked_on_new_telegram_registration(client):
    referrer = repo.create_user(telegram_id=111001, first_name="Referrer")

    res = _telegram_login(client, tg_id=222001, start_param=f"ref_{referrer['telegram_id']}")
    assert res.status_code == 200
    new_user_id = res.json()["user"]["id"]

    link = repo.get_referral_by_referred(new_user_id)
    assert link is not None
    assert link["referrer_id"] == referrer["id"]
    assert link["status"] == "pending"


def test_referral_not_relinked_on_second_login(client):
    referrer = repo.create_user(telegram_id=111002, first_name="Referrer")
    res1 = _telegram_login(client, tg_id=222002, start_param=f"ref_{referrer['telegram_id']}")
    user_id = res1.json()["user"]["id"]

    # Второй вход того же пользователя, теперь БЕЗ start_param (обычное
    # повторное открытие мини-аппа) — привязка не должна создаваться заново
    # или ломаться.
    res2 = _telegram_login(client, tg_id=222002)
    assert res2.status_code == 200
    assert res2.json()["user"]["id"] == user_id

    rows = repo.list_referrals_by_referrer(referrer["id"])
    assert len(rows) == 1


def test_self_referral_rejected(client):
    """Пригласительная ссылка на самого себя (например, скопировал ссылку
    другого пользователя, но тот же telegram_id) не создаёт запись."""
    res = _telegram_login(client, tg_id=333001, start_param="ref_333001")
    assert res.status_code == 200
    new_user_id = res.json()["user"]["id"]
    assert repo.get_referral_by_referred(new_user_id) is None


def test_unknown_referrer_ignored(client):
    """start_param ссылается на telegram_id, которого нет в системе —
    регистрация всё равно проходит, просто без реферальной привязки."""
    res = _telegram_login(client, tg_id=333002, start_param="ref_999999999")
    assert res.status_code == 200
    new_user_id = res.json()["user"]["id"]
    assert repo.get_referral_by_referred(new_user_id) is None


def test_malformed_start_param_ignored(client):
    res = _telegram_login(client, tg_id=333003, start_param="not-a-referral-code")
    assert res.status_code == 200
    new_user_id = res.json()["user"]["id"]
    assert repo.get_referral_by_referred(new_user_id) is None


# ---------- подтверждение при первой оплате ----------

def test_referral_confirmed_on_first_stars_payment(client, monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "test-secret")
    referrer = repo.create_user(telegram_id=444001, first_name="Referrer")
    referred = repo.create_user(telegram_id=444002, first_name="Referred")
    repo.create_referral(referrer["id"], referred["id"])
    repo.create_payment(referred["id"], "stars", external_id=None, plan="pro_monthly", amount=500, currency="XTR")

    payload = {
        "message": {
            "successful_payment": {
                "invoice_payload": f"plan:pro_monthly:user:{referred['id']}",
                "telegram_payment_charge_id": "charge-referral-1",
            }
        }
    }
    res = client.post("/api/telegram/webhook/test-secret", json=payload)
    assert res.status_code == 200

    link = repo.get_referral_by_referred(referred["id"])
    assert link["status"] == "confirmed"
    assert link["confirmed_at"] is not None
    # REFERRAL_REWARD_USD не задан в тестовом окружении -> сумма честно NULL,
    # а не придуманное число.
    assert link["reward_amount"] is None


def test_referral_confirmed_with_configured_reward(client, monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "test-secret")
    monkeypatch.setattr(settings, "REFERRAL_REWARD_USD", "5.00")
    referrer = repo.create_user(telegram_id=444003, first_name="Referrer")
    referred = repo.create_user(telegram_id=444004, first_name="Referred")
    repo.create_referral(referrer["id"], referred["id"])
    repo.create_payment(referred["id"], "stars", external_id=None, plan="pro_monthly", amount=500, currency="XTR")

    payload = {
        "message": {
            "successful_payment": {
                "invoice_payload": f"plan:pro_monthly:user:{referred['id']}",
                "telegram_payment_charge_id": "charge-referral-2",
            }
        }
    }
    res = client.post("/api/telegram/webhook/test-secret", json=payload)
    assert res.status_code == 200

    link = repo.get_referral_by_referred(referred["id"])
    assert link["status"] == "confirmed"
    assert str(link["reward_amount"]) == "5.00000000"
    assert link["reward_currency"] == "USD"


def test_referral_confirmed_on_first_cryptobot_payment(client):
    from app.web.integrations import cryptobot as cryptobot_module

    referrer = repo.create_user(telegram_id=444005, first_name="Referrer")
    referred = repo.create_user(telegram_id=444006, first_name="Referred")
    repo.create_referral(referrer["id"], referred["id"])
    repo.create_payment(referred["id"], "cryptobot", external_id="inv-referral-1", plan="pro_monthly", amount="9.00", currency="USDT")

    import app.web.api.billing as billing_module

    billing_module.cryptobot.verify_webhook_signature = staticmethod(lambda body, sig: True)
    try:
        res = client.post(
            "/api/billing/cryptobot/webhook",
            json={"update_type": "invoice_paid", "payload": {"invoice_id": "inv-referral-1"}},
            headers={"crypto-pay-api-signature": "irrelevant-because-mocked"},
        )
        assert res.status_code == 200
    finally:
        # Не оставляем monkeypatch на будущие тесты, использующие модуль напрямую.
        del billing_module.cryptobot.verify_webhook_signature

    link = repo.get_referral_by_referred(referred["id"])
    assert link["status"] == "confirmed"


def test_referral_second_payment_does_not_reconfirm(client, monkeypatch):
    """Идемпотентность: вторая оплата того же приглашённого не должна
    ничего менять (сумма не задваивается, дата подтверждения не сдвигается)."""
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "test-secret")
    referrer = repo.create_user(telegram_id=444007, first_name="Referrer")
    referred = repo.create_user(telegram_id=444008, first_name="Referred")
    repo.create_referral(referrer["id"], referred["id"])
    repo.create_payment(referred["id"], "stars", external_id=None, plan="pro_monthly", amount=500, currency="XTR")

    payload_1 = {
        "message": {
            "successful_payment": {
                "invoice_payload": f"plan:pro_monthly:user:{referred['id']}",
                "telegram_payment_charge_id": "charge-referral-first",
            }
        }
    }
    client.post("/api/telegram/webhook/test-secret", json=payload_1)
    first_confirmed_at = repo.get_referral_by_referred(referred["id"])["confirmed_at"]

    repo.create_payment(referred["id"], "stars", external_id=None, plan="pro_monthly", amount=500, currency="XTR")
    payload_2 = {
        "message": {
            "successful_payment": {
                "invoice_payload": f"plan:pro_monthly:user:{referred['id']}",
                "telegram_payment_charge_id": "charge-referral-second",
            }
        }
    }
    client.post("/api/telegram/webhook/test-secret", json=payload_2)

    assert repo.get_referral_by_referred(referred["id"])["confirmed_at"] == first_confirmed_at


# ---------- эндпоинт статистики ----------

def test_referral_stats_endpoint(client, monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "test-secret")
    referrer_res = _telegram_login(client, tg_id=555001)
    referrer_token = referrer_res.json()["token"]
    referrer_id = referrer_res.json()["user"]["id"]

    referred = repo.create_user(telegram_id=555002, first_name="Referred")
    repo.create_referral(referrer_id, referred["id"])

    res = client.get("/api/referrals/me", headers={"Authorization": f"Bearer {referrer_token}"})
    assert res.status_code == 200
    body = res.json()
    assert body["pendingCount"] == 1
    assert body["confirmedCount"] == 0
    assert body["referralCode"] == "555001"


def test_referral_stats_requires_auth(client):
    res = client.get("/api/referrals/me")
    assert res.status_code in (401, 403)
