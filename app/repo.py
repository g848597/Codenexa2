"""Репозиторий — все SQL-запросы живут здесь, выше по стеку (api/*.py)
только вызовы этих функций. Один файл на Этапе 1 достаточен — если разрастётся
на следующих этапах, можно разбить по доменам (repo/projects.py и т.д.)."""
import secrets
import string

from app import db

DEFAULT_PROJECT_NAME = "Мой проект"


# ---------- users ----------

def get_user_by_telegram_id(telegram_id: int) -> dict | None:
    return db.query_one("SELECT * FROM users WHERE telegram_id = %s", (telegram_id,))


def get_user_by_id(user_id: int) -> dict | None:
    return db.query_one("SELECT * FROM users WHERE id = %s", (user_id,))


def create_user(telegram_id: int, username: str | None, first_name: str | None,
                 language: str = "ru") -> dict:
    """Создаёт пользователя и его дефолтный проект ("Мой проект") с пустым
    Brand Kit — по спеке 1.3 дефолтный проект создаётся автоматически при
    регистрации, отдельного вызова со стороны фронтенда для этого не нужно."""
    user = db.execute_returning(
        """
        INSERT INTO users (telegram_id, username, first_name, language)
        VALUES (%s, %s, %s, %s)
        RETURNING *
        """,
        (telegram_id, username, first_name, language),
    )
    create_project(user["id"], DEFAULT_PROJECT_NAME, is_active_default=True)
    return user


def get_or_create_user_from_telegram(tg_user: dict, language_hint: str | None = None) -> dict:
    telegram_id = tg_user.get("id")
    existing = get_user_by_telegram_id(telegram_id)
    if existing:
        return existing
    return create_user(
        telegram_id=telegram_id,
        username=tg_user.get("username"),
        first_name=tg_user.get("first_name"),
        language=(language_hint or tg_user.get("language_code") or "ru"),
    )


# ---------- projects ----------

def list_projects(user_id: int) -> list[dict]:
    return db.query(
        """
        SELECT p.*, EXISTS(
            SELECT 1 FROM brand_kits bk WHERE bk.project_id = p.id
        ) AS has_brand_kit
        FROM projects p
        WHERE p.user_id = %s AND p.deleted_at IS NULL
        ORDER BY p.is_active_default DESC, p.created_at ASC
        """,
        (user_id,),
    )


def get_project(project_id: int, user_id: int) -> dict | None:
    """Всегда фильтруем по user_id вместе с project_id — иначе один
    пользователь мог бы читать/менять чужой проект, подставив чужой id."""
    return db.query_one(
        "SELECT * FROM projects WHERE id = %s AND user_id = %s AND deleted_at IS NULL",
        (project_id, user_id),
    )


def create_project(user_id: int, name: str, is_active_default: bool = False) -> dict:
    """Brand Kit создаётся пустым сразу вместе с проектом — brand_kits 1:1 к
    projects по спеке, GET /brand-kit не должен зависеть от того, вызывал ли
    фронтенд PUT хотя бы раз."""
    if is_active_default:
        _clear_default_project(user_id)
    project = db.execute_returning(
        """
        INSERT INTO projects (user_id, name, is_active_default)
        VALUES (%s, %s, %s)
        RETURNING *
        """,
        (user_id, name, is_active_default),
    )
    create_or_update_brand_kit(project["id"], {})
    return project


def rename_project(project_id: int, user_id: int, name: str) -> dict | None:
    return db.execute_returning(
        """
        UPDATE projects SET name = %s
        WHERE id = %s AND user_id = %s AND deleted_at IS NULL
        RETURNING *
        """,
        (name, project_id, user_id),
    )


def set_active_default_project(project_id: int, user_id: int) -> dict | None:
    project = get_project(project_id, user_id)
    if not project:
        return None
    _clear_default_project(user_id)
    return db.execute_returning(
        """
        UPDATE projects SET is_active_default = true
        WHERE id = %s AND user_id = %s AND deleted_at IS NULL
        RETURNING *
        """,
        (project_id, user_id),
    )


def _clear_default_project(user_id: int) -> None:
    # Нужно снять флаг со старого дефолтного ДО установки нового — иначе
    # уникальный индекс uq_projects_one_default_per_user не даст вставить/
    # обновить вторую строку с is_active_default = true.
    db.execute(
        "UPDATE projects SET is_active_default = false WHERE user_id = %s AND is_active_default = true",
        (user_id,),
    )


def soft_delete_project(project_id: int, user_id: int) -> bool:
    project = get_project(project_id, user_id)
    if not project:
        return False
    was_default = project["is_active_default"]
    rowcount = db.execute(
        "UPDATE projects SET deleted_at = now(), is_active_default = false "
        "WHERE id = %s AND user_id = %s AND deleted_at IS NULL",
        (project_id, user_id),
    )
    if rowcount and was_default:
        # Нельзя оставить пользователя без активного проекта — переносим
        # флаг на любой другой оставшийся (самый старый) проект.
        fallback = db.query_one(
            "SELECT id FROM projects WHERE user_id = %s AND deleted_at IS NULL "
            "ORDER BY created_at ASC LIMIT 1",
            (user_id,),
        )
        if fallback:
            set_active_default_project(fallback["id"], user_id)
    return bool(rowcount)


# ---------- brand kits ----------

def get_brand_kit(project_id: int) -> dict | None:
    return db.query_one("SELECT * FROM brand_kits WHERE project_id = %s", (project_id,))


def create_or_update_brand_kit(project_id: int, fields: dict) -> dict:
    """Upsert — Brand Kit создаётся пустым автоматически вместе с проектом
    (см. create_user/create_project), поэтому PUT всегда обновляет
    существующую строку, но ON CONFLICT на случай рассинхрона не помешает."""
    allowed = {
        "logo_url", "primary_color", "secondary_color", "accent_color",
        "font_family", "brand_emojis", "tone_of_voice",
    }
    data = {k: v for k, v in fields.items() if k in allowed}
    columns = list(data.keys())
    return db.execute_returning(
        f"""
        INSERT INTO brand_kits (project_id, {', '.join(columns) if columns else 'logo_url'})
        VALUES (%s, {', '.join(['%s'] * len(columns)) if columns else 'NULL'})
        ON CONFLICT (project_id) DO UPDATE SET
            {', '.join(f'{c} = EXCLUDED.{c}' for c in columns) if columns else 'logo_url = brand_kits.logo_url'},
            updated_at = now()
        RETURNING *
        """,
        tuple([project_id] + list(data.values())),
    )


# ---------- generated_items (Smart History) ----------

def list_history(project_id: int, module_key: str | None = None,
                  favorites_only: bool = False, limit: int = 50, offset: int = 0) -> list[dict]:
    sql = "SELECT * FROM generated_items WHERE project_id = %s"
    params: list = [project_id]
    if module_key:
        sql += " AND module_key = %s"
        params.append(module_key)
    if favorites_only:
        sql += " AND is_favorite = true"
    sql += " ORDER BY created_at DESC LIMIT %s OFFSET %s"
    params += [limit, offset]
    return db.query(sql, tuple(params))


def get_history_item(item_id: int, project_id: int) -> dict | None:
    return db.query_one(
        "SELECT * FROM generated_items WHERE id = %s AND project_id = %s",
        (item_id, project_id),
    )


def create_history_item(project_id: int, module_key: str, title: str | None,
                         payload: dict, result_url: str | None = None,
                         result_text: str | None = None) -> dict:
    import json
    return db.execute_returning(
        """
        INSERT INTO generated_items (project_id, module_key, title, payload, result_url, result_text)
        VALUES (%s, %s, %s, %s, %s, %s)
        RETURNING *
        """,
        (project_id, module_key, title, json.dumps(payload), result_url, result_text),
    )


def set_history_favorite(item_id: int, project_id: int, is_favorite: bool) -> dict | None:
    return db.execute_returning(
        """
        UPDATE generated_items SET is_favorite = %s
        WHERE id = %s AND project_id = %s
        RETURNING *
        """,
        (is_favorite, item_id, project_id),
    )


def delete_history_item(item_id: int, project_id: int) -> bool:
    rowcount = db.execute(
        "DELETE FROM generated_items WHERE id = %s AND project_id = %s",
        (item_id, project_id),
    )
    return bool(rowcount)


# ---------- short_links (Utility 3.6 URL Shortener) ----------

_SLUG_ALPHABET = string.ascii_letters + string.digits  # base62
_SLUG_LENGTH = 6
_SLUG_MAX_ATTEMPTS = 8  # с 62^6 ≈ 56 млрд слагов коллизия практически невозможна,
                        # ретраи — просто защита от теоретического дубля


def _generate_slug() -> str:
    return "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(_SLUG_LENGTH))


def get_short_link_by_slug(slug: str) -> dict | None:
    return db.query_one("SELECT * FROM short_links WHERE slug = %s", (slug,))


def list_short_links(project_id: int, limit: int = 50, offset: int = 0) -> list[dict]:
    return db.query(
        """
        SELECT * FROM short_links WHERE project_id = %s
        ORDER BY created_at DESC LIMIT %s OFFSET %s
        """,
        (project_id, limit, offset),
    )


def create_short_link(project_id: int, original_url: str) -> dict:
    """Генерирует уникальный base62-слаг длиной 6 символов и создаёт
    запись. При коллизии (крайне маловероятной) перегенерирует слаг —
    UNIQUE-индекс на slug гарантирует, что дубль не проскочит."""
    last_error: Exception | None = None
    for _ in range(_SLUG_MAX_ATTEMPTS):
        slug = _generate_slug()
        try:
            return db.execute_returning(
                """
                INSERT INTO short_links (project_id, original_url, slug)
                VALUES (%s, %s, %s)
                RETURNING *
                """,
                (project_id, original_url, slug),
            )
        except Exception as exc:  # noqa: BLE001 — реагируем только на конфликт уникальности, ретраим
            last_error = exc
            continue
    raise RuntimeError("Не удалось сгенерировать уникальный slug") from last_error


def increment_short_link_clicks(slug: str) -> dict | None:
    return db.execute_returning(
        """
        UPDATE short_links SET clicks = clicks + 1
        WHERE slug = %s
        RETURNING *
        """,
        (slug,),
    )


# ---------- content_plan_items (Этап 6 — Раздел «Рост», 6.1/6.2) ----------

CONTENT_PLAN_STATUSES = {"idea", "in_progress", "done", "published"}


def list_content_plan_items(project_id: int, status: str | None = None,
                             only_with_date: bool = False) -> list[dict]:
    """Один источник данных для 6.1 (канбан, обычно без фильтра по дате) и
    6.2 (календарь, only_with_date=True — карточки без даты в сетку месяца
    не попадают). Сортировка по planned_date нужна только календарю, но не
    мешает канбану (там фронтенд группирует по status отдельно)."""
    sql = "SELECT * FROM content_plan_items WHERE project_id = %s"
    params: list = [project_id]
    if status:
        sql += " AND status = %s"
        params.append(status)
    if only_with_date:
        sql += " AND planned_date IS NOT NULL"
    sql += " ORDER BY planned_date ASC NULLS LAST, created_at DESC"
    return db.query(sql, tuple(params))


def get_content_plan_item(item_id: int, project_id: int) -> dict | None:
    return db.query_one(
        "SELECT * FROM content_plan_items WHERE id = %s AND project_id = %s",
        (item_id, project_id),
    )


def create_content_plan_item(project_id: int, title: str, status: str = "idea",
                              planned_date: str | None = None,
                              linked_generated_item_id: int | None = None) -> dict:
    return db.execute_returning(
        """
        INSERT INTO content_plan_items (project_id, title, status, planned_date, linked_generated_item_id)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING *
        """,
        (project_id, title, status, planned_date, linked_generated_item_id),
    )


def update_content_plan_item(item_id: int, project_id: int, fields: dict) -> dict | None:
    """Частичное обновление — используется и для drag-and-drop/селекта статуса
    (6.1), и для редактирования из клика по календарю (6.2), и для снятия
    даты (planned_date передаётся как None в fields явно, а не просто
    отсутствует в словаре — вызывающий код в app/api/growth.py решает,
    когда класть None, а когда не трогать поле вовсе)."""
    allowed = {"title", "status", "planned_date"}
    data = {k: v for k, v in fields.items() if k in allowed}
    if not data:
        return get_content_plan_item(item_id, project_id)
    columns = list(data.keys())
    return db.execute_returning(
        f"""
        UPDATE content_plan_items SET {', '.join(f'{c} = %s' for c in columns)}
        WHERE id = %s AND project_id = %s
        RETURNING *
        """,
        tuple(data.values()) + (item_id, project_id),
    )


def delete_content_plan_item(item_id: int, project_id: int) -> bool:
    rowcount = db.execute(
        "DELETE FROM content_plan_items WHERE id = %s AND project_id = %s",
        (item_id, project_id),
    )
    return bool(rowcount)


# ---------- templates ----------

def list_templates(category: str | None = None, user_id: int | None = None) -> list[dict]:
    """Возвращает системные шаблоны + (если передан user_id) личные шаблоны
    этого пользователя в указанной категории."""
    sql = "SELECT * FROM templates WHERE (is_system = true"
    params: list = []
    if user_id is not None:
        sql += " OR user_id = %s"
        params.append(user_id)
    sql += ")"
    if category:
        sql += " AND category = %s"
        params.append(category)
    sql += " ORDER BY is_system DESC, created_at DESC"
    return db.query(sql, tuple(params))
