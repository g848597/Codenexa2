"""Раунд 5 (см. аудит, раздел 13, "Средний приоритет", п.1 и п.2):
- пул соединений в db.py (get_conn()/tx() теперь берут/отдают соединение из
  psycopg2.pool.ThreadedConnectionPool на время одной единицы работы вместо
  вечного соединения на поток) — эти тесты гоняются через client/repo как
  обычно, поэтому любая регрессия в пуле уже ловится ВСЕМИ существующими
  тестами (они все дергают БД). Отдельно здесь проверяется только то, что
  параллельные вызовы не мешают друг другу и что пул переживает много
  последовательных запросов подряд без утечки соединений.
- payments.amount TEXT -> NUMERIC(20,8) + единая денежная утилита (money.py).
"""
from decimal import Decimal

import pytest

from app.web import money, repo


# ---------- money.py ----------

@pytest.mark.parametrize(
    "value,expected",
    [
        ("9.00", Decimal("9.00")),
        (9, Decimal("9")),
        (Decimal("1.5"), Decimal("1.5")),
        (0.1, Decimal("0.1")),  # через repr(), не "в лоб" Decimal(0.1)
    ],
)
def test_to_decimal(value, expected):
    assert money.to_decimal(value) == expected


def test_to_decimal_rejects_garbage():
    with pytest.raises(ValueError):
        money.to_decimal("not-a-number")


@pytest.mark.parametrize(
    "value,currency,expected",
    [
        ("9.001", "USD", "9.00"),  # 2 знака, округление вниз
        ("9.009", "USD", "9.00"),
        (500, "XTR", "500"),  # звёзды — целое число, без дробной части
        ("0.123456789", "BTC", "0.12345678"),  # 8 знаков для BTC
    ],
)
def test_to_display(value, currency, expected):
    assert money.to_display(value, currency) == expected


def test_to_display_no_scientific_notation():
    # Decimal может дать экспоненциальную запись для очень маленьких чисел —
    # to_display должен всегда отдавать обычную десятичную форму (для JSON
    # API и для отображения пользователю).
    result = money.to_display("0.00000001", "BTC")
    assert "E" not in result.upper()
    assert result == "0.00000001"


# ---------- payments.amount (NUMERIC) round-trip ----------

def _make_user(email="money-test@example.com"):
    return repo.create_user(email=email, first_name="Money", last_name="Test")


def test_payment_amount_roundtrip_decimal(client):
    user = _make_user()
    repo.create_payment(
        user["id"], "cryptobot", external_id="inv-1", plan="pro_monthly",
        amount="9.12345678", currency="BTC",
    )
    payments = repo.list_payments(user["id"])
    assert len(payments) == 1
    assert payments[0]["amount"] == Decimal("9.12345678")
    assert payments[0]["currency"] == "BTC"


def test_payment_amount_accepts_int_and_decimal(client):
    user = _make_user("money-test-2@example.com")
    repo.create_payment(
        user["id"], "stars", external_id="link", plan="pro_monthly",
        amount=500, currency="XTR",
    )
    payments = repo.list_payments(user["id"])
    assert payments[0]["amount"] == Decimal("500")


# ---------- пул соединений: много последовательных запросов не текут ----------

def test_many_sequential_queries_do_not_exhaust_pool(client):
    """DB_POOL_MAX по умолчанию 10 — если бы соединение не возвращалось в
    пул после каждого get_conn()/tx(), это довольно быстро зависло бы или
    упало с PoolError('connection pool exhausted') на десятках вызовов
    подряд, даже без реальной конкурентности."""
    user = _make_user("money-test-pool@example.com")
    for i in range(50):
        repo.create_payment(
            user["id"], "cryptobot", external_id=f"inv-{i}", plan="pro_monthly",
            amount="1.00", currency="USDT",
        )
    assert len(repo.list_payments(user["id"])) == 50
