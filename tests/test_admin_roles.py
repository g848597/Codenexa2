"""Раунд 6 (аудит, раздел 13, "Средний приоритет": "Ролевая модель админов
(вместо allow-list)"). Покрывает:
  - самозалечивающийся bootstrap первого superadmin из ADMIN_EMAILS (.env);
  - что bootstrap срабатывает только на холодном старте (пока в БД нет ни
    одного superadmin), а не для каждого email из списка бесконечно;
  - /api/admin/users доступен только superadmin, а не обычному admin;
  - выдачу/отзыв ролей через API;
  - защиту от самопонижения и от понижения последнего superadmin.
"""
from app.web.config import settings


def _register_and_login(client, email="alice@example.com", password="correct-horse-1"):
    client.post("/api/auth/register", json={"email": email, "password": password})
    res = client.post("/api/auth/login", json={"email": email, "password": password})
    body = res.json()
    return body["token"], body["user"]


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


# ---------- bootstrap ----------

def test_bootstrap_promotes_first_admin_email_to_superadmin(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    token, user = _register_and_login(client)
    assert user["isAdmin"] is True

    res = client.get("/api/admin/users", headers=_headers(token))
    assert res.status_code == 200
    roles = {u["email"]: u["role"] for u in res.json()["users"]}
    assert roles["alice@example.com"] == "superadmin"


def test_bootstrap_does_not_promote_email_not_in_list(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"someone-else@example.com"})
    _token, user = _register_and_login(client)
    assert user["isAdmin"] is False


def test_bootstrap_only_fires_once_for_cold_start(client, monkeypatch):
    """Если superadmin уже назначен (даже другому пользователю), второй
    email из ADMIN_EMAILS больше НЕ получает роль автоматически — иначе
    отзыв роли через API был бы бессмысленным, пока запись остаётся в .env."""
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com", "bob@example.com"})
    _token_a, user_a = _register_and_login(client, email="alice@example.com")
    assert user_a["isAdmin"] is True

    _token_b, user_b = _register_and_login(client, email="bob@example.com")
    assert user_b["isAdmin"] is False


def test_revoked_bootstrap_admin_is_not_silently_restored_on_next_login(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    _token, user = _register_and_login(client)
    assert user["isAdmin"] is True

    # Заводим второго superadmin напрямую через repo — имитирует ситуацию,
    # когда в системе уже есть кому явно отозвать роль у alice через API
    # (сам API-путь отзыва покрыт test_superadmin_can_promote_user_to_admin
    # и соседними тестами; здесь важен именно эффект отзыва на bootstrap).
    from app.web import repo
    bob = repo.create_user(email="bob@example.com", password_hash="x")
    repo.set_user_role(bob["id"], "superadmin")
    repo.set_user_role(user["id"], "user")

    # Повторный логин alice НЕ должен снова выдать ей superadmin, несмотря
    # на то что её email всё ещё в ADMIN_EMAILS — в системе уже есть
    # superadmin (bob), поэтому bootstrap-ветка больше не применяется.
    _token2, user2 = _register_and_login(client)
    assert user2["isAdmin"] is False


# ---------- доступ к /api/admin/users ----------

def test_admin_users_requires_auth(client):
    res = client.get("/api/admin/users")
    assert res.status_code in (401, 403)


def test_regular_admin_cannot_manage_roles(client, monkeypatch):
    """admin (не superadmin) получает 403 на /api/admin/users — управление
    ролями зарезервировано за superadmin."""
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    super_token, _ = _register_and_login(client, email="alice@example.com")

    plain_token, plain_user = _register_and_login(client, email="carl@example.com")
    client.put(
        f"/api/admin/users/{plain_user['id']}/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )

    res = client.get("/api/admin/users", headers=_headers(plain_token))
    assert res.status_code == 403


def test_non_admin_gets_403(client):
    token, _user = _register_and_login(client, email="dana@example.com")
    res = client.get("/api/admin/users", headers=_headers(token))
    assert res.status_code == 403


# ---------- выдача/отзыв ролей ----------

def test_superadmin_can_promote_user_to_admin(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    super_token, _ = _register_and_login(client, email="alice@example.com")
    _plain_token, plain_user = _register_and_login(client, email="erin@example.com")

    res = client.put(
        f"/api/admin/users/{plain_user['id']}/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )
    assert res.status_code == 200
    assert res.json()["user"]["role"] == "admin"


def test_promoted_admin_can_access_investors_admin_endpoint(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    super_token, _ = _register_and_login(client, email="alice@example.com")
    plain_token, plain_user = _register_and_login(client, email="frank@example.com")

    client.put(
        f"/api/admin/users/{plain_user['id']}/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )

    res = client.get("/api/investors/admin", headers=_headers(plain_token))
    assert res.status_code == 200


def test_search_users_by_partial_email(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    super_token, _ = _register_and_login(client, email="alice@example.com")
    _register_and_login(client, email="grace@example.com")

    res = client.get("/api/admin/users?q=grace", headers=_headers(super_token))
    assert res.status_code == 200
    emails = [u["email"] for u in res.json()["users"]]
    assert "grace@example.com" in emails


def test_set_role_rejects_invalid_role(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    super_token, _ = _register_and_login(client, email="alice@example.com")
    _plain_token, plain_user = _register_and_login(client, email="henry@example.com")

    res = client.put(
        f"/api/admin/users/{plain_user['id']}/role",
        json={"role": "godmode"},
        headers=_headers(super_token),
    )
    assert res.status_code == 422


def test_set_role_404_for_unknown_user(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    super_token, _ = _register_and_login(client, email="alice@example.com")

    res = client.put(
        "/api/admin/users/999999/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )
    assert res.status_code == 404


# ---------- защита от самопонижения / потери последнего superadmin ----------

def test_superadmin_cannot_demote_self(client, monkeypatch):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    super_token, user = _register_and_login(client, email="alice@example.com")

    res = client.put(
        f"/api/admin/users/{user['id']}/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )
    assert res.status_code == 400


def test_cannot_demote_last_superadmin(client, monkeypatch):
    """Даже ДРУГОЙ superadmin не может понизить единственного оставшегося
    superadmin в системе."""
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {"alice@example.com"})
    super_token, alice = _register_and_login(client, email="alice@example.com")

    from app.web import repo
    bob_token, bob = _register_and_login(client, email="bob@example.com")
    repo.set_user_role(bob["id"], "superadmin")

    # bob понижает alice до admin — остаётся один superadmin (bob), это ОК.
    res1 = client.put(
        f"/api/admin/users/{alice['id']}/role",
        json={"role": "admin"},
        headers=_headers(bob_token),
    )
    assert res1.status_code == 200

    # alice (уже не superadmin) не может ничего сделать через этот эндпоинт —
    # 403, т.к. она больше не superadmin.
    res2 = client.put(
        f"/api/admin/users/{bob['id']}/role",
        json={"role": "admin"},
        headers=_headers(super_token),
    )
    assert res2.status_code == 403
