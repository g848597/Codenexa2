"""Точка входа Telegram Toolkit API.

Запуск локально:
    uvicorn app.server:app --reload --port 8001

Продакшн:
    uvicorn app.server:app --host 0.0.0.0 --port $PORT

В отличие от Codenexa2 (тот же процесс/домен отдаёт и фронтенд, и API), это
отдельный сервис — фронтенд (React Mini App) будет ходить сюда по CORS,
поэтому CORSMiddleware обязателен.
"""
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import brand_kit, content, design, growth, history, me, modules, projects, telegram_tools, utility
from app.config import settings
from app.db import init_db

app = FastAPI(title="Telegram Toolkit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(me.router)
app.include_router(projects.router)
app.include_router(brand_kit.router)
app.include_router(history.router)
app.include_router(modules.router)
app.include_router(telegram_tools.router)
app.include_router(utility.router)
app.include_router(utility.redirect_router)
app.include_router(content.router)
app.include_router(design.router)
app.include_router(growth.router)
app.include_router(growth.tools_router)


@app.on_event("startup")
async def _startup():
    settings.validate()
    init_db()
    # Этап 5: если S3 не настроен (см. app/storage.py), design-upload пишет
    # файлы на локальный диск — раздаём их отсюда же под /media, чтобы
    # result_url из Smart History открывался и в dev-режиме без бакета.
    if not settings.S3_BUCKET:
        os.makedirs(settings.LOCAL_MEDIA_DIR, exist_ok=True)
        app.mount("/media", StaticFiles(directory=settings.LOCAL_MEDIA_DIR), name="media")


@app.get("/health")
async def health():
    return {"status": "ok"}
