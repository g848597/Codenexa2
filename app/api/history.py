from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app import repo
from app.deps import get_current_user

router = APIRouter(prefix="/api/projects", tags=["history"])


class CreateHistoryItemBody(BaseModel):
    module_key: str
    title: str | None = None
    payload: dict = {}
    result_url: str | None = None
    result_text: str | None = None


class PatchHistoryItemBody(BaseModel):
    is_favorite: bool


def _require_project(project_id: int, user: dict) -> dict:
    project = repo.get_project(project_id, user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return project


@router.get("/{project_id}/history")
async def list_history(
    project_id: int,
    module: str | None = Query(default=None, description="Фильтр по module_key"),
    favorites: bool = Query(default=False),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    _require_project(project_id, user)
    items = repo.list_history(project_id, module_key=module, favorites_only=favorites,
                               limit=limit, offset=offset)
    return {"items": items}


@router.post("/{project_id}/history")
async def create_history_item(project_id: int, body: CreateHistoryItemBody,
                               user: dict = Depends(get_current_user)):
    """Универсальная запись в историю — каждый модуль (Этапы 2-7) вызывает
    этот эндпоинт после генерации результата, отдельных таблиц/эндпоинтов
    под конкретные модули не создаём (см. 01-core-foundation.md, 1.2)."""
    _require_project(project_id, user)
    item = repo.create_history_item(
        project_id, body.module_key, body.title, body.payload,
        body.result_url, body.result_text,
    )
    return {"item": item}


@router.patch("/{project_id}/history/{item_id}")
async def patch_history_item(project_id: int, item_id: int, body: PatchHistoryItemBody,
                              user: dict = Depends(get_current_user)):
    _require_project(project_id, user)
    item = repo.set_history_favorite(item_id, project_id, body.is_favorite)
    if not item:
        raise HTTPException(status_code=404, detail="Запись истории не найдена")
    return {"item": item}


@router.delete("/{project_id}/history/{item_id}")
async def delete_history_item(project_id: int, item_id: int, user: dict = Depends(get_current_user)):
    _require_project(project_id, user)
    ok = repo.delete_history_item(item_id, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Запись истории не найдена")
    return {"deleted": True}
