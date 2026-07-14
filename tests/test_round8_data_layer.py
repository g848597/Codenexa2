"""Раунд 8, модуль 3 (аудит, раздел 7, п.2/п.3/п.6 — см. CHANGES_ROUND8.md):

- reorder_investors: дубликаты sort_order в одном запросе теперь явная
  ошибка (400 через API), а не тихая неопределённость порядка; конкурентный
  bulk-reorder больше не "перемешивает" две одновременные попытки
  (lost update) — вторая транзакция полностью перезаписывает первую после
  её коммита.
- mark_latest_pending_paid: повторный клик "оплатить" до появления
  Idempotency-Key на checkout больше не оставляет вечно висящие pending-
  платежи — все, кроме только что закрытого, переводятся в 'cancelled'.
"""
import threading

from app.web import repo
from app.web.config import settings


def _headers(token):
    return {"Authorization": f"Bearer {token}"}


def _bootstrap_superadmin(client, monkeypatch, email="reorder-admin@example.com"):
    monkeypatch.setattr(settings, "ADMIN_EMAILS", {email})
    client.post("/api/auth/register", json={"email": email, "password": "correct-horse-1"})
    res = client.post("/api/auth/login", json={"email": email, "password": "correct-horse-1"})
    body = res.json()
    return body["token"], body["user"]


def _create_investor(client, token, name):
    res = client.post(
        "/api/investors", json={"name": name, "status": "draft"}, headers=_headers(token)
    )
    assert res.status_code == 200
    return res.json()["investor"]["id"]


# ---------- reorder: дубликаты sort_order ----------

def test_reorder_rejects_duplicate_sort_order(client, monkeypatch):
    token, _ = _bootstrap_superadmin(client, monkeypatch)
    id_a = _create_investor(client, token, "Investor A")
    id_b = _create_investor(client, token, "Investor B")

    res = client.put(
        "/api/investors/reorder/bulk",
        json={"order": [{"id": id_a, "sortOrder": 0}, {"id": id_b, "sortOrder": 0}]},
        headers=_headers(token),
    )
    assert res.status_code == 400


def test_reorder_accepts_distinct_sort_order(client, monkeypatch):
    token, _ = _bootstrap_superadmin(client, monkeypatch)
    id_a = _create_investor(client, token, "Investor A")
    id_b = _create_investor(client, token, "Investor B")

    res = client.put(
        "/api/investors/reorder/bulk",
        json={"order": [{"id": id_a, "sortOrder": 1}, {"id": id_b, "sortOrder": 0}]},
        headers=_headers(token),
    )
    assert res.status_code == 200
    ordered = res.json()["investors"]
    assert ordered[0]["id"] == id_b
    assert ordered[1]["id"] == id_a


def test_reorder_repo_raises_on_duplicate_sort_order_directly():
    """Проверка на уровне repo напрямую (не только через API-обёртку) —
    гарантирует, что защита живёт в самой функции данных, а не только в
    HTTP-слое."""
    import pytest

    with pytest.raises(ValueError):
        repo.reorder_investors([(1, 5), (2, 5)])


def test_concurrent_reorder_does_not_interleave(client, monkeypatch):
    """Два "одновременных" bulk-reorder не должны перемешать результат —
    после того как обе транзакции завершились, порядок должен полностью
    соответствовать ОДНОЙ из двух попыток целиком, а не их смеси."""
    token, _ = _bootstrap_superadmin(client, monkeypatch)
    id_a = _create_investor(client, token, "Investor A")
    id_b = _create_investor(client, token, "Investor B")
    id_c = _create_investor(client, token, "Investor C")

    order_1 = [(id_a, 0), (id_b, 1), (id_c, 2)]
    order_2 = [(id_a, 2), (id_b, 0), (id_c, 1)]

    errors = []

    def _run(order):
        try:
            repo.reorder_investors(order)
        except Exception as exc:  # noqa: BLE001
            errors.append(exc)

    t1 = threading.Thread(target=_run, args=(order_1,))
    t2 = threading.Thread(target=_run, args=(order_2,))
    t1.start()
    t2.start()
    t1.join()
    t2.join()

    assert not errors

    final = {row["id"]: row["sort_order"] for row in repo.list_investors_all()}
    final_tuple = (final[id_a], final[id_b], final[id_c])
    assert final_tuple in (
        (0, 1, 2),  # order_1 победил целиком
        (2, 0, 1),  # order_2 победил целиком
    )


# ---------- mark_latest_pending_paid: дублирующиеся pending-платежи ----------

def _make_user(email="stars-dup@example.com"):
    return repo.create_user(email=email, first_name="Stars", last_name="Dup")


def test_mark_latest_pending_paid_cancels_other_pending(client):
    user = _make_user()
    # Двойной клик "оплатить" до Idempotency-Key на этом провайдере создал
    # два pending-платежа на один и тот же тариф.
    repo.create_payment(user["id"], "stars", external_id=None, plan="pro_monthly",
                         amount=500, currency="XTR")
    repo.create_payment(user["id"], "stars", external_id=None, plan="pro_monthly",
                         amount=500, currency="XTR")

    ok = repo.mark_latest_pending_paid("stars", user["id"], "pro_monthly", external_id="charge-1")
    assert ok is True

    payments = repo.list_payments(user["id"])
    statuses = sorted(p["status"] for p in payments)
    assert statuses == ["cancelled", "paid"]
    assert sum(1 for p in payments if p["status"] == "pending") == 0


def test_mark_latest_pending_paid_no_pending_returns_false(client):
    user = _make_user("stars-dup-2@example.com")
    ok = repo.mark_latest_pending_paid("stars", user["id"], "pro_monthly", external_id="charge-2")
    assert ok is False
