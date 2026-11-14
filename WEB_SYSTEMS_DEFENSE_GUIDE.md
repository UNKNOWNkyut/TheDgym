# PULSEFIT / The DGym — Web Systems Defense Guide (Tagalog / Taglish)

> **Live-Defense Cheat Sheet** para sa Web Systems and Technologies. Lahat ng file paths at line numbers dito ay naka-verify sa codebase para madaling buksan sa VS Code habang sumasagot sa professor.

---

## 1. Role Ko sa System at Mga Naiambag (`Backend Developer`)

Kung tatanungin ng professor: *"Ano ang role mo at mga ambag mo sa paggawa ng system?"* — **ako ang Backend Developer ng PULSEFIT / The DGym**. Ako ang nag-design at nag-implement ng core server-side architecture, database, security, payment/SMS/NFC integrations, AI analytics pipeline, automated tests, at production deployment ng system.

### 1.1 FastAPI REST API & Routing Architecture
Ako ang gumawa ng main FastAPI application entry point, security middlewares, exception handling, at lahat ng 15 API router modules sa backend:
- **App Entry Point & Middleware:** [backend/app/main.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L372-L393)
  - Naka-mount dito ang 15 `APIRouter` modules (`L372-L386`) at health check endpoint `@app.get("/api/health")` (`L393`).
  - May built-in CSRF header guard (`X-Requested-With`, `L264-L269`), Content-Security-Policy headers (`_SPA_CSP`, `L198-L210`), at sanitized error responses (`backend/app/routers/auth.py#L259-L284`, `backend/app/routers/payments.py#L296-L301`) para hindi mag-leak ang raw stack traces o vendor secrets.
- **API Routers (`backend/app/routers/`):**
  - [auth.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L70) (`/api/auth`) — Login, register, logout, 2-step biometric verification, session check.
  - [account.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/account.py#L27) (`/api/account` & `uploads_router` `/api/uploads`) — Profile updates at file uploads.
  - [users.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/users.py#L15) (`/api/users`) — Staff/Trainer/User management.
  - [members.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/members.py#L36) (`/api/members`) — Member CRUD at profile lookup.
  - [membership_plans.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/membership_plans.py#L32-L39) (`/api/plans` at `/api/memberships`) — Plans catalog at member subscriptions.
  - [visits.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/visits.py#L18) (`/api/visits`) — Check-in / check-out logs at active visits.
  - [class_sessions.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/class_sessions.py#L21) (`/api/classes`) — Group fitness classes at enrollment.
  - [pt_sessions.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/pt_sessions.py#L25) (`/api/pt-sessions`) — Personal training bookings.
  - [finance.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L43) (`/api/finance`) — Revenue, expenses, at financial breakdown.
  - [analytics.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/analytics.py#L35-L61) (`/api/analytics` at `/api/churn`) — Dashboard KPIs, analytics charts, at AI churn endpoints.
  - [retention.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/retention.py#L29) (`/api/retention`) — Retention campaigns at SMS triggers.
  - [notifications.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/notifications.py#L18) (`/api/notifications`) — In-app alerts at SMS tests.
  - [access_control.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L56) (`/api`) — NFC scanner check-in tap at WebSocket live feed.
  - [payments.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L47) (`/api/payments`) — Xendit checkout creation, webhook handler, at payment verification.
- **Strict Pydantic Validation:** Lahat ng request/response payloads ay may strict schemas (`extra="forbid"`) sa 9 modules ng `backend/app/schemas/`: `auth.py`, `account.py`, `gym.py`, `finance.py`, `analytics.py`, `retention.py`, `access_control.py`, `training_and_visits.py`, at `common_types.py`.

### 1.2 PostgreSQL Database & SQLAlchemy Async ORM
Ako ang nag-design ng relational database schema, async connection pooling, at startup migrations:
- **Async Engine & URL Normalization:** [backend/app/database.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/database.py#L12-L90)
  - `prepare_async_database_config` (`L12-L55`): Awtomatikong kino-convert ang Neon/Render `postgres://` o `postgresql://` URL papuntang `postgresql+asyncpg://`, nililipat ang `sslmode` sa `connect_args["ssl"]`, tinatanggal ang `channel_binding`, at dini-disable ang statement cache kapag gumagamit ng PgBouncer (`-pooler.`).
  - Naka-setup dito ang `engine = create_async_engine` (`L70`), `AsyncSessionLocal` (`L73-L79`), `Base` (`L81`), at `get_db()` dependency (`L84-L90`).
- **21 SQLAlchemy ORM Models (`backend/app/models/`):**
  - Core Auth & Users: `user.py`, `user_biometric.py`, `user_profile.py`, `revoked_token.py`, `audit_log.py`
  - Gym Operations & Access: `member.py`, `membership_plan.py`, `member_membership.py`, `member_keycard.py`, `keycard_tap_log.py`, `access_scanner.py`, `visit.py`, `class_session.py`, `pt_session.py`
  - Finance, AI & Retention: `expense.py`, `expense_category.py`, `raw_transaction.py`, `processed_customer.py`, `prediction.py`, `retention_strategy.py`, `notification.py`
- **Startup Migrations:** [backend/app/database_migrations.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/database_migrations.py#L8-L55)
  - `run_startup_column_migrations` (`L8-L55`) ay idempotent startup migration na nagdadagdag ng bagong columns/indexes gaya ng `visits.entry_method`, `visits.keycard_id`, `visits.scanner_id`, `uq_visits_member_active_open`, at `users.tokens_valid_after` nang hindi nasisira ang existing database data.

### 1.3 Authentication, Security & Biometric Verification
Ako ang nag-implement ng defense-in-depth security layer ng backend:
- **Password Hashing & Anti-Enumeration:** [backend/app/core/security.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/security.py#L15-L49)
  - Gumagamit ng Argon2id `PasswordHasher` (`L15`), `hash_password` (`L31-L33`), at `verify_password` (`L36-L49`) na may `_DUMMY_ARGON2_HASH` (`L18`) para pareho ang oras ng response kahit hindi nag-e-exist ang email (iwas timing attack).
- **JWT Session & Persistent Revocation:** [backend/app/core/security.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/security.py#L52-L274)
  - `create_access_token` (`L52-L75`) at `decode_access_token` (`L121-L150`) na may `jti`, `iss`, `aud`, `iat`, `exp`.
  - Stateful token revocation kapag nag-logout o nag-reset ng password: `revoke_token` (`L78-L109`), `persist_revoked_token` (`L205-L232`), `persist_user_session_revocation` (`L235-L244`), at `is_session_revoked_in_db` (`L247-L274`).
  - Naka-set sa `HttpOnly; SameSite=Lax` cookie ([auth.py#L343-L360](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L343-L360)) para hindi manakaw ng JavaScript (XSS).
- **Role-Based Access Control (RBAC):** [backend/app/core/deps.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/deps.py#L30-L115)
  - `resolve_authenticated_user` (`L30-L79`), `get_current_user` (`L80-L100`), at `require_roles` (`L102-L115`) na nag-e-enforce ng `UserRole` (`admin`, `staff`, `trainer`, `member` sa [user.py#L8-L12](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/models/user.py#L8-L12)).
- **Persistent Rate Limiting:** [backend/app/core/rate_limit.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/rate_limit.py#L19-L195)
  - `resolve_client_ip` (`L19`), `_check_persistent_bucket` (`L95-L144`), `require_rate_limit` (`L159-L184`), at pre-configured limiters (`rate_limit_auth`, `rate_limit_sensitive`, `rate_limit_ai`, `rate_limit_ocr_burst`, `rate_limit_ocr_hourly`, `rate_limit_ocr_global_daily`, `L188-L195`).
- **2-Step Face Verification & ID OCR Backend:**
  - Endpoints sa [auth.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L294-L340) at `L491-L944`, short-lived `face_2fa` tokens (`create_face_challenge_token` sa [security.py#L153-L166](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/security.py#L153-L166) at `decode_face_challenge_token` `L169`).
  - Biometric math at privacy: Euclidean distance verification sa [biometrics.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/biometrics.py#L14-L58) at keyed ID hashing gamit `BIOMETRIC_HMAC_SECRET` (`L75-L93`), plus optional Face++ verification (`compare_faces_facepp` sa [external_vision.py#L138](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/external_vision.py#L138)).

### 1.4 Third-Party & Hardware Integrations
Ako ang nag-integrate ng external APIs at real-time hardware workflows sa backend:
- **Xendit Payment Gateway:** [payments.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L205-L424), [xendit_service.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/xendit_service.py#L75-L191), [membership_activation.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/membership_activation.py#L97)
  - Invoice creation (`create_checkout_session` `L205` -> `create_xendit_invoice` `L75`), asynchronous webhook na may `hmac.compare_digest` verification sa `x-callback-token` at amount verification (`xendit_webhook` `L330-L420`), status fallback (`verify_checkout_status` `L424`, `get_xendit_invoice` `L156`), at auto-activation ng membership (`activate_member_and_notify_on_payment` `L97`).
- **TextBee SMS Gateway:** [sms_service.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/sms_service.py#L33-L140), [notifications.py#L191-L217](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/notifications.py#L191-L217), [retention.py#L183](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/retention.py#L183)
  - Nagpapadala ng HTTP POST sa `TEXTBEE_API_BASE` (`L33`) via `send_sms` (`L100-L140`) para sa retention campaigns at admin SMS alerts na may audit logging.
- **Web NFC Scanner & WebSockets:** [access_control.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L148-L245)
  - NFC check-in validation endpoints (`/api/access/tap` at `/api/access/webhook-tap`, `L148-L215`) at Origin-validated Cookie-auth WebSocket feed (`WS /api/access/ws/live-feed`, `L222-L245`) para sa real-time Admin monitoring.

### 1.5 AI Churn Prediction & Analytics Engine
Ako ang nag-integrate ng Machine Learning churn model at backend aggregation queries:
- **XGBoost + StandardScaler Scoring:** [churn_ml.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/churn_ml.py#L32-L238)
  - Gumagamit ng JSON-only model artifacts (`churn_model.json`, `scaler.json` sa halip na unsafe `.pkl` files) at nag-e-expose ng `train_baseline_model` at `predict_churn_batch`.
- **Feature Engineering Pipeline:** [churn_pipeline.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/churn_pipeline.py#L27-L195)
  - `_compute_features_for_members` (`L27`) ay kumukuha ng SQL features mula sa `visits`, `class_enrollments`, `pt_sessions`, at `member_memberships`, at ina-update ang predictions via `_refresh_predictions` (`L121`), `refresh_member_churn_prediction` (`L183`), at `refresh_all_predictions` (`L195`).
- **Dashboard KPI & Finance Aggregations:** [overview_kpis.py#L49-L88](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/overview_kpis.py#L49-L88) (`period_bounds` `L49`, `compute_overview_kpis` `L88`), [analytics.py#L61-L370](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/analytics.py#L61-L370), at [finance.py#L343-L510](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L343-L510).

### 1.6 Testing, CI/CD & Production Deployment
Ako rin ang nag-setup ng backend verification suites, GitHub Actions CI, at deployment configs:
- **5 Verification Test Suites (2,125 total lines):**
  - `backend/verify_config.py` (271 lines) — Config & fail-closed production checks.
  - `backend/verify_biometric_auth.py` (573 lines) — Face embedding, OCR, at 2-step auth tests.
  - `backend/verify_security_and_scale.py` (424 lines) — RBAC, JWT revocation, CSRF, at rate limit tests.
  - `backend/verify_gym_workflows.py` (464 lines) — End-to-end member, visits, classes, at PT workflows.
  - `backend/verify_xendit_payments.py` (393 lines) — Checkout, webhook signature verification, at auto-activation tests.
- **CI/CD & Deployment Configs:**
  - [.github/workflows/ci.yml](file:///C:/Users/Administrator/Documents/The_D_gym/.github/workflows/ci.yml#L1-L76) — Automated Frontend lint/tsc/build + Backend PostgreSQL 16 test run + admin smoke test.
  - Fail-closed startup guard `validate_settings` sa [backend/app/config.py#L138-L180](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/config.py#L138-L180).
  - Container & reverse proxy setups: [Dockerfile.render](file:///C:/Users/Administrator/Documents/The_D_gym/Dockerfile.render#L1-L54), [render.yaml](file:///C:/Users/Administrator/Documents/The_D_gym/render.yaml#L1-L43), [docker-compose.yml](file:///C:/Users/Administrator/Documents/The_D_gym/docker-compose.yml#L1-L66), at [deploy/nginx/default.conf.template](file:///C:/Users/Administrator/Documents/The_D_gym/deploy/nginx/default.conf.template#L1-L106).

---

## 2. Nasaan ang Routing at Paano Ito Gumagana?

### 2.1 Frontend Routing (React Router — SPA)
- **Main Route Table:** [src/App.tsx](file:///C:/Users/Administrator/Documents/The_D_gym/src/App.tsx#L204-L383)
  - **Public Routes:** `/`, `/about`, `/membership`, `/classes`, `/trainers`, `/contact`, `/login`, `/register` (hindi kailangan mag-login).
  - **Protected & Role-Based Routes:** `/admin`, `/trainer`, `/member`, `/manage/*`, at `/manage/scanner`.
  - **Custom 404 Fallback:** Catch-all route (`*`) sa dulo ng route list sa `App.tsx` na nagpapakita ng custom 404 page kapag mali o wala ang URL path.
- **Route Guards (Frontend Access Protection):**
  - [src/components/auth/ProtectedRoute.tsx](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/auth/ProtectedRoute.tsx#L12-L54) — Tsine-check kung authenticated ang user at kung tugma ang role niya; kung hindi, automatic na nire-redirect sa `/login` o sa tamang dashboard.
  - [src/components/layout/ManagementLayout.tsx](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/layout/ManagementLayout.tsx#L25-L156) — Layout wrapper at role-filtered sidebar navigation para sa `/manage/*`.
- **Paano Gumagana ang Client-Side SPA Routing (at Bakit Hindi Nag-404 sa Refresh):**
  1. Kapag nag-click ang user ng link sa React app, hindi nagre-reload ang buong browser; pinapalitan lang ng React Router ang DOM at URL sa client side gamit ang Browser History API.
  2. Kapag nag-hard refresh (F5) ang user sa isang deep link tulad ng `/manage/analytics`, kailangan itong saluhin ng server para ibalik ang `index.html`:
     - **Sa Render / FastAPI Single-Container Deploy:** May SPA fallback middleware sa [backend/app/main.py#L134-L150](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L134-L150) (`_resolve_spa_file`) at `L281-L291` na nagse-serve ng `index.html` para sa lahat ng non-API GET routes.
     - **Sa Nginx Deploy:** Naka-configure ang SPA `try_files` rewrite sa [deploy/nginx/default.conf.template#L47-L106](file:///C:/Users/Administrator/Documents/The_D_gym/deploy/nginx/default.conf.template#L47-L106).

### 2.2 Backend API Routing (FastAPI `APIRouter`)
- **Router Mounting:** Lahat ng 15 `APIRouter` modules ay naka-register sa [backend/app/main.py#L372-L386](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L372-L386) + health check endpoint sa `L393`.
- **Prefix Mapping (`backend/app/routers/*.py`):**
  - `/api/auth` (`auth.py#L70`), `/api/account` (`account.py#L27`), `/api/users` (`users.py#L15`), `/api/members` (`members.py#L36`), `/api/plans` & `/api/memberships` (`membership_plans.py#L32-L39`), `/api/visits` (`visits.py#L18`), `/api/classes` (`class_sessions.py#L21`), `/api/pt-sessions` (`pt_sessions.py#L25`), `/api/finance` (`finance.py#L43`), `/api/analytics` & `/api/churn` (`analytics.py#L35-L61`), `/api/retention` (`retention.py#L29`), `/api/notifications` (`notifications.py#L18`), `/api` (`access_control.py#L56`), at `/api/payments` (`payments.py#L47`).
  - Bawat router method (`@router.get`, `@router.post`, `@router.put`, `@router.delete`) ay automatic na na-va-validate ng Pydantic schemas bago tumakbo ang Python handler.
- **Paano Nakakarating ang `/api/*` Calls mula Frontend:**
  - **Local Development:** Nire-redirect ng Vite dev proxy sa [vite.config.ts#L168-L175](file:///C:/Users/Administrator/Documents/The_D_gym/vite.config.ts#L168-L175) ang lahat ng `/api/*` requests papuntang FastAPI backend port para walang CORS error at gumana ang cookies.
  - **Production:** Ang Nginx reverse proxy ([default.conf.template#L47-L106](file:///C:/Users/Administrator/Documents/The_D_gym/deploy/nginx/default.conf.template#L47-L106)) o same-origin FastAPI server ([main.py#L281-L291](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L281-L291)) ang dumidiretso ng `/api/*` papuntang Python backend bago ang SPA fallback.

---

## 3. Pag Nagulo ang Chart, Paano Aayusin? (Chart & Data Integrity)

### 3.1 Nasaan ang Mga Charts at Analytics Components?
| Dashboard / View | Frontend Component & Lines | Backend Data Source |
|---|---|---|
| **Admin / Staff Overview KPIs** | [ManageOverviewPage.tsx#L15-L53](file:///C:/Users/Administrator/Documents/The_D_gym/src/pages/manage/ManageOverviewPage.tsx#L15-L53), [OverviewKpiGrid.tsx#L36-L155](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/manage/OverviewKpiGrid.tsx#L36-L155) | [overview_kpis.py#L49-L88](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/overview_kpis.py#L49-L88) |
| **Admin Analytics & Churn Charts** | [ManageAnalyticsPage.tsx#L42-L69](file:///C:/Users/Administrator/Documents/The_D_gym/src/pages/manage/ManageAnalyticsPage.tsx#L42-L69), `L180`, `L337-L445` | [analytics.py#L61-L370](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/analytics.py#L61-L370) |
| **Admin Finance Charts** | [ManageFinancePage.tsx#L62-L145](file:///C:/Users/Administrator/Documents/The_D_gym/src/pages/manage/ManageFinancePage.tsx#L62-L145), `L348-L455` | [finance.py#L343-L510](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L343-L510) |
| **Trainer Dashboard Analytics** | [TrainerDashboard.tsx#L234-L287](file:///C:/Users/Administrator/Documents/The_D_gym/src/pages/TrainerDashboard.tsx#L234-L287), `L948` | `visits.py`, `class_sessions.py`, `pt_sessions.py` |
| **Member Dashboard & Plan Progress** | [DashboardPage.tsx#L37-L40](file:///C:/Users/Administrator/Documents/The_D_gym/src/pages/DashboardPage.tsx#L37-L40), `L157-L167`, `L865`, [YourPlanPage.tsx#L415-L473](file:///C:/Users/Administrator/Documents/The_D_gym/src/pages/YourPlanPage.tsx#L415-L473), [PlanOnboardingWizard.tsx#L195-L215](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/membership/PlanOnboardingWizard.tsx#L195-L215) | `members.py`, `membership_plans.py`, `visits.py` |

### 3.2 End-to-End Data Pipeline ng Charts
```text
[PostgreSQL Tables] (visits, raw_transactions, expenses, predictions, member_memberships)
       │
       ▼  SQLAlchemy Async Aggregation Queries
[FastAPI Backend] (overview_kpis.py:L88 / analytics.py:L61-L370 / finance.py:L343-L510)
       │
       ▼  Validated Pydantic JSON Response
[Frontend API Client] (src/lib/api.ts:L133-L165, L631-L660)
       │
       ▼  React useState + useEffect Fetch & Data Mapping
[Chart / SVG Component] (OverviewKpiGrid, ManageAnalyticsPage, ManageFinancePage, etc.)
```

### 3.3 4-Step Troubleshooting Checklist (Kapag Nag-break o Nagmukhang Sira ang Chart)
1. **Step 1 — Data / API Shape Mismatch:**
   - Buksan ang **Browser DevTools -> Network tab** at tingnan ang JSON response galing `/api/analytics` o `/api/finance`.
   - I-check kung may `null`, `NaN`, o maling date format na dumating, o kung hindi tugma ang key names ng backend Pydantic response sa inaasahan ng chart `dataKey` / props sa frontend (at kung may safe `?? 0` o empty array `[]` fallback).
2. **Step 2 — Container & CSS Layout Sizing:**
   - Kapag blank ang chart o nag-o-overlap sa ibang screen sizes, i-check ang parent wrapper CSS: kailangan ng explicit minimum height (halimbawa `min-h-[300px]`) para sa `ResponsiveContainer` at `min-w-0` sa flex/grid parents para hindi mag-collapse ang width sa mobile/desktop resize.
3. **Step 3 — State & Re-render Sync:**
   - I-check ang `useEffect` dependency array sa page component (halimbawa kapag nagpalit ng date filter / period selector sa `ManageAnalyticsPage` o `ManageFinancePage`, dapat nagre-refetch at hindi stale cache o race condition ang naka-render). Siguraduhing may loading state at empty-data state bago mag-render ang chart.
4. **Step 4 — ML / Analytics Seed & Calculation Check:**
   - Kung zero o luma lahat ng numbers, i-verify ang actual rows sa PostgreSQL at ang backend aggregation queries (`compute_overview_kpis` sa [overview_kpis.py#L88](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/overview_kpis.py#L88), [finance.py#L343-L510](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L343-L510)) o i-check kung napagana ang churn scoring pipeline ([churn_pipeline.py#L121-L195](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/churn_pipeline.py#L121-L195) at [churn_ml.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/churn_ml.py#L32-L238)).

---

## 4. Paano Nagco-connect ang Lahat ng Integrations?

### 4.1 System Connection Overview Diagram
```text
                       ┌──────────────────────────────────────┐
                       │   React + Vite Frontend (SPA UI)     │
                       │  src/lib/api.ts + Browser Hardware   │
                       └───────┬───────────────┬──────────────┘
                               │ REST + Cookie │ WebSocket (Live Feed)
                               ▼               ▼
┌──────────────┐       ┌──────────────────────────────────────┐       ┌─────────────────┐
│  Xendit API  │◄─────►│     FastAPI Backend (main.py)        │◄─────►│   PostgreSQL    │
│ (Checkout &  │HTTPS/ │  • payments.py   • auth.py           │asyncpg│  (21 ORM Models │
│  Webhooks)   │HMAC   │  • retention.py  • access_control.py │       │   + Migrations) │
└──────────────┘       │  • analytics.py  • churn_pipeline.py │       └─────────────────┘
                       └───────┬───────────────┬──────────────┘
                               │ HTTP POST     │ Distance / Face++ Check
                               ▼               ▼
                       ┌──────────────┐ ┌─────────────────────┐
                       │ TextBee SMS  │ │ Biometrics & ID OCR │
                       │  (SMS API)   │ │  (biometrics.py /   │
                       └──────────────┘ │ external_vision.py) │
                                        └─────────────────────┘
```

### 4.2 Detailed Integration Flows (Exact Files & Lines)

1. **Frontend <-> Backend <-> PostgreSQL:**
   - **Frontend (`src/lib/api.ts`):** Ang [api.ts#L133-L165](file:///C:/Users/Administrator/Documents/The_D_gym/src/lib/api.ts#L133-L165) ang nagpapadala ng lahat ng `fetch` requests na may `credentials: "include"` (para sumama ang `HttpOnly` JWT cookie) at `X-Requested-With: XMLHttpRequest` CSRF header.
   - **Backend Auth & DB:** Dumadaan ito sa CSRF middleware ng [main.py#L264-L269](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L264-L269), nire-resolve ang user at role sa [deps.py#L30-L115](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/deps.py#L30-L115), at nag-qu-query sa PostgreSQL gamit ang `AsyncSession` (`get_db` sa [database.py#L84-L90](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/database.py#L84-L90)).

2. **Xendit Payment Integration:**
   - **Checkout Creation:** Sa [PaymentPage.tsx#L155-L180](file:///C:/Users/Administrator/Documents/The_D_gym/src/pages/PaymentPage.tsx#L155-L180), tatawag ang frontend sa `POST /api/payments/create-checkout` ([payments.py#L205](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L205)) -> tatawagin ng backend ang `create_xendit_invoice` ([xendit_service.py#L75](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/xendit_service.py#L75)) at ibabalik ang Xendit hosted invoice URL.
   - **Webhook & Auto-Activation:** Pagkabayad ng user sa Xendit, magse-send ang Xendit ng async POST sa `POST /api/payments/webhook/xendit` ([payments.py#L330-L420](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L330-L420)). Bine-verify muna ng backend ang `x-callback-token` gamit ang `hmac.compare_digest` at ang paid amount (may fallback verify din sa `verify_checkout_status` `L424` / `get_xendit_invoice` `L156`), saka tatawagin ang `activate_member_and_notify_on_payment` ([membership_activation.py#L97](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/membership_activation.py#L97)) para gawing active ang membership at keycard sa PostgreSQL.

3. **TextBee SMS Integration:**
   - Kapag nag-trigger ng retention message ([retention.py#L183](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/retention.py#L183)) o admin test SMS ([notifications.py#L191-L217](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/notifications.py#L191-L217)), tinatawag ng backend ang `send_sms` ([sms_service.py#L100-L140](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/sms_service.py#L100-L140)) na nagpo-POST sa `TEXTBEE_API_BASE` (`L33`) gamit ang TextBee API key at device ID.

4. **ID OCR & 2-Step Face Verification / Liveness:**
   - **Camera & Extraction:** Ginagamit ng frontend ang browser `MediaDevices` camera API sa [IdScannerStep.tsx#L88-L178](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/auth/IdScannerStep.tsx#L88-L178) at [FaceLivenessStep.tsx#L92-L160](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/auth/FaceLivenessStep.tsx#L92-L160) kasama ang [faceBiometrics.ts#L118-L176](file:///C:/Users/Administrator/Documents/The_D_gym/src/lib/faceBiometrics.ts#L118-L176) para kunin ang ID text at face embedding vector.
   - **Backend Verification & Storage:** Ipinapasa ito sa `/api/auth` ([auth.py#L294-L340](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L294-L340) at `L491-L944`), kinukumpara ang distance sa [biometrics.py#L14-L58](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/biometrics.py#L14-L58) (o via `compare_faces_facepp` sa [external_vision.py#L138](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/external_vision.py#L138)), hina-hash ang ID number gamit `BIOMETRIC_HMAC_SECRET` ([biometrics.py#L75-L93](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/biometrics.py#L75-L93)), at sine-save sa PostgreSQL.

5. **Web NFC Scanner & WebSockets (Real-Time Check-In):**
   - **Tap & Validate:** Kapag tinap ang NFC card sa [MobileScannerPage.tsx#L250-L325](file:///C:/Users/Administrator/Documents/The_D_gym/src/pages/manage/MobileScannerPage.tsx#L250-L325), nagpapadala ito ng request sa `/api/access/tap` o `/api/access/webhook-tap` ([access_control.py#L148-L215](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L148-L215)) para i-validate ang keycard at i-log ang `Visit` sa PostgreSQL.
   - **Live Broadcast:** Pagka-save sa DB, nagbo-broadcast agad ang backend sa `WS /api/access/ws/live-feed` ([access_control.py#L222-L245](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L222-L245)) na nakakabit sa [LiveKeycardMonitor.tsx#L117-L132](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/manage/LiveKeycardMonitor.tsx#L117-L132), [MemberKeycardsCard.tsx#L144-L146](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/manage/MemberKeycardsCard.tsx#L144-L146), at [NotificationBell.tsx#L105-L115](file:///C:/Users/Administrator/Documents/The_D_gym/src/components/layout/NotificationBell.tsx#L105-L115).
