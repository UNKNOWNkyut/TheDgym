from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import (
    AsyncSessionLocal,
    Base,
    engine,
)
from app.routers import (
    auth_router,
    account_router,
    users_router,
    members_router,
    membership_plans_router,
    visits_router,
    class_sessions_router,
    pt_sessions_router,
    finance_router,
    analytics_router,
)
from app.seed import seed_users
from app.seed_plans import seed_plans
from app.seed_members import seed_members
from app.seed_phase5 import seed_phase5
from app.services.churn_pipeline import seed_simulated_gym_analytics


# =========================================================
# UPLOAD DIRECTORY
# =========================================================

UPLOADS_DIR = (
    Path(__file__)
    .resolve()
    .parent
    .parent
    / "uploads"
)

UPLOADS_DIR.mkdir(
    parents=True,
    exist_ok=True,
)


# =========================================================
# APPLICATION LIFESPAN
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    # Create any missing database tables automatically.
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed development data & initialize Phase 6 ML analytics.
    async with AsyncSessionLocal() as session:
        await seed_users(session)
        await seed_plans(session)
        await seed_members(session)
        await seed_phase5(session)
        await seed_simulated_gym_analytics(session)

    yield

    await engine.dispose()


# =========================================================
# FASTAPI APP
# =========================================================

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "The DGym API — Authentication, "
        "Management, Finance, "
        "Member Services, and Analytics Platform"
    ),
    lifespan=lifespan,
)


# =========================================================
# PROFILE PICTURE FILES
# =========================================================

app.mount(
    "/api/uploads",
    StaticFiles(directory=str(UPLOADS_DIR)),
    name="uploads",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# ROUTERS
# =========================================================

app.include_router(auth_router)
app.include_router(account_router)
app.include_router(users_router)
app.include_router(members_router)
app.include_router(membership_plans_router)
app.include_router(visits_router)
app.include_router(class_sessions_router)
app.include_router(pt_sessions_router)
app.include_router(finance_router)
app.include_router(analytics_router)


# =========================================================
# HEALTH CHECK
# =========================================================

@app.get(
    "/api/health",
    tags=["Health"],
)
async def health_check():
    return {
        "status": "online",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
    }