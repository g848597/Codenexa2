"""Слой хранения — PostgreSQL (совместимо с Supabase).

Паттерн пула соединений и autocommit-обвязка взяты из Codenexa2/app/web/db.py
(уже проверены на проде: борются с "мёртвыми" соединениями после простоя
воркера и с лимитом коннектов Supabase Session Pooler). Здесь версия
упрощена под нужды Этапа 1 — без RETURNING-эмуляции под sqlite, т.к. этот
проект с самого начала пишется под Postgres и не имеет legacy sqlite-кода.
"""
import threading
from contextlib import contextmanager

import psycopg2
import psycopg2.extras
from psycopg2 import pool as pg_pool

from app.config import settings

_pool = None
_pool_lock = threading.Lock()


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = pg_pool.ThreadedConnectionPool(
                    settings.DB_POOL_MIN,
                    settings.DB_POOL_MAX,
                    dsn=settings.DATABASE_URL,
                    sslmode="require" if "localhost" not in settings.DATABASE_URL else "disable",
                )
    return _pool


@contextmanager
def _borrow_conn():
    """Берёт соединение из пула и всегда возвращает его обратно, даже при
    исключении. Порванные соединения (частый случай с удалённой БД после
    простоя воркера) закрываются и заменяются новыми."""
    pool = _get_pool()
    conn = pool.getconn()
    if conn.closed:
        pool.putconn(conn, close=True)
        conn = pool.getconn()
    try:
        conn.autocommit = True
    except psycopg2.ProgrammingError:
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


def query(sql: str, params: tuple = ()) -> list[dict]:
    """SELECT — возвращает список словарей (по имени колонки)."""
    with _borrow_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]


def query_one(sql: str, params: tuple = ()) -> dict | None:
    rows = query(sql, params)
    return rows[0] if rows else None


def execute(sql: str, params: tuple = ()) -> int:
    """INSERT/UPDATE/DELETE без RETURNING — возвращает rowcount."""
    with _borrow_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return cur.rowcount


def execute_returning(sql: str, params: tuple = ()) -> dict | None:
    """INSERT/UPDATE ... RETURNING ... — возвращает одну строку результата."""
    with _borrow_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            row = cur.fetchone()
            return dict(row) if row else None


def init_db() -> None:
    """Применяет все migrations/*.sql по очереди в алфавитном порядке
    (идемпотентно — весь DDL там через IF NOT EXISTS), безопасно вызывать
    при каждом старте сервера. Добавление нового файла миграции (например
    002_utility.sql на Этапе 3) не требует изменений в этой функции."""
    import os

    migrations_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "migrations")
    if not os.path.isdir(migrations_dir):
        return
    with _borrow_conn() as conn:
        with conn.cursor() as cur:
            for filename in sorted(os.listdir(migrations_dir)):
                if filename.endswith(".sql"):
                    path = os.path.join(migrations_dir, filename)
                    with open(path, "r", encoding="utf-8") as f:
                        cur.execute(f.read())
