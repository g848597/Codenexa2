"""Слой хранения — PostgreSQL (Supabase).

Совместим по интерфейсу с прошлой SQLite-версией, поэтому repo.py и остальной
код почти не пришлось менять: get_conn()/tx() по-прежнему отдают объект с
.execute(...)/.executemany(...), у курсора есть .fetchone()/.fetchall(), а
после INSERT доступен .lastrowid (как в sqlite3), хотя в Postgres это
реализовано через INSERT ... RETURNING id.

Пул соединений (аудит, раздел 13, "Средний приоритет", п.1 / раздел 3):
раньше каждый ОС-поток из FastAPI-threadpool (до 40 при дефолтных настройках)
открывал СВОЁ соединение к Postgres через threading.local и держал его вечно
— при нескольких воркерах это легко упиралось в лимит Supabase (обычно
15-60 на Session Pooler).

Теперь соединения берутся из ограниченного psycopg2.pool.ThreadedConnectionPool
(размер задаётся DB_POOL_MIN/DB_POOL_MAX в .env), НА ВРЕМЯ ОДНОЙ единицы
работы — одного запроса для get_conn(), одной транзакции для tx() — и сразу
возвращаются обратно. Важно: явно НЕ используется threading.local/thread-id
как ключ привязки соединения к запросу, потому что sync-эндпоинты FastAPI
выполняются в threadpool (через anyio.to_thread), а async-эндпоинты — в
потоке event loop; для одного и того же HTTP-запроса это могут быть разные
ОС-потоки на входе/выходе, поэтому "запомнить соединение в thread-local и
вернуть его в пул из middleware после запроса" ненадёжно. Acquire/release
в пределах одного вызова get_conn()/tx() свободны от этой проблемы, т.к.
целиком выполняются в одном стеке вызовов одного потока.
"""
import re
import threading
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2 import pool as pg_pool

from app.web.config import settings

_INSERT_RE = re.compile(r"^\s*INSERT\s+INTO\s+\w+", re.IGNORECASE)

_pool = None
_pool_lock = threading.Lock()


def _get_pool():
    """Ленивая инициализация пула — на момент импорта модуля DATABASE_URL
    может быть ещё не нужен (например, если модуль импортирован без реальной
    работы с БД), поэтому пул создаётся при первом реальном обращении, а не
    при импорте."""
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = pg_pool.ThreadedConnectionPool(
                    settings.DB_POOL_MIN,
                    settings.DB_POOL_MAX,
                    dsn=settings.DATABASE_URL,
                    sslmode="require",
                )
    return _pool


@contextmanager
def _borrow_conn():
    """Берёт соединение из пула на время `with`-блока и всегда возвращает его
    обратно (даже при исключении). Если соединение оказалось порванным
    (частая ситуация с удалённой БД после простоя воркера), оно закрывается
    и не возвращается в пул — вместо него открывается новое."""
    pool = _get_pool()
    conn = pool.getconn()
    if conn.closed:
        pool.putconn(conn, close=True)
        conn = pool.getconn()
    # autocommit нужно выставить ДО первого запроса на соединении: если
    # соединение уже успело открыть неявную транзакцию, psycopg2/libpq
    # запрещает менять autocommit "внутри транзакции" (ошибка
    # `set_session cannot be used inside a transaction`). Поэтому
    # переключаемся в autocommit сразу после получения соединения из пула,
    # ещё до пробного запроса ниже.
    try:
        conn.autocommit = True
    except psycopg2.ProgrammingError:
        # Соединение вернулось в пул с незакрытой транзакцией (не должно
        # происходить при нормальной работе, но лучше откатить и повторить,
        # чем молча терять соединение из пула).
        conn.rollback()
        conn.autocommit = True
    try:
        with conn.cursor() as probe:
            probe.execute("SELECT 1")
    except psycopg2.OperationalError:
        pool.putconn(conn, close=True)
        conn = pool.getconn()
        conn.autocommit = True
    try:
        yield conn
    finally:
        try:
            pool.putconn(conn, close=conn.closed)
        except Exception:  # noqa: BLE001 — возврат в пул не должен маскировать исходную ошибку
            pass


class _EagerCursor:
    """Результат одного запроса через get_conn() — строки вычитаны заранее,
    т.к. реальное соединение psycopg2 уже вернулось в пул к моменту, когда
    вызывающий код дойдёт до .fetchone()/.fetchall()."""

    def __init__(self, rows, lastrowid, rowcount):
        self._rows = rows
        self._pos = 0
        self.lastrowid = lastrowid
        self.rowcount = rowcount

    def fetchone(self):
        if not self._rows or self._pos >= len(self._rows):
            return None
        row = self._rows[self._pos]
        self._pos += 1
        return row

    def fetchall(self):
        if not self._rows:
            return []
        remaining = self._rows[self._pos:]
        self._pos = len(self._rows)
        return remaining


class _OneShotConn:
    """Возвращается из get_conn(). execute() сам берёт соединение из пула,
    выполняет запрос и сразу отдаёт его обратно — используется только для
    одиночных запросов (см. repo.py: везде ровно один execute() и один
    fetchone()/fetchall() на инстанс), поэтому не требует thread-affinity.
    Для многошаговых транзакций используйте tx()."""

    def execute(self, query, params=()):
        q = query.replace("?", "%s")
        is_insert = bool(_INSERT_RE.match(q)) and "RETURNING" not in q.upper()
        if is_insert:
            q = q.rstrip().rstrip(";") + " RETURNING id"
        with _borrow_conn() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(q, params)
                lastrowid = None
                rows = None
                if is_insert:
                    row = cur.fetchone()
                    lastrowid = row["id"] if row else None
                elif cur.description is not None:
                    rows = cur.fetchall()
                rowcount = cur.rowcount
        return _EagerCursor(rows, lastrowid, rowcount)


class _CursorWrapper:
    def __init__(self, cursor):
        self._cursor = cursor
        self.lastrowid = None

    def execute(self, query, params=()):
        q = query.replace("?", "%s")
        is_insert = bool(_INSERT_RE.match(q)) and "RETURNING" not in q.upper()
        if is_insert:
            q = q.rstrip().rstrip(";") + " RETURNING id"
        self._cursor.execute(q, params)
        if is_insert:
            row = self._cursor.fetchone()
            self.lastrowid = row["id"] if row else None
        return self

    def executemany(self, query, seq_of_params):
        self._cursor.executemany(query.replace("?", "%s"), list(seq_of_params))
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    @property
    def rowcount(self):
        return self._cursor.rowcount


class _ConnWrapper:
    """Обёртка вокруг ЖИВОГО соединения — используется внутри tx(), где одно
    и то же соединение из пула держится на протяжении всего `with`-блока
    (нужно для атомарности многошаговых транзакций)."""

    def __init__(self, conn):
        self._conn = conn

    def execute(self, query, params=()):
        cur = _CursorWrapper(self._conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor))
        return cur.execute(query, params)

    def executemany(self, query, seq_of_params):
        cur = _CursorWrapper(self._conn.cursor())
        return cur.executemany(query, seq_of_params)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()


def get_conn():
    """Для одиночных запросов (в основном чтение) — соединение берётся из
    пула и возвращается обратно в рамках одного execute()."""
    return _OneShotConn()


@contextmanager
def tx():
    """Для записи в несколько шагов — атомарно, с commit/rollback в конце
    блока. Соединение берётся из пула на время всего блока и возвращается
    сразу по выходу (успешному или через исключение)."""
    with _borrow_conn() as conn:
        conn.autocommit = False
        wrapper = _ConnWrapper(conn)
        try:
            yield wrapper
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.autocommit = True


SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    -- Задача 3 (CODENEXA_TASKLIST.md, раздел A): email подтверждается кодом
    -- (см. auth_otp_codes ниже, purpose='verify_email'). Для пользователей,
    -- вошедших только через Telegram/OAuth без email, это поле не имеет
    -- значения (email может быть NULL) — проверка подтверждения делается
    -- только там, где это осмысленно (сам email/пароль флоу).
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    google_id TEXT UNIQUE,
    yandex_id TEXT UNIQUE,
    first_name TEXT,
    last_name TEXT,
    avatar_url TEXT,
    totp_secret TEXT,
    totp_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    -- Ролевая модель админов (аудит, раздел 13, "Средний приоритет", п.3 —
    -- см. app/web/deps.py и app/web/api/admin_users.py). 'user' — обычный
    -- пользователь, 'admin' — доступ к CRUD-панелям (сейчас: инвесторы),
    -- 'superadmin' — дополнительно может выдавать/отзывать роли другим
    -- пользователям через /api/admin/users.
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin', 'superadmin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);
-- Индекс на users.role создаётся ниже, в _run_migrations(), а НЕ здесь —
-- нарочно. CREATE TABLE IF NOT EXISTS на уже существующей таблице (БД до
-- этого релиза) не добавляет колонку role задним числом, а этот индекс на
-- неё ссылается: если бы он стоял тут, `CREATE INDEX ... ON users(role)`
-- упал бы с UndefinedColumn до того, как миграция ниже успеет добавить
-- колонку. _run_migrations() выполняется ПОСЛЕ SCHEMA и уже гарантированно
-- видит колонку (сама её добавляет, если её ещё не было).

CREATE TABLE IF NOT EXISTS sessions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_id TEXT UNIQUE NOT NULL,
    user_agent TEXT,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS oauth_links (
    id BIGSERIAL PRIMARY KEY,
    provider TEXT NOT NULL,
    state TEXT UNIQUE NOT NULL,
    code TEXT UNIQUE,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    consumed BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    external_id TEXT,
    plan TEXT,
    amount NUMERIC(20, 8),
    currency TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    idempotency_key TEXT,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
-- Идемпотентность чекаута (см. аудит, п.0.5): повторный запрос с тем же
-- ключом от того же пользователя не должен создавать второй платёж/инвойс.
-- Partial-индекс, т.к. idempotency_key необязателен (старые записи — NULL).
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_user_idempotency
    ON payments(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Раздел "Инвесторы". status: draft | published | hidden.
CREATE TABLE IF NOT EXISTS investors (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT NOT NULL DEFAULT '',
    country TEXT NOT NULL DEFAULT '',
    company TEXT NOT NULL DEFAULT '',
    description TEXT NOT NULL DEFAULT '',
    investment_amount TEXT,
    investment_amount_value DOUBLE PRECISION,
    currency TEXT,
    status TEXT NOT NULL DEFAULT 'draft',
    photo_url TEXT,
    website_url TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investors_status_order ON investors(status, sort_order);

-- Аудит-лог админ-действий (аудит, раздел 13, "Средний приоритет":
-- "Аудит-лог админ-действий", раунд 7). Пишется на КАЖДОЕ изменяющее
-- действие admin/superadmin (роли, инвесторы) — кто, что, над каким
-- объектом, когда и с какого IP. Только чтение через API (нет
-- update/delete эндпоинтов над этой таблицей: аудит-лог, который сам можно
-- редактировать, бесполезен как аудит-лог).
CREATE TABLE IF NOT EXISTS admin_audit_log (
    id BIGSERIAL PRIMARY KEY,
    admin_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT,
    details JSONB,
    ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_admin ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_target ON admin_audit_log(target_type, target_id);

-- Тарифы (раунд 8, аудит раздел 12 "Объединить": PLANS — раньше статичный
-- Python-словарь в billing.py — вынесен в таблицу с историей изменения цен.
-- Смена цены НЕ перезаписывает строку, а деактивирует старую (is_active =
-- FALSE) и вставляет новую активную — так остаётся полная история "когда и
-- на сколько менялась цена", а не только текущее значение. См. п.29 аудита
-- ("прозрачная публичная история изменения тарифов" — редкость на рынке).
CREATE TABLE IF NOT EXISTS plans (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    usd NUMERIC(20, 8) NOT NULL,
    stars INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    duration_days INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_plans_code ON plans(code, created_at DESC);
-- Только одна активная запись на код тарифа одновременно.
CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_code_active ON plans(code) WHERE is_active;

-- Реферальная программа (раунд 8, аудит раздел 13 "Средний приоритет").
-- status: 'pending' — приглашённый зарегистрировался, ещё не платил;
--         'confirmed' — у приглашённого была первая успешная оплата
--         (именно на этот момент, а не на регистрацию, начисляется
--         вознаграждение — иначе фрод через фейковые аккаунты без оплаты).
-- reward_amount/reward_currency осознанно NULL, пока REFERRAL_REWARD_USD не
-- задан (см. config.py) — запись "заслужен ли реферал" не подменяется
-- выдуманной суммой.
CREATE TABLE IF NOT EXISTS referrals (
    id BIGSERIAL PRIMARY KEY,
    referrer_id BIGINT NOT NULL REFERENCES users(id),
    referred_id BIGINT NOT NULL REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'pending',
    reward_amount NUMERIC(20, 8),
    reward_currency TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- Один пользователь может быть приглашён только один раз.
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);

-- Задача 3 (CODENEXA_TASKLIST.md): одноразовые OTP-коды для подтверждения
-- email и сброса пароля. Один код на пользователя+purpose одновременно —
-- запрос нового кода "гасит" предыдущий (см. repo.create_otp_code). Код
-- хранится хешем (тем же bcrypt-контекстом, что и пароли — см. security.py),
-- а не в открытом виде: утечка БД не должна давать возможность подтвердить
-- чужой email или сбросить чужой пароль. attempts — счётчик неверных
-- попыток на ЭТОТ конкретный код (защита от перебора 6-значного кода в
-- пределах его TTL, отдельно от общего rate-limit на сам эндпоинт).
CREATE TABLE IF NOT EXISTS auth_otp_codes (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose TEXT NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    code_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed BOOLEAN NOT NULL DEFAULT FALSE,
    attempts INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_auth_otp_active ON auth_otp_codes(user_id, purpose, consumed);

-- Командные (бизнес-тариф) аккаунты. Одна организация = один плательщик
-- бизнес-тарифа, внутри которого может быть несколько users (сотрудников).
CREATE TABLE IF NOT EXISTS organizations (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    owner_user_id BIGINT NOT NULL REFERENCES users(id),
    plan_code TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Кто состоит в организации и с какой ролью. Один пользователь не может
-- состоять в двух организациях одновременно (упрощение для первой версии).
CREATE TABLE IF NOT EXISTS organization_members (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_user ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON organization_members(org_id);

-- Приглашения сотрудников в организацию по токену-ссылке.
CREATE TABLE IF NOT EXISTS organization_invites (
    id BIGSERIAL PRIMARY KEY,
    org_id BIGINT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    email TEXT,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    accepted_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON organization_invites(org_id);

-- Шаблоны документов раздела "Документы". owner_org_id = NULL значит
-- системный шаблон, виден всем; иначе это приватный шаблон организации,
-- виден только её участникам. fields -- вопросы мастера заполнения (см.
-- webapp/src/components/docsApp.js renderField/renderWizard -- форма
-- рендерится по этому массиву без правок кода фронтенда). body_template --
-- текст документа с плейсхолдерами {{key}}, key совпадает с fields[].key.
CREATE TABLE IF NOT EXISTS document_templates (
    id BIGSERIAL PRIMARY KEY,
    code TEXT NOT NULL,
    owner_org_id BIGINT REFERENCES organizations(id) ON DELETE CASCADE,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    fields JSONB NOT NULL DEFAULT '[]',
    body_template TEXT NOT NULL,
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- code уникален в рамках своей области видимости: не может повториться
-- дважды среди системных шаблонов, и не может повториться дважды внутри
-- одной организации -- но разные организации могут использовать общий code.
CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_code_global
    ON document_templates(code) WHERE owner_org_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_templates_code_org
    ON document_templates(owner_org_id, code) WHERE owner_org_id IS NOT NULL;

-- Готовые документы пользователей, собранные по шаблону (или собственный
-- текст из AI-конструктора -- тогда template_code = NULL).
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    org_id BIGINT REFERENCES organizations(id),
    template_code TEXT,
    title TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}',
    final_text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_documents_user ON documents(user_id, created_at DESC);

-- Профиль раздела "Документы": данные, которые пользователь один раз
-- вводит и они автоматически доступны для подстановки/шапки документа
-- (ФИО, реквизиты, логотип, подпись). Один профиль на пользователя.
CREATE TABLE IF NOT EXISTS document_profiles (
    user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL DEFAULT '',
    city TEXT NOT NULL DEFAULT '',
    position TEXT NOT NULL DEFAULT '',
    company_name TEXT NOT NULL DEFAULT '',
    bin_iin TEXT NOT NULL DEFAULT '',
    requisites TEXT NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    signature_name TEXT NOT NULL DEFAULT '',
    logo_path TEXT,
    signature_path TEXT,
    pdf_theme TEXT NOT NULL DEFAULT 'classic',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


# Колонки, добавленные ПОСЛЕ первого релиза соответствующих таблиц — на
# случай, если схема уже была создана раньше без них. Идемпотентно.
_COLUMN_MIGRATIONS = (
    ("investors", "investment_amount_value", "DOUBLE PRECISION"),
    ("investors", "currency", "TEXT"),
    ("payments", "idempotency_key", "TEXT"),
    ("users", "email_verified", "BOOLEAN NOT NULL DEFAULT FALSE"),
    # Реальный срок действия подписки (было: "платил хоть раз" — см. чат,
    # запрос владельца проекта на честную проверку активной подписки, а не
    # факта оплаты когда-либо). duration_days на plans — сколько дней даёт
    # тариф (NULL = бессрочно/разовая покупка); expires_at на payments —
    # когда истекает КОНКРЕТНАЯ оплата, вычисляется в момент подтверждения
    # оплаты (см. repo.py::_apply_expiry, mark_payment_paid,
    # mark_latest_pending_paid).
    ("plans", "duration_days", "INTEGER"),
    ("payments", "expires_at", "TIMESTAMPTZ"),
)


def _run_migrations(conn):
    with conn.cursor() as cur:
        for table, column, col_type in _COLUMN_MIGRATIONS:
            cur.execute(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_name = %s AND column_name = %s",
                (table, column),
            )
            if not cur.fetchone():
                cur.execute(f"ALTER TABLE {table} ADD COLUMN {column} {col_type}")
        # Индекс идемпотентности мог не существовать до этого релиза —
        # создаём отдельно от CREATE TABLE (та ветка не выполнится повторно
        # для уже существующей таблицы).
        cur.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_user_idempotency "
            "ON payments(user_id, idempotency_key) WHERE idempotency_key IS NOT NULL"
        )
        # payments.amount: TEXT -> NUMERIC(20,8) (аудит, раздел 13, "Средний
        # приоритет", п.2 — единая денежная утилита, см. app/web/money.py).
        # На новых установках CREATE TABLE уже создаёт колонку NUMERIC, этот
        # блок нужен только для БД, где таблица была создана до этого релиза.
        # NULLIF(amount, '') — на случай пустой строки вместо NULL в старых
        # записях (::NUMERIC на '' упал бы с ошибкой).
        cur.execute(
            "SELECT data_type FROM information_schema.columns "
            "WHERE table_name = 'payments' AND column_name = 'amount'"
        )
        row = cur.fetchone()
        if row and row[0] != "numeric":
            cur.execute(
                "ALTER TABLE payments ALTER COLUMN amount TYPE NUMERIC(20, 8) "
                "USING NULLIF(amount, '')::NUMERIC(20, 8)"
            )

        # users.role: ролевая модель админов вместо allow-list (аудит,
        # раздел 13, "Средний приоритет", п.3). На новых установках CREATE
        # TABLE уже создаёт колонку с CHECK-констрейнтом — этот блок нужен
        # только для БД, где таблица users была создана до этого релиза.
        # ALTER TABLE ADD CONSTRAINT не поддерживает "IF NOT EXISTS" в
        # Postgres (в отличие от индексов), поэтому проверяем существование
        # вручную через pg_constraint — тот же паттерн, что и для колонок
        # выше, просто источник другой системный каталог.
        cur.execute(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name = 'users' AND column_name = 'role'"
        )
        if not cur.fetchone():
            cur.execute("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'")
        cur.execute("SELECT 1 FROM pg_constraint WHERE conname = 'users_role_check'")
        if not cur.fetchone():
            cur.execute(
                "ALTER TABLE users ADD CONSTRAINT users_role_check "
                "CHECK (role IN ('user', 'admin', 'superadmin'))"
            )
        cur.execute("CREATE INDEX IF NOT EXISTS idx_users_role ON users(role) WHERE role != 'user'")


# Дефолтные тарифы — вставляются в `plans` один раз, если таблица пуста
# (например, свежая установка). Совпадают с прежними значениями словаря
# PLANS, который был в billing.py до раунда 8, — миграция с БД без плейсхолдер-
# значений на старте не создаёт разрыва в ценах для уже развёрнутых окружений.
_DEFAULT_PLANS = (
    {"code": "start_monthly", "title": "Старт — месяц", "usd": "3.00", "stars": 150},
    {"code": "pro_monthly", "title": "Pro — месяц", "usd": "9.00", "stars": 500},
    {"code": "pro_yearly", "title": "Pro — год", "usd": "79.00", "stars": 4500},
    {"code": "business_monthly", "title": "Бизнес — месяц", "usd": "19.00", "stars": 1000},
)


def _seed_default_plans(conn):
    with conn.cursor() as cur:
        cur.execute("SELECT COUNT(*) FROM plans")
        (count,) = cur.fetchone()
        if count > 0:
            return
        for p in _DEFAULT_PLANS:
            cur.execute(
                "INSERT INTO plans (code, title, usd, stars, is_active) VALUES (%s, %s, %s, %s, TRUE)",
                (p["code"], p["title"], p["usd"], p["stars"]),
            )


# Дефолтные шаблоны документов раздела "Документы" (см. app/web/api/docs.py) —
# минимальный стартовый набор, admin/владелец организации может добавлять
# свои через тот же API (owner_org_id != NULL).
_DEFAULT_TEMPLATES = (
    {
        "code": "rent_agreement",
        "category": "Аренда",
        "title": "Договор аренды помещения",
        "description": "Простой договор аренды между арендодателем и арендатором.",
        "fields": [
            {"key": "landlord_name", "question": "ФИО арендодателя", "required": True},
            {"key": "tenant_name", "question": "ФИО арендатора", "required": True},
            {"key": "address", "question": "Адрес помещения", "required": True},
            {"key": "amount", "question": "Сумма аренды в месяц", "required": True, "isMoney": True},
            {"key": "notes", "question": "Дополнительные условия", "required": False, "multiline": True},
        ],
        "body_template": (
            "ДОГОВОР АРЕНДЫ ПОМЕЩЕНИЯ\n\n"
            "Арендодатель: {{landlord_name}}\n"
            "Арендатор: {{tenant_name}}\n"
            "Адрес помещения: {{address}}\n"
            "Сумма аренды: {{amount}} в месяц\n\n"
            "Дополнительные условия: {{notes}}\n"
        ),
    },
    # Самый простой шаблон из всех — минимум полей, без денег и дат,
    # специально для проверки цикла "открыл мастер -> заполнил ->
    # предпросмотр -> сохранил -> увидел в списке документов".
    {
        "code": "explanatory_note",
        "category": "Общие",
        "title": "Объяснительная записка",
        "description": "Короткая объяснительная на имя руководителя.",
        "fields": [
            {"key": "full_name", "question": "Ваше ФИО", "required": True},
            {"key": "recipient", "question": "Кому адресована (ФИО, должность)", "required": True},
            {
                "key": "explanation",
                "question": "Что произошло и почему",
                "required": True,
                "multiline": True,
            },
            {"key": "date", "question": "Дата", "required": False},
        ],
        "body_template": (
            "ОБЪЯСНИТЕЛЬНАЯ ЗАПИСКА\n\n"
            "От: {{full_name}}\n"
            "Кому: {{recipient}}\n\n"
            "{{explanation}}\n\n"
            "Дата: {{date}}\n"
        ),
    },
    # --- Договоры ---
    {
        "code": "loan_receipt",
        "category": "Договоры",
        "title": "Расписка о займе",
        "description": "Расписка о получении денежных средств в долг с обязательством возврата.",
        "fields": [
            {"key": "borrower_name", "question": "ФИО заёмщика (кто берёт в долг)", "required": True},
            {"key": "lender_name", "question": "ФИО займодавца (кто даёт в долг)", "required": True},
            {"key": "amount", "question": "Сумма займа", "required": True, "isMoney": True},
            {"key": "amount_words", "question": "Сумма прописью", "required": False,
             "hint": "Например: сто тысяч тенге"},
            {"key": "return_date", "question": "Срок возврата (дата)", "required": True},
            {"key": "notes", "question": "Дополнительные условия (проценты, порядок возврата)",
             "required": False, "multiline": True},
        ],
        "body_template": (
            "РАСПИСКА\n\n"
            "Я, {{borrower_name}}, получил от {{lender_name}} денежные средства в размере "
            "{{amount}} тенге ({{amount_words}}) в качестве займа и обязуюсь вернуть указанную "
            "сумму в полном объёме в срок до {{return_date}}.\n\n"
            "{{notes}}\n"
        ),
    },
    {
        "code": "consulting_services_agreement",
        "category": "Договоры",
        "title": "Договор оказания консультационных услуг",
        "description": "Договор между исполнителем и заказчиком на оказание консультационных/сопровождающих услуг.",
        "locked": True,
        "fields": [
            {"key": "contractor_name", "question": "Исполнитель (ФИО/ИП/ТОО)", "required": True},
            {"key": "client_name", "question": "Заказчик (ФИО/ИП/ТОО)", "required": True},
            {"key": "subject", "question": "Предмет договора — что именно делает исполнитель",
             "required": True, "multiline": True},
            {"key": "term", "question": "Срок действия договора", "required": True,
             "hint": "Например: 3 месяца с даты подписания"},
            {"key": "amount", "question": "Стоимость услуг", "required": True, "isMoney": True},
            {"key": "payment_terms", "question": "Порядок оплаты", "required": False,
             "multiline": True, "hint": "Например: ежемесячно, до 5 числа"},
        ],
        "body_template": (
            "ДОГОВОР ОКАЗАНИЯ КОНСУЛЬТАЦИОННЫХ УСЛУГ\n\n"
            "Исполнитель: {{contractor_name}}\n"
            "Заказчик: {{client_name}}\n\n"
            "1. Предмет договора\n{{subject}}\n\n"
            "2. Срок действия\n{{term}}\n\n"
            "3. Стоимость и порядок оплаты\nСтоимость услуг составляет {{amount}} тенге. "
            "{{payment_terms}}\n"
        ),
    },
    {
        "code": "nda_agreement",
        "category": "Договоры",
        "title": "Соглашение о неразглашении (NDA)",
        "description": "Двустороннее соглашение о конфиденциальности передаваемой информации.",
        "fields": [
            {"key": "party_a", "question": "Сторона 1 (ФИО/компания)", "required": True},
            {"key": "party_b", "question": "Сторона 2 (ФИО/компания)", "required": True},
            {"key": "purpose", "question": "Цель раскрытия информации", "required": True,
             "multiline": True, "hint": "Например: обсуждение условий партнёрства"},
            {"key": "term", "question": "Срок действия обязательств о конфиденциальности",
             "required": True, "hint": "Например: 2 года с даты подписания"},
        ],
        "body_template": (
            "СОГЛАШЕНИЕ О НЕРАЗГЛАШЕНИИ КОНФИДЕНЦИАЛЬНОЙ ИНФОРМАЦИИ (NDA)\n\n"
            "{{party_a}} и {{party_b}} заключили настоящее соглашение о нижеследующем.\n\n"
            "1. Цель раскрытия информации: {{purpose}}\n\n"
            "2. Стороны обязуются не разглашать третьим лицам конфиденциальную информацию, "
            "полученную друг от друга в связи с указанной целью, в течение срока: {{term}}.\n"
        ),
    },
    # --- Кадры / HR ---
    {
        "code": "employment_offer",
        "category": "Кадры",
        "title": "Оффер (предложение о работе)",
        "description": "Письмо-предложение кандидату с условиями трудоустройства.",
        "fields": [
            {"key": "candidate_name", "question": "ФИО кандидата", "required": True},
            {"key": "position", "question": "Должность", "required": True},
            {"key": "salary", "question": "Оклад", "required": True, "isMoney": True},
            {"key": "start_date", "question": "Дата выхода на работу", "required": True},
            {"key": "conditions", "question": "Дополнительные условия", "required": False,
             "multiline": True, "hint": "График, испытательный срок, бонусы"},
        ],
        "body_template": (
            "ПРЕДЛОЖЕНИЕ О РАБОТЕ\n\n"
            "Уважаемый(ая) {{candidate_name}},\n\n"
            "Мы рады предложить вам должность «{{position}}» с окладом {{salary}} тенге "
            "и датой выхода на работу {{start_date}}.\n\n"
            "{{conditions}}\n"
        ),
    },
    {
        "code": "resignation_letter",
        "category": "Кадры",
        "title": "Заявление на увольнение",
        "description": "Заявление об увольнении по собственному желанию.",
        "fields": [
            {"key": "full_name", "question": "Ваше ФИО", "required": True},
            {"key": "position", "question": "Ваша должность", "required": True},
            {"key": "recipient", "question": "На чьё имя (руководитель, должность)", "required": True},
            {"key": "last_day", "question": "Последний рабочий день", "required": True},
        ],
        "body_template": (
            "ЗАЯВЛЕНИЕ\n\n"
            "{{recipient}}\n"
            "от {{full_name}}, {{position}}\n\n"
            "Прошу уволить меня по собственному желанию с {{last_day}}.\n"
        ),
    },
    {
        "code": "vacation_request",
        "category": "Кадры",
        "title": "Заявление на отпуск",
        "description": "Заявление на предоставление ежегодного оплачиваемого отпуска.",
        "fields": [
            {"key": "full_name", "question": "Ваше ФИО", "required": True},
            {"key": "position", "question": "Ваша должность", "required": True},
            {"key": "recipient", "question": "На чьё имя (руководитель, должность)", "required": True},
            {"key": "start_date", "question": "Дата начала отпуска", "required": True},
            {"key": "days", "question": "Количество дней", "required": True},
        ],
        "body_template": (
            "ЗАЯВЛЕНИЕ\n\n"
            "{{recipient}}\n"
            "от {{full_name}}, {{position}}\n\n"
            "Прошу предоставить мне ежегодный оплачиваемый отпуск на {{days}} "
            "календарных дней с {{start_date}}.\n"
        ),
    },
    # --- Финансы ---
    {
        "code": "invoice_simple",
        "category": "Финансы",
        "title": "Счёт на оплату",
        "description": "Простой счёт на оплату товаров/услуг для контрагента.",
        "fields": [
            {"key": "seller_name", "question": "Поставщик (ИП/ТОО, реквизиты)", "required": True,
             "multiline": True},
            {"key": "buyer_name", "question": "Покупатель", "required": True},
            {"key": "items", "question": "Товары/услуги (по одной строке)", "required": True,
             "multiline": True, "hint": "Например: Консультация — 50 000 тенге"},
            {"key": "amount", "question": "Итого к оплате", "required": True, "isMoney": True},
            {"key": "due_date", "question": "Оплатить до", "required": False},
        ],
        "body_template": (
            "СЧЁТ НА ОПЛАТУ\n\n"
            "Поставщик: {{seller_name}}\n"
            "Покупатель: {{buyer_name}}\n\n"
            "{{items}}\n\n"
            "Итого к оплате: {{amount}} тенге\n"
            "Оплатить до: {{due_date}}\n"
        ),
    },
    {
        "code": "act_of_completion",
        "category": "Финансы",
        "title": "Акт выполненных работ",
        "description": "Акт приёма-передачи выполненных работ/оказанных услуг между сторонами.",
        "fields": [
            {"key": "contractor_name", "question": "Исполнитель", "required": True},
            {"key": "client_name", "question": "Заказчик", "required": True},
            {"key": "work_description", "question": "Описание выполненных работ", "required": True,
             "multiline": True},
            {"key": "amount", "question": "Сумма", "required": True, "isMoney": True},
            {"key": "act_date", "question": "Дата составления акта", "required": True},
        ],
        "body_template": (
            "АКТ ВЫПОЛНЕННЫХ РАБОТ №___ от {{act_date}}\n\n"
            "Исполнитель: {{contractor_name}}\n"
            "Заказчик: {{client_name}}\n\n"
            "Исполнитель выполнил, а Заказчик принял следующие работы:\n{{work_description}}\n\n"
            "Стоимость выполненных работ составляет {{amount}} тенге. "
            "Стороны претензий друг к другу не имеют.\n"
        ),
    },
    {
        "code": "power_of_attorney_finance",
        "category": "Финансы",
        "title": "Доверенность на представление интересов",
        "description": "Доверенность на ведение финансовых/юридических дел от имени доверителя.",
        "locked": True,
        "fields": [
            {"key": "principal_name", "question": "ФИО доверителя", "required": True},
            {"key": "attorney_name", "question": "ФИО поверенного", "required": True},
            {"key": "powers", "question": "Какие полномочия передаются", "required": True,
             "multiline": True, "hint": "Например: представлять интересы в банке, подписывать документы"},
            {"key": "valid_until", "question": "Срок действия доверенности", "required": True},
        ],
        "body_template": (
            "ДОВЕРЕННОСТЬ\n\n"
            "Я, {{principal_name}}, настоящей доверенностью уполномочиваю {{attorney_name}} "
            "на следующее: {{powers}}.\n\n"
            "Доверенность действительна до {{valid_until}}.\n"
        ),
    },
    # --- Бизнес ---
    {
        "code": "commercial_proposal",
        "category": "Бизнес",
        "title": "Коммерческое предложение",
        "description": "Презентационное предложение услуг/продукта потенциальному клиенту.",
        "locked": True,
        "fields": [
            {"key": "company_name", "question": "Название вашей компании", "required": True},
            {"key": "recipient", "question": "Кому адресовано", "required": False},
            {"key": "offer", "question": "Что вы предлагаете", "required": True, "multiline": True},
            {"key": "benefits", "question": "Ключевые преимущества", "required": True,
             "multiline": True},
            {"key": "price", "question": "Стоимость / условия", "required": False},
            {"key": "contacts", "question": "Контакты для связи", "required": True},
        ],
        "body_template": (
            "КОММЕРЧЕСКОЕ ПРЕДЛОЖЕНИЕ\n\n"
            "{{recipient}}\n\n"
            "Компания {{company_name}} предлагает: {{offer}}\n\n"
            "Преимущества:\n{{benefits}}\n\n"
            "Стоимость и условия: {{price}}\n\n"
            "Контакты: {{contacts}}\n"
        ),
    },
)


def _seed_default_templates(conn):
    """Проверка по каждому code отдельно (а не "есть ли вообще хоть один
    системный шаблон") — иначе на уже развёрнутой БД, где 1 затравочный
    шаблон уже лежит, новые добавленные сюда позже шаблоны никогда бы не
    докатились при перезапуске."""
    with conn.cursor() as cur:
        for t in _DEFAULT_TEMPLATES:
            cur.execute(
                "SELECT 1 FROM document_templates WHERE code = %s AND owner_org_id IS NULL",
                (t["code"],),
            )
            if cur.fetchone():
                continue
            cur.execute(
                "INSERT INTO document_templates "
                "(code, owner_org_id, category, title, description, fields, body_template) "
                "VALUES (%s, NULL, %s, %s, %s, %s, %s)",
                (
                    t["code"], t["category"], t["title"], t["description"],
                    psycopg2.extras.Json(t["fields"]), t["body_template"],
                ),
            )


def init_db():
    with _borrow_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(SCHEMA)
        _run_migrations(conn)
        _seed_default_plans(conn)
        _seed_default_templates(conn)
