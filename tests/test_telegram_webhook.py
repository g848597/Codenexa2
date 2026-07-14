"""Раунд 4 (см. аудит, раздел 4, п.4): сравнение секрета вебхука Telegram
переведено с `!=` на `hmac.compare_digest`, чтобы не давать теоретическую
timing-атаку на подбор секрета. Тесты проверяют поведение эндпоинта, а не
внутреннюю реализацию сравнения (это деталь, а не контракт)."""
from app.web.config import settings


def test_webhook_rejects_wrong_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "correct-secret")
    res = client.post("/api/telegram/webhook/wrong-secret", json={})
    assert res.status_code == 403


def test_webhook_accepts_correct_secret(client, monkeypatch):
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "correct-secret")
    res = client.post("/api/telegram/webhook/correct-secret", json={})
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_webhook_rejects_when_secret_not_configured(client, monkeypatch):
    # Пустой TELEGRAM_WEBHOOK_SECRET на сервере — эндпоинт не должен
    # открываться "всем", кто бы ни попал в путь.
    monkeypatch.setattr(settings, "TELEGRAM_WEBHOOK_SECRET", "")
    res = client.post("/api/telegram/webhook/anything", json={})
    assert res.status_code == 403
