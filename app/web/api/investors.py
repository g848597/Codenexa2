"""Раздел "Инвесторы": публичный список опубликованных карточек + полная
CRUD-панель для админа (роль admin/superadmin в БД, см.
app/web/deps.is_admin_user — до раунда 6 здесь был allow-list из .env,
теперь управление ролями идёт через /api/admin/users, см. admin_users.py).

Все admin-эндпоинты защищены get_current_admin — обычный залогиненный
пользователь получит 403, а не сможет создать/изменить/удалить карточку.
Загрузка фото делает три вещи, которые часто забывают в подобных формах:
  1. Проверяет реальное содержимое файла через Pillow (а не просто
     Content-Type заголовок, который клиент может подделать).
  2. Пересохраняет изображение (перекодирует), что уничтожает встроенные
     метаданные/EXIF и любой полезный "хвост" в файле-полиглоте.
  3. Генерирует случайное имя файла на сервере — имя, введённое клиентом,
     никогда не попадает в путь на диске (защита от path traversal).
"""
import io
import os
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field, field_validator, model_validator

from app.web import repo
from app.web.audit import log_action
from app.web.config import settings
from app.web.deps import get_current_admin

router = APIRouter(prefix="/api/investors", tags=["investors"])

ALLOWED_STATUSES = {"draft", "published", "hidden"}
MAX_TEXT = 2000
MAX_SHORT = 200
MAX_AMOUNT_VALUE = 1_000_000_000_000  # 1 трлн — разумный потолок, не бизнес-лимит, а защита от опечаток/переполнения
# ISO 4217 — только валюты, реально ожидаемые у инвесторов CodeNexa (не полный
# список всех мировых валют: если понадобится ещё одна, её осознанно добавляют
# сюда, а не разрешают "любые 3 буквы", которые нельзя честно отрисовать на
# диаграмме сумм).
ALLOWED_CURRENCIES = {
    "USD", "EUR", "GBP", "KZT", "RUB", "CNY", "JPY", "CHF", "AED",
    "SGD", "UZS", "TRY", "UAH", "GEL", "AMD", "PLN", "INR", "CAD", "AUD",
}

INVESTORS_UPLOAD_DIR = os.path.join(settings.UPLOAD_DIR, "investors")
os.makedirs(INVESTORS_UPLOAD_DIR, exist_ok=True)


# ---------- модели ----------

class InvestorIn(BaseModel):
    name: str = Field(min_length=1, max_length=MAX_SHORT)
    position: str = Field(default="", max_length=MAX_SHORT)
    country: str = Field(default="", max_length=MAX_SHORT)
    company: str = Field(default="", max_length=MAX_SHORT)
    description: str = Field(default="", max_length=MAX_TEXT)
    investment_amount: str | None = Field(default=None, max_length=100)
    investment_amount_value: float | None = Field(default=None, ge=0, le=MAX_AMOUNT_VALUE)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    status: str = Field(default="draft")
    website_url: str | None = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def _status_valid(cls, v):
        if v not in ALLOWED_STATUSES:
            raise ValueError(f"status должен быть одним из: {', '.join(sorted(ALLOWED_STATUSES))}")
        return v

    @field_validator("website_url")
    @classmethod
    def _website_valid(cls, v):
        if v and not (v.startswith("http://") or v.startswith("https://")):
            raise ValueError("website_url должен начинаться с http:// или https://")
        return v

    @field_validator("currency")
    @classmethod
    def _currency_valid(cls, v):
        if v is None:
            return v
        v = v.strip().upper()
        if v not in ALLOWED_CURRENCIES:
            raise ValueError(f"currency должен быть одним из: {', '.join(sorted(ALLOWED_CURRENCIES))}")
        return v

    @field_validator("name", "position", "country", "company", "description")
    @classmethod
    def _strip(cls, v):
        return v.strip() if isinstance(v, str) else v

    @model_validator(mode="after")
    def _amount_pair_valid(self):
        # Числовая сумма без валюты (или наоборот) — гарантированно "сломанная"
        # запись: диаграмма на публичной странице не может честно показать
        # число без единицы измерения. Требуем оба поля вместе или оба пустые.
        if (self.investment_amount_value is None) != (self.currency is None):
            raise ValueError(
                "investment_amount_value и currency должны быть заполнены вместе "
                "либо оба оставлены пустыми"
            )
        return self


class InvestorUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=MAX_SHORT)
    position: str | None = Field(default=None, max_length=MAX_SHORT)
    country: str | None = Field(default=None, max_length=MAX_SHORT)
    company: str | None = Field(default=None, max_length=MAX_SHORT)
    description: str | None = Field(default=None, max_length=MAX_TEXT)
    investment_amount: str | None = None
    investment_amount_value: float | None = Field(default=None, ge=0, le=MAX_AMOUNT_VALUE)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    status: str | None = None
    website_url: str | None = Field(default=None, max_length=500)

    @field_validator("status")
    @classmethod
    def _status_valid(cls, v):
        if v is not None and v not in ALLOWED_STATUSES:
            raise ValueError(f"status должен быть одним из: {', '.join(sorted(ALLOWED_STATUSES))}")
        return v

    @field_validator("currency")
    @classmethod
    def _currency_valid(cls, v):
        if v is None:
            return v
        v = v.strip().upper()
        if v not in ALLOWED_CURRENCIES:
            raise ValueError(f"currency должен быть одним из: {', '.join(sorted(ALLOWED_CURRENCIES))}")
        return v

    @model_validator(mode="after")
    def _amount_pair_valid(self):
        # Та же гарантия, что и в InvestorIn — см. комментарий там. Важно и
        # здесь: PUT в этом приложении всегда шлёт форму целиком (см.
        # investorsAdmin.js), а не частичный патч, так что оба поля в payload
        # всегда либо явно заданы, либо явно пусты.
        if (self.investment_amount_value is None) != (self.currency is None):
            raise ValueError(
                "investment_amount_value и currency должны быть заполнены вместе "
                "либо оба оставлены пустыми"
            )
        return self


class ReorderItem(BaseModel):
    id: int
    sortOrder: int


class ReorderBody(BaseModel):
    order: list[ReorderItem]


# ---------- сериализация ----------

def _public_shape(row: dict) -> dict:
    return {
        "id": row["id"],
        "name": row["name"],
        "position": row["position"],
        "country": row["country"],
        "company": row["company"],
        "description": row["description"],
        "investmentAmount": row["investment_amount"],
        "investmentAmountValue": row["investment_amount_value"],
        "currency": row["currency"],
        "status": row["status"],
        "photoUrl": row["photo_url"],
        "websiteUrl": row["website_url"],
        "sortOrder": row["sort_order"],
    }


def _admin_shape(row: dict) -> dict:
    return {**_public_shape(row), "createdAt": row["created_at"], "updatedAt": row["updated_at"]}


# ---------- публичные эндпоинты ----------

@router.get("")
def list_public_investors():
    return {"investors": [_public_shape(r) for r in repo.list_investors_public()]}


# ---------- админ: чтение ----------

@router.get("/admin")
def list_admin_investors(_admin: dict = Depends(get_current_admin)):
    return {"investors": [_admin_shape(r) for r in repo.list_investors_all()]}


# ---------- админ: запись ----------

@router.post("")
def create_investor(payload: InvestorIn, request: Request, admin: dict = Depends(get_current_admin)):
    row = repo.create_investor(**payload.model_dump())
    log_action(request, admin, action="create", target_type="investor", target_id=row["id"],
               details={"name": row["name"], "status": row["status"]})
    return {"investor": _admin_shape(row)}


@router.put("/{investor_id}")
def update_investor(
    investor_id: int,
    payload: InvestorUpdate,
    request: Request,
    admin: dict = Depends(get_current_admin),
):
    if not repo.get_investor(investor_id):
        raise HTTPException(status_code=404, detail="Инвестор не найден")
    fields = {k: v for k, v in payload.model_dump().items() if v is not None}
    row = repo.update_investor(investor_id, **fields)
    log_action(request, admin, action="update", target_type="investor", target_id=investor_id,
               details={"fields": sorted(fields.keys())})
    return {"investor": _admin_shape(row)}


@router.delete("/{investor_id}")
def delete_investor(investor_id: int, request: Request, admin: dict = Depends(get_current_admin)):
    row = repo.get_investor(investor_id)
    if not row:
        raise HTTPException(status_code=404, detail="Инвестор не найден")
    _remove_photo_file(row.get("photo_url"))
    repo.delete_investor(investor_id)
    log_action(request, admin, action="delete", target_type="investor", target_id=investor_id,
               details={"name": row["name"]})
    return {"ok": True}


@router.put("/reorder/bulk")
def reorder_investors(payload: ReorderBody, request: Request, admin: dict = Depends(get_current_admin)):
    ids = [item.id for item in payload.order]
    existing = {r["id"] for r in repo.list_investors_all()}
    unknown = [i for i in ids if i not in existing]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Неизвестные id: {unknown}")
    try:
        repo.reorder_investors([(item.id, item.sortOrder) for item in payload.order])
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    log_action(request, admin, action="reorder", target_type="investor", target_id=None,
               details={"count": len(ids)})
    return {"investors": [_admin_shape(r) for r in repo.list_investors_all()]}


# ---------- фото ----------

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_DIMENSION = 1600


def _remove_photo_file(photo_url: str | None):
    if not photo_url or not photo_url.startswith("/uploads/investors/"):
        return
    filename = os.path.basename(photo_url)
    path = os.path.join(INVESTORS_UPLOAD_DIR, filename)
    if os.path.isfile(path):
        try:
            os.remove(path)
        except OSError:
            pass  # не блокируем запрос из-за проблемы с уборкой мусора на диске


@router.post("/{investor_id}/photo")
async def upload_investor_photo(
    investor_id: int,
    request: Request,
    file: UploadFile = File(...),
    admin: dict = Depends(get_current_admin),
):
    row = repo.get_investor(investor_id)
    if not row:
        raise HTTPException(status_code=404, detail="Инвестор не найден")

    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Разрешены только JPEG, PNG или WEBP")

    raw = await file.read(settings.MAX_UPLOAD_BYTES + 1)
    if len(raw) > settings.MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Файл слишком большой (максимум 5 МБ)")
    if not raw:
        raise HTTPException(status_code=400, detail="Пустой файл")

    try:
        from PIL import Image, ImageOps

        with Image.open(io.BytesIO(raw)) as img:
            img.verify()  # быстрая проверка, что это действительно изображение
        with Image.open(io.BytesIO(raw)) as img:
            img = ImageOps.exif_transpose(img)  # применяем ориентацию, затем EXIF отбрасываем
            img = img.convert("RGB")
            img.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
            buf = io.BytesIO()
            img.save(buf, format="JPEG", quality=88, optimize=True)
            clean_bytes = buf.getvalue()
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Файл повреждён или не является изображением")

    _remove_photo_file(row.get("photo_url"))

    filename = f"{uuid.uuid4().hex}.jpg"
    dest_path = os.path.join(INVESTORS_UPLOAD_DIR, filename)
    with open(dest_path, "wb") as f:
        f.write(clean_bytes)

    photo_url = f"/uploads/investors/{filename}"
    updated = repo.update_investor(investor_id, photo_url=photo_url)
    log_action(request, admin, action="photo_upload", target_type="investor", target_id=investor_id)
    return {"investor": _admin_shape(updated)}


@router.delete("/{investor_id}/photo")
def delete_investor_photo(investor_id: int, request: Request, admin: dict = Depends(get_current_admin)):
    row = repo.get_investor(investor_id)
    if not row:
        raise HTTPException(status_code=404, detail="Инвестор не найден")
    _remove_photo_file(row.get("photo_url"))
    updated = repo.update_investor(investor_id, photo_url=None)
    log_action(request, admin, action="photo_delete", target_type="investor", target_id=investor_id)
    return {"investor": _admin_shape(updated)}
