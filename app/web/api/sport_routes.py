"""AI Sport — REST-обёртка над footballdata.io для мини-аппа.

Этот файл — тот самый app/web/api/sport_routes.py, на который ссылался
комментарий в webapp/src/config/sportApi.js, но которого не было ни в одном
присланном архиве проекта. Без него /api/sport/* всегда отвечал 404
независимо от того, какие ключи вписаны в Railway.

Раздел публичный: список команд и live-счёт одинаковы для всех
пользователей, поэтому, в отличие от /api/billing, /api/referrals и т.д.,
авторизация здесь не требуется.
"""
from fastapi import APIRouter, HTTPException, Query

from app.web.integrations import footballdata as fd

router = APIRouter(prefix="/api/sport", tags=["sport"])


@router.get("/status")
async def status():
    return {"configured": fd.is_configured()}


@router.get("/teams/popular")
async def teams_popular():
    if not fd.is_configured():
        # Честно пусто, а не ошибка — фронтенд покажет sa-hint-block вместо
        # красного экрана ошибки (см. sportApp.js: apiConfigured === false).
        return {"teams": []}
    try:
        teams = await fd.popular_teams()
    except fd.FootballDataError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return {"teams": teams}


@router.get("/teams/search")
async def teams_search(q: str = Query(..., min_length=2, max_length=80)):
    if not fd.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        teams = await fd.search_teams(q)
    except fd.FootballDataError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return {"teams": teams}


@router.get("/teams/{team_id}")
async def team_detail(team_id: str):
    if not fd.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        team = await fd.team_detail(team_id)
    except fd.FootballDataError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return {"team": team}


@router.get("/teams/{team_id}/matches")
async def team_matches(team_id: str):
    if not fd.is_configured():
        raise HTTPException(status_code=503, detail="AI Sport временно не подключён к источнику данных")
    try:
        matches = await fd.team_matches(team_id)
    except fd.FootballDataError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return matches


@router.get("/live")
async def live():
    if not fd.is_configured():
        return {"matches": [], "configured": False}
    try:
        matches = await fd.live_matches()
    except fd.FootballDataError as e:
        raise HTTPException(status_code=e.status, detail=str(e))
    return {"matches": matches, "configured": True}
