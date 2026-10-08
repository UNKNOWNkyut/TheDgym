from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.members import router as members_router
from app.routers.membership_plans import router as membership_plans_router
from app.routers.visits import router as visits_router
from app.routers.class_sessions import router as class_sessions_router
from app.routers.pt_sessions import router as pt_sessions_router
from app.routers.finance import router as finance_router

__all__ = [
    "auth_router",
    "users_router",
    "members_router",
    "membership_plans_router",
    "visits_router",
    "class_sessions_router",
    "pt_sessions_router",
    "finance_router",
]
