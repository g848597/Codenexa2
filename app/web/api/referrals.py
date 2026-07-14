"""Статистика реферальной программы для текущего пользователя (раунд 8,
модуль 2). Закрывает честную оговорку из webapp/src/i18n.js
(`pt_referral_note`: "счётчик растёт только когда сервер подтвердит") —
до этого раунда подтверждать было нечем, счётчик на фронтенде был чисто
локальным (localStorage)."""
from fastapi import APIRouter, Depends

from app.web import repo
from app.web.deps import get_current_user

router = APIRouter(prefix="/api/referrals", tags=["referrals"])


@router.get("/me")
def my_referral_stats(user: dict = Depends(get_current_user)):
    rows = repo.list_referrals_by_referrer(user["id"])
    confirmed = [r for r in rows if r["status"] == "confirmed"]
    pending = [r for r in rows if r["status"] == "pending"]
    return {
        "confirmedCount": len(confirmed),
        "pendingCount": len(pending),
        "referralCode": str(user.get("telegram_id")) if user.get("telegram_id") else None,
    }
