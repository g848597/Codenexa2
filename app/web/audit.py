"""Общая точка записи в admin_audit_log для всех admin-эндпоинтов.

Раунд 7 (аудит, раздел 13, "Средний приоритет": "Аудит-лог админ-действий").
Вынесено в отдельный модуль, а не продублировано в каждом api/*.py файле —
см. аудит, раздел 12, "Объединить" (в проекте уже есть прецедент: esc()/
escAttr() были вынесены в webapp/src/utils/html.js по этой же причине).
"""
from typing import Any

from fastapi import Request

from app.web import repo


def log_action(
    request: Request,
    admin: dict,
    action: str,
    target_type: str,
    target_id: Any = None,
    details: dict | None = None,
) -> None:
    """Best-effort: запись в аудит-лог никогда не должна ронять уже
    выполненное и закоммиченное действие (например, из-за временной
    недоступности БД) — поэтому исключения здесь намеренно проглатываются,
    а не пробрасываются наверх."""
    try:
        repo.log_admin_action(
            admin_id=admin.get("id"),
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details,
            ip=request.client.host if request.client else None,
        )
    except Exception:  # noqa: BLE001
        pass
