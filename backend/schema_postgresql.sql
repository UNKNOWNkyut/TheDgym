-- ============================================================================
-- THE DGYM — PostgreSQL 16 Database Schema
-- Location: Rosario, Batangas
-- System: Gym Management, Attendance, Operations & Financial Ledger
-- Standard: 3rd Normal Form (3NF) with Relational Integrity & Cascades
-- ============================================================================

-- Optional: Drop existing tables in reverse dependency order
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS expense_categories CASCADE;
DROP TABLE IF EXISTS pt_sessions CASCADE;
DROP TABLE IF EXISTS class_enrollments CASCADE;
DROP TABLE IF EXISTS class_sessions CASCADE;
DROP TABLE IF EXISTS visits CASCADE;
DROP TABLE IF EXISTS member_memberships CASCADE;
DROP TABLE IF EXISTS membership_plans CASCADE;
DROP TABLE IF EXISTS members CASCADE;
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
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'trainer', 'member')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);


-- ============================================================================
-- 2. MEMBERS (Athlete Profile & Demographics)
-- ============================================================================
CREATE TABLE members (
    id SERIAL PRIMARY KEY,
    member_code VARCHAR(20) NOT NULL UNIQUE, -- Sequential format: DGM-0001, DGM-0002...
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_members_code ON members(member_code);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_name ON members(last_name, first_name);


-- ============================================================================
-- 3. MEMBERSHIP_PLANS (Tier Catalog & Pricing)
-- ============================================================================
CREATE TABLE membership_plans (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
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
-- 4. MEMBER_MEMBERSHIPS (Subscription Contracts & Payment Ledger)
-- ============================================================================
CREATE TABLE member_memberships (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES membership_plans(id) ON DELETE RESTRICT,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
    paid_amount NUMERIC(10, 2) CHECK (paid_amount >= 0),
    payment_method VARCHAR(20) CHECK (payment_method IN ('cash', 'gcash', 'maya', 'bank_transfer', 'other')),
    payment_reference VARCHAR(100),
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_member_memberships_member_id ON member_memberships(member_id);
CREATE INDEX idx_member_memberships_status ON member_memberships(status);
CREATE INDEX idx_member_memberships_dates ON member_memberships(start_date, end_date);


-- ============================================================================
-- 5. VISITS (Front-Desk Attendance & Dwell Time Tracking)
-- ============================================================================
CREATE TABLE visits (
    id SERIAL PRIMARY KEY,
    member_id INTEGER NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    recorded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    checked_out_at TIMESTAMPTZ,
    visit_type VARCHAR(20) NOT NULL DEFAULT 'walk_in' CHECK (visit_type IN ('walk_in', 'class', 'pt_session', 'open_gym')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_visits_member_id ON visits(member_id);
CREATE INDEX idx_visits_checked_in_at ON visits(checked_in_at);


-- ============================================================================
-- 6. CLASS_SESSIONS (Group Fitness Schedules & Capacity Limits)
-- ============================================================================
CREATE TABLE class_sessions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    class_type VARCHAR(20) NOT NULL CHECK (class_type IN ('barbell_club', 'conditioning', 'open_gym', 'powerlifting', 'strength', 'hiit', 'other')),
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
-- 7. CLASS_ENROLLMENTS (Junction Table: Member Attendance per Class)
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
-- 8. PT_SESSIONS (1-on-1 Personal Training & Coach Approval Workflow)
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
-- 9. EXPENSE_CATEGORIES (Overhead Classification)
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
-- 10. EXPENSES (Operational Disbursements Ledger)
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
