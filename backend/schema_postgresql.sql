-- ============================================================================
-- THE DGYM — PostgreSQL 16 Database Schema
-- Location: Rosario, Batangas
-- System: Gym Management, Attendance, Operations, NFC Access & ML Retention
-- Standard: 3rd Normal Form (3NF) with Relational Integrity & Cascades
-- ============================================================================

-- Optional: Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS retention_strategies CASCADE;
DROP TABLE IF EXISTS predictions CASCADE;
DROP TABLE IF EXISTS processed_customers CASCADE;
DROP TABLE IF EXISTS raw_transactions CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS pt_sessions CASCADE;
DROP TABLE IF EXISTS class_enrollments CASCADE;
DROP TABLE IF EXISTS class_sessions CASCADE;
DROP TABLE IF EXISTS keycard_tap_logs CASCADE;
DROP TABLE IF EXISTS visits CASCADE;
DROP TABLE IF EXISTS member_keycards CASCADE;
DROP TABLE IF EXISTS access_scanners CASCADE;
DROP TABLE IF EXISTS member_memberships CASCADE;
DROP TABLE IF EXISTS membership_plans CASCADE;
DROP TABLE IF EXISTS members CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;


-- ============================================================================
-- 1. USERS (Authentication & Role-Based Access Control)
-- ============================================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(20) NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'staff', 'trainer', 'member')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);


-- ============================================================================
-- 2. USER_PROFILES (Extended User Avatar / Profile Settings)
-- ============================================================================
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    profile_picture_path VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ix_user_profiles_user_id ON user_profiles(user_id);


-- ============================================================================
-- 3. MEMBERS (Athlete Profile & Demographics)
-- ============================================================================
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    member_code VARCHAR(20) NOT NULL UNIQUE, -- Sequential format: DGM-0001, DGM-0002...
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE,
    phone VARCHAR(50),
    date_of_birth DATE,
    gender VARCHAR(20) CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
    address TEXT,
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended', 'expired')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    admin_viewed_at TIMESTAMPTZ
);

CREATE INDEX idx_members_code ON members(member_code);
CREATE INDEX idx_members_email ON members(email);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_name ON members(last_name, first_name);


-- ============================================================================
-- 4. MEMBERSHIP_PLANS (Tier Catalog & Pricing)
-- ============================================================================
CREATE TABLE membership_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    duration_days INTEGER NOT NULL CHECK (duration_days > 0),
    price_php NUMERIC(10, 2) NOT NULL CHECK (price_php >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_membership_plans_slug ON membership_plans(slug);


-- ============================================================================
-- 5. MEMBER_MEMBERSHIPS (Subscription Contracts & Payment Ledger)
-- ============================================================================
CREATE TABLE member_memberships (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
    paid_amount NUMERIC(10, 2) CHECK (paid_amount >= 0),
    payment_method VARCHAR(20) CHECK (
        payment_method IN (
            'cash', 'gcash', 'bank_transfer', 'qr_payment',
            'credit_card', 'debit_card', 'maya', 'other'
        )
    ),
    payment_reference VARCHAR(100),
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_member_memberships_member_id ON member_memberships(member_id);
CREATE INDEX idx_member_memberships_plan_id ON member_memberships(plan_id);
CREATE INDEX idx_member_memberships_status ON member_memberships(status);
CREATE INDEX idx_member_memberships_dates ON member_memberships(start_date, end_date);
CREATE UNIQUE INDEX uq_member_memberships_payment_reference_nonempty
    ON member_memberships(payment_reference)
    WHERE payment_reference IS NOT NULL AND payment_reference != '';


-- ============================================================================
-- 6. ACCESS_SCANNERS (Registered RFID/NFC Edge Readers)
-- ============================================================================
CREATE TABLE access_scanners (
    id SERIAL PRIMARY KEY,
    name VARCHAR(120) NOT NULL,
    location VARCHAR(150) NOT NULL DEFAULT 'Front Desk',
    api_key_hash VARCHAR(64) NOT NULL UNIQUE,
    api_key_prefix VARCHAR(16) NOT NULL,
    tap_mode VARCHAR(20) NOT NULL DEFAULT 'check_in_only' CHECK (tap_mode IN ('check_in_only', 'toggle_in_out')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_heartbeat_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ix_access_scanners_api_key_hash ON access_scanners(api_key_hash);


-- ============================================================================
-- 7. MEMBER_KEYCARDS (Issued Physical RFID/NFC Keycards)
-- ============================================================================
CREATE TABLE member_keycards (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    card_uid_hash VARCHAR(64) NOT NULL UNIQUE,
    card_uid_masked VARCHAR(32) NOT NULL,
    card_label VARCHAR(100) NOT NULL DEFAULT 'DGym Smart Keycard',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'lost', 'stolen', 'revoked')),
    issued_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    revoked_reason TEXT,
    last_tapped_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ix_member_keycards_card_uid_hash ON member_keycards(card_uid_hash);
CREATE INDEX ix_member_keycards_member_id ON member_keycards(member_id);
CREATE INDEX ix_member_keycards_status ON member_keycards(status);


-- ============================================================================
-- 8. VISITS (Front-Desk Attendance & Dwell Time Tracking)
-- ============================================================================
CREATE TABLE visits (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    keycard_id INTEGER REFERENCES member_keycards(id) ON DELETE SET NULL,
    scanner_id INTEGER REFERENCES access_scanners(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TIMESTAMPTZ,
    visit_type VARCHAR(20) NOT NULL DEFAULT 'walk_in' CHECK (visit_type IN ('walk_in', 'class', 'pt_session', 'open_gym')),
    entry_method VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (entry_method IN ('manual', 'rfid_tap', 'qr_scan')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visits_member_id ON visits(member_id);
CREATE INDEX idx_visits_checked_in_at ON visits(checked_in_at);
CREATE INDEX ix_visits_member_checked_in ON visits(member_id, checked_in_at);
CREATE UNIQUE INDEX uq_visits_member_active_open
    ON visits(member_id) WHERE checked_out_at IS NULL;


-- ============================================================================
-- 9. KEYCARD_TAP_LOGS (Immutable NFC Hardware Audit & Decision Telemetry)
-- ============================================================================
CREATE TABLE keycard_tap_logs (
    id SERIAL PRIMARY KEY,
    keycard_id INTEGER REFERENCES member_keycards(id) ON DELETE SET NULL,
    member_id INTEGER REFERENCES members(id) ON DELETE SET NULL,
    scanner_id INTEGER REFERENCES access_scanners(id) ON DELETE SET NULL,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    card_uid_masked VARCHAR(32) NOT NULL,
    decision VARCHAR(40) NOT NULL CHECK (
        decision IN (
            'granted_check_in', 'granted_check_out',
            'already_checked_in', 'already_checked_out', 'paired_card',
            'denied_unregistered_card', 'denied_card_lost_or_stolen',
            'denied_card_revoked', 'denied_member_suspended',
            'denied_member_inactive', 'denied_no_membership',
            'denied_membership_expired', 'denied_payment_pending',
            'denied_cooldown_duplicate'
        )
    ),
    reason_message VARCHAR(500) NOT NULL,
    plan_name VARCHAR(100),
    days_remaining INTEGER,
    warning_banner VARCHAR(255),
    latency_ms INTEGER NOT NULL DEFAULT 0 CHECK (latency_ms >= 0),
    tapped_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_keycard_tap_logs_keycard_id ON keycard_tap_logs(keycard_id);
CREATE INDEX ix_keycard_tap_logs_member_id ON keycard_tap_logs(member_id);
CREATE INDEX ix_keycard_tap_logs_decision ON keycard_tap_logs(decision);
CREATE INDEX ix_keycard_tap_logs_tapped_at ON keycard_tap_logs(tapped_at);


-- ============================================================================
-- 10. CLASS_SESSIONS (Group Fitness Schedules & Capacity Limits)
-- ============================================================================
CREATE TABLE class_sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    class_type VARCHAR(20) NOT NULL CHECK (
        class_type IN (
            'tabata', 'hiit', 'barbell_club', 'conditioning',
            'open_gym', 'powerlifting', 'strength', 'other'
        )
    ),
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    max_capacity INTEGER NOT NULL DEFAULT 15 CHECK (max_capacity > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'ongoing', 'completed', 'cancelled')),
    location VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_class_sessions_scheduled_at ON class_sessions(scheduled_at);
CREATE INDEX idx_class_sessions_coach_id ON class_sessions(coach_id);


-- ============================================================================
-- 11. CLASS_ENROLLMENTS (Junction Table: Member Attendance per Class)
-- ============================================================================
CREATE TABLE class_enrollments (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    class_session_id INTEGER NOT NULL REFERENCES class_sessions(id) ON DELETE CASCADE,
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    CONSTRAINT uq_member_class_session UNIQUE (member_id, class_session_id)
);

CREATE INDEX idx_class_enrollments_session ON class_enrollments(class_session_id);
CREATE INDEX idx_class_enrollments_member ON class_enrollments(member_id);


-- ============================================================================
-- 12. PT_SESSIONS (1-on-1 Personal Training & Coach Approval Workflow)
-- ============================================================================
CREATE TABLE pt_sessions (
    id SERIAL PRIMARY KEY,
    trainer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'scheduled', 'rejected', 'completed', 'cancelled', 'no_show')),
    notes TEXT,
    coach_notes TEXT,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_pt_sessions_trainer_id ON pt_sessions(trainer_id);
CREATE INDEX idx_pt_sessions_member_id ON pt_sessions(member_id);
CREATE INDEX idx_pt_sessions_scheduled_at ON pt_sessions(scheduled_at);
CREATE INDEX idx_pt_sessions_status ON pt_sessions(status);


-- ============================================================================
-- 13. EXPENSE_CATEGORIES (Overhead Classification)
-- ============================================================================
CREATE TABLE expense_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================================
-- 14. EXPENSES (Operational Disbursements Ledger)
-- ============================================================================
CREATE TABLE expenses (
    id SERIAL PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES expense_categories(id) ON DELETE RESTRICT,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    expense_date DATE NOT NULL,
    description TEXT NOT NULL,
    receipt_path VARCHAR(500),
    recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    is_archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_archived ON expenses(is_archived);
CREATE INDEX idx_expenses_recorded_by ON expenses(recorded_by_user_id);


-- ============================================================================
-- 15. NOTIFICATIONS (In-App User & Member Alert Inbox)
-- ============================================================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    member_id INTEGER REFERENCES members(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'info',
    action_text VARCHAR(100),
    action_url VARCHAR(250),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_notifications_user_id ON notifications(user_id);
CREATE INDEX ix_notifications_member_id ON notifications(member_id);
CREATE INDEX ix_notifications_is_read ON notifications(is_read);


-- ============================================================================
-- 16. AUDIT_LOGS (Security & Financial Immutable Event Trail)
-- ============================================================================
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    actor_user_id INTEGER,
    actor_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(100),
    target_id VARCHAR(100),
    ip_address VARCHAR(64),
    outcome VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
    details TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_audit_logs_actor_user_id ON audit_logs(actor_user_id);
CREATE INDEX ix_audit_logs_action ON audit_logs(action);
CREATE INDEX ix_audit_logs_created_at ON audit_logs(created_at);


-- ============================================================================
-- 17. RAW_TRANSACTIONS (ML Pipeline Staging Activity Feed)
-- ============================================================================
CREATE TABLE raw_transactions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    transaction_type VARCHAR(50) NOT NULL,
    transaction_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount NUMERIC(10, 2) DEFAULT 0.00,
    reference_code VARCHAR(100),
    metadata_json TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_raw_transactions_customer_id ON raw_transactions(customer_id);
CREATE INDEX ix_raw_transactions_transaction_date ON raw_transactions(transaction_date);


-- ============================================================================
-- 18. PROCESSED_CUSTOMERS (ML Feature Store per Member)
-- ============================================================================
CREATE TABLE processed_customers (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE,
    visit_frequency_weekly DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    days_since_last_checkin INTEGER NOT NULL DEFAULT 0,
    total_visits_30d INTEGER NOT NULL DEFAULT 0,
    total_class_bookings INTEGER NOT NULL DEFAULT 0,
    total_pt_sessions INTEGER NOT NULL DEFAULT 0,
    membership_tenure_days INTEGER NOT NULL DEFAULT 0,
    total_revenue_lifetime NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    recent_activity_score DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    feature_calculated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX ix_processed_customers_customer_id ON processed_customers(customer_id);


-- ============================================================================
-- 19. PREDICTIONS (XGBoost Churn Risk Inference Results)
-- ============================================================================
CREATE TABLE predictions (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    churn_probability DOUBLE PRECISION NOT NULL,
    risk_tier VARCHAR(20) NOT NULL,
    top_risk_factor_1 VARCHAR(150),
    top_risk_factor_2 VARCHAR(150),
    top_risk_factor_3 VARCHAR(150),
    model_version VARCHAR(50) NOT NULL DEFAULT '1.0',
    predicted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_predictions_customer_id ON predictions(customer_id);
CREATE INDEX ix_predictions_risk_tier ON predictions(risk_tier);


-- ============================================================================
-- 20. RETENTION_STRATEGIES (Targeted Re-Engagement Offers)
-- ============================================================================
CREATE TABLE retention_strategies (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    risk_tier VARCHAR(20) NOT NULL,
    churn_probability DOUBLE PRECISION NOT NULL,
    urgency VARCHAR(20) NOT NULL DEFAULT 'NORMAL',
    strategy_title VARCHAR(200) NOT NULL,
    diagnosis_summary TEXT NOT NULL,
    tactical_action_steps TEXT NOT NULL,
    offer_title VARCHAR(150) NOT NULL,
    offer_message TEXT NOT NULL,
    offer_action_text VARCHAR(100) NOT NULL,
    offer_action_url VARCHAR(200) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'Pending',
    dispatched_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX ix_retention_strategies_member_id ON retention_strategies(member_id);
CREATE INDEX ix_retention_strategies_risk_tier ON retention_strategies(risk_tier);
