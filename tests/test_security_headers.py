def test_security_headers_present_on_every_response(client):
    res = client.get("/health")
    assert "Content-Security-Policy" in res.headers
    assert res.headers["X-Content-Type-Options"] == "nosniff"
    assert res.headers["Referrer-Policy"] == "strict-origin-when-cross-origin"


def test_security_headers_present_on_error_responses(client):
    # 404 тоже должен получить заголовки — middleware не должен пропускать
    # неуспешные ответы (частая ошибка при добавлении security-заголовков
    # только на happy path).
    res = client.get("/api/does-not-exist")
    assert res.status_code == 404
    assert "Content-Security-Policy" in res.headers


def test_hsts_not_set_in_development(client):
    res = client.get("/health")
    assert "Strict-Transport-Security" not in res.headers


def test_hsts_set_in_staging(client, monkeypatch):
    """Раунд 8, модуль 8 (аудит, раздел 9, "нет staging-окружения"):
    staging — реальный HTTPS-деплой, поэтому получает HSTS так же, как
    production (а не только development-исключение)."""
    from app.web.config import settings

    monkeypatch.setattr(settings, "ENV", "staging")
    res = client.get("/health")
    assert "Strict-Transport-Security" in res.headers
