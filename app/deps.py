"""Единая точка аутентификации запроса.

Формат заголовка (по спеке 1.1 — никакого отдельного логина/пароля нет):
    Authorization: tma <initData>

При первом входе пользователь и его дефолтный проект создаются автоматически
(repo.get_or_create_user_from_telegram)."""
from fastapi import Header, HTTPException

from app import repo
from app.telegram_auth import validate_init_data


def _extract_user(authorization: str | None) -> dict | None:
    if not authorization or not authorization.startswith("tma "):
        return None
    init_data = authorization[4:]
    payload = validate_init_data(init_data)
    if not payload or not payload.get("user"):
        return None
    return repo.get_or_create_user_from_telegram(payload["user"])


async def get_current_user(authorization: str | None = Header(default=None)) -> dict:
    user = _extract_user(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация через Telegram initData")
    return user


async def get_current_user_optional(authorization: str | None = Header(default=None)) -> dict | None:
    return _extract_user(authorization)
