"""Раздел «Контент» (Этап 4, см. 04-content.md).

Зависимость — Этап 1 (Brand Kit обязателен: tone_of_voice и brand_emojis
используются как дефолты/входные данные всех генераторов). Brand Kit сам
по себе читается фронтендом через уже существующий
GET /api/projects/:id/brand-kit (app/api/brand_kit.py) — здесь отдельного
эндпоинта под него не заводим, только принимаем tone/brand_emojis как поля
тела запроса (фронтенд подставляет их дефолтом из Brand Kit, пользователь
может переопределить перед генерацией).

Все 6 модулей — на шаблонном движке (app/content_engine.py + бизнес-логика
в app/content_logic.py), без AI в MVP. Сохранение в историю — как и в
Этапах 2-3, через универсальный POST /api/projects/:id/history, отдельных
per-модульных эндпоинтов сохранения не заводим.
"""
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app import content_logic as logic

router = APIRouter(prefix="/api/tools", tags=["content"])


def _tone_error(tone: str) -> dict:
    return {"tone": f"Тон должен быть одним из: {', '.join(sorted(logic.CONTENT_TONES))}"}


# ---------- 4.1 Конструктор постов ----------

class PostConstructorBody(BaseModel):
    post_type: str
    topic: str
    theses: list[str] = Field(default_factory=list)
    tone: str = "friendly"
    brand_emojis: list[str] = Field(default_factory=list)


@router.post("/post-constructor")
async def post_constructor(body: PostConstructorBody):
    if body.post_type not in logic.POST_TYPES:
        raise HTTPException(
            status_code=422,
            detail={"post_type": f"Тип поста должен быть одним из: {', '.join(sorted(logic.POST_TYPES))}"},
        )
    if not body.topic.strip():
        raise HTTPException(status_code=422, detail={"topic": "Укажите тему поста"})
    if body.tone not in logic.CONTENT_TONES:
        raise HTTPException(status_code=422, detail=_tone_error(body.tone))

    result = logic.build_post(
        body.post_type, body.topic.strip(), body.theses, body.tone, body.brand_emojis,
    )
    return result


# ---------- 4.2 Конструктор приветственного сообщения ----------

class WelcomeMessageBody(BaseModel):
    channel_name: str
    perks: list[str] = Field(default_factory=list)
    rules_short: str | None = None
    tone: str = "friendly"


@router.post("/welcome-message")
async def welcome_message(body: WelcomeMessageBody):
    if not body.channel_name.strip():
        raise HTTPException(status_code=422, detail={"channel_name": "Укажите название канала/группы"})
    if body.tone not in logic.CONTENT_TONES:
        raise HTTPException(status_code=422, detail=_tone_error(body.tone))

    result = logic.build_welcome_message(
        body.channel_name, body.perks, body.rules_short, body.tone,
    )
    return result


# ---------- 4.3 Конструктор правил группы ----------

class GroupRulesBody(BaseModel):
    community_type: str
    standard_rule_keys: list[str] = Field(default_factory=list)
    custom_rules: list[str] = Field(default_factory=list)


@router.post("/group-rules")
async def group_rules(body: GroupRulesBody):
    if body.community_type not in logic.COMMUNITY_TYPES:
        raise HTTPException(
            status_code=422,
            detail={"community_type": f"Тип сообщества должен быть одним из: {', '.join(sorted(logic.COMMUNITY_TYPES))}"},
        )
    unknown_keys = set(body.standard_rule_keys) - set(logic.STANDARD_RULES_BANK.keys())
    if unknown_keys:
        raise HTTPException(status_code=422, detail={"standard_rule_keys": f"Неизвестные пункты: {sorted(unknown_keys)}"})

    result = logic.build_group_rules(body.community_type, body.standard_rule_keys, body.custom_rules)
    return result


@router.get("/group-rules/catalog")
async def group_rules_catalog():
    """Каталог типовых пунктов правил и типов сообществ — чтобы фронтенд
    не дублировал эти константы вручную и не рассинхронизировался с
    бэкендом при добавлении новых пунктов."""
    return {
        "standard_rules": [{"key": k, "label": v} for k, v in logic.STANDARD_RULES_BANK.items()],
        "community_types": [{"key": k, "label": v} for k, v in logic.COMMUNITY_TYPE_LABELS.items()],
    }


# ---------- 4.4 Генератор заголовков ----------

@router.get("/headline-generator")
async def headline_generator(
    topic: str = Query(..., min_length=1, max_length=200),
    count: int = Query(default=5),
):
    if count not in (3, 5, 10):
        raise HTTPException(status_code=422, detail={"count": "Количество вариантов должно быть 3, 5 или 10"})
    headlines = logic.generate_headlines(topic.strip(), count)
    return {"headlines": headlines}


# ---------- 4.5 Генератор CTA/призывов ----------

class CtaGeneratorBody(BaseModel):
    goal: str
    tone: str = "friendly"


@router.post("/cta-generator")
async def cta_generator(body: CtaGeneratorBody):
    if body.goal not in logic.CTA_GOALS:
        raise HTTPException(
            status_code=422,
            detail={"goal": f"Цель должна быть одной из: {', '.join(sorted(logic.CTA_GOALS))}"},
        )
    if body.tone not in logic.CONTENT_TONES:
        raise HTTPException(status_code=422, detail=_tone_error(body.tone))

    variants = logic.generate_cta_variants(body.goal, body.tone, count=3)
    return {"variants": variants}


# ---------- 4.6 Генератор хештегов ----------

@router.get("/hashtag-generator")
async def hashtag_generator(
    niche: str = Query(..., min_length=1, max_length=100),
    category: str = Query(...),
    count: int = Query(default=10),
):
    if category not in logic.HASHTAG_CATEGORIES:
        raise HTTPException(
            status_code=422,
            detail={"category": f"Категория должна быть одной из: {', '.join(sorted(logic.HASHTAG_CATEGORIES))}"},
        )
    if count not in (5, 10, 15):
        raise HTTPException(status_code=422, detail={"count": "Количество хештегов должно быть 5, 10 или 15"})

    hashtags = logic.generate_hashtags(niche.strip(), category, count)
    return {"hashtags": hashtags}
