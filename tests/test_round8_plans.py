"""Раунд 8, модуль 4 (аудит, раздел 12 "Объединить" — см. CHANGES_ROUND8.md):
PLANS из статичного Python-словаря в billing.py вынесен в таблицу `plans` с
историей изменения цен. Управление — PUT /api/admin/plans/{code}, только
superadmin, каждое изменение пишется в общий аудит-лог."""
from app.web import repo
from app.web.config import settings


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _bootstrap_superadmin(client, monkeypatch, email="plans-admin@example.com"):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {email})
    client.post("/api/auth/register", json={"email": email, "password": "correct-horse-1"})
    res = client.post("/api/auth/login", json={"email": email, "password": "correct-horse-1"})
    body = res.json()
    return body["token"], body["user"]


def _register_and_login(client, email, password="correct-horse-1"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    return res.json()["token"]


# ---------- публичный список тарифов теперь из БД ----------

def test_public_plans_come_from_db_not_dict(client):
    res = client.get("/api/billing/plans")
    assert res.status_code == 200
    codes = {p["code"] for p in res.json()["plans"]}
    # Сидируются на старте (init_db -> _seed_default_plans), но источник —
    # таблица plans, не PLANS-словарь (которого в billing.py больше нет).
    assert "pro_monthly" in codes
    assert "pro_yearly" in codes


def test_checkout_uses_db_backed_plan(client, monkeypatch):
    """Тариф, созданный ТОЛЬКО в БД (не было в старом словаре PLANS),
    должен быть доступен для чекаута — подтверждает, что checkout() больше
    не завязан на хардкод."""
    repo.set_plan_price("round8_addon", "Доп. тариф раунда 8", "1.00", 50)
    token = _register_and_login(client, "checkout-db-plan@example.com")

    async def fake_create_invoice_link(**kwargs):
        return "https://t.me/invoice/fake"

    import app.web.api.billing as billing_module

    monkeypatch.setattr(billing_module.stars, "create_invoice_link", fake_create_invoice_link)

    res = client.post(
        "/api/billing/checkout",
        json={"plan": "round8_addon", "method": "stars"},
        headers=_headers(token),
    )
    assert res.status_code == 200


# ---------- admin_plans: доступ и запись истории ----------

def test_plan_price_change_requires_superadmin(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", set())
    token = _register_and_login(client, "plain-user-plans@example.com")
    res = client.put(
        "/api/admin/plans/round8_test_forbidden",
        json={"title": "X", "usd": "5.00", "stars": 100},
        headers=_headers(token),
    )
    assert res.status_code == 403


def test_plan_price_change_creates_history_and_deactivates_old(client, monkeypatch):
    token, admin = _bootstrap_superadmin(client, monkeypatch, "plans-history@example.com")
    code = "round8_history_test"

    res1 = client.put(
        f"/api/admin/plans/{code}",
        json={"title": "Тест", "usd": "10.00", "stars": 600},
        headers=_headers(token),
    )
    assert res1.status_code == 200
    assert res1.json()["plan"]["isActive"] is True

    res2 = client.put(
        f"/api/admin/plans/{code}",
        json={"title": "Тест", "usd": "12.00", "stars": 700},
        headers=_headers(token),
    )
    assert res2.status_code == 200

    history_res = client.get(f"/api/admin/plans/history?code={code}", headers=_headers(token))
    assert history_res.status_code == 200
    history = history_res.json()["history"]
    assert len(history) == 2
    # Новые записи первыми.
    assert history[0]["usd"] == "12.00"
    assert history[0]["isActive"] is True
    assert history[1]["usd"] == "10.00"
    assert history[1]["isActive"] is False

    active_res = client.get("/api/billing/plans")
    active_codes_prices = {p["code"]: p["usd"] for p in active_res.json()["plans"]}
    assert active_codes_prices[code] == "12.00"


def test_plan_price_change_is_logged(client, monkeypatch):
    token, _admin = _bootstrap_superadmin(client, monkeypatch, "plans-audit@example.com")
    code = "round8_audit_test"
    client.put(f"/api/admin/plans/{code}", json={"title": "Т", "usd": "3.00", "stars": 200}, headers=_headers(token))

    log_res = client.get("/api/admin/users/audit-log", headers=_headers(token))
    assert log_res.status_code == 200
    entries = [e for e in log_res.json()["entries"] if e["action"] == "plan_price_change"]
    assert len(entries) == 1
    assert entries[0]["targetId"] == code
    assert entries[0]["details"]["to"]["usd"] == "3.00"


def test_plan_price_rejects_non_positive_usd(client, monkeypatch):
    token, _ = _bootstrap_superadmin(client, monkeypatch, "plans-negative@example.com")
    res = client.put(
        "/api/admin/plans/round8_negative_test",
        json={"title": "Т", "usd": "-1.00", "stars": 100},
        headers=_headers(token),
    )
    assert res.status_code == 400
