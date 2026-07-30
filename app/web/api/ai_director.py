"""AI Business -> AI Director — прокси к Anthropic Messages API.

Фронтенд business-app/ (см. src/services/aiDirectorClient.js) НИКОГДА не
обращается к api.anthropic.com напрямую из браузера — ключ живёт только
здесь, на сервере (см. app/web/config.py::ANTHROPIC_API_KEY). Контракт
(/api/ai-director, тело {messages, businessContext}, ответ {reply}) portирован
1:1 из справочной Node-реализации business-app/server/index.js — тот сервис
не разворачивается отдельно, чтобы не гонять два бэкенда за одним доменом;
эндпоинт живёт в общем FastAPI-процессе, как и всё остальное API.

Как и AI Sport (см. sport_routes.py) — без ключа модуль честно отвечает
"не настроено", а не выдуманным ответом (правило №1 проекта).
"""
import time

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

import httpx

from app.web.config import settings
from app.web.deps import get_current_user

router = APIRouter(prefix="/api", tags=["ai-director"])

ANTHROPIC_MESSAGES_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_VERSION = "2023-06-01"

# Тот же простой rate-limit в памяти процесса, что и в справочном
# Node-прокси — для одного воркера этого достаточно; при нескольких
# воркерах/инстансах имеет смысл вынести в Redis (см. app/web/cache.py),
# как уже сделано для /api/auth/*.
_REQUEST_LOG: dict[str, list[float]] = {}
_WINDOW_SECONDS = 60.0
_MAX_REQUESTS_PER_WINDOW = 20


def _is_rate_limited(key: str) -> bool:
    now = time.time()
    entries = [t for t in _REQUEST_LOG.get(key, []) if now - t < _WINDOW_SECONDS]
    entries.append(now)
    _REQUEST_LOG[key] = entries
    return len(entries) > _MAX_REQUESTS_PER_WINDOW


class AIDirectorMessage(BaseModel):
    role: str
    content: str


class AIDirectorRequest(BaseModel):
    messages: list[AIDirectorMessage]
    businessContext: str


@router.post("/ai-director")
async def ai_director(payload: AIDirectorRequest, user: dict = Depends(get_current_user)):
    if not settings.ANTHROPIC_API_KEY:
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY не задан на сервере — AI Director не настроен.",
        )

    if _is_rate_limited(f"user:{user['id']}"):
        raise HTTPException(status_code=429, detail="Слишком много запросов. Попробуйте через минуту.")

    if not payload.messages:
        raise HTTPException(status_code=400, detail="`messages` не может быть пустым.")
    if not payload.businessContext.strip():
        raise HTTPException(status_code=400, detail="`businessContext` не может быть пустым.")

    clean_messages = [
        {"role": m.role, "content": m.content[:8000]}
        for m in payload.messages
        if m.role in ("user", "assistant") and m.content
    ][-20:]

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            upstream = await client.post(
                ANTHROPIC_MESSAGES_URL,
                headers={
                    "Content-Type": "application/json",
                    "x-api-key": settings.ANTHROPIC_API_KEY,
                    "anthropic-version": ANTHROPIC_VERSION,
                },
                json={
                    "model": settings.ANTHROPIC_MODEL,
                    "max_tokens": 1000,
                    "system": payload.businessContext[:20000],
                    "messages": clean_messages,
                },
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=500, detail="Internal proxy error.")

    if upstream.status_code >= 400:
        raise HTTPException(status_code=502, detail="AI provider error.")

    data = upstream.json()
    reply = "\n\n".join(
        block.get("text", "") for block in data.get("content", []) if block.get("type") == "text"
    )
    return {"reply": reply or "Не удалось получить ответ. Попробуйте переформулировать запрос."}
