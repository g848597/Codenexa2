"""Вебхук самого Telegram-бота (не мини-аппа). Нужен для:
1. pre_checkout_query — обязательный ответ в течение 10 секунд для Stars-платежей.
2. successful_payment — подтверждение оплаты Stars, зачисление тарифа.
3. /start — приветствие с кнопкой, открывающей мини-апп (см. _send_start_reply).

Установка вебхука — теперь автоматическая при каждом старте сервера, см.
app/web/telegram_setup.py (раньше была отдельная curl-команда вручную).
"""
import hmac

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.concurrency import run_in_threadpool

from app.web import referrals, repo
from app.web.config import settings
from app.web.integrations import stars

router = APIRouter(prefix="/api/telegram", tags=["telegram-bot"])

_API_BASE = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


async def _send_start_reply(chat_id: int):
    """Раньше бот вообще ничего не отвечал на /start — молчал, из-за чего
    было впечатление, что он "не работает" (см. историю чата). Кнопка типа
    web_app — правильный способ открыть мини-апп из обычного сообщения (не
    просто ссылка t.me/..., а именно WebAppInfo — тогда сайт открывается
    во встроенном окне Telegram, а initData сразу доступна фронтенду)."""
    if not settings.TELEGRAM_BOT_TOKEN:
        return
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(
                f"{_API_BASE}/sendMessage",
                json={
                    "chat_id": chat_id,
                    "text": "Добро пожаловать в CodeNexa! Откройте приложение по кнопке ниже.",
                    "reply_markup": {
                        "inline_keyboard": [[
                            {"text": "Открыть CodeNexa", "web_app": {"url": settings.PUBLIC_BASE_URL}},
                        ]],
                    },
                },
            )
    except Exception:  # noqa: BLE001 — сбой приветствия не должен ронять обработку вебхука
        pass


@router.post("/webhook/{secret}")
async def telegram_webhook(secret: str, request: Request):
    # hmac.compare_digest вместо `!=` — защита от timing-атаки при переборе секрета.
    # Секрет и так может утечь через логи прокси/реферер (см. аудит, раздел 4, п.4),
    # но constant-time сравнение — бесплатная защита в глубину, которую не стоит пропускать.
    expected = settings.TELEGRAM_WEBHOOK_SECRET
    if not expected or not hmac.compare_digest(secret, expected):
        raise HTTPException(status_code=403, detail="Неверный секрет вебхука")

    update = await request.json()

    if "pre_checkout_query" in update:
        pcq = update["pre_checkout_query"]
        await stars.answer_pre_checkout_query(pcq["id"], ok=True)
        return {"ok": True}

    message = update.get("message")

    if message and str(message.get("text", "")).startswith("/start"):
        chat_id = message.get("chat", {}).get("id")
        if chat_id:
            await _send_start_reply(chat_id)
        return {"ok": True}

    if message and "successful_payment" in message:
        sp = message["successful_payment"]
        payload = sp.get("invoice_payload", "")
        # payload формата "plan:<code>:user:<id>" — см. billing.py checkout()
        parts = dict(zip(payload.split(":")[::2], payload.split(":")[1::2]))
        plan_code = parts.get("plan")
        user_id = parts.get("user")
        charge_id = sp.get("telegram_payment_charge_id", payload)
        if plan_code and user_id:
            # Раунд 8 (аудит, раздел 3, см. CHANGES_ROUND8.md, модуль 6):
            # блокирующий psycopg2-вызов уведён в threadpool, чтобы не
            # блокировать event loop на время запроса к БД.
            paid = await run_in_threadpool(repo.mark_latest_pending_paid, "stars", int(user_id), plan_code, charge_id)
            if paid:
                # Раунд 8, модуль 2: подтверждение реферала при первой
                # успешной оплате приглашённого (best-effort внутри).
                await run_in_threadpool(referrals.maybe_confirm_referral, int(user_id))
        return {"ok": True}

    return {"ok": True}
