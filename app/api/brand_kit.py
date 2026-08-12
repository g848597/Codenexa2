from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app import repo
from app.deps import get_current_user

router = APIRouter(prefix="/api/projects", tags=["brand-kit"])

VALID_TONES = {"friendly", "expert", "sales", "official"}


class BrandKitBody(BaseModel):
    logo_url: str | None = None
    primary_color: str | None = None
    secondary_color: str | None = None
    accent_color: str | None = None
    font_family: str | None = None
    brand_emojis: list[str] | None = None
    tone_of_voice: str | None = None


def _require_project(project_id: int, user: dict) -> dict:
    project = repo.get_project(project_id, user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return project


@router.get("/{project_id}/brand-kit")
async def get_brand_kit(project_id: int, user: dict = Depends(get_current_user)):
    _require_project(project_id, user)
    kit = repo.get_brand_kit(project_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Brand Kit не найден")
    return {"brand_kit": kit}


@router.put("/{project_id}/brand-kit")
async def put_brand_kit(project_id: int, body: BrandKitBody, user: dict = Depends(get_current_user)):
    _require_project(project_id, user)

    if body.tone_of_voice is not None and body.tone_of_voice not in VALID_TONES:
        raise HTTPException(
            status_code=422,
            detail=f"tone_of_voice должен быть одним из: {sorted(VALID_TONES)}",
        )
    if body.brand_emojis is not None and len(body.brand_emojis) > 5:
        raise HTTPException(status_code=422, detail="Максимум 5 фирменных эмодзи")

    fields = body.model_dump(exclude_none=True)
    kit = repo.create_or_update_brand_kit(project_id, fields)
    return {"brand_kit": kit}
