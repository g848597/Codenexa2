"""Ручной интеграционный тест для шага 2 раздела "Инвесторы": числовое поле
суммы + валюта. Не pytest (в проекте нет test runner'а) — запускается вручную:
    /home/claude/venv/bin/python scripts/manual_test_investors_amount.py
Печатает PASS/FAIL, падает с кодом 1 при первом провале любой группы.

Проверяет 3 вещи по-настоящему (не на словах):
  1. Миграция колонок на БД, СОЗДАННОЙ ДО этого шага (старая схема без
     investment_amount_value/currency) — самый важный кейс, потому что именно
     он либо сломает существующий деплой, либо нет.
  2. Идемпотентность миграции (повторный запуск ничего не ломает).
  3. Pydantic-валидация "оба или ничего" + allowlist валют — на реальных
     объектах InvestorIn/InvestorUpdate, а не по чтению кода глазами.
"""
import os
import sqlite3
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

failures = 0


def assert_(cond, label):
    global failures
    if cond:
        print(f"  PASS  {label}")
    else:
        failures += 1
        print(f"  FAIL  {label}")


def test_migration_on_legacy_db():
    print("\n[1] Миграция на БД со СТАРОЙ схемой (до этого шага)")
    with tempfile.TemporaryDirectory() as tmp:
        db_path = os.path.join(tmp, "legacy.db")
        # Старая схема — намеренно БЕЗ investment_amount_value/currency,
        # именно так выглядит уже задеплоенная база до этого изменения.
        conn = sqlite3.connect(db_path)
        conn.executescript(
            """
            CREATE TABLE investors (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                position TEXT NOT NULL DEFAULT '',
                country TEXT NOT NULL DEFAULT '',
                company TEXT NOT NULL DEFAULT '',
                description TEXT NOT NULL DEFAULT '',
                investment_amount TEXT,
                status TEXT NOT NULL DEFAULT 'draft',
                photo_url TEXT,
                website_url TEXT,
                sort_order INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            """
        )
        conn.execute(
            "INSERT INTO investors (name, investment_amount) VALUES (?, ?)",
            ("Existing Investor", "$50k"),
        )
        conn.commit()
        conn.close()

        os.environ["DATABASE_PATH"] = db_path
        os.environ["UPLOAD_DIR"] = os.path.join(tmp, "uploads")
        # Модули читают settings при импорте — импортируем ПОСЛЕ выставления env.
        from app.web import db as db_module

        db_module._local = db_module.threading.local()  # свежее соединение на новый путь
        import importlib

        importlib.reload(db_module)

        conn = db_module.get_conn()
        before_cols = {r["name"] for r in conn.execute("PRAGMA table_info(investors)").fetchall()}
        assert_(
            "investment_amount_value" not in before_cols and "currency" not in before_cols,
            "до миграции новых колонок действительно нет (тест бьёт по правильному сценарию)",
        )

        db_module.init_db()

        after_cols = {r["name"] for r in conn.execute("PRAGMA table_info(investors)").fetchall()}
        assert_("investment_amount_value" in after_cols, "после init_db() колонка investment_amount_value добавлена")
        assert_("currency" in after_cols, "после init_db() колонка currency добавлена")

        row = conn.execute("SELECT * FROM investors WHERE name = 'Existing Investor'").fetchone()
        assert_(row["investment_amount"] == "$50k", "старые данные (investment_amount) не потеряны после миграции")
        assert_(row["investment_amount_value"] is None, "новая колонка у старой записи честно NULL, а не 0 или выдумка")

        # Идемпотентность: повторный вызов не должен падать и не должен дублировать/ломать колонки.
        try:
            db_module.init_db()
            db_module.init_db()
            idempotent_ok = True
        except Exception as e:
            idempotent_ok = False
            print(f"        exception: {e!r}")
        assert_(idempotent_ok, "повторный init_db() безопасен (идемпотентность миграции)")

        # repo.create_investor / update_investor реально пишут новые поля через whitelist колонок.
        from app.web import repo as repo_module

        importlib.reload(repo_module)
        created = repo_module.create_investor(
            name="New Investor", investment_amount_value=12000.5, currency="USD", status="draft"
        )
        assert_(created["investment_amount_value"] == 12000.5, "create_investor реально сохраняет investment_amount_value")
        assert_(created["currency"] == "USD", "create_investor реально сохраняет currency")

        updated = repo_module.update_investor(created["id"], investment_amount_value=99.0, currency="EUR")
        assert_(updated["investment_amount_value"] == 99.0, "update_investor обновляет investment_amount_value")
        assert_(updated["currency"] == "EUR", "update_investor обновляет currency")


def test_pydantic_validation():
    print("\n[2] Pydantic-валидация: 'оба или ничего' + allowlist валют")
    os.environ.setdefault("DATABASE_PATH", os.path.join(tempfile.mkdtemp(), "v.db"))
    os.environ.setdefault("UPLOAD_DIR", tempfile.mkdtemp())
    from pydantic import ValidationError

    from app.web.api.investors import InvestorIn, InvestorUpdate

    # Оба пустые — ок (инвестор без раскрытой суммы).
    try:
        InvestorIn(name="A")
        ok1 = True
    except ValidationError:
        ok1 = False
    assert_(ok1, "InvestorIn: оба поля пустые — валидно (сумма не раскрывается)")

    # Оба заданы корректно — ок.
    try:
        inv = InvestorIn(name="A", investment_amount_value=1000, currency="usd")
        ok2 = inv.currency == "USD"
    except ValidationError:
        ok2 = False
    assert_(ok2, "InvestorIn: оба поля заданы, currency нормализуется к верхнему регистру (usd -> USD)")

    # Значение без валюты — ошибка.
    try:
        InvestorIn(name="A", investment_amount_value=1000)
        ok3 = False
    except ValidationError:
        ok3 = True
    assert_(ok3, "InvestorIn: значение без валюты — отклонено (нельзя строить диаграмму без единицы измерения)")

    # Валюта без значения — ошибка.
    try:
        InvestorIn(name="A", currency="USD")
        ok4 = False
    except ValidationError:
        ok4 = True
    assert_(ok4, "InvestorIn: валюта без значения — отклонено")

    # Неизвестный код валюты — ошибка (не любые 3 буквы).
    try:
        InvestorIn(name="A", investment_amount_value=10, currency="XYZ")
        ok5 = False
    except ValidationError:
        ok5 = True
    assert_(ok5, "InvestorIn: неизвестный код валюты (XYZ) отклонён allowlist'ом")

    # Отрицательная сумма — ошибка (ge=0).
    try:
        InvestorIn(name="A", investment_amount_value=-5, currency="USD")
        ok6 = False
    except ValidationError:
        ok6 = True
    assert_(ok6, "InvestorIn: отрицательная сумма отклонена (ge=0)")

    # Та же проверка для InvestorUpdate (используется в PUT).
    try:
        InvestorUpdate(currency="EUR")
        ok7 = False
    except ValidationError:
        ok7 = True
    assert_(ok7, "InvestorUpdate: валюта без значения — тоже отклонено")

    try:
        upd = InvestorUpdate(investment_amount_value=250, currency="kzt")
        ok8 = upd.currency == "KZT"
    except ValidationError:
        ok8 = False
    assert_(ok8, "InvestorUpdate: валидная пара проходит, KZT нормализуется в верхний регистр")


if __name__ == "__main__":
    test_migration_on_legacy_db()
    test_pydantic_validation()
    print(f"\n{'ВСЕ ТЕСТЫ ПРОШЛИ' if failures == 0 else f'ПРОВАЛЕНО: {failures}'}")
    sys.exit(0 if failures == 0 else 1)
