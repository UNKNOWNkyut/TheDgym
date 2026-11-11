import logging
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("dgym.migrations")


async def run_startup_column_migrations(engine: AsyncEngine) -> None:
    """
    Idempotently add newly introduced columns and partial unique indexes to pre-existing
    tables (e.g. `visits.entry_method`, `visits.keycard_id`, `visits.scanner_id`,
    `uq_member_memberships_payment_reference_nonempty`, `uq_visits_member_active_open`).
    Safe across both SQLite and PostgreSQL.
    """
    async with engine.begin() as conn:
        def _get_existing_columns(sync_conn, table_name: str) -> set[str]:
            inspector = inspect(sync_conn)
            if not inspector.has_table(table_name):
                return set()
            return {col["name"] for col in inspector.get_columns(table_name)}

        def _get_existing_indexes(sync_conn, table_name: str) -> set[str]:
            inspector = inspect(sync_conn)
            if not inspector.has_table(table_name):
                return set()
            return {idx["name"] for idx in inspector.get_indexes(table_name) if idx.get("name")}

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

            visits_indexes = await conn.run_sync(_get_existing_indexes, "visits")
            if "uq_visits_member_active_open" not in visits_indexes:
                await conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_visits_member_active_open "
                        "ON visits (member_id) WHERE checked_out_at IS NULL"
                    )
                )
                logger.info("[MIGRATION] Created partial unique index uq_visits_member_active_open")

        members_cols = await conn.run_sync(_get_existing_columns, "members")
        if members_cols and "admin_viewed_at" not in members_cols:
            await conn.execute(
                text("ALTER TABLE members ADD COLUMN admin_viewed_at TIMESTAMP NULL")
            )
            logger.info("[MIGRATION] Added column members.admin_viewed_at")

        mm_cols = await conn.run_sync(_get_existing_columns, "member_memberships")
        if mm_cols:
            mm_indexes = await conn.run_sync(_get_existing_indexes, "member_memberships")
            if "uq_member_memberships_payment_reference_nonempty" not in mm_indexes:
                await conn.execute(
                    text(
                        "CREATE UNIQUE INDEX IF NOT EXISTS uq_member_memberships_payment_reference_nonempty "
                        "ON member_memberships (payment_reference) "
                        "WHERE payment_reference IS NOT NULL AND payment_reference != ''"
                    )
                )
                logger.info(
                    "[MIGRATION] Created partial unique index uq_member_memberships_payment_reference_nonempty"
                )
