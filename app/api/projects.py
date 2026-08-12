from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app import repo
from app.deps import get_current_user

router = APIRouter(prefix="/api/projects", tags=["projects"])


class CreateProjectBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)


class PatchProjectBody(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    is_active_default: bool | None = None


@router.get("")
async def list_projects(user: dict = Depends(get_current_user)):
    return {"projects": repo.list_projects(user["id"])}


@router.post("")
async def create_project(body: CreateProjectBody, user: dict = Depends(get_current_user)):
    project = repo.create_project(user["id"], body.name)
    return {"project": project}


@router.patch("/{project_id}")
async def patch_project(project_id: int, body: PatchProjectBody, user: dict = Depends(get_current_user)):
    project = repo.get_project(project_id, user["id"])
    if not project:
        raise HTTPException(status_code=404, detail="Проект не найден")

    if body.name is not None:
        project = repo.rename_project(project_id, user["id"], body.name)

    if body.is_active_default is True:
        project = repo.set_active_default_project(project_id, user["id"])

    return {"project": project}


@router.delete("/{project_id}")
async def delete_project(project_id: int, user: dict = Depends(get_current_user)):
    ok = repo.soft_delete_project(project_id, user["id"])
    if not ok:
        raise HTTPException(status_code=404, detail="Проект не найден")
    return {"deleted": True}
