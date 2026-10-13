import os
from pathlib import Path
from typing import List

try:
    from dotenv import load_dotenv

    # Search for .env file in cwd, backend directory, or root directory
    base_dir = Path(__file__).resolve().parent.parent
    for p in [Path(".env"), base_dir / ".env", base_dir.parent / ".env"]:
        if p.is_file():
            load_dotenv(dotenv_path=p, override=False)
            break
except ImportError:
    pass


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

    # Google OAuth Settings
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET: str = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]


settings = Settings()
