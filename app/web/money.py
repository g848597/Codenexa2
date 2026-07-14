"""Единая точка работы с денежными суммами (аудит, раздел 13, "Средний
приоритет", п.2).

Было: `payments.amount` хранился как TEXT, а разные части кода сами собирали
строки/`float` для сумм (доллар тарифа, конвертация в крипту, звёзды) — это
и риск потери точности (`float` для денег в принципе не годится — 0.1 + 0.2
!= 0.3 в IEEE754), и рассинхрон форматирования между провайдерами (у BTC
нужно 8 знаков после запятой, у Stars — 0, у USDT — обычно 2).

Стало: все денежные величины внутри процесса — `Decimal`, `payments.amount`
в БД — `NUMERIC(20,8)` (см. `db.py`). psycopg2 адаптирует `Decimal` <->
`NUMERIC` без потери точности в обе стороны. Наружу (JSON-ответы API) суммы
отдаются строкой через `to_display()`, а не "голым" `Decimal`/`float` —
сериализация `Decimal` в JSON стандартными энкодерами обычно идёт через
`float` и возвращает то же самое IEEE754-округление, которого мы весь этот
модуль стараемся избежать.
"""
from decimal import ROUND_DOWN, Decimal, InvalidOperation

# Число знаков после запятой на ОТОБРАЖЕНИЕ (не обязательно совпадает с тем,
# что фактически хранится в БД — там NUMERIC(20,8) без потери точности для
# любого из используемых активов).
CURRENCY_DECIMALS = {
    "USD": 2,
    "USDT": 2,
    "TON": 4,
    "BTC": 8,
    "XTR": 0,  # Telegram Stars — целое число, дробных долей не бывает
}
DEFAULT_DECIMALS = 8


def to_decimal(value) -> Decimal:
    """Безопасно приводит str/int/float/Decimal к Decimal.

    `float` идёт через `repr()`, а не напрямую в `Decimal(value)` — иначе в
    Decimal утащится двоичная погрешность float (`Decimal(0.1) != Decimal('0.1')`),
    `repr()` в Python 3 даёт кратчайшее десятичное представление, при парсинге
    обратно дающее то же самое float-значение (round-trip-safe), но без
    "хвоста" лишних цифр вроде `0.1000000000000000055511151231257827021181583404541015625`.
    """
    if isinstance(value, Decimal):
        return value
    if isinstance(value, float):
        value = repr(value)
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError) as exc:
        raise ValueError(f"Некорректная денежная сумма: {value!r}") from exc


def quantize(value, currency: str) -> Decimal:
    """Округляет ВНИЗ (никогда не округляем в пользу продавца при отображении/
    списании) до принятого числа знаков для валюты."""
    dec = to_decimal(value)
    places = CURRENCY_DECIMALS.get(currency.upper(), DEFAULT_DECIMALS)
    quant = Decimal(1).scaleb(-places) if places else Decimal(1)
    return dec.quantize(quant, rounding=ROUND_DOWN)


def to_display(value, currency: str) -> str:
    """Строковое представление суммы для JSON-ответов API — без экспоненты
    и без float-погрешности, с числом знаков, принятым для валюты."""
    return format(quantize(value, currency), "f")
