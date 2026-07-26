"""Автоматическая настройка вебхука Telegram-бота при старте сервера.

Раньше вебхук приходилось привязывать вручную — открыть в браузере ссылку
вида https://api.telegram.org/bot<TOKEN>/setWebhook?url=...&secret_token=...
после каждой смены бота (TELEGRAM_BOT_TOKEN в Railway). Легко забыть или
перепутать URL — ровно так и было (см. историю: бот открывался, но
/telegram/webhook не был привязан, вебхук молчал).

Теперь это делает сам сервер при каждом запуске: сравнивает, что сейчас
привязано (getWebhookInfo), с тем, что должно быть (settings.PUBLIC_BASE_URL
+ "/telegram/webhook"), и молча выходит, если уже совпадает — либо
перепривязывает, если нет. Не критично для запуска сервера: если Telegram
недоступен или токен неверный, только логируется предупреждение, само
приложение продолжает работать (вебхук можно будет привязать и вручную,
как раньше)."""
import logging

import httpx

from app.web.config import settings

logger = logging.getLogger("codenexa.telegram_setup")


async def setup_webhook():
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.info("[telegram_setup] TELEGRAM_BOT_TOKEN не задан — пропускаю настройку вебхука")
        return
    if settings.PUBLIC_BASE_URL.startswith("http://localhost"):
        # На Railway это никогда не должно случиться (см. config.py —
        # RAILWAY_PUBLIC_DOMAIN подставляется автоматически), но если
        # переменной почему-то нет — не пытаемся прописать боту localhost,
        # это бессмысленно (Telegram снаружи его не увидит).
        logger.warning(
            "[telegram_setup] PUBLIC_BASE_URL похож на локальный (%s) — "
            "пропускаю настройку вебхука, привяжите вручную при необходимости",
            settings.PUBLIC_BASE_URL,
        )
        return

    target_url = f"{settings.PUBLIC_BASE_URL}/telegram/webhook"
    api_base = f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            info = await client.get(f"{api_base}/getWebhookInfo")
            info.raise_for_status()
            current_url = (info.json().get("result") or {}).get("url", "")

            if current_url == target_url:
                logger.info("[telegram_setup] Вебхук уже привязан правильно (%s)", target_url)
                return

            res = await client.get(
                f"{api_base}/setWebhook",
                params={
                    "url": target_url,
                    "secret_token": settings.TELEGRAM_WEBHOOK_SECRET,
                    "allowed_updates": '["message","pre_checkout_query"]',
                },
            )
            res.raise_for_status()
            body = res.json()
            if body.get("ok"):
                logger.info("[telegram_setup] Вебхук привязан: %s (было: %r)", target_url, current_url)
            else:
                logger.warning("[telegram_setup] Telegram отклонил setWebhook: %s", body)
    except Exception as e:  # noqa: BLE001 — сбой автонастройки не должен ронять запуск сервера
        logger.warning("[telegram_setup] Не удалось настроить вебхук автоматически: %s", e)
