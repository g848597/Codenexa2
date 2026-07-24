"""Фоновый воркер напоминаний о матче (AI Sport) — реальная бизнес-фича на
базе уже существующего Telegram-бота (см. app/web/api/telegram_webhook.py,
app/web/integrations/stars.py: тот же API_BASE/TELEGRAM_BOT_TOKEN, никакой
новой интеграции не заводится).

В проекте нет ни одного планировщика задач (APScheduler и т.п. нет в
requirements.txt) — вместо новой зависимости используется простой asyncio-цикл
поверх того же event loop, что и остальной FastAPI-процесс: раз в
REMINDER_POLL_SECONDS опрашивает repo.due_match_reminders() и шлёт сообщение
через Bot API. Один процесс/воркер — гонок за "кто отправит" не бывает
(Railway по умолчанию не запускает несколько web-процессов на один сервис).
"""
import asyncio
import logging
import time

import httpx
from fastapi.concurrency import run_in_threadpool

from app.web import repo
from app.web.config import settings

logger = logging.getLogger("codenexa.reminders")

REMINDER_POLL_SECONDS = 30


def _api_base() -> str | None:
    if not settings.TELEGRAM_BOT_TOKEN:
        return None
    return f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}"


async def _send(telegram_id: int, text: str) -> bool:
    api_base = _api_base()
    if not api_base:
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            res = await client.post(f"{api_base}/sendMessage", json={"chat_id": telegram_id, "text": text})
        data = res.json()
        return bool(data.get("ok"))
    except Exception:  # noqa: BLE001 — сбой одного сообщения не должен ронять воркер
        logger.warning("Не удалось отправить напоминание пользователю telegram_id=%s", telegram_id, exc_info=True)
        return False


def _format_message(reminder: dict) -> str:
    minutes = reminder["minutes_before"]
    home = reminder["home_name"] or "?"
    away = reminder["away_name"] or "?"
    return (
        f"⚽ Напоминание AI Sport\n{home} — {away}\n"
        f"Начало через {minutes} мин."
    )


async def _tick():
    now_ts = int(time.time())
    try:
        due = await run_in_threadpool(repo.due_match_reminders, now_ts)
    except Exception:  # noqa: BLE001 — БД временно недоступна, попробуем на следующем тике
        logger.warning("due_match_reminders упал — пропускаю тик", exc_info=True)
        return
    for reminder in due:
        telegram_id = reminder.get("telegram_id")
        if not telegram_id:
            # У пользователя нет привязанного Telegram (это не должно
            # случаться — see sport_routes.create_reminder отказывает таким
            # пользователям на создании, — но перепроверяем и здесь, а не
            # выдаём отправку за успешную).
            await run_in_threadpool(repo.mark_reminder_sent, reminder["id"])
            continue
        ok = await _send(telegram_id, _format_message(reminder))
        if ok:
            await run_in_threadpool(repo.mark_reminder_sent, reminder["id"])
        # При неудаче — не отмечаем sent, следующий тик попробует снова.


async def run_forever():
    if not settings.TELEGRAM_BOT_TOKEN:
        logger.info("TELEGRAM_BOT_TOKEN не задан — воркер напоминаний AI Sport не запущен")
        return
    logger.info("Воркер напоминаний AI Sport запущен (опрос каждые %sс)", REMINDER_POLL_SECONDS)
    while True:
        await _tick()
        await asyncio.sleep(REMINDER_POLL_SECONDS)
