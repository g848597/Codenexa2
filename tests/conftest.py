"""Общие fixtures для тестов.

Требует живой Postgres (см. docker-compose.yml сервис `db`, либо CI-сервис в
.github/workflows/ci.yml) — в проекте нет ORM-слоя абстракции от конкретной
СУБД (см. аудит, раздел 2, "слой БД"), поэтому SQLite-мок здесь дал бы ложное
чувство покрытия: часть багов (например TEXT/NUMERIC для amount, RETURNING id)
воспроизводима только на настоящем Postgres.

Переменные окружения для подключения к тестовой БД читаются ДО импорта
app.web.config (он же читает .env один раз при первом импорте модуля), поэтому
здесь они выставляются в самом верху файла, до любых `from app...` импортов.
"""
import os

os.environ.setdefault("ENV", "development")
os.environ.setdefault("JWT_SECRET", "test-only-secret-do-not-use-in-production")
os.environ.setdefault(
    "DATABASE_URL",
    os.environ.get("TEST_DATABASE_URL", "postgresql://codenexa:codenexa@localhost:5432/codenexa"),
)
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "test-bot-token")
os.environ.setdefault("TELEGRAM_BOT_USERNAME", "codenexa_test_bot")
os.environ.setdefault("CRYPTOBOT_API_TOKEN", "test-cryptobot-token")

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.web.db import get_conn, init_db  # noqa: E402


@pytest.fixture(scope="session")
def _app():
    from app.web.server import app as fastapi_app

    init_db()
    return fastapi_app


@pytest.fixture()
def client(_app):
    return TestClient(_app)


@pytest.fixture(autouse=True)
def _clean_db(_app):
    """Чистим таблицы, которые трогают тесты, перед КАЖДЫМ тестом — тесты не
    должны зависеть от порядка выполнения друг друга."""
    conn = get_conn()
    for table in (
        "admin_audit_log", "referrals", "investors", "payments", "auth_otp_codes", "oauth_links", "sessions",
        # Организации ссылаются на users.id БЕЗ ON DELETE CASCADE
        # (organizations.owner_user_id) — должны быть очищены до "users",
        # иначе DELETE FROM users падает по внешнему ключу. document_templates
        # и documents каскадируются от organizations, отдельно чистить не нужно.
        "organization_invites", "organization_members", "organizations",
        "users", "plans",
    ):
        conn.execute(f"DELETE FROM {table}")
    # `plans` — не пустая по умолчанию (см. db.py::_seed_default_plans),
    # поэтому после очистки её нужно пересеять, иначе test-раны, повторно
    # запущенные на одной и той же (не эфемерной) тестовой БД, копят историю
    # цен между независимыми запусками pytest, а не только между тестами
    # внутри одного запуска.
    from app.web.db import _borrow_conn, _seed_default_plans

    with _borrow_conn() as raw_conn:
        _seed_default_plans(raw_conn)
    yield


@pytest.fixture(autouse=True)
def _reset_in_memory_rate_limit_state():
    """`_attempts` в `auth.py` — намеренное in-memory состояние процесса,
    используемое как фолбэк, когда REDIS_URL не задан (см. аудит, раздел 3:
    "In-memory состояние там, где нужна персистентность"). В проде это один
    и тот же процесс на всё время жизни сервера, но в тестах каждый тест
    должен быть независим — иначе rate-limit, накопленный в одном тесте,
    ложно валит совершенно другой тест, который к первому не имеет отношения.

    Одноразовые OAuth-коды (Google/Yandex -> мини-апп) с прошлого раунда
    больше не живут в памяти процесса — они в таблице `oauth_links`
    (см. app/web/api/auth.py), которую уже чистит `_clean_db` выше."""
    from app.web.api import auth as auth_module
    from app.web.cache import get_redis, reset_for_tests

    auth_module._attempts.clear()
    reset_for_tests()
    r = get_redis()
    if r is not None:
        for key in r.keys("ratelimit:*"):
            r.delete(key)
    yield
