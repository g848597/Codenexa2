"""Загрузка файлов для раздела «Дизайн» (Этап 5, 05-design.md).

Все 6 canvas-модулей рендерят изображение на клиенте и шлют готовый PNG/JPG
как data URL (`data:image/png;base64,...`) в теле запроса — сюда, в единую
точку загрузки. Rendering на бэкенде намеренно не делаем (см. 05-design.md,
"Не гнать рендеринг на бэкенд в MVP").

Хранилище — S3 (или S3-совместимое: Yandex Object Storage / Cloudflare R2 /
MinIO — через S3_ENDPOINT_URL), с автоматическим фоллбэком на локальный диск,
если S3_BUCKET не задан (dev-режим без поднятого бакета работает из коробки,
см. app/config.py). Фоллбэк — тот же приём, что уже использован для
SHORT_LINK_BASE_URL на Этапе 3.
"""
import base64
import os
import re
import uuid
from datetime import datetime, timezone

from fastapi import HTTPException

from app.config import settings

_DATA_URL_RE = re.compile(r"^data:(?P<mime>[\w/+.\-]+);base64,(?P<data>.+)$", re.DOTALL)

# Раздел «Дизайн» имеет дело только с изображениями — держим allowlist явным,
# чтобы через этот эндпоинт нельзя было залить произвольный файл/скрипт.
_ALLOWED_MIME = {"image/png", "image/jpeg", "image/webp", "image/svg+xml"}
_EXT_BY_MIME = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}


def _decode_data_url(data_base64: str, content_type_hint: str | None) -> tuple[bytes, str]:
    match = _DATA_URL_RE.match(data_base64.strip())
    if match:
        mime = match.group("mime").lower()
        raw_b64 = match.group("data")
    else:
        # На случай, если фронтенд когда-нибудь пришлёт голый base64 без
        # префикса data URL — подстрахуемся хинтом из тела запроса.
        mime = (content_type_hint or "image/png").lower()
        raw_b64 = data_base64.strip()

    if mime not in _ALLOWED_MIME:
        raise HTTPException(status_code=422, detail=f"Неподдерживаемый тип файла: {mime}")

    try:
        raw = base64.b64decode(raw_b64, validate=True)
    except Exception:
        raise HTTPException(status_code=422, detail="Некорректный base64 в data_base64")

    if len(raw) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=422,
            detail=f"Файл больше {settings.MAX_UPLOAD_BYTES // (1024 * 1024)} МБ",
        )
    return raw, mime


def _object_key(module_key: str, filename: str, mime: str) -> str:
    safe_module = re.sub(r"[^a-zA-Z0-9_-]", "_", module_key) or "design"
    stem = re.sub(r"[^a-zA-Z0-9_.\-]", "_", os.path.splitext(filename)[0]) or "file"
    ext = _EXT_BY_MIME.get(mime, "bin")
    stamp = datetime.now(timezone.utc).strftime("%Y/%m/%d")
    return f"design/{safe_module}/{stamp}/{uuid.uuid4().hex}_{stem}.{ext}"


def upload_image(data_base64: str, module_key: str, filename: str,
                  content_type_hint: str | None = None) -> str:
    """Декодирует data URL и сохраняет файл, возвращает публичный URL."""
    raw, mime = _decode_data_url(data_base64, content_type_hint)
    key = _object_key(module_key, filename, mime)
    if settings.S3_BUCKET:
        return _upload_to_s3(raw, key, mime)
    return _upload_to_local_disk(raw, key)


def _upload_to_s3(raw: bytes, key: str, content_type: str) -> str:
    try:
        import boto3
    except ImportError:
        raise HTTPException(
            status_code=500,
            detail="S3_BUCKET задан, но boto3 не установлен (pip install -r requirements.txt)",
        )

    client_kwargs: dict = {"region_name": settings.S3_REGION}
    if settings.S3_ENDPOINT_URL:
        client_kwargs["endpoint_url"] = settings.S3_ENDPOINT_URL
    if settings.S3_ACCESS_KEY_ID:
        client_kwargs["aws_access_key_id"] = settings.S3_ACCESS_KEY_ID
        client_kwargs["aws_secret_access_key"] = settings.S3_SECRET_ACCESS_KEY

    s3 = boto3.client("s3", **client_kwargs)
    try:
        s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=raw, ContentType=content_type)
    except Exception as exc:  # pragma: no cover - сетевой сбой во внешнем сервисе
        raise HTTPException(status_code=502, detail=f"Не удалось загрузить файл в S3: {exc}")

    if settings.S3_PUBLIC_URL_BASE:
        return f"{settings.S3_PUBLIC_URL_BASE.rstrip('/')}/{key}"
    if settings.S3_ENDPOINT_URL:
        return f"{settings.S3_ENDPOINT_URL.rstrip('/')}/{settings.S3_BUCKET}/{key}"
    return f"https://{settings.S3_BUCKET}.s3.{settings.S3_REGION}.amazonaws.com/{key}"


def _upload_to_local_disk(raw: bytes, key: str) -> str:
    path = os.path.join(settings.LOCAL_MEDIA_DIR, key)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(raw)
    return f"{settings.LOCAL_MEDIA_BASE_URL.rstrip('/')}/{key}"
