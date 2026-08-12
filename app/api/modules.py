"""Единый источник правды для реестра модулей.

Спека (01-core-foundation.md, 1.7) описывает modules.config.ts на фронтенде.
Пока фронтенд не реализован, тем же контрактом (ModuleConfig) пользуется
app/modules_registry.json — Этапы 2-7 дописывают туда записи своих модулей,
а не создают параллельные реестры. Когда появится фронтенд, modules.config.ts
может либо импортировать этот JSON, либо просто зеркалить его вручную —
источник правды один.
"""
import json
import os

from fastapi import APIRouter

router = APIRouter(prefix="/api", tags=["modules"])

_REGISTRY_PATH = os.path.join(os.path.dirname(__file__), "..", "modules_registry.json")


@router.get("/modules")
async def list_modules():
    with open(_REGISTRY_PATH, "r", encoding="utf-8") as f:
        modules = json.load(f)
    return {"modules": modules}
