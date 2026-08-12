"""Раздел «Рост» (Этап 6, см. 06-growth.md).

Зависимость — Этап 1 (Workspace: проекты/история) и Этап 4 (Контент: 6.3
"Создать пост из этой идеи" открывает Конструктор постов на фронтенде с
предзаполненной темой — чистая клиентская навигация с react-router state,
без HTTP-вызова, тот же паттерн, что UTM Builder -> URL Shortener на
Этапе 3, см. PostConstructor.tsx).

Два роутера в файле (как utility.py на Этапе 3 с router/redirect_router):
- `router` (`/api/projects/{id}/content-plan...`) — 6.1 Контент-план, тем же
  эндпоинтом пользуется и 6.2 Календарь (см. 06-growth.md: "не создавать
  отдельную таблицу, только другое представление" — на бэкенде это тоже
  один и тот же список, с опциональным фильтром `with_date_only`).
- `tools_router` (`/api/tools/...`) — 6.3 идеи, 6.4 опрос/викторина.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app import growth_logic as logic
from app import repo
from app.deps import get_current_user

router = APIRouter(prefix="/api/projects", tags=["growth"])
tools_router = APIRouter(prefix="/api/tools", tags=["growth"])


def _require_project(project_id: int, user: dict) -> dict:
    project = repo.get_project(project_id, user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return project


def _status_error() -> dict:
    return {"status": f"Статус должен быть одним из: {', '.join(sorted(repo.CONTENT_PLAN_STATUSES))}"}


# =====================================================================
# 6.1 Контент-план / 6.2 Календарь — общий источник данных
# =====================================================================

class CreateContentPlanItemBody(BaseModel):
    title: str
    status: str = "idea"
    planned_date: str | None = None  # 'YYYY-MM-DD'
    linked_generated_item_id: int | None = None


class UpdateContentPlanItemBody(BaseModel):
    title: str | None = None
    status: str | None = None
    planned_date: str | None = None
    # planned_date=None в теле неотличимо от "поле не передали" в Pydantic
    # по умолчанию (оба варианта дают None) — явный флаг нужен, чтобы можно
    # было осознанно снять дату с карточки, не трогая остальные поля.
    clear_planned_date: bool = False


@router.get("/{project_id}/content-plan")
async def list_content_plan(
    project_id: int,
    status: str | None = Query(default=None, description="Фильтр по колонке канбана"),
    with_date_only: bool = Query(default=False, description="6.2 Календарь — только карточки с датой"),
    user: dict = Depends(get_current_user),
):
    _require_project(project_id, user)
    if status and status not in repo.CONTENT_PLAN_STATUSES:
        raise HTTPException(status_code=422, detail=_status_error())
    items = repo.list_content_plan_items(project_id, status=status, only_with_date=with_date_only)
    return {"items": items}


@router.post("/{project_id}/content-plan")
async def create_content_plan_item(
    project_id: int, body: CreateContentPlanItemBody, user: dict = Depends(get_current_user),
):
    """Универсальная точка создания карточки — используется и формой
    «Создать карточку вручную» на канбане (6.1), и кнопкой «В контент-план»
    из Генератора идей (6.3, без linked_generated_item_id — идея не лежит в
    generated_items), и (по DoD) кнопкой «В контент-план» из Smart History
    (с linked_generated_item_id — существующая запись истории)."""
    _require_project(project_id, user)
    if not body.title.strip():
        raise HTTPException(status_code=422, detail={"title": "Укажите название карточки"})
    if body.status not in repo.CONTENT_PLAN_STATUSES:
        raise HTTPException(status_code=422, detail=_status_error())
    if body.linked_generated_item_id is not None:
        linked = repo.get_history_item(body.linked_generated_item_id, project_id)
        if not linked:
            raise HTTPException(status_code=404, detail="Связанная запись истории не найдена")

    item = repo.create_content_plan_item(
        project_id, body.title.strip(), body.status, body.planned_date, body.linked_generated_item_id,
    )
    return {"item": item}


@router.patch("/{project_id}/content-plan/{item_id}")
async def update_content_plan_item(
    project_id: int, item_id: int, body: UpdateContentPlanItemBody, user: dict = Depends(get_current_user),
):
    """Одна точка правки и для селекта статуса на канбане (мобильный
    фоллбэк вместо drag-and-drop, см. 06-growth.md 6.1), и для редактирования
    карточки по клику из календаря (6.2)."""
    _require_project(project_id, user)
    if body.status is not None and body.status not in repo.CONTENT_PLAN_STATUSES:
        raise HTTPException(status_code=422, detail=_status_error())

    fields: dict = {}
    if body.title is not None:
        if not body.title.strip():
            raise HTTPException(status_code=422, detail={"title": "Название не может быть пустым"})
        fields["title"] = body.title.strip()
    if body.status is not None:
        fields["status"] = body.status
    if body.clear_planned_date:
        fields["planned_date"] = None
    elif body.planned_date is not None:
        fields["planned_date"] = body.planned_date

    item = repo.update_content_plan_item(item_id, project_id, fields)
    if not item:
        raise HTTPException(status_code=404, detail="Карточка контент-плана не найдена")
    return {"item": item}


@router.delete("/{project_id}/content-plan/{item_id}")
async def delete_content_plan_item(project_id: int, item_id: int, user: dict = Depends(get_current_user)):
    _require_project(project_id, user)
    ok = repo.delete_content_plan_item(item_id, project_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Карточка контент-плана не найдена")
    return {"deleted": True}


# =====================================================================
# 6.3 Генератор идей постов
# =====================================================================

@tools_router.get("/idea-generator")
async def idea_generator(
    niche: str = Query(..., min_length=1, max_length=200),
    count: int = Query(default=5),
):
    if count not in (5, 10):
        raise HTTPException(status_code=422, detail={"count": "Количество идей должно быть 5 или 10"})
    ideas = logic.generate_ideas(niche.strip(), count)
    return {"ideas": ideas}


# =====================================================================
# 6.4 Генератор опросов/викторин
# =====================================================================

class PollQuizBody(BaseModel):
    type: str
    question: str
    options: list[str] = Field(default_factory=list)
    correct_index: int | None = None


@tools_router.post("/poll-quiz-builder")
async def poll_quiz_builder(body: PollQuizBody):
    if body.type not in logic.POLL_TYPES:
        raise HTTPException(
            status_code=422,
            detail={"type": f"Тип должен быть одним из: {', '.join(sorted(logic.POLL_TYPES))}"},
        )
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail={"question": "Укажите текст вопроса"})
    if len(question) > logic.MAX_QUESTION_LENGTH:
        raise HTTPException(
            status_code=422,
            detail={"question": f"Вопрос не может быть длиннее {logic.MAX_QUESTION_LENGTH} символов"},
        )

    options = [o.strip() for o in body.options if o.strip()]
    if len(options) < logic.MIN_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail={"options": f"Нужно минимум {logic.MIN_OPTIONS} варианта ответа"},
        )
    if len(options) > logic.MAX_OPTIONS:
        raise HTTPException(
            status_code=422,
            detail={"options": f"Максимум {logic.MAX_OPTIONS} вариантов — лимит Telegram Poll"},
        )
    too_long = [o for o in options if len(o) > logic.MAX_OPTION_LENGTH]
    if too_long:
        raise HTTPException(
            status_code=422,
            detail={"options": f"Текст варианта не может быть длиннее {logic.MAX_OPTION_LENGTH} символов"},
        )

    correct_index = body.correct_index
    if body.type == "quiz":
        if correct_index is None or not (0 <= correct_index < len(options)):
            raise HTTPException(
                status_code=422,
                detail={"correct_index": "Отметьте правильный вариант ответа"},
            )

    return logic.build_poll_quiz(body.type, question, options, correct_index)
