"""Управление ролями администраторов (аудит, раздел 13, "Средний
приоритет": "Ролевая модель админов (вместо allow-list)", раунд 6).

Все эндпоинты защищены get_current_superadmin — обычный admin (например,
тот, кто модерирует раздел "Инвесторы") видит 403 и не может ни посмотреть,
ни тем более изменить роли других пользователей. Это намеренное разделение:
скомпрометированный обычный admin-аккаунт не должен иметь возможность выдать
самому себе superadmin и захватить полный контроль над системой.

См. также app/web/deps.py (_apply_admin_bootstrap — как назначается самый
первый superadmin) и app/web/config.py (комментарий про ADMIN_EMAILS/
ADMIN_TELEGRAM_IDS как bootstrap-only после раунда 6).
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, field_validator

from app.web import repo
from app.web.audit import log_action
from app.web.deps import get_current_superadmin

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])

ASSIGNABLE_ROLES = {"user", "admin", "superadmin"}


def _shape(row: dict) -> dict:
    return {
        "id": row["id"],
        "email": row.get("email"),
        "telegramId": row.get("telegram_id"),
        "firstName": row.get("first_name"),
        "lastName": row.get("last_name"),
        "role": row.get("role") or "user",
    }


@router.get("")
def list_or_search_users(
    q: str = Query(default="", max_length=200),
    _admin: dict = Depends(get_current_superadmin),
):
    """Без ?q= — текущие admin/superadmin (обзор "кому уже выдана роль").
    С ?q= — поиск по email (частичное совпадение) или telegram_id (точное),
    чтобы найти пользователя и выдать ему роль."""
    if q.strip():
        rows = repo.search_users(q.strip(), limit=20)
    else:
        rows = repo.list_admins()
    return {"users": [_shape(r) for r in rows]}


class RoleBody(BaseModel):
    role: str

    @field_validator("role")
    @classmethod
    def _valid_role(cls, v: str) -> str:
        if v not in ASSIGNABLE_ROLES:
            raise ValueError(f"Роль должна быть одной из: {', '.join(sorted(ASSIGNABLE_ROLES))}")
        return v


@router.put("/{user_id}/role")
def set_role(
    user_id: int,
    payload: RoleBody,
    request: Request,
    admin: dict = Depends(get_current_superadmin),
):
    target = repo.get_user_by_id(user_id)
    if not target:
        raise HTTPException(status_code=404, detail="Пользователь не найден")

    # Запрет понижать роль самому себе — только другой superadmin может это
    # сделать. Без этой проверки можно было бы случайно (например, опечаткой
    # в выпадающем списке) остаться без доступа к собственной панели.
    if user_id == admin["id"] and payload.role != "superadmin":
        raise HTTPException(
            status_code=400,
            detail="Нельзя понизить собственную роль — попросите другого superadmin",
        )

    # Запрет понижать ПОСЛЕДНЕГО superadmin в системе (даже другим
    # superadmin-ом) — иначе система осталась бы без единого пользователя,
    # способного выдавать роли, и потребовалось бы прямое вмешательство в БД.
    if payload.role != "superadmin" and target.get("role") == "superadmin":
        if repo.count_superadmins() <= 1:
            raise HTTPException(
                status_code=400,
                detail="Нельзя понизить последнего superadmin в системе",
            )

    previous_role = target.get("role") or "user"
    updated = repo.set_user_role(user_id, payload.role)
    log_action(
        request,
        admin,
        action="role_change",
        target_type="user",
        target_id=user_id,
        details={"from": previous_role, "to": payload.role, "targetEmail": target.get("email")},
    )
    return {"user": _shape(updated)}


@router.get("/audit-log")
def get_audit_log(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    action: str | None = Query(default=None, max_length=100),
    adminId: int | None = Query(default=None),  # noqa: N803 — camelCase на границе с фронтендом
    _admin: dict = Depends(get_current_superadmin),
):
    """Только superadmin — сам аудит-лог о действиях админов является
    чувствительными данными (кто что менял), не для обычного admin."""
    rows = repo.list_audit_log(limit=limit, offset=offset, action=action, admin_id=adminId)
    total = repo.count_audit_log(action=action, admin_id=adminId)
    return {
        "entries": [
            {
                "id": r["id"],
                "adminId": r["admin_id"],
                "adminEmail": r.get("admin_email"),
                "adminName": r.get("admin_first_name"),
                "action": r["action"],
                "targetType": r["target_type"],
                "targetId": r["target_id"],
                "details": r["details"],
                "ip": r["ip"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ],
        "total": total,
        "limit": limit,
        "offset": offset,
    }
