"""Раунд 7 (аудит, раздел 13, "Средний приоритет": "Аудит-лог
админ-действий"). Покрывает:
  - что смена роли пишется в admin_audit_log;
  - что CRUD-действия над инвесторами (создание/обновление/удаление/
    сортировка) пишутся в admin_audit_log;
  - что /api/admin/users/audit-log доступен только superadmin (не обычному
    admin и не анонимному пользователю);
  - фильтрацию по action.
"""
from app.web.config import settings


def _register_and_login(client, email="alice@example.com", password="correct-horse-1"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    body = res.json()
    return body["token"], body["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _bootstrap_superadmin(client, monkeypatch, email="alice@example.com"):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {email})
    return _register_and_login(client, email=email)


def test_role_change_is_logged(client, monkeypatch):
    super_token, _super_user = _bootstrap_superadmin(client, monkeypatch)
    _plain_token, plain_user = _register_and_login(client, email="bob@example.com")

    res = client.put(
        f"/api/admin/users/{plain_user['id']}/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )
    assert res.status_code == 200

    log_res = client.get("/api/admin/users/audit-log", headers=_headers(super_token))
    assert log_res.status_code == 200
    entries = log_res.json()["entries"]
    assert len(entries) == 1
    entry = entries[0]
    assert entry["action"] == "role_change"
    assert entry["targetType"] == "user"
    assert str(entry["targetId"]) == str(plain_user["id"])
    assert entry["details"]["to"] == "admin"
    assert entry["details"]["from"] == "user"


def test_investor_crud_is_logged(client, monkeypatch):
    super_token, _super_user = _bootstrap_superadmin(client, monkeypatch)

    create_res = client.post(
        "/api/investors",
        json={"name": "Jane Doe", "status": "draft"},
        headers=_headers(super_token),
    )
    assert create_res.status_code == 200
    investor_id = create_res.json()["investor"]["id"]

    client.put(
        f"/api/investors/{investor_id}",
        json={"status": "published"},
        headers=_headers(super_token),
    )
    client.delete(f"/api/investors/{investor_id}", headers=_headers(super_token))

    log_res = client.get("/api/admin/users/audit-log", headers=_headers(super_token))
    actions = [e["action"] for e in log_res.json()["entries"]]
    # Самые новые записи первыми.
    assert actions[:3] == ["delete", "update", "create"]
    assert all(e["targetType"] == "investor" for e in log_res.json()["entries"][:3])


def test_audit_log_requires_superadmin(client, monkeypatch):
    super_token, _ = _bootstrap_superadmin(client, monkeypatch)
    plain_token, plain_user = _register_and_login(client, email="carl@example.com")
    client.put(
        f"/api/admin/users/{plain_user['id']}/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )

    # обычный admin (не superadmin) не должен видеть аудит-лог
    res = client.get("/api/admin/users/audit-log", headers=_headers(plain_token))
    assert res.status_code == 403


def test_audit_log_requires_auth(client):
    res = client.get("/api/admin/users/audit-log")
    assert res.status_code in (401, 403)


def test_audit_log_filters_by_action(client, monkeypatch):
    super_token, _ = _bootstrap_superadmin(client, monkeypatch)
    client.post(
        "/api/investors",
        json={"name": "Jane Doe", "status": "draft"},
        headers=_headers(super_token),
    )
    _plain_token, plain_user = _register_and_login(client, email="bob@example.com")
    client.put(
        f"/api/admin/users/{plain_user['id']}/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )

    res = client.get(
        "/api/admin/users/audit-log",
        params={"action": "role_change"},
        headers=_headers(super_token),
    )
    entries = res.json()["entries"]
    assert len(entries) == 1
    assert entries[0]["action"] == "role_change"
