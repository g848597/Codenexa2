"""Раздел «Telegram Tools» (Этап 2, см. 02-telegram-tools.md).

Из 6 модулей раздела серверная логика нужна только трём:
  - 2.1 Username Checker — браузер не может сходить на t.me напрямую
    (кросс-доменный запрос/CORS), поэтому проверка идёт через бэкенд.
  - 2.3 Deep Link Builder — синтаксис ссылки простой, но по DoD Этапа 2
    ("рабочий запрос к бэкенду/валидация") валидация продублирована на
    сервере, чтобы в generated_items не попадал невалидный payload.
  - 2.2 Bio Generator — шаблонная генерация вынесена на бэкенд, чтобы
    паттерны можно было менять/расширять (в перспективе — заменить на AI),
    не трогая фронтенд.

2.4 Markdown Builder, 2.5 Unicode Fonts, 2.6 Text Cleaner — чисто
клиентская логика по спеке, отдельных эндпоинтов не заводим. Если их
результат нужно сохранить (Markdown Builder — по DoD должен), это делает
уже существующий POST /api/projects/:id/history (app/api/history.py) —
отдельный history-роут под конкретный модуль по 01-core-foundation.md
заводить не нужно, generated_items универсальна для всех модулей.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from app import telegram_tools_logic as logic

router = APIRouter(prefix="/api/tools", tags=["telegram_tools"])


# ---------- 2.1 Username Checker ----------

@router.get("/username-checker")
async def check_username(username: str = Query(..., min_length=1, max_length=33)):
    clean = username.strip().lstrip("@")
    return await logic.check_username_availability(clean)


# ---------- 2.3 Deep Link Builder ----------

class DeepLinkBuildBody(BaseModel):
    bot_username: str
    link_type: str
    param: str = ""


@router.post("/deep-link-builder")
async def build_deep_link(body: DeepLinkBuildBody):
    result = logic.build_deep_link(
        body.bot_username.strip().lstrip("@"),
        body.link_type.strip(),
        body.param.strip(),
    )
    if not result["ok"]:
        raise HTTPException(status_code=422, detail=result["errors"])
    return result


# ---------- 2.2 Bio Generator ----------

class BioGenerateBody(BaseModel):
    niche: str
    tone: str = "friendly"
    keywords: str | None = None
    length: str = "short"  # "short" (~70 симв) | "medium" (~140 симв)


@router.post("/bio-generator")
async def generate_bio(body: BioGenerateBody):
    if not body.niche.strip():
        raise HTTPException(status_code=422, detail={"niche": "Укажите нишу/тему"})
    if body.tone not in logic.BIO_TONES:
        raise HTTPException(
            status_code=422,
            detail={"tone": f"Тон должен быть одним из: {', '.join(sorted(logic.BIO_TONES))}"},
        )
    variants = logic.generate_bio_variants(body.niche, body.tone, body.keywords, body.length)
    return {"variants": variants}
