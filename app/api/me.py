from fastapi import APIRouter, Depends

from app.deps import get_current_user

router = APIRouter(prefix="/api", tags=["me"])


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)):
    """Простейший способ фронтенду проверить, что initData принят и
    пользователь создан/подтянут — используется на старте Mini App."""
    return {"user": user}
