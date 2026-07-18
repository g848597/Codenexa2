"""Раздел "Документы" (AI Docs) мини-аппа: категории шаблонов -> пошаговый
мастер (см. фронтенд webapp/src/components/docsApp.js, чат-визард) ->
предпросмотр -> сохранение -> экспорт в PDF/DOCX. Плюс произвольный
документ без шаблона и профиль автоподстановки (ФИО/реквизиты/логотип/
подпись).

Раунд "AI Docs — починка раздела" — что изменилось относительно
предыдущей версии этого файла:
  - /api/documents теперь отдаёт {items, total, page} (раньше был
    {documents: [...]} без total — фронтенд ждал items/total и либо падал,
    либо показывал пустой список).
  - Реальный экспорт в PDF/DOCX: GET /api/documents/{id}/file?format=pdf|docx
    (раньше фронтенд уже дёргал этот путь, а бэкенда для него не было
    вообще — см. app/web/docgen.py).
  - Профиль (/api/profile, /api/profile/logo, /api/profile/signature) —
    раньше тоже вызывался с фронтенда в пустоту.
  - /api/custom-document* — "свой текст" без AI: пользователь сам пишет
    текст документа, мы его просто аккуратно вёрстаем и сохраняем/
    экспортируем. Никакого вызова внешней LLM здесь нет (сознательно —
    AI-парсинг свободного описания в шаблон это отдельная, отдельно
    планируемая задача).
  - /api/ai/parse убран: фронтенд AI-конструктора на нём был завязан на
    несуществующий AI-бэкенд и всегда падал с ошибкой.
  - Дневной лимит бесплатного тарифа на СОЗДАНИЕ (сохранение) документов
    теперь реально считается и проверяется на сервере, а не только рисуется
    во фронтенде.
"""
import io
import os
import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel

from app.web import docgen, repo
from app.web.config import settings
from app.web.deps import get_current_user

router = APIRouter(tags=["docs"])

_PLACEHOLDER_RE = re.compile(r"\{\{(\w+)\}\}")

# Сколько документов в день может СОХРАНИТЬ (не предпросмотреть) пользователь
# без активной подписки. Предпросмотр (/api/documents/preview) в лимит не
# входит — им можно пользоваться сколько угодно, ограничение только на
# итоговое сохранение/экспорт.
FREE_DAILY_LIMIT = 3

DOCS_UPLOAD_DIR = os.path.join(settings.UPLOAD_DIR, "docs_profile")
os.makedirs(DOCS_UPLOAD_DIR, exist_ok=True)
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


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
    created_at = row["created_at"]
    return {
        "id": row["id"],
        "templateCode": row["template_code"],
        "title": row["title"],
        "templateTitle": row["title"] if row["template_code"] else "Свой документ",
        "data": row["data"],
        "finalText": row["final_text"],
        "createdAt": created_at.isoformat() if hasattr(created_at, "isoformat") else created_at,
    }


def _render(body_template: str, data: dict) -> str:
    """Подставляет {{key}} значениями из data. Незаполненные/незнакомые
    плейсхолдеры заменяются на пустую строку, а не остаются в тексте —
    иначе '{{notes}}' попал бы в сохранённый документ пользователя."""
    return _PLACEHOLDER_RE.sub(lambda m: str(data.get(m.group(1), "")).strip(), body_template)


def _validate_required_fields(template: dict, data: dict):
    for f in template["fields"]:
        if f.get("required") and not str(data.get(f["key"], "")).strip():
            raise HTTPException(400, f"Поле «{f['question']}» обязательно для заполнения")


def _current_org_id(user: dict) -> int | None:
    membership = repo.get_user_membership(user["id"])
    return membership["org_id"] if membership else None


def _is_pro(user: dict) -> bool:
    return bool(repo.get_active_subscription(user["id"]))


def _abs_profile_path(rel_path: str | None) -> str | None:
    if not rel_path or not rel_path.startswith("/uploads/docs_profile/"):
        return None
    filename = os.path.basename(rel_path)
    path = os.path.join(DOCS_UPLOAD_DIR, filename)
    return path if os.path.isfile(path) else None


def _profile_for_render(user_id: int) -> dict:
    """Профиль, обогащённый абсолютными путями к логотипу/подписи — для
    docgen.py (он работает с файлами на диске, а не с публичными /uploads/ URL)."""
    profile = repo.get_document_profile(user_id)
    out = dict(profile)
    out["logo_path_abs"] = _abs_profile_path(profile.get("logo_path"))
    out["signature_path_abs"] = _abs_profile_path(profile.get("signature_path"))
    return out


# =========================================================================
# Шаблоны
# =========================================================================

@router.get("/api/templates")
def list_templates(user: dict = Depends(get_current_user)):
    org_id = _current_org_id(user)
    rows = repo.list_templates_for_scope(org_id)
    categories: dict[str, list] = {}
    for row in rows:
        categories.setdefault(row["category"], []).append(_template_shape(row))
    return {"categories": [{"code": name, "title": name, "templates": items} for name, items in categories.items()]}


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


# =========================================================================
# Документы по шаблону
# =========================================================================

class DocumentBody(BaseModel):
    templateCode: str
    data: dict


@router.post("/api/documents/preview")
def preview_document(body: DocumentBody, user: dict = Depends(get_current_user)):
    org_id = _current_org_id(user)
    template = repo.get_template_for_scope(body.templateCode, org_id)
    if not template:
        raise HTTPException(404, "Шаблон не найден")
    if template["locked"] and not _is_pro(user):
        raise HTTPException(403, "Этот шаблон доступен на платном тарифе — оформите PRO, чтобы им воспользоваться")
    _validate_required_fields(template, body.data)
    return {"finalText": _render(template["body_template"], body.data)}


@router.post("/api/documents")
def create_document(body: DocumentBody, user: dict = Depends(get_current_user)):
    org_id = _current_org_id(user)
    template = repo.get_template_for_scope(body.templateCode, org_id)
    if not template:
        raise HTTPException(404, "Шаблон не найден")
    if template["locked"] and not _is_pro(user):
        raise HTTPException(403, "Этот шаблон доступен на платном тарифе — оформите PRO, чтобы им воспользоваться")

    if not _is_pro(user) and repo.count_documents_today(user["id"]) >= FREE_DAILY_LIMIT:
        raise HTTPException(
            402,
            f"Бесплатный тариф — до {FREE_DAILY_LIMIT} документов в день. "
            "Оформите PRO в разделе «Тарифы», чтобы снять ограничение.",
        )

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
    total = repo.count_documents(user["id"])
    return {"items": [_document_shape(r) for r in rows], "total": total, "page": page}


@router.get("/api/documents/limit")
def documents_limit(user: dict = Depends(get_current_user)):
    is_pro = _is_pro(user)
    return {
        "isPro": is_pro,
        "freeDailyLimit": FREE_DAILY_LIMIT,
        "todayCount": repo.count_documents_today(user["id"]),
    }


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


@router.get("/api/documents/{doc_id}/file")
def download_document_file(doc_id: int, format: str = Query(default="pdf"), user: dict = Depends(get_current_user)):
    if format not in ("pdf", "docx"):
        raise HTTPException(400, "format должен быть 'pdf' или 'docx'")
    row = repo.get_document(doc_id, user["id"])
    if not row:
        raise HTTPException(404, "Документ не найден")

    profile = _profile_for_render(user["id"])
    title = row["title"] or "Документ"
    slug = re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "document"

    if format == "pdf":
        content = docgen.build_pdf(title, row["final_text"], profile)
        media_type = "application/pdf"
        filename = f"{slug}.pdf"
    else:
        content = docgen.build_docx(title, row["final_text"], profile)
        media_type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        filename = f"{slug}.docx"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# =========================================================================
# Произвольный документ (без AI — пользователь сам пишет текст)
# =========================================================================

class CustomPreviewBody(BaseModel):
    description: str


@router.post("/api/custom-document/preview")
def preview_custom_document(body: CustomPreviewBody, user: dict = Depends(get_current_user)):
    text = body.description.strip()
    if not text:
        raise HTTPException(400, "Текст документа не может быть пустым")
    return {"finalText": text}


class CustomSaveBody(BaseModel):
    description: str
    finalText: str


@router.post("/api/custom-document")
def save_custom_document(body: CustomSaveBody, user: dict = Depends(get_current_user)):
    if not body.finalText.strip():
        raise HTTPException(400, "Текст документа не может быть пустым")

    if not _is_pro(user) and repo.count_documents_today(user["id"]) >= FREE_DAILY_LIMIT:
        raise HTTPException(
            402,
            f"Бесплатный тариф — до {FREE_DAILY_LIMIT} документов в день. "
            "Оформите PRO в разделе «Тарифы», чтобы снять ограничение.",
        )

    org_id = _current_org_id(user)
    title = f"Свой документ · {datetime.now().strftime('%d.%m.%Y')}"
    doc = repo.create_document(
        user_id=user["id"], org_id=org_id, template_code=None,
        title=title, data={"description": body.description}, final_text=body.finalText,
    )
    return _document_shape(doc)


# =========================================================================
# Профиль (автоподстановка ФИО/реквизитов, логотип, подпись)
# =========================================================================

def _permissions_for(is_pro: bool) -> dict:
    return {
        "canEditPdfTheme": is_pro,
        "canUploadLogo": is_pro,
        "canUploadSignature": is_pro,
    }


@router.get("/api/profile")
def get_profile(user: dict = Depends(get_current_user)):
    profile = repo.get_document_profile(user["id"])
    is_pro = _is_pro(user)
    return {
        "profile": profile,
        "user": {"tariff": "pro" if is_pro else "free"},
        "permissions": _permissions_for(is_pro),
    }


@router.put("/api/profile")
def update_profile(body: dict, user: dict = Depends(get_current_user)):
    profile = repo.upsert_document_profile(user["id"], body)
    is_pro = _is_pro(user)
    return {
        "profile": profile,
        "user": {"tariff": "pro" if is_pro else "free"},
        "permissions": _permissions_for(is_pro),
    }


def _process_and_save_image(raw: bytes, subdir_name: str) -> str:
    from PIL import Image, ImageOps

    with Image.open(io.BytesIO(raw)) as img:
        img.verify()
    with Image.open(io.BytesIO(raw)) as img:
        img = ImageOps.exif_transpose(img)
        img = img.convert("RGBA") if img.mode in ("RGBA", "LA") else img.convert("RGB")
        img.thumbnail((900, 900))
        buf = io.BytesIO()
        fmt = "PNG" if img.mode == "RGBA" else "JPEG"
        img.save(buf, format=fmt, quality=90, optimize=True)
        clean_bytes = buf.getvalue()
        ext = "png" if fmt == "PNG" else "jpg"

    filename = f"{subdir_name}-{uuid.uuid4().hex}.{ext}"
    dest_path = os.path.join(DOCS_UPLOAD_DIR, filename)
    with open(dest_path, "wb") as f:
        f.write(clean_bytes)
    return f"/uploads/docs_profile/{filename}"


def _remove_profile_file(rel_path: str | None):
    path = _abs_profile_path(rel_path)
    if path:
        try:
            os.remove(path)
        except OSError:
            pass


async def _handle_profile_upload(kind: str, file: UploadFile, user: dict):
    if not _is_pro(user):
        raise HTTPException(403, "Загрузка логотипа/подписи доступна на платном тарифе PRO")
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(400, "Разрешены только JPEG, PNG или WEBP")
    raw = await file.read(settings.MAX_UPLOAD_BYTES + 1)
    if len(raw) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Файл слишком большой (максимум 5 МБ)")
    if not raw:
        raise HTTPException(400, "Пустой файл")

    try:
        rel_path = _process_and_save_image(raw, kind)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(400, "Файл повреждён или не является изображением")

    old_profile = repo.get_document_profile(user["id"])
    _remove_profile_file(old_profile.get(f"{kind}_path"))
    profile = repo.set_document_profile_file(user["id"], f"{kind}_path", rel_path)
    return {"profile": profile}


@router.post("/api/profile/logo")
async def upload_logo(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    return await _handle_profile_upload("logo", file, user)


@router.post("/api/profile/signature")
async def upload_signature(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    return await _handle_profile_upload("signature", file, user)
