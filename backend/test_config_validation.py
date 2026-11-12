"""Unit tests for fail-closed environment & production config validation in app.config."""
import asyncio
import os
import ssl
import sys
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

from httpx import ASGITransport, AsyncClient

sys.path.insert(0, os.path.dirname(__file__))
os.environ.setdefault("ENVIRONMENT", "development")

from app import config as config_mod
from app.config import _DEFAULT_DEV_SECRET, Settings, is_trusted_proxy, validate_settings
from app.core.rate_limit import resolve_client_ip
from app.database import prepare_async_database_config

_STRONG_JWT = "x" * 64
_VALID_PROD_ENV = {
    "ENVIRONMENT": "production",
    "DATABASE_URL": "postgresql+asyncpg://dgym_user:strongpass@db:5432/dgym_prod",
    "JWT_SECRET_KEY": _STRONG_JWT,
    "CORS_ORIGINS": "https://thedgym.com, https://www.thedgym.com",
    "XENDIT_WEBHOOK_VERIFICATION_TOKEN": "wh_verif_tok_123456",
}


def _assert_fails(env: dict, expected: str, label: str) -> None:
    with patch.dict(os.environ, env, clear=True):
        cfg = Settings()
        try:
            validate_settings(cfg)
        except RuntimeError as exc:
            assert expected in str(exc), f"{label}: expected {expected!r} in {exc!s}"
            return
        raise AssertionError(f"{label}: expected RuntimeError, but validation passed")


def run_all() -> None:
    invalid_cases = [
        ({}, "missing or invalid", "unset ENVIRONMENT"),
        ({"ENVIRONMENT": "prod"}, "missing or invalid", "unknown ENVIRONMENT"),
        ({"ENVIRONMENT": "test"}, "JWT_SECRET_KEY", "test env without JWT"),
        ({"ENVIRONMENT": "staging", "JWT_SECRET_KEY": _STRONG_JWT}, "DATABASE_URL", "staging without DATABASE_URL"),
        ({**_VALID_PROD_ENV, "JWT_SECRET_KEY": _DEFAULT_DEV_SECRET}, "JWT_SECRET_KEY", "prod default JWT"),
        (
            {**_VALID_PROD_ENV, "JWT_SECRET_KEY": "REPLACE_WITH_64_CHAR_RANDOM_SECRET_IN_PRODUCTION"},
            "JWT_SECRET_KEY",
            "prod placeholder JWT",
        ),
        ({**_VALID_PROD_ENV, "DATABASE_URL": ""}, "SQLite is forbidden", "prod empty DATABASE_URL"),
        (
            {**_VALID_PROD_ENV, "DATABASE_URL": "sqlite+aiosqlite:///./dgym.db"},
            "SQLite is forbidden",
            "prod SQLite DATABASE_URL",
        ),
        ({**_VALID_PROD_ENV, "CORS_ORIGINS": ""}, "CORS_ORIGINS", "prod empty CORS_ORIGINS"),
        ({**_VALID_PROD_ENV, "CORS_ORIGINS": "https://thedgym.com,*"}, "CORS_ORIGINS", "prod wildcard CORS"),
        (
            {**_VALID_PROD_ENV, "XENDIT_WEBHOOK_VERIFICATION_TOKEN": ""},
            "XENDIT_WEBHOOK_VERIFICATION_TOKEN",
            "prod missing webhook token",
        ),
    ]
    for env, expected, label in invalid_cases:
        _assert_fails(env, expected, label)

    with patch.dict(os.environ, {"ENVIRONMENT": "development"}, clear=True):
        dev_cfg = Settings()
        validate_settings(dev_cfg)
        assert dev_cfg.JWT_SECRET_KEY == _DEFAULT_DEV_SECRET
        assert "sqlite" in dev_cfg.DATABASE_URL
        assert "http://localhost:5173" in dev_cfg.CORS_ORIGINS

    with patch.dict(os.environ, _VALID_PROD_ENV, clear=True):
        prod_cfg = Settings()
        validate_settings(prod_cfg)
        assert prod_cfg.CORS_ORIGINS == ["https://thedgym.com", "https://www.thedgym.com"]

    with patch.dict(
        os.environ,
        {**_VALID_PROD_ENV, "TRUSTED_PROXY_IPS": "127.0.0.1,172.16.0.0/12,not-an-ip"},
        clear=True,
    ):
        proxy_cfg = Settings()
        assert is_trusted_proxy("127.0.0.1", proxy_cfg)
        assert is_trusted_proxy("172.18.0.5", proxy_cfg)
        assert not is_trusted_proxy("203.0.113.50", proxy_cfg)

        with patch.object(config_mod, "settings", proxy_cfg):
            spoofed_req = SimpleNamespace(
                client=SimpleNamespace(host="203.0.113.50"),
                headers={"x-forwarded-for": "1.1.1.1, 8.8.8.8"},
            )
            assert resolve_client_ip(spoofed_req) == "203.0.113.50"

            proxied_req = SimpleNamespace(
                client=SimpleNamespace(host="172.18.0.5"),
                headers={"x-forwarded-for": "9.9.9.9, 198.51.100.77"},
            )
            assert resolve_client_ip(proxied_req) == "198.51.100.77"

    # Render external URL fallback + explicit CORS_ORIGINS precedence
    render_only_env = {
        k: v for k, v in _VALID_PROD_ENV.items() if k != "CORS_ORIGINS"
    } | {"RENDER_EXTERNAL_URL": "https://thedgym-demo.onrender.com/"}
    with patch.dict(os.environ, render_only_env, clear=True):
        render_cfg = Settings()
        validate_settings(render_cfg)
        assert render_cfg.CORS_ORIGINS == ["https://thedgym-demo.onrender.com"]

    with patch.dict(
        os.environ,
        {**_VALID_PROD_ENV, "RENDER_EXTERNAL_URL": "https://thedgym-demo.onrender.com"},
        clear=True,
    ):
        override_cfg = Settings()
        validate_settings(override_cfg)
        assert override_cfg.CORS_ORIGINS == ["https://thedgym.com", "https://www.thedgym.com"]

    _assert_fails(
        {
            k: v for k, v in _VALID_PROD_ENV.items() if k != "CORS_ORIGINS"
        }
        | {"RENDER_EXTERNAL_URL": "https://*.onrender.com"},
        "CORS_ORIGINS",
        "prod wildcard RENDER_EXTERNAL_URL fallback",
    )

    # Neon / Render PostgreSQL URL normalization for asyncpg
    neon_url, neon_args = prepare_async_database_config(
        "postgresql://user:pass@ep-demo.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    )
    assert neon_url == "postgresql+asyncpg://user:pass@ep-demo.ap-southeast-1.aws.neon.tech/neondb"
    assert neon_args == {"ssl": "require"}

    render_db_url, render_db_args = prepare_async_database_config(
        "postgres://u:p@dpg-demo:5432/thedgym?sslmode=disable&application_name=dgym"
    )
    assert render_db_url == "postgresql+asyncpg://u:p@dpg-demo:5432/thedgym?application_name=dgym"
    assert render_db_args == {"ssl": False}

    vf_url, vf_args = prepare_async_database_config(
        "postgresql+asyncpg://u:p@host:5432/db?sslmode=verify-full"
    )
    assert vf_url == "postgresql+asyncpg://u:p@host:5432/db"
    assert isinstance(vf_args.get("ssl"), ssl.SSLContext) and vf_args["ssl"].check_hostname is True

    sqlite_url, sqlite_args = prepare_async_database_config("sqlite+aiosqlite:///./dgym.db")
    assert sqlite_url == "sqlite+aiosqlite:///./dgym.db"
    assert sqlite_args == {}

    # Single-service SPA static serving & security boundaries
    from app import main as main_mod

    async def _verify_spa_serving() -> None:
        with tempfile.TemporaryDirectory(prefix="dgym_spa_") as tmp:
            dist = Path(tmp)
            assets = dist / "assets"
            assets.mkdir()
            (dist / "index.html").write_text("<html><body>DGym SPA</body></html>", encoding="utf-8")
            (assets / "main-AbCd1234.js").write_text("console.log('ok');", encoding="utf-8")

            with patch.object(main_mod, "_FRONTEND_DIST_DIR", dist.resolve()):
                async with AsyncClient(
                    transport=ASGITransport(app=main_mod.app),
                    base_url="http://test",
                ) as ac:
                    r_root = await ac.get("/")
                    assert r_root.status_code == 200
                    assert "DGym SPA" in r_root.text
                    assert "script-src 'self'" in r_root.headers.get("content-security-policy", "")
                    assert r_root.headers.get("cache-control") == "no-cache"

                    r_route = await ac.get("/portal/dashboard")
                    assert r_route.status_code == 200
                    assert "DGym SPA" in r_route.text

                    r_asset = await ac.get("/assets/main-AbCd1234.js")
                    assert r_asset.status_code == 200
                    assert "immutable" in r_asset.headers.get("cache-control", "")

                    r_missing_asset = await ac.get("/assets/missing-12345678.js")
                    assert r_missing_asset.status_code == 404

                    r_missing_meta = await ac.get("/robots.txt")
                    assert r_missing_meta.status_code == 404

                    r_api_404 = await ac.get("/api/does-not-exist")
                    assert r_api_404.status_code == 404
                    assert "default-src 'none'" in r_api_404.headers.get("content-security-policy", "")

                    r_api_405 = await ac.get("/api/access/webhook-tap?uid=AA:BB:CC:DD")
                    assert r_api_405.status_code == 405

    asyncio.run(_verify_spa_serving())

    print(f"[PASS] All {len(invalid_cases) + 12} config, database URL, proxy, and SPA checks passed")


if __name__ == "__main__":
    run_all()
