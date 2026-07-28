"""Командные (бизнес-тариф) аккаунты. Компания, купившая самый дорогой
тариф, может создать организацию и пригласить в неё сотрудников — все
участники видят и могут создавать общие для компании шаблоны документов
(см. app/web/api/docs.py). Один пользователь состоит максимум в одной
организации (см. idx_org_members_user в db.py) — упрощение для первой
версии, достаточное, пока у нас нет сценария "сотрудник в двух компаниях".
"""
import secrets

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator

from app.web import repo
from app.web.deps import get_current_superadmin, get_current_user

router = APIRouter(prefix="/api/organizations", tags=["organizations"])

# Тарифы, дающие право создать организацию. Держим здесь, а не хардкодим
# один код — на случай, если позже появится несколько уровней бизнес-тарифа.
BUSINESS_PLAN_CODES = {"business_yearly"}


def _member_shape(row: dict) -> dict:
    return {
        "userId": row["user_id"],
        "role": row["role"],
        "firstName": row.get("first_name"),
        "lastName": row.get("last_name"),
        "email": row.get("email"),
        "joinedAt": row["created_at"],
    }


def _has_paid_business_plan(user_id: int) -> bool:
    payments = repo.list_payments(user_id)
    return any(p["status"] == "paid" and p.get("plan") in BUSINESS_PLAN_CODES for p in payments)


class CreateOrgBody(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def _name_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Название компании не может быть пустым")
        return v.strip()


@router.get("/me")
def get_my_organization(user: dict = Depends(get_current_user)):
    """Организация текущего пользователя (если состоит), плюс список
    сотрудников, если он владелец. Пустой ответ — не в организации."""
    membership = repo.get_user_membership(user["id"])
    if not membership:
        return {"organization": None}
    members = repo.list_organization_members(membership["org_id"])
    return {
        "organization": {
            "id": membership["org_id"],
            "name": membership["org_name"],
            "planCode": membership["org_plan_code"],
            "myRole": membership["role"],
        },
        "members": [_member_shape(m) for m in members],
    }


@router.get("/admin/all")
def admin_list_all_organizations(_admin: dict = Depends(get_current_superadmin)):
    """Read-only обзор ВСЕХ организаций для Admin-панели (см.
    admin_panel_build_prompt.md, п.9, "Organizations overview" — опционально,
    добавлено т.к. `/api/organizations/me` намеренно видит только СВОЮ
    организацию и list-all для этого раньше не существовало). Только
    superadmin: это не CRUD, никаких мутирующих действий здесь нет, поэтому
    log_action() не нужен — тот же принцип, что и у публичного
    list_public_investors() в investors.py."""
    rows = repo.list_organizations_overview()
    return {
        "organizations": [
            {
                "id": r["id"],
                "name": r["name"],
                "planCode": r["plan_code"],
                "ownerEmail": r.get("owner_email"),
                "ownerName": " ".join(
                    p for p in [r.get("owner_first_name"), r.get("owner_last_name")] if p
                )
                or None,
                "memberCount": r["member_count"],
                "createdAt": r["created_at"],
            }
            for r in rows
        ]
    }


@router.post("")
def create_organization(body: CreateOrgBody, user: dict = Depends(get_current_user)):
    if repo.get_user_membership(user["id"]):
        raise HTTPException(400, "Вы уже состоите в организации")
    if not _has_paid_business_plan(user["id"]):
        raise HTTPException(403, "Создание организации доступно только на бизнес-тарифе")
    org = repo.create_organization(body.name, user["id"], "business_yearly")
    return {"organization": org}


class InviteBody(BaseModel):
    email: str | None = None


@router.post("/invite")
def invite_member(body: InviteBody, user: dict = Depends(get_current_user)):
    membership = repo.get_user_membership(user["id"])
    if not membership or membership["role"] != "owner":
        raise HTTPException(403, "Приглашать сотрудников может только владелец организации")
    token = secrets.token_urlsafe(24)
    invite = repo.create_organization_invite(membership["org_id"], token, body.email)
    return {"token": invite["token"]}


@router.post("/invite/{token}/accept")
def accept_invite(token: str, user: dict = Depends(get_current_user)):
    result = repo.accept_organization_invite(token, user["id"])
    if not result:
        raise HTTPException(
            400, "Приглашение недействительно, уже использовано, или вы уже в другой организации"
        )
    return {"ok": True}


@router.delete("/members/{member_user_id}")
def remove_member(member_user_id: int, user: dict = Depends(get_current_user)):
    membership = repo.get_user_membership(user["id"])
    if not membership or membership["role"] != "owner":
        raise HTTPException(403, "Удалять сотрудников может только владелец организации")
    if member_user_id == user["id"]:
        raise HTTPException(400, "Владелец не может удалить сам себя")
    repo.remove_organization_member(membership["org_id"], member_user_id)
    return {"ok": True}


@router.post("/leave")
def leave_organization(user: dict = Depends(get_current_user)):
    """Обычный сотрудник может сам покинуть организацию. Владелец — нет
    (нет сценария передачи владения/удаления компании в этой версии), ему
    предлагается сначала передать роль или закрыть компанию другим путём."""
    membership = repo.get_user_membership(user["id"])
    if not membership:
        raise HTTPException(400, "Вы не состоите в организации")
    if membership["role"] == "owner":
        raise HTTPException(
            400, "Владелец не может покинуть организацию — сначала передайте владение или обратитесь в поддержку"
        )
    repo.remove_organization_member(membership["org_id"], user["id"])
    return {"ok": True}
