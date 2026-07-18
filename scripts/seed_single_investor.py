"""Приводит раздел "Инвесторы" к состоянию "ровно один инвестор":
Вадим Архипов, наш первый и главный инвестор, $5000.

Использование (на сервере, где настроен DATABASE_URL/Supabase):
    /home/claude/venv/bin/python scripts/seed_single_investor.py

Скрипт идемпотентен: можно запускать сколько угодно раз — итоговое
состояние всегда "одна карточка Вадима Архипова с этими данными",
без дублей.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.web import repo  # noqa: E402
from app.web.db import init_db  # noqa: E402

INVESTOR = dict(
    name="Vadim Arhipov",
    position="Наш первый и главный инвестор",
    country="",
    company="",
    description="Спасибо за доверие. Спасибо за веру в нас.",
    investment_amount="$5,000",
    investment_amount_value=5000.0,
    currency="USD",
    status="published",
    website_url=None,
    sort_order=0,
)


def main():
    init_db()

    existing = repo.list_investors_all()

    # Ищем, нет ли уже карточки с этим именем — чтобы обновить, а не задублировать.
    match = next((row for row in existing if row["name"] == INVESTOR["name"]), None)

    if match:
        repo.update_investor(match["id"], **{k: v for k, v in INVESTOR.items() if k != "sort_order"})
        keep_id = match["id"]
        print(f"Обновлена существующая карточка (id={keep_id}).")
    else:
        created = repo.create_investor(**INVESTOR)
        keep_id = created["id"]
        print(f"Создана новая карточка (id={keep_id}).")

    # Удаляем всех остальных инвесторов — в разделе должен остаться только один.
    removed = 0
    for row in existing:
        if row["id"] != keep_id:
            repo.delete_investor(row["id"])
            removed += 1

    print(f"Удалено других карточек: {removed}.")
    print("Готово: в разделе 'Инвесторы' теперь только Вадим Архипов, $5000.")


if __name__ == "__main__":
    main()
