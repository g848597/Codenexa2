"""Точка входа. Раздаёт webapp/ на "/" и API на "/api" с одного и того же
процесса и домена — поэтому фронтенду не нужен CORS (см. комментарий в
webapp/src/config/docsApi.js, который уже был написан в расчёте на эту схему).

Запуск локально:
    uvicorn app.web.server:app --reload --port 8000

Продакшн (Railway/любой Docker-хостинг):
    uvicorn app.web.server:app --host 0.0.0.0 --port $PORT
"""
import logging
import os

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.web.api import admin_plans, admin_users, auth, billing, docs, investors, organizations, referrals, sport_routes, telegram_webhook
from app.web.config import settings
from app.web.db import get_conn, init_db
from app.web.middleware import SecurityHeadersMiddleware

# Structured-ish логирование вместо голых print() (аудит, раздел 8: "нет
# structured logging"). Не полноценный JSON-логгер, но единая точка настройки
# уровня/формата вместо разрозненных print() по коду.
logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger("codenexa.server")

# Sentry (аудит, раздел 9, п.9): подключается только если задан SENTRY_DSN —
# без него приложение работает как раньше, никакой жёсткой зависимости от
# внешнего сервиса на старте нет.
if settings.SENTRY_DSN:
    try:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENV,
            traces_sample_rate=0.1,
        )
        logger.info("Sentry инициализирован (env=%s)", settings.ENV)
    except ImportError:
        logger.warning("SENTRY_DSN задан, но пакет sentry-sdk не установлен — пропускаю (см. requirements.txt)")

app = FastAPI(title="CodeNexa API")

app.add_middleware(SecurityHeadersMiddleware)

init_db()

app.include_router(auth.router)
app.include_router(admin_users.router)
app.include_router(admin_plans.router)
app.include_router(billing.router)
app.include_router(investors.router)
app.include_router(referrals.router)
app.include_router(telegram_webhook.router)
app.include_router(sport_routes.router)
app.include_router(organizations.router)
app.include_router(docs.router)


@app.get("/health")
def health():
    """Health-check для проб хостинга (аудит, раздел 9, п.10). Проверяет не
    только "процесс жив", но и что БД реально отвечает — иначе проба
    хостинга будет считать инстанс здоровым, даже если Postgres недоступен."""
    db_ok = True
    db_error = None
    try:
        get_conn().execute("SELECT 1").fetchone()
    except Exception as exc:  # noqa: BLE001 — health-check должен пережить любую ошибку БД
        db_ok = False
        db_error = str(exc)

    body = {"status": "ok" if db_ok else "degraded", "db": "ok" if db_ok else "error"}
    if db_error:
        body["dbError"] = db_error
    return body

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")

WEBAPP_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "webapp")

# /uploads смонтирован ДО статики фронтенда (порядок mount() в Starlette
# важен: более специфичный путь должен быть зарегистрирован первым, иначе
# StaticFiles(directory=WEBAPP_DIR) на "/" перехватит /uploads/* и будет
# отдавать 404 из webapp/, а не реальные файлы).
if os.path.isdir(WEBAPP_DIR):
    app.mount("/", StaticFiles(directory=WEBAPP_DIR, html=True), name="webapp")
