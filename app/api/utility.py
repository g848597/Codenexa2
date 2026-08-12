"""Раздел «Utility» (Этап 3, см. 03-utility.md).

Из 6 модулей раздела серверная логика нужна только одному:
  - 3.6 URL Shortener — короткая ссылка и счётчик кликов не могут жить
    только на клиенте (иначе слаг не был бы общим для всех, кто открывает
    ссылку), поэтому нужны таблица short_links и редирект-эндпоинт.

3.1 Password Generator, 3.2 JSON Formatter, 3.3 Base64, 3.4 Timestamp
Converter, 3.5 UTM Builder — чисто клиентская логика по спеке. UTM Builder
по DoD пишет историю — как и в Этапе 2, это существующий универсальный
POST /api/projects/:id/history (app/api/history.py), отдельный роут не
заводим. Password Generator по спеке НЕ пишет ничего, даже через history —
секьюрити-требование ("пароли не должны лежать в истории").

Редирект GET /r/:slug вынесен в отдельный router без префикса /api — это
публичный эндпоинт, на который переходят по короткой ссылке напрямую в
браузере, а не вызов из фронтенда Mini App.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, field_validator

from app import repo
from app.config import settings
from app.deps import get_current_user

router = APIRouter(prefix="/api", tags=["utility"])
redirect_router = APIRouter(tags=["utility-redirect"])


# ---------- 3.6 URL Shortener ----------

class ShortenUrlBody(BaseModel):
    project_id: int
    original_url: str

    @field_validator("original_url")
    @classmethod
    def _must_be_http_url(cls, v: str) -> str:
        v = v.strip()
        if not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("URL должен начинаться с http:// или https://")
        if len(v) > 8192:
            raise ValueError("URL слишком длинный")
        return v


def _serialize_short_link(row: dict) -> dict:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "short_url": f"{settings.SHORT_LINK_BASE_URL}/r/{row['slug']}",
        "original_url": row["original_url"],
        "clicks": row["clicks"],
        "created_at": row["created_at"],
    }


def _require_project(project_id: int, user: dict) -> dict:
    project = repo.get_project(project_id, user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return project


@router.post("/tools/url-shortener")
async def shorten_url(body: ShortenUrlBody, user: dict = Depends(get_current_user)):
    _require_project(body.project_id, user)
    row = repo.create_short_link(body.project_id, body.original_url)
    # Запись-ссылка в generated_items — по спеке 3.6, "плюс запись-ссылка
    # в generated_items" (сама short_links остаётся источником правды по
    # кликам, generated_items — просто попадание в общую Smart History).
    short_url = f"{settings.SHORT_LINK_BASE_URL}/r/{row['slug']}"
    repo.create_history_item(
        body.project_id,
        "url_shortener",
        title=short_url,
        payload={"original_url": body.original_url, "slug": row["slug"]},
        result_text=short_url,
    )
    return {"short_link": _serialize_short_link(row)}


@router.get("/projects/{project_id}/short-links")
async def list_short_links(
    project_id: int,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    user: dict = Depends(get_current_user),
):
    """Список сокращённых ссылок проекта со счётчиком кликов — generated_items
    хранит только слепок на момент создания, а клики растут после, поэтому
    для актуальных цифр читаем напрямую из short_links."""
    _require_project(project_id, user)
    rows = repo.list_short_links(project_id, limit=limit, offset=offset)
    return {"short_links": [_serialize_short_link(r) for r in rows]}


@redirect_router.get("/r/{slug}")
async def redirect_short_link(slug: str):
    row = repo.get_short_link_by_slug(slug)
    if not row:
        raise HTTPException(status_code=404, detail="Ссылка не найдена")
    repo.increment_short_link_clicks(slug)
    return RedirectResponse(url=row["original_url"], status_code=302)
