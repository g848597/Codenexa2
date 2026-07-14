"""Раунд 8, модуль 8 (аудит, раздел 9, "DevOps: нет staging-окружения" — см.
CHANGES_ROUND8.md): ENV="staging" теперь трактуется как production по
требованиям безопасности (secure-cookie, HSTS — см. test_security_headers.py,
обязательный JWT_SECRET). Development остаётся единственным послаблением."""
from app.web.config import Settings, _is_production_like


def test_is_production_like_development_is_false():
    assert _is_production_like("development") is False


def test_is_production_like_staging_is_true():
    assert _is_production_like("staging") is True


def test_is_production_like_production_is_true():
    assert _is_production_like("production") is True


def test_settings_method_matches_module_helper(monkeypatch):
    from app.web.config import settings

    monkeypatch.setattr(settings, "ENV", "staging")
    assert settings.is_production_like() is True
    monkeypatch.setattr(settings, "ENV", "development")
    assert settings.is_production_like() is False


def test_oauth_csrf_cookie_is_secure_in_staging(client, monkeypatch):
    from app.web.config import settings

    monkeypatch.setattr(settings, "ENV", "staging")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "https://example.com/api/auth/google/callback")

    res = client.get("/api/auth/google/start", follow_redirects=False)
    set_cookie = res.headers.get("set-cookie", "")
    assert "oauth_csrf" in set_cookie
    assert "Secure" in set_cookie


def test_oauth_csrf_cookie_not_secure_in_development(client, monkeypatch):
    from app.web.config import settings

    monkeypatch.setattr(settings, "ENV", "development")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "test-client-id")
    monkeypatch.setattr(settings, "GOOGLE_CLIENT_SECRET", "test-client-secret")
    monkeypatch.setattr(settings, "GOOGLE_REDIRECT_URI", "https://example.com/api/auth/google/callback")

    res = client.get("/api/auth/google/start", follow_redirects=False)
    set_cookie = res.headers.get("set-cookie", "")
    assert "oauth_csrf" in set_cookie
    assert "Secure" not in set_cookie
