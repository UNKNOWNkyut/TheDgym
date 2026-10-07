# ARCHITECTURE.md — THE DGYM System Architecture

> Version: 0.1.0 | Phase: 0 — Discovery | Last Updated: 2026-10-02

---

## 1. System Overview

THE DGYM is a decoupled, multi-tier web application serving two primary audiences:

1. **The Public** — gym visitors, prospective members browsing the public website
2. **Gym Management / Staff** — administrators managing members, classes, attendance, analytics, and AI-generated retention strategies

```
[ Public Browser / Admin Browser ]
          ↓
   [ React + Vite Frontend ]
          ↓ HTTPS / REST
   [ FastAPI Backend (Python) ]
          ↓
   [ PostgreSQL Database ]
          ↑
   [ Python Data Pipeline ]  →  [ ML Model (XGBoost) ]  →  [ OpenAI GPT-4o-mini ]
```

The frontend NEVER connects directly to the database. All data flows through FastAPI.

---

## 2. Frontend Architecture

### Technology
- **Framework:** React 18 + Vite (TypeScript)
- **Styling:** Tailwind CSS (mobile-first)
- **Animation:** GSAP + `@gsap/react` (`useGSAP` hook)
- **Smooth Scroll:** Lenis
- **3D (where justified):** `@splinetool/react-spline`
- **Routing:** React Router v6

### Structure
```
frontend/
├── public/
│   └── assets/
│       ├── logos/          (copies of brand logos)
│       └── images/
├── src/
│   ├── components/
│   │   ├── ui/             (Button, Card, Input, Badge, Skeleton...)
│   │   ├── layout/         (Header, Footer, MobileMenu, ScrollProgress)
│   │   └── sections/       (Hero, Features, Membership, CTA...)
│   ├── pages/
│   │   ├── public/         (Home, About, Membership, Classes, Contact, FAQ, 404)
│   │   └── admin/          (Dashboard, Members, Analytics, Retention...)
│   ├── hooks/              (useScrollProgress, useGSAPAnimation, useTheme...)
│   ├── lib/                (api client, utils, constants)
│   ├── context/            (AuthContext, ThemeContext)
│   ├── types/              (TypeScript interfaces and types)
│   └── styles/
│       └── globals.css     (Tailwind base + CSS custom properties)
├── index.html
├── vite.config.ts
├── tailwind.config.ts
└── tsconfig.json
```

### Routing Strategy
- Public routes: unprotected, server-side renderable via Vite
- Admin routes: protected, lazy-loaded per route (code splitting)
- 404: Dedicated fallback route

### Performance Strategy
- Route-level code splitting via React lazy + Suspense
- GSAP animations on `transform` and `opacity` only (GPU-accelerated)
- Lenis smooth scroll disabled inside modals
- Images: WebP format, lazy-loaded below fold, responsive srcset
- No unused dependencies shipped to client

---

## 3. Backend Architecture

### Technology
- **Framework:** FastAPI (Python 3.13 stable venv)
- **ORM:** SQLAlchemy 2.0 (async via `async_sessionmaker` and `aiosqlite` / `asyncpg`)
- **Validation:** Pydantic v2
- **Authentication:** JWT tokens (PyJWT, HS256, 24h expiration) in httpOnly cookies (`access_token`) and Bearer header fallback
- **Password Hashing:** Argon2id (`argon2-cffi`)
- **Authorization:** Role-Based Access Control (`get_current_user`, `require_roles`) with 4 distinct roles: `admin`, `staff`, `trainer`, `member`

### Structure
```
backend/
├── app/
│   ├── api/
│   │   ├── v1/
│   │   │   ├── auth.py
│   │   │   ├── members.py
│   │   │   ├── memberships.py
│   │   │   ├── visits.py
│   │   │   ├── classes.py
│   │   │   ├── personal_training.py
│   │   │   ├── analytics.py
│   │   │   ├── predictions.py
│   │   │   └── retention.py
│   │   └── router.py
│   ├── core/
│   │   ├── config.py       (environment variables, settings)
│   │   ├── security.py     (JWT, password hashing)
│   │   └── database.py     (SQLAlchemy engine, session)
│   ├── models/             (SQLAlchemy ORM models)
│   ├── schemas/            (Pydantic request/response models)
│   ├── services/           (business logic layer)
│   ├── middleware/         (CORS, rate limiting, logging)
│   └── main.py
├── tests/
├── alembic/               (database migrations)
├── requirements.txt
└── .env.example
```

### API Versioning
- All routes under `/api/v1/`
- Future breaking changes increment to `/api/v2/`

### CORS Policy
- Restricted to known frontend origin(s) only
- No wildcard `*` in production

---

## 4. Database Architecture

### Technology
- **Database:** PostgreSQL
- **Connection Pooling:** SQLAlchemy async engine with pool settings
- **Migrations:** Alembic

### Planned Tables (created incrementally by phase)

| Table | Phase | Description |
|-------|-------|-------------|
| `users` | Phase 3 | Authentication accounts, roles |
| `members` | Phase 4 | Gym member profiles |
| `memberships` | Phase 4 | Membership plans and assignments |
| `visits` | Phase 5 | Check-in records |
| `classes` | Phase 5 | Class schedule and types |
| `class_bookings` | Phase 5 | Member class bookings |
| `personal_training_sessions` | Phase 5 | PT session records |
| `raw_transactions` | Phase 6 | Raw ingested gym data |
| `processed_customers` | Phase 6 | Feature-engineered member records |
| `predictions` | Phase 6 | Churn probability outputs |
| `retention_strategies` | Phase 7 | AI-generated retention content |

### Database Security Rules
- Parameterized queries only (ORM-enforced)
- Least-privilege database roles
- Connection pooling configured (min/max pool size)
- Alembic for all schema changes — no manual DDL in production

---

## 5. Data Pipeline Architecture

```
Raw CSV / JSON Input
       ↓
  Pandera Validation
       ↓
  Python Ingestion Scripts
       ↓
  raw_transactions (PostgreSQL)
       ↓
  Pandas / Polars Data Cleaning
       ↓
  Feature Engineering
       ↓
  Customer-Level Features:
  - visit_frequency
  - class_bookings
  - days_since_last_checkin
  - membership_tenure
  - personal_training_sessions
  - total_revenue
  - recent_activity
       ↓
  processed_customers (PostgreSQL)
       ↓
  ML Training Dataset
```

### Scripts Location
```
scripts/
├── ingest_data.py
├── validate_data.py
├── clean_data.py
├── engineer_features.py
└── train_model.py
```

---

## 6. Machine Learning Architecture

```
processed_customers
       ↓
  Train / Test Split
       ↓
  scikit-learn Pipeline
  (preprocessing + XGBoost classifier)
       ↓
  Trained Model → data/models/churn_model.pkl
       ↓
  Churn Probability Score
       ↓
  Risk Tier Assignment:
  - HIGH:   probability > 0.70
  - MEDIUM: 0.40 < probability ≤ 0.70
  - LOW:    probability ≤ 0.40
       ↓
  predictions (PostgreSQL)
       ↓
  Risk Factor Analysis:
  - Top risk features
  - Engagement metrics
  - Recent behavioral changes
  - Customer value metrics
  - Customer tenure
```

### Model Persistence
- Saved to `data/models/churn_model.pkl`
- Model version tracked in predictions table
- Never retrained automatically without explicit trigger

---

## 7. AI / Generative Architecture (Phase 7)

```
predictions (for a member)
       ↓
  Risk Factor Analysis JSON
       ↓
  Gym Context + Industry Context
       ↓
  Structured Retention Prompt (server-side)
       ↓
  OpenAI GPT-4o-mini API (server-side only)
       ↓
  Generated Retention Strategy (text)
       ↓
  Response Validation + Sanitization
       ↓
  retention_strategies (PostgreSQL)
       ↓
  FastAPI → React Dashboard
```

### AI Security Rules
- OpenAI API key NEVER leaves the server
- Minimal member data in prompt (no passwords, tokens, or unnecessary PII)
- Generated output treated as untrusted content
- Output sanitized before storage and display
- Rate limiting applied to AI endpoints
- Retry + timeout handling on OpenAI calls

---

## 8. Authentication & Authorization Architecture

### Authentication Strategy
- JWT-based authentication
- Tokens delivered via `httpOnly` secure cookies (not localStorage)
- CSRF protection for cookie-based auth
- Session expiration enforced server-side

### Role Definitions
| Role | Description | Access |
|------|-------------|--------|
| `admin` | Full system access | All routes |
| `staff` | Day-to-day operations | Members, visits, classes, PT |
| `member` | Self-service portal | Own profile, bookings (Phase future) |

### Authorization Rules
- All admin routes protected server-side — frontend role checks are supplementary only
- Object ownership verified before any data mutation
- Deny-by-default: routes require explicit permission grants

---

## 9. Security Architecture

### Applied Throughout All Phases
- Parameterized SQL / ORM queries
- Pydantic input validation on all request bodies
- CORS narrowly configured
- Secure HTTP headers (X-Content-Type-Options, X-Frame-Options, HSTS)
- Secrets in environment variables only — never committed to Git
- `.env` files in `.gitignore`
- No sensitive data in logs
- Rate limiting on auth endpoints, AI endpoints, public forms
- Argon2/bcrypt for password hashing
- File upload validation (type, size, name, content)

---

## 10. Directory Structure

```
C:\Users\Administrator\Documents\The_D_gym\
├── .agents/
│   ├── AGENTS.md
│   └── skills/
├── assets/
│   └── logos/
│       ├── thedgym.png       (transparent, dark background version)
│       └── thedgym2.png      (full black bg lockup)
├── frontend/                  (Phase 1+)
├── backend/                   (Phase 3+)
├── data/
│   ├── raw/
│   ├── processed/
│   └── models/
├── scripts/                   (Phase 6+)
├── docs/
│   ├── ARCHITECTURE.md        ← this file
│   ├── PROJECT_PLAN.md
│   ├── DESIGN_SYSTEM.md
│   ├── PHASE_LOG.md
│   ├── TEST_REPORT.md
│   ├── SECURITY_NOTES.md
│   └── PERFORMANCE_NOTES.md
├── tests/                     (Phase 4+)
├── DESIGN.md
├── README.md
├── .env.example
└── .gitignore
```

---

## 11. API Boundary Map

| Frontend Need | FastAPI Endpoint | Backend Service |
|--------------|-----------------|-----------------|
| Public site data | Static/none | — |
| Login / Register | `POST /api/v1/auth/login` | AuthService |
| Members list | `GET /api/v1/members` | MemberService |
| Member detail | `GET /api/v1/members/{id}` | MemberService |
| Visits / check-ins | `GET/POST /api/v1/visits` | VisitService |
| Class bookings | `GET/POST /api/v1/bookings` | ClassService |
| PT sessions | `GET/POST /api/v1/pt-sessions` | PTService |
| Analytics dashboard | `GET /api/v1/analytics/summary` | AnalyticsService |
| Churn predictions | `GET /api/v1/predictions` | PredictionService |
| Retention strategies | `GET/POST /api/v1/retention` | RetentionService |
| Reports / Export | `GET /api/v1/reports/export` | ReportService |
