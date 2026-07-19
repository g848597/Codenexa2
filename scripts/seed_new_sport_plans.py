"""Добавляет тарифы "start_monthly" и "business_monthly" на уже развёрнутой
базе (см. app/web/integrations/sport_common.py: TIER_RULES — раздел AI Sport
теперь честная лестница из 4 тарифов free/start/pro/business, раньше в БД
были только pro_monthly/pro_yearly — этот скрипт закрывает разрыв без
пересоздания таблицы plans).

Цены ниже — ПЛЕЙСХОЛДЕРЫ (см. TODO у каждого def main() блока) — задайте
реальные через уже существующую админку тарифов (PUT /api/admin/plans/{code}
или тот же раздел UI, что и для pro_monthly) после запуска, если суммы не
подходят. Скрипт идемпотентен: repo.set_plan_price() устроен так же, как для
pro_monthly — повторный запуск просто создаёт новую активную запись цены
(историю смотрите через /api/admin/plans/history?code=...), а не дублирует
тариф в каталоге.

Использование (на сервере, где настроен DATABASE_URL/Supabase):
    /home/claude/venv/bin/python scripts/seed_new_sport_plans.py
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.web import repo  # noqa: E402
from app.web.db import init_db  # noqa: E402

# TODO: подставьте реальные цены/звёзды перед первым запуском в проде, если
# плейсхолдеры ниже не устраивают — их проще один раз здесь, чем потом руками
# по каждому тарифу в админке.
NEW_PLANS = (
    {"code": "start_monthly", "title": "Старт — месяц", "usd": "3.00", "stars": 150, "duration_days": 30},
    {"code": "business_monthly", "title": "Бизнес — месяц", "usd": "19.00", "stars": 1000, "duration_days": 30},
)


def main():
    init_db()
    existing_codes = {p["code"] for p in repo.get_active_plans()}

    for plan in NEW_PLANS:
        if plan["code"] in existing_codes:
            print(f"Пропущено — тариф с кодом '{plan['code']}' уже существует и активен: {plan['code']}")
            continue
        repo.set_plan_price(
            plan["code"], plan["title"], plan["usd"], plan["stars"], plan["duration_days"],
        )
        print(f"Создан тариф '{plan['code']}' ({plan['title']}, ${plan['usd']}, {plan['stars']} звёзд, {plan['duration_days']} дн.).")

    print("Готово. Проверьте цены в /api/admin/plans и поправьте при необходимости.")


if __name__ == "__main__":
    main()
