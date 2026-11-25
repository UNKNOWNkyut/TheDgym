import logging
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import AsyncEngine

logger = logging.getLogger("dgym.migrations")


def _inspect_nullable_set_null_fk(sync_conn, table_name: str, col_name: str) -> tuple[bool, bool]:
    inspector = inspect(sync_conn)
    col = next((c for c in inspector.get_columns(table_name) if c["name"] == col_name), None)
    is_nullable = bool(col and col.get("nullable"))
    if sync_conn.dialect.name == "sqlite":
        rows = sync_conn.execute(text(f"PRAGMA foreign_key_list({table_name})")).all()
        has_set_null = any(r[3] == col_name and str(r[6] or "").upper() == "SET NULL" for r in rows)
        return is_nullable, has_set_null
    fk = next(
        (f for f in inspector.get_foreign_keys(table_name) if f.get("constrained_columns") == [col_name]),
        None,
    )
    has_set_null = bool(fk and str((fk.get("options") or {}).get("ondelete", "")).upper() == "SET NULL")
    return is_nullable, has_set_null


async def _migrate_member_memberships_table(conn, mm_cols: set[str]) -> None:
    """Add snapshot columns and decouple `member_id` FK (`NULL`, `ON DELETE SET NULL`)."""
    for col_name, col_len in (("payer_name_snapshot", 255), ("plan_name_snapshot", 100)):
        if col_name not in mm_cols:
            await conn.execute(
                text(f"ALTER TABLE member_memberships ADD COLUMN {col_name} VARCHAR({col_len}) NULL")
            )
            logger.info("[MIGRATION] Added column member_memberships.%s", col_name)

    is_nullable, has_set_null = await conn.run_sync(
        _inspect_nullable_set_null_fk, "member_memberships", "member_id"
    )
    if is_nullable and has_set_null:
        return

    if conn.dialect.name == "postgresql":
        if not is_nullable:
            await conn.execute(text("ALTER TABLE member_memberships ALTER COLUMN member_id DROP NOT NULL"))
        fk_rows = (
            await conn.execute(
                text(
                    "SELECT tc.constraint_name, rc.delete_rule "
                    "FROM information_schema.table_constraints tc "
                    "JOIN information_schema.key_column_usage kcu "
                    "  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema "
                    "JOIN information_schema.referential_constraints rc "
                    "  ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema "
                    "WHERE tc.table_name = 'member_memberships' AND tc.constraint_type = 'FOREIGN KEY' "
                    "  AND kcu.column_name = 'member_id'"
                )
            )
        ).all()
        need_fk = True
        for cname, delete_rule in fk_rows:
            if str(delete_rule or "").upper() == "SET NULL":
                need_fk = False
            else:
                await conn.execute(text(f'ALTER TABLE member_memberships DROP CONSTRAINT "{cname}"'))
        if need_fk:
            await conn.execute(
                text(
                    "ALTER TABLE member_memberships ADD CONSTRAINT fk_member_memberships_member_id "
                    "FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL"
                )
            )
        logger.info("[MIGRATION] Updated member_memberships.member_id to nullable ON DELETE SET NULL (PostgreSQL)")
        return

    if conn.dialect.name == "sqlite":
        cols_order = (
            "id", "member_id", "plan_id", "start_date", "end_date", "status",
            "paid_amount", "payment_method", "payment_reference", "created_by_user_id",
            "payer_name_snapshot", "plan_name_snapshot", "notes", "created_at", "updated_at",
        )
        cols_csv = ", ".join(cols_order)
        await conn.execute(text("DROP TABLE IF EXISTS member_memberships__new"))
        await conn.execute(
            text(
                "CREATE TABLE member_memberships__new ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "member_id INTEGER NULL REFERENCES members(id) ON DELETE SET NULL, "
                "plan_id INTEGER NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT, "
                "start_date TIMESTAMP NOT NULL, "
                "end_date TIMESTAMP NOT NULL, "
                "status VARCHAR(20) NOT NULL, "
                "paid_amount NUMERIC(10, 2) NULL, "
                "payment_method VARCHAR(20) NULL, "
                "payment_reference VARCHAR(100) NULL, "
                "created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL, "
                "payer_name_snapshot VARCHAR(255) NULL, "
                "plan_name_snapshot VARCHAR(100) NULL, "
                "notes TEXT NULL, "
                "created_at TIMESTAMP NOT NULL, "
                "updated_at TIMESTAMP NOT NULL)"
            )
        )
        await conn.execute(
            text(f"INSERT INTO member_memberships__new ({cols_csv}) SELECT {cols_csv} FROM member_memberships")
        )
        await conn.execute(text("DROP TABLE member_memberships"))
        await conn.execute(text("ALTER TABLE member_memberships__new RENAME TO member_memberships"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_member_memberships_id ON member_memberships (id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_member_memberships_member_id ON member_memberships (member_id)"))
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_member_memberships_plan_id ON member_memberships (plan_id)"))
        logger.info("[MIGRATION] Rebuilt SQLite member_memberships with nullable ON DELETE SET NULL member_id")


async def _migrate_expenses_table(conn, exp_cols: set[str]) -> None:
    """Add `expenses.name`, backfill from categories, and decouple `category_id` FK (`NULL`, `ON DELETE SET NULL`)."""
    if "name" not in exp_cols:
        await conn.execute(text("ALTER TABLE expenses ADD COLUMN name VARCHAR(150) NULL"))
        if conn.dialect.name == "postgresql":
            await conn.execute(
                text(
                    "UPDATE expenses e SET name = ec.name "
                    "FROM expense_categories ec "
                    "WHERE e.category_id = ec.id AND (e.name IS NULL OR e.name = '')"
                )
            )
        else:
            await conn.execute(
                text(
                    "UPDATE expenses SET name = ("
                    "  SELECT ec.name FROM expense_categories ec WHERE ec.id = expenses.category_id"
                    ") WHERE category_id IS NOT NULL AND (name IS NULL OR name = '')"
                )
            )
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_expenses_name ON expenses (name)"))
        logger.info("[MIGRATION] Added and backfilled column expenses.name")

    is_nullable, has_set_null = await conn.run_sync(
        _inspect_nullable_set_null_fk, "expenses", "category_id"
    )
    if is_nullable and has_set_null:
        return

    if conn.dialect.name == "postgresql":
        if not is_nullable:
            await conn.execute(text("ALTER TABLE expenses ALTER COLUMN category_id DROP NOT NULL"))
        fk_rows = (
            await conn.execute(
                text(
                    "SELECT tc.constraint_name, rc.delete_rule "
                    "FROM information_schema.table_constraints tc "
                    "JOIN information_schema.key_column_usage kcu "
                    "  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema "
                    "JOIN information_schema.referential_constraints rc "
                    "  ON tc.constraint_name = rc.constraint_name AND tc.constraint_schema = rc.constraint_schema "
                    "WHERE tc.table_name = 'expenses' AND tc.constraint_type = 'FOREIGN KEY' "
                    "  AND kcu.column_name = 'category_id'"
                )
            )
        ).all()
        need_fk = True
        for cname, delete_rule in fk_rows:
            if str(delete_rule or "").upper() == "SET NULL":
                need_fk = False
            else:
                await conn.execute(text(f'ALTER TABLE expenses DROP CONSTRAINT "{cname}"'))
        if need_fk:
            await conn.execute(
                text(
                    "ALTER TABLE expenses ADD CONSTRAINT fk_expenses_category_id "
                    "FOREIGN KEY (category_id) REFERENCES expense_categories(id) ON DELETE SET NULL"
                )
            )
        logger.info("[MIGRATION] Updated expenses.category_id to nullable ON DELETE SET NULL (PostgreSQL)")
        return

    if conn.dialect.name == "sqlite":
        cols_order = (
            "id", "name", "category_id", "amount", "expense_date", "description",
            "receipt_path", "recorded_by_user_id", "is_archived", "created_at", "updated_at",
        )
        cols_csv = ", ".join(cols_order)
        await conn.execute(text("DROP TABLE IF EXISTS expenses__new"))
        await conn.execute(
            text(
                "CREATE TABLE expenses__new ("
                "id INTEGER PRIMARY KEY AUTOINCREMENT, "
                "name VARCHAR(150) NULL, "
                "category_id INTEGER NULL REFERENCES expense_categories(id) ON DELETE SET NULL, "
                "amount NUMERIC(12, 2) NOT NULL, "
                "expense_date DATE NOT NULL, "
                "description TEXT NOT NULL, "
                "receipt_path VARCHAR(500) NULL, "
                "recorded_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL, "
                "is_archived BOOLEAN NOT NULL, "
                "created_at TIMESTAMP NOT NULL, "
                "updated_at TIMESTAMP NOT NULL)"
            )
        )
        await conn.execute(
            text(f"INSERT INTO expenses__new ({cols_csv}) SELECT {cols_csv} FROM expenses")
        )
        await conn.execute(text("DROP TABLE expenses"))
        await conn.execute(text("ALTER TABLE expenses__new RENAME TO expenses"))
        for idx_name, col_sql in (
            ("ix_expenses_id", "id"),
            ("ix_expenses_name", "name"),
            ("ix_expenses_category_id", "category_id"),
            ("ix_expenses_expense_date", "expense_date"),
            ("ix_expenses_recorded_by_user_id", "recorded_by_user_id"),
            ("ix_expenses_is_archived", "is_archived"),
        ):
            await conn.execute(text(f"CREATE INDEX IF NOT EXISTS {idx_name} ON expenses ({col_sql})"))
        logger.info("[MIGRATION] Rebuilt SQLite expenses with nullable ON DELETE SET NULL category_id")


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
            await _migrate_member_memberships_table(conn, mm_cols)
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

        exp_cols = await conn.run_sync(_get_existing_columns, "expenses")
        if exp_cols:
            await _migrate_expenses_table(conn, exp_cols)

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

        audit_cols = await conn.run_sync(_get_existing_columns, "audit_logs")
        if audit_cols:
            if "actor_role" not in audit_cols:
                await conn.execute(text("ALTER TABLE audit_logs ADD COLUMN actor_role VARCHAR(32) NULL"))
                logger.info("[MIGRATION] Added column audit_logs.actor_role")
            if "user_agent" not in audit_cols:
                await conn.execute(text("ALTER TABLE audit_logs ADD COLUMN user_agent VARCHAR(255) NULL"))
                logger.info("[MIGRATION] Added column audit_logs.user_agent")

        composite_indexes = (
            ("audit_logs", "ix_audit_logs_created_id", "created_at, id"),
            ("audit_logs", "ix_audit_logs_outcome_created_id", "outcome, created_at, id"),
            ("audit_logs", "ix_audit_logs_actor_role", "actor_role"),
            ("members", "ix_members_joined_id", "joined_at, id"),
            ("members", "ix_members_status_joined_id", "status, joined_at, id"),
            ("users", "ix_users_created_id", "created_at, id"),
            ("users", "ix_users_role_created_id", "role, created_at, id"),
            ("visits", "ix_visits_checked_in_id", "checked_in_at, id"),
            ("keycard_tap_logs", "ix_tap_logs_tapped_id", "tapped_at, id"),
        )
        index_cache: dict[str, set[str]] = {}
        for table_name, index_name, cols_sql in composite_indexes:
            cols_present = await conn.run_sync(_get_existing_columns, table_name)
            if not cols_present:
                continue
            existing_idx = index_cache.setdefault(
                table_name, await conn.run_sync(_get_existing_indexes, table_name)
            )
            if index_name not in existing_idx:
                await conn.execute(
                    text(f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({cols_sql})")
                )
                existing_idx.add(index_name)
                logger.info("[MIGRATION] Created index %s on %s", index_name, table_name)
