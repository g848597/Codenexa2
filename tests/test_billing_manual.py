"""Ручные способы оплаты (страница components/paymentPage.js): "card" и
"crypto_manual" в /api/billing/checkout, справочник реквизитов
/api/billing/manual-methods, и подтверждение заявки админом
/api/billing/admin/manual-payments — см. app/web/api/billing.py.
"""
from app.web.config import settings


def _register_and_login(client, email="manual@example.com"):
    res = client.post("/api/auth/register", json={"email": email, "password": "correct-horse-1"})
    return res.json()["token"], res.json()["user"]["id"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def test_manual_methods_public_and_unconfigured_by_default(client):
    res = client.get("/api/billing/manual-methods")
    assert res.status_code == 200
    body = res.json()
    # Плейсхолдеры из config.py — по умолчанию ничего не настроено.
    assert body["card"]["configured"] is False
    assert all(not row["configured"] for row in body["crypto"])
    assets = {row["asset"] for row in body["crypto"]}
    assert {"USDT", "TON", "BTC"} <= assets


def test_card_checkout_creates_pending_payment_with_placeholder(client):
    token, _ = _register_and_login(client)
    res = client.post(
        "/api/billing/checkout", json={"plan": "pro_monthly", "method": "card"}, headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["method"] == "card"
    assert body["reference"].startswith("CX-")
    assert body["card"]["number"] == settings.MANUAL_CARD_NUMBER  # ещё плейсхолдер


def test_crypto_manual_checkout_rejects_unconfigured_network(client):
    token, _ = _register_and_login(client)
    res = client.post(
        "/api/billing/checkout",
        json={"plan": "pro_monthly", "method": "crypto_manual", "asset": "USDT", "network": "TRC20"},
        headers=_headers(token),
    )
    # Адрес для USDT/TRC20 не задан (плейсхолдер пуст) — честная ошибка,
    # а не пустая строка адреса.
    assert res.status_code == 503


def test_crypto_manual_checkout_returns_configured_address(client, monkeypatch):
    monkeypatch.setattr(settings, "MANUAL_WALLET_USDT_TRC20", "TAbc123FakeAddressForTests")
    token, _ = _register_and_login(client)
    res = client.post(
        "/api/billing/checkout",
        json={"plan": "pro_monthly", "method": "crypto_manual", "asset": "USDT", "network": "TRC20"},
        headers=_headers(token),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["address"] == "TAbc123FakeAddressForTests"
    assert body["asset"] == "USDT" and body["network"] == "TRC20"
    assert body["reference"].startswith("CX-")


def test_crypto_manual_checkout_rejects_unknown_asset_or_network(client):
    token, _ = _register_and_login(client)
    res = client.post(
        "/api/billing/checkout",
        json={"plan": "pro_monthly", "method": "crypto_manual", "asset": "DOGE", "network": "DOGE"},
        headers=_headers(token),
    )
    assert res.status_code == 400


def test_admin_manual_payments_requires_admin(client):
    token, _ = _register_and_login(client)
    res = client.get("/api/billing/admin/manual-payments", headers=_headers(token))
    assert res.status_code == 403


def test_admin_can_list_and_confirm_manual_payment(client, monkeypatch):
    # Обычный пользователь создаёт заявку на оплату картой.
    token, _ = _register_and_login(client, email="payer@example.com")
    checkout_res = client.post(
        "/api/billing/checkout", json={"plan": "pro_monthly", "method": "card"}, headers=_headers(token),
    )
    payment_id = checkout_res.json()["paymentId"]

    # Пока не подтверждено — доступа к тарифу нет.
    status_res = client.get("/api/billing/status", headers=_headers(token))
    assert status_res.json()["subscription"]["active"] is False

    # Бутстрапим админа через ADMIN_EMAILS (тот же паттерн, что и в
    # test_admin_roles.py) и подтверждаем заявку.
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"admin@example.com"})
    admin_token, _ = _register_and_login(client, email="admin@example.com")

    pending_res = client.get("/api/billing/admin/manual-payments", headers=_headers(admin_token))
    assert pending_res.status_code == 200
    pending_ids = [p["id"] for p in pending_res.json()["payments"]]
    assert payment_id in pending_ids

    confirm_res = client.post(
        f"/api/billing/admin/manual-payments/{payment_id}/confirm", headers=_headers(admin_token),
    )
    assert confirm_res.status_code == 200

    # Тариф теперь активен у пользователя, который платил.
    status_res = client.get("/api/billing/status", headers=_headers(token))
    assert status_res.json()["subscription"]["active"] is True

    # Повторное подтверждение той же заявки — уже не найдена (не pending).
    repeat_res = client.post(
        f"/api/billing/admin/manual-payments/{payment_id}/confirm", headers=_headers(admin_token),
    )
    assert repeat_res.status_code == 404
