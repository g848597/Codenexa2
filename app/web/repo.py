"""Тонкий слой доступа к данным (Postgres/Supabase через db.py) — без ORM,
чтобы не тащить лишнюю зависимость ради небольшого количества таблиц."""
import datetime as dt
import logging

import psycopg2.extras

from app.web import money
from app.web.cache import get_redis
from app.web.db import get_conn, tx

logger = logging.getLogger("codenexa.repo")


def row_to_dict(row):
    return dict(row) if row else None


# Раунд 8 (аудит, раздел 2/12, "переписать" п.1 — механический подпункт,
# см. CHANGES_ROUND8.md, модуль 3.1): паттерн "get_conn(); .fetchone()/
# .fetchall(); row_to_dict(...)" повторялся 10+ раз почти буквально по всему
# файлу. Вынесен в два общих хелпера — тот же принцип, что и вынос esc()/
# escAttr() в webapp/src/utils/html.js и log_action() в audit.py в прошлых
# раундах: не абстракция ради абстракции (лишнего слоя параметров нет), а
# устранение буквального копипаста одной и той же тройки вызовов.
def _fetch_one(query: str, params: tuple = ()):
    conn = get_conn()
    return row_to_dict(conn.execute(query, params).fetchone())


def _fetch_all(query: str, params: tuple = ()):
    conn = get_conn()
    return [row_to_dict(r) for r in conn.execute(query, params).fetchall()]


def get_user_by_id(user_id: int):
    return _fetch_one("SELECT * FROM users WHERE id = ?", (user_id,))


def get_user_by_telegram_id(tg_id: int):
    return _fetch_one("SELECT * FROM users WHERE telegram_id = ?", (tg_id,))


def get_user_by_email(email: str):
    return _fetch_one("SELECT * FROM users WHERE email = ?", (email.lower(),))


def get_user_by_provider_id(field: str, value: str):
    assert field in ("google_id", "yandex_id")
    return _fetch_one(f"SELECT * FROM users WHERE {field} = ?", (value,))


def create_user(**fields):
    with tx() as conn:
        cols = ", ".join(fields.keys())
        placeholders = ", ".join(["?"] * len(fields))
        cur = conn.execute(
            f"INSERT INTO users ({cols}) VALUES ({placeholders})", tuple(fields.values())
        )
        # ВАЖНО: читаем через то же самое соединение (conn), а не через
        # get_user_by_id()/get_conn() — та берёт ДРУГОЕ соединение из пула
        # (см. db.py, п.1 аудита раздела 13), а транзакция ещё не
        # закоммичена в этой точке (commit — только по выходу из `with
        # tx()`), поэтому чужое соединение по правилам изоляции Postgres не
        # увидит только что вставленную строку и вернёт None.
        row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)


def update_user(user_id: int, **fields):
    if not fields:
        return get_user_by_id(user_id)
    with tx() as conn:
        set_clause = ", ".join(f"{k} = ?" for k in fields.keys())
        conn.execute(
            f"UPDATE users SET {set_clause} WHERE id = ?", (*fields.values(), user_id)
        )
    return get_user_by_id(user_id)


def touch_login(user_id: int):
    with tx() as conn:
        conn.execute(
            "UPDATE users SET last_login_at = NOW() WHERE id = ?", (user_id,)
        )


# --- роли/админы (аудит, раздел 13, "Средний приоритет": ролевая модель
# админов вместо allow-list — см. app/web/deps.py и
# app/web/api/admin_users.py) ---

VALID_ROLES = ("user", "admin", "superadmin")


def set_user_role(user_id: int, role: str):
    assert role in VALID_ROLES, f"Недопустимая роль: {role!r}"
    with tx() as conn:
        conn.execute("UPDATE users SET role = ? WHERE id = ?", (role, user_id))
    return get_user_by_id(user_id)


def count_superadmins() -> int:
    """Используется для bootstrap-логики в deps.py: пока в БД нет ни одного
    superadmin, первый вход с email/telegram_id из ADMIN_EMAILS/
    ADMIN_TELEGRAM_IDS (.env) автоматически получает роль. Как только
    появился хотя бы один superadmin, эта функция возвращает >0 и .env
    больше не может ни выдать, ни вернуть роль в обход явного отзыва через
    /api/admin/users."""
    row = _fetch_one("SELECT COUNT(*) AS n FROM users WHERE role = 'superadmin'")
    return row["n"] if row else 0


def list_admins():
    """Все пользователи с ролью admin/superadmin — обзорный список для
    /api/admin/users (без ?q= — "кому уже выдана роль")."""
    return _fetch_all("SELECT * FROM users WHERE role != 'user' ORDER BY role DESC, id ASC")


def search_users(query: str, limit: int = 20):
    """Поиск по email (частичное совпадение) или telegram_id (точное) — для
    выдачи роли пользователю, который ещё не админ."""
    like = f"%{query}%"
    return _fetch_all(
        "SELECT * FROM users WHERE email ILIKE ? OR CAST(telegram_id AS TEXT) = ? "
        "ORDER BY id ASC LIMIT ?",
        (like, query, limit),
    )


# --- sessions ---

# Кэш is_session_valid() (Redis, опционально) — см. аудит, раздел 2, "Где
# можно ускорить": без него каждый авторизованный запрос делает отдельный
# SELECT в Postgres только чтобы проверить revoked-флаг одной сессии. TTL
# короткий (90 сек) и не единственная линия защиты — revoke_session()/
# revoke_all_sessions() дополнительно инвалидируют кэш немедленно, так что
# окно "отозвано в БД, но кэш ещё считает валидным" в норме отсутствует и
# ограничено TTL только если сам Redis недоступен в момент revoke. Без
# REDIS_URL (get_redis() вернёт None) поведение не меняется — прямой SELECT
# на каждый запрос, как раньше.
SESSION_CACHE_TTL = 90


def _session_cache_key(token_id: str) -> str:
    return f"session_valid:{token_id}"


def _invalidate_session_cache(token_id: str):
    r = get_redis()
    if r is None:
        return
    try:
        r.delete(_session_cache_key(token_id))
    except Exception as exc:  # noqa: BLE001 — Redis моргнул, кэш просто протухнет по TTL
        logger.warning("Не удалось инвалидировать кэш сессии (%s)", exc)


def create_session(user_id: int, token_id: str, user_agent: str, ip: str):
    with tx() as conn:
        conn.execute(
            "INSERT INTO sessions (user_id, token_id, user_agent, ip) VALUES (?, ?, ?, ?)",
            (user_id, token_id, user_agent, ip),
        )


def is_session_valid(token_id: str) -> bool:
    r = get_redis()
    cache_key = _session_cache_key(token_id)
    if r is not None:
        try:
            cached = r.get(cache_key)
            if cached is not None:
                return cached == "1"
        except Exception as exc:  # noqa: BLE001 — фолбэк на прямой запрос к БД
            logger.warning("Redis недоступен при чтении кэша сессии (%s)", exc)
            r = None

    conn = get_conn()
    row = conn.execute(
        "SELECT revoked FROM sessions WHERE token_id = ?", (token_id,)
    ).fetchone()
    valid = bool(row) and not row["revoked"]

    if r is not None:
        try:
            r.set(cache_key, "1" if valid else "0", ex=SESSION_CACHE_TTL)
        except Exception as exc:  # noqa: BLE001 — не критично, просто не закешировали
            logger.warning("Redis недоступен при записи кэша сессии (%s)", exc)

    return valid


def list_sessions(user_id: int):
    return _fetch_all(
        "SELECT id, token_id, user_agent, ip, created_at, revoked FROM sessions "
        "WHERE user_id = ? ORDER BY created_at DESC",
        (user_id,),
    )


def revoke_session(user_id: int, session_row_id: int):
    conn = get_conn()
    row = conn.execute(
        "SELECT token_id FROM sessions WHERE id = ? AND user_id = ?",
        (session_row_id, user_id),
    ).fetchone()
    with tx() as conn2:
        conn2.execute(
            "UPDATE sessions SET revoked = TRUE WHERE id = ? AND user_id = ?",
            (session_row_id, user_id),
        )
    if row:
        _invalidate_session_cache(row["token_id"])


def revoke_all_sessions(user_id: int, except_token_id: str | None = None):
    conn = get_conn()
    if except_token_id:
        affected = conn.execute(
            "SELECT token_id FROM sessions WHERE user_id = ? AND token_id != ? AND revoked = FALSE",
            (user_id, except_token_id),
        ).fetchall()
    else:
        affected = conn.execute(
            "SELECT token_id FROM sessions WHERE user_id = ? AND revoked = FALSE", (user_id,)
        ).fetchall()

    with tx() as conn2:
        if except_token_id:
            conn2.execute(
                "UPDATE sessions SET revoked = TRUE WHERE user_id = ? AND token_id != ?",
                (user_id, except_token_id),
            )
        else:
            conn2.execute("UPDATE sessions SET revoked = TRUE WHERE user_id = ?", (user_id,))

    for row in affected:
        _invalidate_session_cache(row["token_id"])


# --- payments ---

def get_payment_by_idempotency_key(user_id: int, idempotency_key: str):
    """Для повтора запроса /billing/checkout с тем же Idempotency-Key —
    возвращаем уже созданный платёж вместо того, чтобы плодить новый инвойс
    (см. аудит, п.0.5: двойной клик/ретрай сети иначе создаёт дубликаты)."""
    if not idempotency_key:
        return None
    conn = get_conn()
    return row_to_dict(
        conn.execute(
            "SELECT * FROM payments WHERE user_id = ? AND idempotency_key = ?",
            (user_id, idempotency_key),
        ).fetchone()
    )


def create_payment(user_id: int, provider: str, external_id: str, plan: str, amount, currency: str,
                    idempotency_key: str | None = None):
    """`amount` принимает Decimal/str/int/float и всегда приводится к Decimal
    перед записью (аудит, раздел 13, "Средний приоритет", п.2 — единая
    денежная утилита, см. app/web/money.py) — колонка `payments.amount`
    теперь NUMERIC(20,8), а не TEXT."""
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO payments (user_id, provider, external_id, plan, amount, currency, idempotency_key) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, provider, external_id, plan, money.to_decimal(amount), currency, idempotency_key),
        )
        return cur.lastrowid


def _plan_duration_days(plan_code: str) -> int | None:
    row = _fetch_one("SELECT duration_days FROM plans WHERE code = ? ORDER BY created_at DESC LIMIT 1", (plan_code,))
    return row["duration_days"] if row else None


def mark_payment_paid(provider: str, external_id: str):
    """Возвращает user_id помеченного платежа (или None, если платёж с таким
    provider/external_id не найден) — раунд 8, модуль 2: вызывающий код
    (billing.py::cryptobot_webhook) использует его, чтобы подтвердить
    реферальную запись приглашённого при его первой успешной оплате.

    expires_at считается от момента оплаты на длительность тарифа
    (plans.duration_days). NULL длительность = бессрочный/разовый тариф —
    expires_at остаётся NULL, "активная подписка" для него не истекает."""
    with tx() as conn:
        row = conn.execute(
            "SELECT plan FROM payments WHERE provider = ? AND external_id = ?",
            (provider, external_id),
        ).fetchone()
        duration_days = _plan_duration_days(row["plan"]) if row else None
        expires_sql = "NOW() + (? * INTERVAL '1 day')" if duration_days else "NULL"
        params = (duration_days,) if duration_days else ()
        updated = conn.execute(
            f"UPDATE payments SET status = 'paid', paid_at = NOW(), expires_at = {expires_sql} "
            "WHERE provider = ? AND external_id = ? RETURNING user_id",
            (*params, provider, external_id),
        ).fetchone()
        return updated["user_id"] if updated else None


def mark_latest_pending_paid(provider: str, user_id: int, plan: str, external_id: str):
    """Для Stars: при создании инвойса ещё нет charge_id, он появляется только
    в successful_payment. Поэтому ищем последний pending-платёж этого
    пользователя/тарифа и закрываем его, записывая charge_id как external_id.

    Раунд 8 (аудит, раздел 7, п.3 — см. CHANGES_ROUND8.md, модуль 3.3):
    двойной клик на "оплатить" до появления Idempotency-Key (п.0.5) мог
    оставить несколько pending-платежей на один тариф — вебхук закрывал
    только последний, остальные навсегда зависали в статусе 'pending' и
    засоряли историю платежей недостоверными "неоплаченными" записями.
    Теперь при подтверждении оплаты все остальные pending-платежи того же
    пользователя/тарифа явно переводятся в 'cancelled', а не остаются висеть."""
    with tx() as conn:
        row = conn.execute(
            "SELECT id FROM payments WHERE provider = ? AND user_id = ? AND plan = ? "
            "AND status = 'pending' ORDER BY created_at DESC LIMIT 1",
            (provider, user_id, plan),
        ).fetchone()
        if not row:
            return False
        duration_days = _plan_duration_days(plan)
        expires_sql = "NOW() + (? * INTERVAL '1 day')" if duration_days else "NULL"
        expires_params = (duration_days,) if duration_days else ()
        conn.execute(
            f"UPDATE payments SET status = 'paid', paid_at = NOW(), external_id = ?, expires_at = {expires_sql} "
            "WHERE id = ?",
            (external_id, *expires_params, row["id"]),
        )
        conn.execute(
            "UPDATE payments SET status = 'cancelled' WHERE provider = ? AND user_id = ? "
            "AND plan = ? AND status = 'pending' AND id != ?",
            (provider, user_id, plan, row["id"]),
        )
        return True


def get_active_subscription(user_id: int):
    """Реальная проверка активной подписки — оплачена И (бессрочная, ИЛИ
    ещё не истекла). В отличие от "платил хоть раз когда-либо" (старая
    логика, см. историю чата), это честно отражает текущий доступ.
    Берётся платёж с самым поздним expires_at среди подходящих (а не просто
    последний по дате оплаты) — так продление/апгрейд тарифа корректно
    отражается, даже если купили заранее, до истечения текущего."""
    return _fetch_one(
        "SELECT * FROM payments WHERE user_id = ? AND status = 'paid' "
        "AND (expires_at IS NULL OR expires_at > NOW()) "
        "ORDER BY (expires_at IS NULL) DESC, expires_at DESC NULLS LAST, paid_at DESC LIMIT 1",
        (user_id,),
    )


def list_payments(user_id: int):
    return _fetch_all(
        "SELECT * FROM payments WHERE user_id = ? ORDER BY created_at DESC", (user_id,)
    )


# --- oauth state (для Google/Yandex через диплинк в бота, см. README_BACKEND.md) ---

def create_oauth_state(provider: str, state: str):
    with tx() as conn:
        conn.execute(
            "INSERT INTO oauth_links (provider, state) VALUES (?, ?)", (provider, state)
        )


def attach_oauth_code(state: str, user_id: int, code: str):
    with tx() as conn:
        conn.execute(
            "UPDATE oauth_links SET user_id = ?, code = ? WHERE state = ?",
            (user_id, code, state),
        )


def validate_oauth_state(provider: str, state: str, max_age_seconds: int = 600) -> bool:
    """Проверяет, что `state` был выдан этим сервером для этого провайдера,
    ещё не использован (user_id IS NULL — callback ещё не проходил) и не
    старше max_age_seconds. Не привязка к браузеру (это делает cookie на
    уровне auth.py), а защита от повторного использования/протухшего state.
    См. аудит, раздел 4, п.6.
    """
    conn = get_conn()
    row = conn.execute(
        "SELECT created_at FROM oauth_links "
        "WHERE provider = ? AND state = ? AND user_id IS NULL",
        (provider, state),
    ).fetchone()
    if not row:
        return False
    created_at = row["created_at"]
    if created_at is None:
        return False
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=dt.timezone.utc)
    age = (dt.datetime.now(dt.timezone.utc) - created_at).total_seconds()
    return age <= max_age_seconds


# --- investors ("Инвесторы") ---

INVESTOR_FIELDS = (
    "name", "position", "country", "company", "description",
    "investment_amount", "investment_amount_value", "currency",
    "status", "photo_url", "website_url", "sort_order",
)


def list_investors_public():
    """Только опубликованные, в порядке отображения — для публичной страницы."""
    return _fetch_all(
        "SELECT * FROM investors WHERE status = 'published' ORDER BY sort_order ASC, id ASC"
    )


def list_investors_all():
    """Все карточки независимо от статуса — для админ-панели."""
    return _fetch_all("SELECT * FROM investors ORDER BY sort_order ASC, id ASC")


def get_investor(investor_id: int):
    return _fetch_one("SELECT * FROM investors WHERE id = ?", (investor_id,))


def create_investor(**fields):
    clean = {k: v for k, v in fields.items() if k in INVESTOR_FIELDS}
    with tx() as conn:
        if "sort_order" not in clean:
            row = conn.execute("SELECT COALESCE(MAX(sort_order), -1) + 1 AS n FROM investors").fetchone()
            clean["sort_order"] = row["n"]
        cols = ", ".join(clean.keys())
        placeholders = ", ".join(["?"] * len(clean))
        cur = conn.execute(
            f"INSERT INTO investors ({cols}) VALUES ({placeholders})", tuple(clean.values())
        )
        # См. комментарий в create_user() — читаем через тот же conn, а не
        # через get_investor()/get_conn(), иначе не увидим ещё не
        # закоммиченную строку из-за пула соединений.
        row = conn.execute("SELECT * FROM investors WHERE id = ?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)


def update_investor(investor_id: int, **fields):
    clean = {k: v for k, v in fields.items() if k in INVESTOR_FIELDS}
    if not clean:
        return get_investor(investor_id)
    clean["updated_at"] = "__now__"
    set_parts = []
    values = []
    for k, v in clean.items():
        if k == "updated_at":
            set_parts.append("updated_at = NOW()")
        else:
            set_parts.append(f"{k} = ?")
            values.append(v)
    values.append(investor_id)
    with tx() as conn:
        conn.execute(f"UPDATE investors SET {', '.join(set_parts)} WHERE id = ?", tuple(values))
    return get_investor(investor_id)


def delete_investor(investor_id: int):
    with tx() as conn:
        conn.execute("DELETE FROM investors WHERE id = ?", (investor_id,))


def reorder_investors(order: list[tuple[int, int]]):
    """order: список (investor_id, sort_order).

    Раунд 8 (аудит, раздел 7, п.2 и п.6 — см. CHANGES_ROUND8.md, модуль 3.2):
    - Дубликаты sort_order в одном запросе теперь явная ошибка (ValueError,
      API-слой превращает её в 400), а не тихая неопределённость порядка —
      раньше это подстраховывалось только вторичной сортировкой по id в
      SELECT'ах, но сама возможность записать два одинаковых sort_order
      ничем не была ограничена.
    - `SELECT ... FOR UPDATE` на затрагиваемые строки в начале транзакции:
      если два админа одновременно перетаскивают карточки, вторая
      транзакция ждёт коммита первой и полностью перезаписывает её поверх
      (честный "последний сохранивший побеждает"), а не чередует часть
      строк одной попытки с частью строк другой (lost update). Блокировка
      берётся в порядке ORDER BY id (а не в порядке из запроса) — единый
      порядок для всех конкурентных транзакций исключает deadlock "A ждёт
      лок B, B ждёт лок A".
    """
    if not order:
        return
    seen_sort_orders = set()
    for _, sort_order in order:
        if sort_order in seen_sort_orders:
            raise ValueError(f"Дублирующийся sort_order в запросе: {sort_order}")
        seen_sort_orders.add(sort_order)

    ids = sorted({investor_id for investor_id, _ in order})
    with tx() as conn:
        conn.execute("SELECT id FROM investors WHERE id = ANY(?) ORDER BY id FOR UPDATE", (ids,))
        conn.executemany(
            "UPDATE investors SET sort_order = ?, updated_at = NOW() WHERE id = ?",
            [(sort_order, investor_id) for investor_id, sort_order in order],
        )


# ---------- аудит-лог админ-действий (раунд 7) ----------

def log_admin_action(
    admin_id: int | None,
    action: str,
    target_type: str,
    target_id: str | int | None = None,
    details: dict | None = None,
    ip: str | None = None,
):
    """Пишет одну строку в admin_audit_log. Намеренно "лучше стараться, чем
    не писать вовсе": вызовы оборачиваются в try/except в API-слое, чтобы
    сбой логирования (например, временная недоступность БД) никогда не
    блокировал само админ-действие — само действие уже прошло и закоммичено
    к моменту вызова этой функции."""
    with tx() as conn:
        conn.execute(
            "INSERT INTO admin_audit_log (admin_id, action, target_type, target_id, details, ip) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (
                admin_id,
                action,
                target_type,
                str(target_id) if target_id is not None else None,
                psycopg2.extras.Json(details) if details is not None else None,
                ip,
            ),
        )


def list_audit_log(limit: int = 50, offset: int = 0, action: str | None = None, admin_id: int | None = None):
    """Постранично, самые новые записи первыми. Фильтры необязательны и
    комбинируются (AND) — используются панелью аудита для сужения выборки
    по типу действия и/или конкретному админу."""
    conn = get_conn()
    clauses = []
    params: list = []
    if action:
        clauses.append("a.action = ?")
        params.append(action)
    if admin_id is not None:
        clauses.append("a.admin_id = ?")
        params.append(admin_id)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    params.extend([limit, offset])
    rows = conn.execute(
        f"""
        SELECT a.id, a.admin_id, a.action, a.target_type, a.target_id, a.details,
               a.ip, a.created_at, u.email AS admin_email, u.first_name AS admin_first_name
        FROM admin_audit_log a
        LEFT JOIN users u ON u.id = a.admin_id
        {where}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ? OFFSET ?
        """,
        tuple(params),
    ).fetchall()
    return [row_to_dict(r) for r in rows]


def count_audit_log(action: str | None = None, admin_id: int | None = None) -> int:
    conn = get_conn()
    clauses = []
    params: list = []
    if action:
        clauses.append("action = ?")
        params.append(action)
    if admin_id is not None:
        clauses.append("admin_id = ?")
        params.append(admin_id)
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    row = conn.execute(f"SELECT COUNT(*) AS c FROM admin_audit_log {where}", tuple(params)).fetchone()
    return row_to_dict(row)["c"]


def consume_oauth_code(code: str):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM oauth_links WHERE code = ? AND consumed = FALSE", (code,)
    ).fetchone()
    if not row:
        return None
    with tx() as conn2:
        conn2.execute("UPDATE oauth_links SET consumed = TRUE WHERE code = ?", (code,))
    return row_to_dict(row)


# --- OTP-коды: подтверждение email и сброс пароля (задача 3,
# CODENEXA_TASKLIST.md). Общая таблица auth_otp_codes с полем `purpose`
# вместо двух похожих таблиц — верификация и сброс пароля отличаются только
# тем, что происходит ПОСЛЕ успешной проверки кода (auth.py), а не механикой
# хранения/TTL/попыток самого кода. ---

def create_otp_code(user_id: int, purpose: str, code_hash: str, ttl_seconds: int):
    """Гасит все ранее выданные, ещё не использованные коды этого purpose для
    пользователя (запрос нового кода делает предыдущий недействительным — иначе
    в таблице накапливались бы несколько параллельно "живых" кодов, из которых
    подошёл бы любой) и создаёт новый."""
    with tx() as conn:
        conn.execute(
            "UPDATE auth_otp_codes SET consumed = TRUE "
            "WHERE user_id = ? AND purpose = ? AND consumed = FALSE",
            (user_id, purpose),
        )
        cur = conn.execute(
            "INSERT INTO auth_otp_codes (user_id, purpose, code_hash, expires_at) "
            "VALUES (?, ?, ?, NOW() + make_interval(secs => ?))",
            (user_id, purpose, code_hash, ttl_seconds),
        )
        row = conn.execute("SELECT * FROM auth_otp_codes WHERE id = ?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)


def get_active_otp_code(user_id: int, purpose: str):
    """Последний ещё не использованный и не просроченный код данного purpose,
    если он есть — на пользователя+purpose он максимум один (см.
    create_otp_code выше)."""
    return _fetch_one(
        "SELECT * FROM auth_otp_codes WHERE user_id = ? AND purpose = ? "
        "AND consumed = FALSE AND expires_at > NOW() "
        "ORDER BY created_at DESC LIMIT 1",
        (user_id, purpose),
    )


def register_otp_attempt(otp_id: int) -> int:
    """Увеличивает счётчик неверных попыток для конкретного кода и возвращает
    новое значение — вызывающий код (auth.py) решает, когда "сжечь" код
    (см. MAX_OTP_ATTEMPTS), сама эта функция кода не инвалидирует."""
    with tx() as conn:
        conn.execute("UPDATE auth_otp_codes SET attempts = attempts + 1 WHERE id = ?", (otp_id,))
    row = _fetch_one("SELECT attempts FROM auth_otp_codes WHERE id = ?", (otp_id,))
    return row["attempts"] if row else 0


def consume_otp_code(otp_id: int):
    with tx() as conn:
        conn.execute("UPDATE auth_otp_codes SET consumed = TRUE WHERE id = ?", (otp_id,))


# --- тарифы (plans) — раунд 8, модуль 4 (аудит, раздел 12 "Объединить":
# PLANS из статичного словаря billing.py в таблицу с историей цен) ---

def get_active_plans():
    """Все действующие сейчас тарифы — для публичного /api/billing/plans."""
    return _fetch_all("SELECT * FROM plans WHERE is_active ORDER BY code ASC")


def get_active_plan(code: str):
    return _fetch_one("SELECT * FROM plans WHERE code = ? AND is_active", (code,))


def list_plan_history(code: str | None = None):
    """Вся история изменений цен — либо по одному коду тарифа, либо по всем.
    Новые записи первыми (см. аудит, п.29 — публичная история тарифов)."""
    if code:
        return _fetch_all("SELECT * FROM plans WHERE code = ? ORDER BY created_at DESC", (code,))
    return _fetch_all("SELECT * FROM plans ORDER BY code ASC, created_at DESC")


def set_plan_price(code: str, title: str, usd, stars: int, duration_days: int | None = None):
    """Меняет цену тарифа: деактивирует текущую активную запись для `code`
    (если она была) и вставляет новую активную — старая строка не
    удаляется и не перезаписывается, так вся история цен остаётся читаемой
    через list_plan_history(). Если тарифа с таким code ещё не было, эта же
    функция его создаёт (первая запись для code сразу активна).

    duration_days — на сколько дней даёт доступ оплата этого тарифа (NULL =
    бессрочно/разовая покупка). Применяется к НОВЫМ оплатам этого тарифа
    (см. mark_payment_paid/mark_latest_pending_paid) — уже оплаченные
    подписки не пересчитываются задним числом."""
    with tx() as conn:
        conn.execute("UPDATE plans SET is_active = FALSE WHERE code = ? AND is_active", (code,))
        cur = conn.execute(
            "INSERT INTO plans (code, title, usd, stars, duration_days, is_active) VALUES (?, ?, ?, ?, ?, TRUE)",
            (code, title, money.to_decimal(usd), stars, duration_days),
        )
        row = conn.execute("SELECT * FROM plans WHERE id = ?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)


# --- реферальная программа (referrals) — раунд 8, модуль 2 (аудит, раздел
# 13, "Средний приоритет") ---

def create_referral(referrer_id: int, referred_id: int):
    """Связывает нового пользователя с пригласившим. Уникальный индекс на
    referred_id гарантирует, что один пользователь может быть привязан
    только к ОДНОМУ рефереру (защита от повторной привязки задним числом).
    Возвращает None, если запись для referred_id уже существует (не
    перезаписывает существующую привязку) — вызывающий код (app/web/
    referrals.py) отличает "уже был приглашён кем-то другим" от "успешно
    привязан впервые"."""
    existing = get_referral_by_referred(referred_id)
    if existing:
        return None
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO referrals (referrer_id, referred_id, status) VALUES (?, ?, 'pending')",
            (referrer_id, referred_id),
        )
        row = conn.execute("SELECT * FROM referrals WHERE id = ?", (cur.lastrowid,)).fetchone()
        return row_to_dict(row)


def get_referral_by_referred(referred_id: int):
    return _fetch_one("SELECT * FROM referrals WHERE referred_id = ?", (referred_id,))


def confirm_referral(referred_id: int, reward_amount=None, reward_currency: str | None = None):
    """Переводит referrals-запись приглашённого пользователя в 'confirmed'
    при его первой успешной оплате. Идемпотентно: если запись уже
    'confirmed' (вторая и последующие оплаты того же пользователя), ничего
    не делает и возвращает None — вознаграждение начисляется один раз, за
    первую оплату, не за каждую."""
    with tx() as conn:
        row = conn.execute(
            "SELECT * FROM referrals WHERE referred_id = ? AND status = 'pending'",
            (referred_id,),
        ).fetchone()
        if not row:
            return None
        conn.execute(
            "UPDATE referrals SET status = 'confirmed', reward_amount = ?, "
            "reward_currency = ?, confirmed_at = NOW() WHERE id = ?",
            (reward_amount, reward_currency, row["id"]),
        )
        updated = conn.execute("SELECT * FROM referrals WHERE id = ?", (row["id"],)).fetchone()
        return row_to_dict(updated)


def list_referrals_by_referrer(referrer_id: int):
    return _fetch_all(
        "SELECT * FROM referrals WHERE referrer_id = ? ORDER BY created_at DESC", (referrer_id,)
    )


def count_confirmed_referrals(referrer_id: int) -> int:
    row = _fetch_one(
        "SELECT COUNT(*) AS n FROM referrals WHERE referrer_id = ? AND status = 'confirmed'",
        (referrer_id,),
    )
    return row["n"] if row else 0


# --- организации (командный/бизнес-тариф) и документы (раздел "Документы") ---

def create_organization(name: str, owner_user_id: int, plan_code: str):
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO organizations (name, owner_user_id, plan_code) VALUES (?, ?, ?)",
            (name, owner_user_id, plan_code),
        )
        org = row_to_dict(conn.execute(
            "SELECT * FROM organizations WHERE id = ?", (cur.lastrowid,)
        ).fetchone())
        conn.execute(
            "INSERT INTO organization_members (org_id, user_id, role) VALUES (?, ?, 'owner')",
            (org["id"], owner_user_id),
        )
        return org


def get_organization(org_id: int):
    return _fetch_one("SELECT * FROM organizations WHERE id = ?", (org_id,))


def get_user_membership(user_id: int):
    """Организация и роль текущего пользователя, если он в неё входит —
    None, если пользователь не состоит ни в одной организации."""
    return _fetch_one(
        "SELECT organization_members.*, organizations.name AS org_name, "
        "organizations.plan_code AS org_plan_code FROM organization_members "
        "JOIN organizations ON organizations.id = organization_members.org_id "
        "WHERE organization_members.user_id = ?",
        (user_id,),
    )


def list_organization_members(org_id: int):
    return _fetch_all(
        "SELECT organization_members.*, users.first_name, users.last_name, users.email "
        "FROM organization_members JOIN users ON users.id = organization_members.user_id "
        "WHERE organization_members.org_id = ? ORDER BY organization_members.created_at ASC",
        (org_id,),
    )


def remove_organization_member(org_id: int, user_id: int):
    with tx() as conn:
        conn.execute(
            "DELETE FROM organization_members WHERE org_id = ? AND user_id = ? AND role != 'owner'",
            (org_id, user_id),
        )


def create_organization_invite(org_id: int, token: str, email: str | None, role: str = "member"):
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO organization_invites (org_id, token, email, role) VALUES (?, ?, ?, ?)",
            (org_id, token, email, role),
        )
        return row_to_dict(conn.execute(
            "SELECT * FROM organization_invites WHERE id = ?", (cur.lastrowid,)
        ).fetchone())


def get_invite_by_token(token: str):
    return _fetch_one(
        "SELECT * FROM organization_invites WHERE token = ? AND status = 'pending'", (token,)
    )


def accept_organization_invite(token: str, user_id: int):
    """Помечает приглашение принятым и добавляет пользователя в организацию.
    Возвращает None, если приглашения нет / уже использовано, или если
    пользователь уже состоит в какой-то другой организации (упрощение:
    один пользователь = одна организация, см. idx_org_members_user)."""
    with tx() as conn:
        invite = conn.execute(
            "SELECT * FROM organization_invites WHERE token = ? AND status = 'pending'", (token,)
        ).fetchone()
        if not invite:
            return None
        already = conn.execute(
            "SELECT 1 FROM organization_members WHERE user_id = ?", (user_id,)
        ).fetchone()
        if already:
            return None
        conn.execute(
            "INSERT INTO organization_members (org_id, user_id, role) VALUES (?, ?, ?)",
            (invite["org_id"], user_id, invite["role"]),
        )
        conn.execute(
            "UPDATE organization_invites SET status = 'accepted', accepted_at = NOW() WHERE id = ?",
            (invite["id"],),
        )
        return row_to_dict(invite)


# --- шаблоны документов ---

def list_templates_for_scope(org_id: int | None):
    """Системные шаблоны (owner_org_id IS NULL) + приватные шаблоны
    организации пользователя, если он в ней состоит."""
    if org_id:
        return _fetch_all(
            "SELECT * FROM document_templates WHERE is_active AND "
            "(owner_org_id IS NULL OR owner_org_id = ?) ORDER BY category ASC, title ASC",
            (org_id,),
        )
    return _fetch_all(
        "SELECT * FROM document_templates WHERE is_active AND owner_org_id IS NULL "
        "ORDER BY category ASC, title ASC"
    )


def get_template_for_scope(code: str, org_id: int | None):
    """Ищет сначала приватный шаблон организации пользователя (если есть),
    иначе системный — так организация может переопределить system-код своим
    под тем же code, не ломая ссылки для остальных."""
    if org_id:
        own = _fetch_one(
            "SELECT * FROM document_templates WHERE code = ? AND owner_org_id = ? AND is_active",
            (code, org_id),
        )
        if own:
            return own
    return _fetch_one(
        "SELECT * FROM document_templates WHERE code = ? AND owner_org_id IS NULL AND is_active",
        (code,),
    )


def create_template(owner_org_id: int | None, code: str, category: str, title: str,
                     description: str, fields: list, body_template: str, locked: bool = False):
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO document_templates "
            "(code, owner_org_id, category, title, description, fields, body_template, locked) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (code, owner_org_id, category, title, description,
             psycopg2.extras.Json(fields), body_template, locked),
        )
        return row_to_dict(conn.execute(
            "SELECT * FROM document_templates WHERE id = ?", (cur.lastrowid,)
        ).fetchone())


def deactivate_template(owner_org_id: int, code: str):
    """Организация может выключить только свой собственный шаблон —
    поэтому owner_org_id обязателен и не может быть NULL (системные
    шаблоны редактируются отдельно, через админку)."""
    with tx() as conn:
        conn.execute(
            "UPDATE document_templates SET is_active = FALSE "
            "WHERE code = ? AND owner_org_id = ?",
            (code, owner_org_id),
        )


# --- документы пользователей ---

def create_document(user_id: int, org_id: int | None, template_code: str | None,
                     title: str, data: dict, final_text: str):
    with tx() as conn:
        cur = conn.execute(
            "INSERT INTO documents (user_id, org_id, template_code, title, data, final_text) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, org_id, template_code, title, psycopg2.extras.Json(data), final_text),
        )
        return row_to_dict(conn.execute(
            "SELECT * FROM documents WHERE id = ?", (cur.lastrowid,)
        ).fetchone())


def list_documents(user_id: int, page: int = 1, page_size: int = 20):
    offset = max(page - 1, 0) * page_size
    return _fetch_all(
        "SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (user_id, page_size, offset),
    )


def get_document(doc_id: int, user_id: int):
    return _fetch_one(
        "SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id)
    )


def delete_document(doc_id: int, user_id: int):
    with tx() as conn:
        conn.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))


# --- профиль раздела "Документы" (автоподстановка ФИО/реквизитов, логотип, подпись) ---

_PROFILE_FIELDS = (
    "full_name", "city", "position", "company_name", "bin_iin",
    "requisites", "address", "signature_name", "pdf_theme",
)


def get_document_profile(user_id: int):
    row = _fetch_one("SELECT * FROM document_profiles WHERE user_id = ?", (user_id,))
    if row:
        return row
    # Профиля ещё нет — отдаём пустой шаблон, не создавая строку в БД
    # раньше времени (создастся при первом PUT/загрузке файла).
    return {f: "" for f in _PROFILE_FIELDS} | {
        "user_id": user_id, "logo_path": None, "signature_path": None, "pdf_theme": "classic",
    }


def upsert_document_profile(user_id: int, fields: dict):
    clean = {k: str(v).strip() for k, v in fields.items() if k in _PROFILE_FIELDS}
    with tx() as conn:
        exists = conn.execute(
            "SELECT 1 FROM document_profiles WHERE user_id = ?", (user_id,)
        ).fetchone()
        if exists:
            if clean:
                set_clause = ", ".join(f"{k} = ?" for k in clean)
                conn.execute(
                    f"UPDATE document_profiles SET {set_clause}, updated_at = NOW() WHERE user_id = ?",
                    (*clean.values(), user_id),
                )
        else:
            cols = ["user_id", *clean.keys()]
            placeholders = ", ".join(["?"] * len(cols))
            conn.execute(
                f"INSERT INTO document_profiles ({', '.join(cols)}) VALUES ({placeholders})",
                (user_id, *clean.values()),
            )
        return row_to_dict(conn.execute(
            "SELECT * FROM document_profiles WHERE user_id = ?", (user_id,)
        ).fetchone())


def set_document_profile_file(user_id: int, kind: str, path: str | None):
    """kind: 'logo_path' | 'signature_path'."""
    if kind not in ("logo_path", "signature_path"):
        raise ValueError("kind должен быть logo_path или signature_path")
    with tx() as conn:
        exists = conn.execute(
            "SELECT 1 FROM document_profiles WHERE user_id = ?", (user_id,)
        ).fetchone()
        if exists:
            conn.execute(
                f"UPDATE document_profiles SET {kind} = ?, updated_at = NOW() WHERE user_id = ?",
                (path, user_id),
            )
        else:
            conn.execute(
                f"INSERT INTO document_profiles (user_id, {kind}) VALUES (?, ?)",
                (user_id, path),
            )
        return row_to_dict(conn.execute(
            "SELECT * FROM document_profiles WHERE user_id = ?", (user_id,)
        ).fetchone())
