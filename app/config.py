"""Единая точка загрузки конфигурации из .env.
Больше нигде в коде os.environ не читаем напрямую (паттерн взят из
Codenexa2/app/web/config.py — там он уже проверен на реальном деплое)."""
import os

from dotenv import load_dotenv

load_dotenv()

ENV = os.getenv("ENV", "development").strip().lower()  # development | staging | production


def _is_production_like(env: str) -> bool:
    return env != "development"


class Settings:
    ENV: str = ENV

    # На Этапе 1 достаточно DATABASE_URL — БД может быть той же Supabase,
    # что и у CodeNexa (для тестов/разработки), просто с новыми таблицами
    # из migrations/001_init.sql. Никаких пересечений по именам таблиц с
    # существующим проектом CodeNexa нет.
    DATABASE_URL: str = os.getenv("DATABASE_URL", "")

    DB_POOL_MIN: int = int(os.getenv("DB_POOL_MIN", "1"))
    DB_POOL_MAX: int = int(os.getenv("DB_POOL_MAX", "10"))

    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")

    # Домен, на котором отдаётся редирект-эндпоинт GET /r/:slug (3.6 URL
    # Shortener) — сам бэкенд и есть этот домен (редирект зарегистрирован
    # прямо в app.server), поэтому по умолчанию совпадает с адресом API.
    # В проде задаётся явно, если сервис висит за собственным доменом
    # (напр. "https://tgtoolkit.app").
    SHORT_LINK_BASE_URL: str = os.getenv("SHORT_LINK_BASE_URL", "http://127.0.0.1:8001").rstrip("/")

    # Отдельный сервис (не тот же процесс/домен, что фронтенд) — в отличие
    # от Codenexa2, здесь CORS обязателен.
    CORS_ORIGINS: list[str] = [
        origin.strip()
        for origin in os.getenv("CORS_ORIGINS", "*").split(",")
        if origin.strip()
    ]

    # --- Этап 5 (Дизайн) — хранилище файлов, см. app/storage.py ---
    # Если S3_BUCKET не задан, storage.py молча падает обратно на локальный
    # диск (LOCAL_MEDIA_DIR, отдаётся статикой через /media в server.py) —
    # так все 6 модулей раздела «Дизайн» работают из коробки в dev-режиме
    # без поднятого бакета, как и с БД в 001_init.sql. В проде задайте
    # S3_BUCKET (+ ключи/эндпоинт) — тогда файлы реально уходят в S3/S3-
    # совместимое хранилище (подходит и Yandex Object Storage, и R2, и MinIO
    # через S3_ENDPOINT_URL).
    S3_BUCKET: str = os.getenv("S3_BUCKET", "")
    S3_REGION: str = os.getenv("S3_REGION", "us-east-1")
    S3_ACCESS_KEY_ID: str = os.getenv("S3_ACCESS_KEY_ID", "")
    S3_SECRET_ACCESS_KEY: str = os.getenv("S3_SECRET_ACCESS_KEY", "")
    S3_ENDPOINT_URL: str = os.getenv("S3_ENDPOINT_URL", "")
    # Если перед бакетом стоит свой домен/CDN — иначе URL собирается из
    # бакета/эндпоинта напрямую.
    S3_PUBLIC_URL_BASE: str = os.getenv("S3_PUBLIC_URL_BASE", "")

    LOCAL_MEDIA_DIR: str = os.getenv("LOCAL_MEDIA_DIR", "./media")
    LOCAL_MEDIA_BASE_URL: str = os.getenv("LOCAL_MEDIA_BASE_URL", "http://127.0.0.1:8001/media")

    # Максимальный размер одного загружаемого файла (байты) — canvas-модули
    # на фронте шлют PNG data URL целиком в JSON-теле запроса, без лимита
    # можно случайно положить и БД-соединение (JSON парсится целиком в
    # память), и сам процесс на большом файле.
    MAX_UPLOAD_BYTES: int = int(os.getenv("MAX_UPLOAD_BYTES", str(15 * 1024 * 1024)))  # 15 МБ

    def validate(self) -> None:
        """Явная проверка вместо тихого падения при первом запросе."""
        if not self.DATABASE_URL:
            raise RuntimeError(
                "DATABASE_URL не задан. Пропишите его в .env (см. .env.example)."
            )
        if not self.TELEGRAM_BOT_TOKEN and _is_production_like(self.ENV):
            raise RuntimeError(
                "TELEGRAM_BOT_TOKEN не задан — без него нельзя проверить подпись "
                "initData в production/staging."
            )


settings = Settings()
