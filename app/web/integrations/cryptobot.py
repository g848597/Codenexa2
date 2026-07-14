"""Клиент Crypto Pay API (@CryptoBot). Документация: https://help.crypt.bot/crypto-pay-api"""
import hashlib
import hmac
from decimal import Decimal

import httpx

from app.web import money
from app.web.config import settings

BASE_URL = "https://pay.crypt.bot/api" if settings.CRYPTOBOT_NETWORK == "mainnet" else "https://testnet-pay.crypt.bot/api"


def _headers():
    return {"Crypto-Pay-API-Token": settings.CRYPTOBOT_API_TOKEN}


def verify_webhook_signature(raw_body: bytes, signature_header: str | None) -> bool:
    """Проверка подписи вебхука CryptoBot (было пропущено — см. аудит, п.0.2).

    По документации Crypto Pay API: secret_key = SHA256(app_token) (сырой
    байтовый хэш, не hex-строка), signature = HEX(HMAC_SHA256(secret_key,
    raw_body)). Сравниваем СЫРОЕ, ещё не распарсенное тело запроса — если
    сначала распарсить JSON и заново сериализовать, порядок/форматирование
    полей может отличаться и подпись не сойдётся, поэтому raw_body обязателен.
    https://help.crypt.bot/crypto-pay-api#Webhooks
    """
    if not signature_header or not settings.CRYPTOBOT_WEBHOOK_SECRET:
        return False
    secret_key = hashlib.sha256(settings.CRYPTOBOT_WEBHOOK_SECRET.encode()).digest()
    expected = hmac.new(secret_key, raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


async def create_invoice(amount: str, asset: str, description: str, payload: str) -> dict:
    """asset — например 'USDT', 'TON', 'BTC'. Полный список: GET /getExchangeRates
    или см. help.crypt.bot. Возвращает данные инвойса, включая pay_url."""
    if not settings.CRYPTOBOT_API_TOKEN:
        raise RuntimeError("CRYPTOBOT_API_TOKEN не задан в .env")
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{BASE_URL}/createInvoice",
            headers=_headers(),
            json={
                "amount": amount,
                "asset": asset,
                "description": description[:1024],
                "payload": payload,
                "paid_btn_name": "callback",
                "paid_btn_url": settings.PUBLIC_BASE_URL,
            },
        )
        data = res.json()
    if not data.get("ok"):
        raise RuntimeError(f"CryptoBot createInvoice error: {data}")
    return data["result"]


_rate_cache: dict[str, tuple[Decimal, float]] = {}  # asset -> (rate_to_usd, fetched_at_monotonic)
_RATE_CACHE_TTL = 60  # секунд — курс не должен "гулять" внутри одного чекаута,
# но и не должен биться в CryptoBot API на каждый запрос тарифов


async def get_usd_rate(asset: str):
    """Сколько USD стоит 1 единица asset (Decimal). Использует GET /getExchangeRates.

    Раньше (см. аудит, п.0.3) цена для TON/BTC отправлялась в createInvoice
    как есть в USD (например "9.00" TON вместо "9.00" USD в TON), что либо
    переплата пользователя в тысячи раз, либо недоплата — в зависимости от
    трактовки CryptoBot. Теперь сумма всегда явно конвертируется на сервере.

    Возвращает Decimal, а не float (см. аудит, раздел 13, "Средний
    приоритет", п.2) — курс идёт в денежный расчёт (convert_usd_to_asset),
    а float там же был источником неточности."""
    import time

    cached = _rate_cache.get(asset)
    if cached and (time.monotonic() - cached[1]) < _RATE_CACHE_TTL:
        return cached[0]

    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(f"{BASE_URL}/getExchangeRates", headers=_headers())
        data = res.json()
    if not data.get("ok"):
        raise RuntimeError(f"CryptoBot getExchangeRates error: {data}")

    rate = None
    for item in data["result"]:
        # Ищем курс asset -> USD напрямую (source=asset, target=USD).
        if item.get("source") == asset and item.get("target") == "USD":
            rate = money.to_decimal(item["rate"])
            break
    if rate is None:
        raise RuntimeError(f"CryptoBot: курс {asset} -> USD не найден в getExchangeRates")

    _rate_cache[asset] = (rate, time.monotonic())
    return rate


async def convert_usd_to_asset(usd_amount, asset: str) -> str:
    """USD-сумма тарифа -> строка с суммой в asset, с точностью, разумной для
    крипты (8 знаков). Для стейблкоина USDT курс ~1:1, но всё равно идём через
    getExchangeRates, а не хардкодим 1.0 — так безопаснее при деколлатерализации/
    отклонениях стейбла и единообразнее с остальными активами.

    `usd_amount` — Decimal/str/int (см. app/web/money.py, аудит раздел 13
    "Средний приоритет" п.2: раньше здесь был `float`, что для денежных
    расчётов в принципе не годится — IEEE754 не хранит десятичные дроби
    точно). Курс из CryptoBot API тоже приводится к Decimal перед делением."""
    rate = await get_usd_rate(asset)
    if rate <= 0:
        raise RuntimeError(f"CryptoBot: некорректный курс для {asset}: {rate}")
    amount = money.to_decimal(usd_amount) / rate
    return money.to_display(amount, asset)


async def get_invoice(invoice_id: int) -> dict | None:
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.get(
            f"{BASE_URL}/getInvoices", headers=_headers(), params={"invoice_ids": str(invoice_id)}
        )
        data = res.json()
    if not data.get("ok"):
        return None
    items = data["result"].get("items", [])
    return items[0] if items else None
