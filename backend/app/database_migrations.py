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
    if engine.dialect.name == "postgresql":
        async with engine.connect() as ac_raw:
            ac_conn = await ac_raw.execution_options(isolation_level="AUTOCOMMIT")
            has_userrole_type = await ac_conn.scalar(
                text("SELECT 1 FROM pg_type WHERE typname = 'userrole'")
            )
            if has_userrole_type:
                await ac_conn.execute(
                    text("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'user'")
                )

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
            ts_type = "TIMESTAMP WITH TIME ZONE" if conn.dialect.name == "postgresql" else "TIMESTAMP"
            await conn.execute(
                text(f"ALTER TABLE members ADD COLUMN admin_viewed_at {ts_type} NULL")
            )
            logger.info("[MIGRATION] Added column members.admin_viewed_at")

        users_cols = await conn.run_sync(_get_existing_columns, "users")
        if users_cols and "tokens_valid_after" not in users_cols:
            ts_type = "TIMESTAMP WITH TIME ZONE" if conn.dialect.name == "postgresql" else "TIMESTAMP"
            await conn.execute(
                text(f"ALTER TABLE users ADD COLUMN tokens_valid_after {ts_type} NULL")
            )
            logger.info("[MIGRATION] Added column users.tokens_valid_after")

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

        biometric_cols = await conn.run_sync(_get_existing_columns, "user_biometrics")
        if biometric_cols:
            ts_type = "TIMESTAMP WITH TIME ZONE" if conn.dialect.name == "postgresql" else "TIMESTAMP"
            biometric_migrations = (
                ("descriptor_version", "VARCHAR(32) NOT NULL DEFAULT 'faceapi-128-v1'"),
                ("id_type", "VARCHAR(50) NULL"),
                ("id_number_masked", "VARCHAR(32) NULL"),
                ("id_number_hash", "VARCHAR(64) NULL"),
                ("id_ocr_name", "VARCHAR(255) NULL"),
                ("id_face_match_score", "FLOAT NULL"),
                ("reference_selfie_b64", "TEXT NULL"),
                ("verification_provider", "VARCHAR(32) NOT NULL DEFAULT 'faceapi_local'"),
                ("is_enrolled", "BOOLEAN NOT NULL DEFAULT TRUE"),
                ("last_verified_at", f"{ts_type} NULL"),
            )
            for col_name, col_ddl in biometric_migrations:
                if col_name not in biometric_cols:
                    await conn.execute(
                        text(f"ALTER TABLE user_biometrics ADD COLUMN {col_name} {col_ddl}")
                    )
                    logger.info("[MIGRATION] Added column user_biometrics.%s", col_name)
