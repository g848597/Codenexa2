"""Единая точка аутентификации запроса. Понимает два формата заголовка
Authorization, оба уже используются/ожидаются во фронтенде:

  Authorization: tma <initData>      — когда мини-апп открыт внутри Telegram
  Authorization: Bearer <jwt>        — сессия после email/Google/Yandex-логина

Если пользователь авторизован через Telegram впервые — автоматически
создаём (или подтягиваем) учётную запись, никакого отдельного шага
"регистрации" через Telegram не требуется (Модуль: одно касание = вход).
"""
from fastapi import Header, HTTPException

from app.web import repo, security
from app.web.api.telegram_auth import validate_init_data
from app.web.config import settings


def is_admin_user(user: dict | None) -> bool:
    """Роль хранится в БД (users.role) — см. комментарий в config.py про
    переход от allow-list к ролевой модели (раунд 6, аудит раздел 13,
    "Средний приоритет"). 'admin' и 'superadmin' оба проходят обычные
    admin-эндпоинты (например /api/investors/admin/*); разница только в
    доступе к управлению ролями других пользователей, см.
    is_superadmin_user()."""
    if not user:
        return False
    return user.get("role") in ("admin", "superadmin")


def is_superadmin_user(user: dict | None) -> bool:
    """superadmin — единственная роль, которой можно выдавать/отзывать роли
    другим пользователям через /api/admin/users. Обычный admin намеренно не
    может этого делать: скомпрометированный admin-аккаунт иначе мог бы сам
    себе выдать superadmin и захватить полный контроль."""
    if not user:
        return False
    return user.get("role") == "superadmin"


def _apply_admin_bootstrap(user: dict | None) -> dict | None:
    """Самозалечивающийся bootstrap первого superadmin. Проблема холодного
    старта: чтобы выдать роль через /api/admin/users, там уже нужен хотя бы
    один superadmin — курица и яйцо. Решение: пока в БД НЕТ ни одного
    superadmin, при входе пользователя с email/telegram_id из
    ADMIN_EMAILS/ADMIN_TELEGRAM_IDS (.env) ему автоматически выдаётся роль
    superadmin.

    Важно, что проверка именно "нет ни одного superadmin в БД", а не "роль
    ещё не назначена этому пользователю": если бы бустрап срабатывал всегда,
    пока пользователь есть в .env, другой superadmin не мог бы по-настоящему
    отозвать у него доступ через API — при следующем логине роль вернулась
    бы обратно. Как только в системе появился хотя бы один superadmin, .env
    полностью перестаёт быть источником прав — дальше только явные действия
    через /api/admin/users."""
    if not user or user.get("role") not in (None, "user"):
        return user
    email = (user.get("email") or "").strip().lower()
    tg_id = user.get("telegram_id")
    is_bootstrap_candidate = (email and email in settings.ADMIN_EMAILS) or (
        tg_id and str(tg_id) in settings.ADMIN_TELEGRAM_IDS
    )
    if not is_bootstrap_candidate:
        return user
    if repo.count_superadmins() > 0:
        return user
    return repo.set_user_role(user["id"], "superadmin")


def _get_or_create_telegram_user(tg_user: dict):
    tg_id = tg_user.get("id")
    if not tg_id:
        return None
    existing = repo.get_user_by_telegram_id(tg_id)
    if existing:
        repo.touch_login(existing["id"])
        return existing
    return repo.create_user(
        telegram_id=tg_id,
        first_name=tg_user.get("first_name"),
        last_name=tg_user.get("last_name"),
        avatar_url=None,
    )


async def get_current_user(authorization: str | None = Header(default=None)):
    user = try_get_current_user_value(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    return user


async def get_current_user_optional(authorization: str | None = Header(default=None)):
    return try_get_current_user_value(authorization)


def try_get_current_user_value(authorization: str | None):
    if not authorization:
        return None

    if authorization.startswith("tma "):
        init_data = authorization[4:]
        payload = validate_init_data(init_data)
        if not payload or not payload.get("user"):
            return None
        user = _get_or_create_telegram_user(payload["user"])
        return _apply_admin_bootstrap(user)

    if authorization.startswith("Bearer "):
        token = authorization[7:]
        decoded = security.decode_session_token(token)
        if not decoded:
            return None
        jti = decoded.get("jti")
        if not jti or not repo.is_session_valid(jti):
            return None
        user = repo.get_user_by_id(int(decoded["sub"]))
        return _apply_admin_bootstrap(user)

    return None


async def get_current_admin(authorization: str | None = Header(default=None)):
    """Требует не только валидную сессию, но и роль admin/superadmin в БД.
    403 (а не 404), чтобы не путать с 'ресурс не найден' — но без утечки
    деталей о том, у кого именно есть доступ."""
    user = try_get_current_user_value(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    if not is_admin_user(user):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return user


async def get_current_superadmin(authorization: str | None = Header(default=None)):
    """Как get_current_admin, но требует именно superadmin — используется
    только для /api/admin/users (управление ролями других пользователей)."""
    user = try_get_current_user_value(authorization)
    if not user:
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    if not is_superadmin_user(user):
        raise HTTPException(status_code=403, detail="Недостаточно прав")
    return user
