from fastapi import APIRouter

from app.api.v1 import (
    auth,
    friends,
    me,
    payments,
    railway_account,
    stations,
    subscriptions,
    trains,
)

router = APIRouter(prefix="/api/v1")
router.include_router(auth.router)
router.include_router(me.router)
router.include_router(stations.router)
router.include_router(trains.router)
router.include_router(subscriptions.router)
router.include_router(payments.router)
router.include_router(railway_account.router)
router.include_router(friends.router)
