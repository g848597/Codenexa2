"""Управление тарифами (аудит, раздел 12 "Объединить": PLANS из статичного
словаря в billing.py -> таблица `plans` с историей изменения цен, раунд 8).

Изменение цены — чувствительное действие (напрямую влияет на выручку),
поэтому доступно только superadmin (тот же уровень доступа, что и
управление ролями в admin_users.py) и пишется в общий аудит-лог через
app/web/audit.py::log_action() — тот же принцип, что и для CRUD инвесторов
и смены ролей в предыдущих раундах."""
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, field_validator

from app.web import money, repo
from app.web.audit import log_action
from app.web.deps import get_current_superadmin

router = APIRouter(prefix="/api/admin/plans", tags=["admin-plans"])


def _shape(row: dict) -> dict:
    return {
        "id": row["id"],
        "code": row["code"],
        "title": row["title"],
        "usd": money.to_display(row["usd"], "USD"),
        "stars": row["stars"],
        "isActive": row["is_active"],
        "createdAt": row["created_at"],
    }


@router.get("")
def list_plans(_admin: dict = Depends(get_current_superadmin)):
    """Только действующие тарифы — используйте /history для полной истории цен."""
    return {"plans": [_shape(p) for p in repo.get_active_plans()]}


@router.get("/history")
def get_plan_history(
    code: str | None = Query(default=None, max_length=100),
    _admin: dict = Depends(get_current_superadmin),
):
    return {"history": [_shape(p) for p in repo.list_plan_history(code)]}


class PlanBody(BaseModel):
    title: str
    usd: str
    stars: int

    @field_validator("title")
    @classmethod
    def _title_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("title не может быть пустым")
        return v.strip()

    @field_validator("stars")
    @classmethod
    def _stars_positive(cls, v: int) -> int:
        if v <= 0:
            raise ValueError("stars должно быть положительным числом")
        return v


@router.put("/{code}")
def set_plan_price(code: str, payload: PlanBody, request: Request, admin: dict = Depends(get_current_superadmin)):
    """Меняет цену тарифа `code` (или создаёт его, если такого кода ещё не
    было) — старая цена не удаляется, а остаётся в истории (см.
    repo.set_plan_price). Идемпотентности здесь намеренно нет: это админ-
    панель с явным нажатием кнопки "Сохранить", а не платёжный чекаут, где
    повторный клик/ретрай сети — обычный сценарий."""
    try:
        usd_decimal = money.to_decimal(payload.usd)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    if usd_decimal <= 0:
        raise HTTPException(status_code=400, detail="usd должно быть положительным числом")

    previous = repo.get_active_plan(code)
    updated = repo.set_plan_price(code, payload.title, usd_decimal, payload.stars)
    log_action(
        request,
        admin,
        action="plan_price_change",
        target_type="plan",
        target_id=code,
        details={
            "from": {"usd": str(previous["usd"]), "stars": previous["stars"]} if previous else None,
            "to": {"usd": str(usd_decimal), "stars": payload.stars},
        },
    )
    return {"plan": _shape(updated)}
