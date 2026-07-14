"""Раунд 8, модуль 6 (аудит, раздел 3 — "Синхронный psycopg2 внутри async def
эндпоинтов", см. CHANGES_ROUND8.md): google_callback, yandex_callback,
telegram_webhook, cryptobot_webhook — все `async def`, но вызывали
синхронный `repo.*` (блокирующий сетевой I/O к Postgres) напрямую, что
блокировало event loop на время запроса к БД. Теперь блокирующие вызовы
уходят через `fastapi.concurrency.run_in_threadpool`.

Полноценный нагрузочный тест с реальным параллелизмом двух ASGI-запросов на
одном event loop через синхронный `TestClient` ненадёжен (TestClient не
гарантирует общий цикл событий между двумя параллельными вызовами из разных
потоков). Вместо таймингового теста здесь проверяется монтаж: что именно
блокирующий вызов действительно уходит через `run_in_threadpool`, а не
исполняется напрямую в корутине — это и есть исправление из аудита."""
from app.web.api import billing as billing_module
from app.web.api import telegram_webhook as telegram_webhook_module


def test_telegram_webhook_uses_threadpool_for_blocking_call(client, monkeypatch):
    from app.web.config import settings

    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "test-secret")

    calls = []
    real_run_in_threadpool = telegram_webhook_module.run_in_threadpool

    async def _spy(func, *args, **kwargs):
        calls.append(func)
        return await real_run_in_threadpool(func, *args, **kwargs)

    monkeypatch.setattr(telegram_webhook_module, "run_in_threadpool", _spy)

    payload = {
        "message": {
            "successful_payment": {
                "invoice_payload": "plan:pro_monthly:user:999999",
                "telegram_payment_charge_id": "charge-xyz",
            }
        }
    }
    res = client.post("/api/telegram/webhook/test-secret", json=payload)
    assert res.status_code == 200
    assert len(calls) == 1
    assert calls[0].__name__ == "mark_latest_pending_paid"


def test_cryptobot_webhook_uses_threadpool_for_blocking_call(client, monkeypatch):
    from app.web.integrations import cryptobot as cryptobot_module

    monkeypatch.setattr(cryptobot_module, "verify_webhook_signature", lambda body, sig: True)

    calls = []
    real_run_in_threadpool = billing_module.run_in_threadpool

    async def _spy(func, *args, **kwargs):
        calls.append(func)
        return await real_run_in_threadpool(func, *args, **kwargs)

    monkeypatch.setattr(billing_module, "run_in_threadpool", _spy)

    res = client.post(
        "/api/billing/cryptobot/webhook",
        json={"update_type": "invoice_paid", "payload": {"invoice_id": "inv-does-not-exist"}},
        headers={"crypto-pay-api-signature": "irrelevant-because-mocked"},
    )
    assert res.status_code == 200
    assert len(calls) == 1
    assert calls[0].__name__ == "mark_payment_paid"


def test_google_callback_csrf_check_uses_threadpool(client, monkeypatch):
    """Даже путь, который заканчивается 400 (CSRF не совпал), должен идти
    через run_in_threadpool — сама проверка (_verify_oauth_csrf) внутри
    делает блокирующий SELECT (repo.validate_oauth_state)."""
    from app.web.api import auth as auth_module
    from app.web.config import settings

    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "https://example.com/api/auth/google/callback")

    calls = []
    real_run_in_threadpool = auth_module.run_in_threadpool

    async def _spy(func, *args, **kwargs):
        calls.append(func)
        return await real_run_in_threadpool(func, *args, **kwargs)

    monkeypatch.setattr(auth_module, "run_in_threadpool", _spy)

    res = client.get(
        "/api/auth/google/callback",
        params={"code": "irrelevant", "state": "unknown-state"},
        follow_redirects=False,
    )
    assert res.status_code == 400
    assert len(calls) == 1
    assert calls[0].__name__ == "_verify_oauth_csrf"
