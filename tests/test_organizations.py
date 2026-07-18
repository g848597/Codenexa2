"""Тесты для командных (бизнес-тариф) аккаунтов — app/web/api/organizations.py.

Покрывает: создание организации требует оплаченный business-тариф, инвайт-флоу
владелец/сотрудник, и новый эндпоинт /leave (сотрудник может выйти сам,
владелец — нет, см. organizations.py::leave_organization).
"""
from app.web import repo


def _register(client, email):
    res = client.post("/api/auth/register", json={"email": email, "password": "correct-horse-1"})
    assert res.status_code == 200, res.text
    return res.json()["token"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _grant_business_plan(email):
    user = repo.get_user_by_email(email)
    repo.create_payment(user["id"], "manual", f"test-{user['id']}", "business_yearly", "10", "USDT")
    repo.mark_payment_paid("manual", f"test-{user['id']}")
    return user


def test_create_organization_requires_business_plan(client):
    token = _register(client, "owner1@example.com")
    res = client.post("/api/organizations", json={"name": "Acme"}, headers=_headers(token))
    assert res.status_code == 403


def test_create_organization_and_invite_flow(client):
    owner_token = _register(client, "owner2@example.com")
    _grant_business_plan("owner2@example.com")

    create_res = client.post("/api/organizations", json={"name": "Acme"}, headers=_headers(owner_token))
    assert create_res.status_code == 200, create_res.text

    me_res = client.get("/api/organizations/me", headers=_headers(owner_token))
    body = me_res.json()
    assert body["organization"]["name"] == "Acme"
    assert body["organization"]["myRole"] == "owner"
    assert len(body["members"]) == 1

    invite_res = client.post("/api/organizations/invite", json={}, headers=_headers(owner_token))
    assert invite_res.status_code == 200
    token_str = invite_res.json()["token"]

    member_token = _register(client, "member2@example.com")
    accept_res = client.post(f"/api/organizations/invite/{token_str}/accept", headers=_headers(member_token))
    assert accept_res.status_code == 200

    me_res2 = client.get("/api/organizations/me", headers=_headers(member_token))
    body2 = me_res2.json()
    assert body2["organization"]["myRole"] == "member"
    assert len(body2["members"]) == 2


def test_member_can_leave_but_owner_cannot(client):
    owner_token = _register(client, "owner3@example.com")
    _grant_business_plan("owner3@example.com")
    client.post("/api/organizations", json={"name": "Acme"}, headers=_headers(owner_token))
    invite_res = client.post("/api/organizations/invite", json={}, headers=_headers(owner_token))
    token_str = invite_res.json()["token"]

    member_token = _register(client, "member3@example.com")
    client.post(f"/api/organizations/invite/{token_str}/accept", headers=_headers(member_token))

    # Владелец не может покинуть организацию через /leave
    owner_leave_res = client.post("/api/organizations/leave", headers=_headers(owner_token))
    assert owner_leave_res.status_code == 400

    # Сотрудник может
    member_leave_res = client.post("/api/organizations/leave", headers=_headers(member_token))
    assert member_leave_res.status_code == 200

    me_res = client.get("/api/organizations/me", headers=_headers(member_token))
    assert me_res.json()["organization"] is None
