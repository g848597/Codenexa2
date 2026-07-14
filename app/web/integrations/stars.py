"""Оплата через Telegram Stars. Не требует provider_token — валюта 'XTR'.
Документация: https://core.telegram.org/bots/payments-stars
Ссылка на инвойс открывается в клиенте через Telegram.WebApp.openInvoice()
(уже реализовано во фронтенде, см. webapp/src/telegram.js -> openInvoice)."""
import httpx

from app.web.config import settings

API_BASE = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


async def create_invoice_link(title: str, description: str, payload: str, stars_amount: int) -> str:
    if not settings.TELEGRAM_BOT_TOKEN:
        raise RuntimeError("TELEGRAM_BOT_TOKEN не задан в .env")
    async with httpx.AsyncClient(timeout=15) as client:
        res = await client.post(
            f"{API_BASE}/createInvoiceLink",
            json={
                "title": title[:32],
                "description": description[:255],
                "payload": payload,
                "currency": "XTR",
                "prices": [{"label": title[:32], "amount": stars_amount}],
            },
        )
        data = res.json()
    if not data.get("ok"):
        raise RuntimeError(f"Telegram createInvoiceLink error: {data}")
    return data["result"]


async def answer_pre_checkout_query(pre_checkout_query_id: str, ok: bool, error_message: str | None = None):
    async with httpx.AsyncClient(timeout=15) as client:
        payload = {"pre_checkout_query_id": pre_checkout_query_id, "ok": ok}
        if error_message:
            payload["error_message"] = error_message
        await client.post(f"{API_BASE}/answerPreCheckoutQuery", json=payload)
