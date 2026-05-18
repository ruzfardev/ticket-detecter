from fastapi import APIRouter

from app.internal.v1 import users

router = APIRouter(prefix="/internal/v1")
router.include_router(users.router)
