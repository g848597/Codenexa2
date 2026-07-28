"""Аггрегатная статистика для главного экрана новой Admin-панели (см.
admin_panel_build_prompt.md, п.3 — "Dashboard home screen... вероятно
единственный реальный пробел на бэкенде"). Один эндпоинт вместо того, чтобы
фронтенд дёргал полдесятка отдельных ручек (users/plans/billing) при каждом
открытии дэшборда.

Только superadmin (тот же уровень доступа, что admin_users.py/admin_plans.py
— здесь показываются деньги и роли, а не CRUD одного раздела типа
инвесторов, поэтому обычный admin намеренно не видит эту сводку)."""
from fastapi import APIRouter, Depends

from app.web import money, repo
from app.web.deps import get_current_superadmin

router = APIRouter(prefix="/api/admin", tags=["admin-dashboard"])


@router.get("/dashboard")
def get_dashboard(_admin: dict = Depends(get_current_superadmin)):
    stats = repo.get_admin_dashboard_stats()
    return {
        "totalUsers": stats["total_users"],
        "activeUsers7d": stats["active_users_7d"],
        "activeUsers30d": stats["active_users_30d"],
        "roleCounts": {
            "user": stats["role_counts"].get("user", 0),
            "admin": stats["role_counts"].get("admin", 0),
            "superadmin": stats["role_counts"].get("superadmin", 0),
        },
        "activeSubscriptions": stats["active_subscriptions"],
        "pendingManualPayments": stats["pending_manual_payments"],
        # Честно только USD/USDT — см. комментарий в repo.get_admin_dashboard_stats
        # про то, почему TON/BTC/Stars не конвертируются по придуманному курсу.
        "revenue30dUsd": money.to_display(stats["revenue_30d_usd"], "USD"),
        "otherCurrencyPayments30d": stats["other_currency_payments_30d"],
    }
