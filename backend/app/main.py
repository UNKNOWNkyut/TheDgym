from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.database import AsyncSessionLocal, Base, engine
from app.routers import (
    auth_router,
    users_router,
    members_router,
    membership_plans_router,
    finance_router,
)
from app.seed import seed_users
from app.seed_plans import seed_plans
from app.seed_members import seed_members


@asynccontextmanager
async def lifespan(app: FastAPI):

    # Create database tables if they do not exist.
    async with engine.begin() as conn:
        await conn.run_sync(
            Base.metadata.create_all
        )

    # Seed development data.
    async with AsyncSessionLocal() as session:
        await seed_users(session)
        await seed_plans(session)
        await seed_members(session)

    yield

    # Close database engine when server shuts down.
    await engine.dispose()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=(
        "The DGym API — Authentication, "
        "Management, Finance, and Analytics Platform"
    ),
    lifespan=lifespan,
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

app.include_router(users_router)

app.include_router(members_router)

app.include_router(
    membership_plans_router
)

app.include_router(
    finance_router
)


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