import hashlib
import hmac
import json

from app.web.config import settings


def _register_and_login(client, email="bob@example.com"):
    res = client.post("/api/auth/register", json={"email": email, "password": "correct-horse-1"})
    return res.json()["token"]


def test_plans_public(client):
    res = client.get("/api/billing/plans")
    assert res.status_code == 200
    codes = {p["code"] for p in res.json()["plans"]}
    assert "pro_monthly" in codes


def test_checkout_requires_auth(client):
    res = client.post("/api/billing/checkout", json={"plan": "pro_monthly", "method": "stars"})
    assert res.status_code in (401, 403)


def test_checkout_unknown_plan_rejected(client):
    token = _register_and_login(client)
    res = client.post(
        "/api/billing/checkout",
        json={"plan": "does_not_exist", "method": "stars"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 400


def test_checkout_idempotency_key_returns_same_payment(client, monkeypatch):
    """Двойной клик "Оплатить" с одним и тем же Idempotency-Key не должен
    создавать второй платёж (аудит, п.0.5)."""
    token = _register_and_login(client)
    headers = {"Authorization": f"Bearer {token}", "Idempotency-Key": "test-key-123"}

    async def fake_create_invoice_link(**kwargs):
        return "https://t.me/invoice/fake-link"

    import app.web.api.billing as billing_module

    monkeypatch.setattr(billing_module.stars, "create_invoice_link", fake_create_invoice_link)

    res1 = client.post(
        "/api/billing/checkout", json={"plan": "pro_monthly", "method": "stars"}, headers=headers
    )
    assert res1.status_code == 200
    assert res1.json().get("idempotent") is not True

    res2 = client.post(
        "/api/billing/checkout", json={"plan": "pro_monthly", "method": "stars"}, headers=headers
    )
    assert res2.status_code == 200
    body2 = res2.json()
    assert body2["idempotent"] is True
    assert body2["invoiceLink"] == res1.json()["invoiceLink"]


# ---------- CryptoBot webhook signature ----------

def _sign(raw_body: bytes) -> str:
    secret_key = hashlib.sha256(settings.CRYPTOBOT_WEBHOOK_SECRET.encode()).digest()
    return hmac.new(secret_key, raw_body, hashlib.sha256).hexdigest()


def test_webhook_rejects_missing_signature(client):
    payload = {"update_type": "invoice_paid", "payload": {"invoice_id": 1}}
    res = client.post("/api/billing/cryptobot/webhook", content=json.dumps(payload))
    assert res.status_code == 403


def test_webhook_rejects_invalid_signature(client):
    payload = {"update_type": "invoice_paid", "payload": {"invoice_id": 1}}
    res = client.post(
        "/api/billing/cryptobot/webhook",
        content=json.dumps(payload),
        headers={"crypto-pay-api-signature": "not-a-valid-signature"},
    )
    assert res.status_code == 403


def test_webhook_accepts_valid_signature(client):
    raw = json.dumps({"update_type": "invoice_paid", "payload": {"invoice_id": 999}}).encode()
    res = client.post(
        "/api/billing/cryptobot/webhook",
        content=raw,
        headers={
            "crypto-pay-api-signature": _sign(raw),
            "content-type": "application/json",
        },
    )
    assert res.status_code == 200
    assert res.json() == {"ok": True}
