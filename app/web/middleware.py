"""Security-заголовки и health-check (аудит, раздел 9, высокий приоритет п.8/10).

Раньше ни один security-заголовок не выставлялся вообще — ни на API, ни на
статике фронтенда. Добавлено middleware, которое проставляет их на КАЖДЫЙ
ответ, без исключений (в т.ч. на 4xx/5xx и на статику), одним местом.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.web.config import settings

# CSP разрешает ресурсы только с собственного домена (фронтенд без сборки,
# все скрипты/стили — свои файлы) + Telegram WebApp SDK, который явно
# подключается со своего CDN (см. webapp/index.html).
_CSP = (
    "default-src 'self'; "
    "script-src 'self' https://telegram.org; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: https:; "
    "font-src 'self' data:; "
    "connect-src 'self'; "
    "frame-ancestors https://web.telegram.org https://*.telegram.org; "
    "base-uri 'self'; "
    "form-action 'self'"
)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Проставляет security-заголовки на каждый ответ.

    frame-ancestors/CSP разрешают встраивание именно в Telegram (мини-апп
    открывается внутри Telegram WebView, т.е. в iframe telegram.org) — поэтому
    X-Frame-Options здесь НЕ ставится в DENY/SAMEORIGIN (это сломало бы сам
    продукт), контроль встраивания отдан целиком CSP frame-ancestors, который
    гибче (поддерживает список доменов, чего X-Frame-Options не умеет)."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["Content-Security-Policy"] = _CSP
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        response.headers["X-XSS-Protection"] = "0"  # устарел, CSP делает эту работу лучше; ставим 0 явно, а не молчим
        # HSTS имеет смысл только на HTTPS — на локальном http://localhost его
        # выставлять нельзя (браузер потом весь час будет требовать https и
        # локальная разработка сломается). staging — реальный HTTPS-деплой,
        # поэтому тоже получает HSTS (раунд 8, аудит раздел 9).
        if settings.is_production_like():
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"
        return response
