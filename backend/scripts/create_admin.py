"""
Create the initial production ADMIN user without running demo seeders.

Usage:
  Interactive prompts:
    python scripts/create_admin.py --email owner@thedgym.com --full-name "DGym Owner"

  Non-interactive (container / CI):
    ADMIN_EMAIL=owner@thedgym.com ADMIN_PASSWORD='...' python scripts/create_admin.py
"""
import argparse
import asyncio
import getpass
import os
import sys
from pathlib import Path
from typing import Optional

from pydantic import EmailStr, TypeAdapter, ValidationError
from sqlalchemy import select

BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import app.models  # noqa: E402, F401 — register all declarative models
from app.core.security import hash_password  # noqa: E402
from app.database import AsyncSessionLocal, Base, engine  # noqa: E402
from app.database_migrations import run_startup_column_migrations  # noqa: E402
from app.models.user import User, UserRole  # noqa: E402

_EMAIL_ADAPTER = TypeAdapter(EmailStr)
_DISALLOWED_PASSWORDS = {"admin12345", "password123", "changeme123"}


def _resolve_inputs(args: argparse.Namespace) -> tuple[str, str, str, Optional[str]]:
    raw_email = (args.email or os.getenv("ADMIN_EMAIL", "")).strip()
    if not raw_email:
        raw_email = input("Admin email: ").strip()
    try:
        email = str(_EMAIL_ADAPTER.validate_python(raw_email)).lower().strip()
    except ValidationError as exc:
        raise ValueError(f"Invalid email address: {raw_email!r}") from exc

    full_name = (args.full_name or os.getenv("ADMIN_FULL_NAME", "")).strip()
    if not full_name:
        full_name = input("Full name [DGym Admin]: ").strip() or "DGym Admin"
    if len(full_name) < 2:
        raise ValueError("Full name must be at least 2 characters.")

    phone = (args.phone or os.getenv("ADMIN_PHONE", "")).strip() or None

    password = os.getenv("ADMIN_PASSWORD", "")
    if not password:
        if not sys.stdin.isatty():
            raise ValueError("Set ADMIN_PASSWORD when running non-interactively.")
        password = getpass.getpass("Admin password (min 10 chars): ")
        confirm = getpass.getpass("Confirm admin password: ")
        if password != confirm:
            raise ValueError("Passwords do not match.")

    if len(password) < 10:
        raise ValueError("Admin password must be at least 10 characters.")
    if password.lower() in _DISALLOWED_PASSWORDS:
        raise ValueError("Refusing to create an admin with a known demo/default password.")

    return email, password, full_name, phone


async def create_admin_user(
    email: str,
    password: str,
    full_name: str,
    phone: Optional[str],
) -> int:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await run_startup_column_migrations(engine)

    try:
        async with AsyncSessionLocal() as db:
            existing = (
                await db.execute(select(User).where(User.email == email))
            ).scalar_one_or_none()
            if existing is not None:
                if existing.role == UserRole.ADMIN:
                    print(f"[OK] Admin user already exists: {existing.email} (id={existing.id}).")
                    return 0
                print(
                    f"[ERROR] User '{existing.email}' already exists with role='{existing.role.value}'.",
                    file=sys.stderr,
                )
                return 1

            admin = User(
                email=email,
                hashed_password=hash_password(password),
                full_name=full_name,
                phone=phone,
                role=UserRole.ADMIN,
                is_active=True,
            )
            db.add(admin)
            await db.commit()
            await db.refresh(admin)
            print(f"[CREATED] Admin user '{admin.email}' created (id={admin.id}, active={admin.is_active}).")
            return 0
    finally:
        await engine.dispose()


def main() -> int:
    parser = argparse.ArgumentParser(description="Create an initial production ADMIN user for The DGym.")
    parser.add_argument("--email", help="Admin email address (or set ADMIN_EMAIL)")
    parser.add_argument("--full-name", help="Admin display name (or set ADMIN_FULL_NAME)")
    parser.add_argument("--phone", help="Optional contact phone number (or set ADMIN_PHONE)")
    args = parser.parse_args()

    try:
        email, password, full_name, phone = _resolve_inputs(args)
    except ValueError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        return 2

    return asyncio.run(create_admin_user(email, password, full_name, phone))


if __name__ == "__main__":
    raise SystemExit(main())
