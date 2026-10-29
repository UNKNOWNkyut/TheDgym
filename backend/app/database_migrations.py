import logging
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("dgym.migrations")


async def run_startup_column_migrations(engine: AsyncEngine) -> None:
    """
    Idempotently add newly introduced columns to pre-existing tables
    (e.g. `visits.entry_method`, `visits.keycard_id`, `visits.scanner_id`).
    Safe across both SQLite and PostgreSQL.
    """
    async with engine.begin() as conn:
        def _get_existing_columns(sync_conn, table_name: str) -> set[str]:
            inspector = inspect(sync_conn)
            if not inspector.has_table(table_name):
                return set()
            return {col["name"] for col in inspector.get_columns(table_name)}

        visits_cols = await conn.run_sync(_get_existing_columns, "visits")
        if visits_cols:
            if "entry_method" not in visits_cols:
                await conn.execute(
                    text("ALTER TABLE visits ADD COLUMN entry_method VARCHAR(20) NOT NULL DEFAULT 'manual'")
                )
                logger.info("[MIGRATION] Added column visits.entry_method")
            if "keycard_id" not in visits_cols:
                await conn.execute(
                    text("ALTER TABLE visits ADD COLUMN keycard_id INTEGER NULL")
                )
                logger.info("[MIGRATION] Added column visits.keycard_id")
            if "scanner_id" not in visits_cols:
                await conn.execute(
                    text("ALTER TABLE visits ADD COLUMN scanner_id INTEGER NULL")
                )
                logger.info("[MIGRATION] Added column visits.scanner_id")
