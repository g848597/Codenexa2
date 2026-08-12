"""Этап 5 — Раздел «Дизайн» (05-design.md).

Все 6 модулей раздела рендерят изображение на клиенте (canvas) — единственное,
что реально нужно бэкенду, это принять готовый файл и отдать URL для
`result_url` в Smart History (POST /api/projects/:id/history, уже есть с
Этапа 1). Отдельных per-модульных эндпоинтов, как и в Этапах 2-4, не заводим —
`module_key` в теле различает Banner Creator / Avatar Creator / QR Creator /
Resize-Crop-Compress / Color Palette / Watermark Creator только для того,
чтобы разложить файлы по разным префиксам в хранилище (app/storage.py).
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import repo, storage
from app.deps import get_current_user

router = APIRouter(prefix="/api/tools", tags=["design"])


class DesignUploadBody(BaseModel):
    project_id: int
    module_key: str = Field(min_length=1, max_length=64)
    filename: str = Field(default="design.png", max_length=200)
    content_type: str | None = None
    data_base64: str = Field(min_length=1)


@router.post("/design-upload")
async def upload_design_asset(body: DesignUploadBody, user: dict = Depends(get_current_user)):
    project = repo.get_project(body.project_id, user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    url = storage.upload_image(
        body.data_base64,
        module_key=body.module_key,
        filename=body.filename,
        content_type_hint=body.content_type,
    )
    return {"url": url}
