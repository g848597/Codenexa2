"""Раздел "Документы" мини-аппа: шаблоны + собранные по ним документы.
Контракт эндпоинтов соответствует тому, что уже ожидает фронтенд —
webapp/src/config/docsApi.js (listTemplates/getTemplate/previewDocument/
createDocument/listDocuments/getDocument/deleteDocument).

Доступ к шаблонам организации: см. app/web/api/organizations.py и db.py
(document_templates.owner_org_id). Пользователь без организации видит и
использует только системные шаблоны (owner_org_id IS NULL).

TODO (сознательно не в этой версии — другой объём работы): AI-парсинг
свободного описания в шаблон (/api/ai/parse), произвольные документы без
шаблона (/api/custom-document*), профиль с логотипом/подписью
(/api/profile*), выгрузка в PDF/DOCX (/api/documents/{id}/file) — фронтенд
их уже вызывает (см. docsApi.js), но это отдельная от шаблонов задача.
"""
import re

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.web import repo
from app.web.deps import get_current_user

router = APIRouter(tags=["docs"])

_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")


def _template_shape(row: dict, full: bool = False) -> dict:
    out = {
        "code": row["code"],
        "category": row["category"],
        "title": row["title"],
        "description": row["description"],
        "locked": row["locked"],
        "isCustom": row["owner_org_id"] is not None,
    }
    if full:
        out["fields"] = row["fields"]
    return out


def _document_shape(row: dict) -> dict:
    return {
        "id": row["id"],
        "templateCode": row["template_code"],
        "title": row["title"],
        "data": row["data"],
        "finalText": row["final_text"],
        "createdAt": row["created_at"],
    }


def _render(body_template: str, data: dict) -> str:
    """Подставляет {{key}} значениями из data. Незаполненные/незнакомые
    плейсхолдеры заменяются на пустую строку, а не остаются в тексте —
    иначе '{{notes}}' попал бы в сохранённый документ пользователя."""
    return _PLACEHOLDER_RE.sub(lambda m: str(data.get(m.group(1), "")), body_template)


def _validate_required_fields(template: dict, data: dict):
    for f in template["fields"]:
        if f.get("required") and not str(data.get(f["key"], "")).strip():
            raise HTTPException(400, f"Поле «{f['question']}» обязательно для заполнения")


def _current_org_id(user: dict) -> int | None:
    membership = repo.get_user_membership(user["id"])
    return membership["org_id"] if membership else None


@router.get("/api/templates")
def list_templates(user: dict = Depends(get_current_user)):
    org_id = _current_org_id(user)
    rows = repo.list_templates_for_scope(org_id)
    categories: dict[str, list] = {}
    for row in rows:
        categories.setdefault(row["category"], []).append(_template_shape(row))
    return {"categories": [{"name": name, "templates": items} for name, items in categories.items()]}


@router.get("/api/templates/{code}")
def get_template(code: str, user: dict = Depends(get_current_user)):
    org_id = _current_org_id(user)
    row = repo.get_template_for_scope(code, org_id)
    if not row:
        raise HTTPException(404, "Шаблон не найден")
    return _template_shape(row, full=True)


class TemplateBody(BaseModel):
    code: str
    category: str
    title: str
    description: str = ""
    fields: list[dict]
    bodyTemplate: str


@router.post("/api/templates")
def create_template(body: TemplateBody, user: dict = Depends(get_current_user)):
    """Создать приватный шаблон компании. Доступно любому участнику
    организации (не только владельцу) — если понадобится ограничить только
    владельцем, здесь достаточно добавить проверку role == 'owner'."""
    membership = repo.get_user_membership(user["id"])
    if not membership:
        raise HTTPException(403, "Создание своих шаблонов доступно только участникам организации")
    try:
        row = repo.create_template(
            owner_org_id=membership["org_id"], code=body.code, category=body.category,
            title=body.title, description=body.description, fields=body.fields,
            body_template=body.bodyTemplate,
        )
    except Exception:
        raise HTTPException(400, "Шаблон с таким кодом уже существует в вашей организации")
    return _template_shape(row, full=True)


@router.delete("/api/templates/{code}")
def delete_template(code: str, user: dict = Depends(get_current_user)):
    membership = repo.get_user_membership(user["id"])
    if not membership:
        raise HTTPException(403, "Недоступно")
    repo.deactivate_template(membership["org_id"], code)
    return {"ok": True}


class DocumentBody(BaseModel):
    templateCode: str
    data: dict


@router.post("/api/documents/preview")
def preview_document(body: DocumentBody, user: dict = Depends(get_current_user)):
    org_id = _current_org_id(user)
    template = repo.get_template_for_scope(body.templateCode, org_id)
    if not template:
        raise HTTPException(404, "Шаблон не найден")
    _validate_required_fields(template, body.data)
    return {"finalText": _render(template["body_template"], body.data)}


@router.post("/api/documents")
def create_document(body: DocumentBody, user: dict = Depends(get_current_user)):
    org_id = _current_org_id(user)
    template = repo.get_template_for_scope(body.templateCode, org_id)
    if not template:
        raise HTTPException(404, "Шаблон не найден")
    _validate_required_fields(template, body.data)
    final_text = _render(template["body_template"], body.data)
    doc = repo.create_document(
        user_id=user["id"], org_id=org_id, template_code=template["code"],
        title=template["title"], data=body.data, final_text=final_text,
    )
    return _document_shape(doc)


@router.get("/api/documents")
def list_documents(page: int = Query(default=1, ge=1), user: dict = Depends(get_current_user)):
    rows = repo.list_documents(user["id"], page=page)
    return {"documents": [_document_shape(r) for r in rows]}


@router.get("/api/documents/{doc_id}")
def get_document(doc_id: int, user: dict = Depends(get_current_user)):
    row = repo.get_document(doc_id, user["id"])
    if not row:
        raise HTTPException(404, "Документ не найден")
    return _document_shape(row)


@router.delete("/api/documents/{doc_id}")
def delete_document(doc_id: int, user: dict = Depends(get_current_user)):
    repo.delete_document(doc_id, user["id"])
    return {"ok": True}
