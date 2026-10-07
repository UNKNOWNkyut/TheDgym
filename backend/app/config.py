import os
from typing import List


class Settings:
    PROJECT_NAME: str = "The DGym API"
    VERSION: str = "1.0.0"
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")

    # Database: defaults to async SQLite for local standalone development,
    # or PostgreSQL (e.g. postgresql+asyncpg://user:pass@localhost:5432/dgym)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./dgym.db")

    # JWT Settings
    JWT_SECRET_KEY: str = os.getenv(
        "JWT_SECRET_KEY", "dgym-ultra-secure-jwt-secret-key-rosario-batangas-2026-32chars"
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]


settings = Settings()
