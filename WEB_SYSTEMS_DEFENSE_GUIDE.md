# PULSEFIT / The DGym — Web Systems Defense Guide (Tagalog / Taglish)

> **Live-Defense Cheat Sheet** para sa Web Systems and Technologies. Lahat ng file paths at line numbers dito ay naka-verify sa kasalukuyang codebase (pagkatapos linisin ang horizontal-line comments) para madaling buksan sa VS Code habang sumasagot sa professor.

---

## 1. Role Ko sa System at Mga Naiambag (`Backend Developer`)

Kung tatanungin ng professor: *"Ano ang role mo at mga ambag mo sa paggawa ng system?"* — **ako ang Backend Developer ng PULSEFIT / The DGym**. Ako ang nag-design at nag-implement ng core server-side architecture, database, security, payment/SMS/NFC integrations, AI analytics pipeline, automated tests, at production deployment ng system.

### 1.1 FastAPI REST API & Routing Architecture
Ako ang gumawa ng main FastAPI application entry point, security middlewares, exception handling, at lahat ng 15 mounted router instances (mula sa 14 router modules) sa backend:
- **App Entry Point & Middleware:** [backend/app/main.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L228-L393)
  - Naka-mount dito ang 15 `APIRouter` instances (`L372-L386`) at health check endpoint `@app.get("/api/health")` (`L393`).
  - May built-in CSRF header guard (`_requires_csrf_header` sa `L228`, enforced sa `L261`), `Permissions-Policy: camera=(self)...` (`L297`), Content-Security-Policy (`_SPA_CSP`, `L196`, stamped sa `L310`), global exception handler (`L334`), at sanitized vendor errors ([auth.py#L259-L284](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L259-L284), [payments.py#L296-L301](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L296-L301)) para hindi mag-leak ang raw stack traces o API keys.
- **API Routers (`backend/app/routers/`):**
  - [auth.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L70) (`/api/auth`) — Register (`L366`), Login (`L491`), Google auth (`L551`), Biometric providers (`L676`), Cloud OCR (`L698`), Face verify (`L730`), First-login enroll (`L869`), Avail plan (`L944`), Logout (`L1041`), Me (`L1061`).
  - [account.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/account.py#L27-L28) (`/api/account` at `uploads_router` `/api/uploads`) — Profile updates at profile picture uploads (`L133`, `L312`, `L390`).
  - [users.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/users.py#L15-L30) (`/api/users`) — User listing (`L18`) at Audit logs (`L30`).
  - [members.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/members.py#L36) (`/api/members`) — List (`L125`), Stats (`L161`), Detail (`L173`), Create (`L197`), Update (`L265`), Deactivate (`L337`), Hard-delete (`L375`), Reactivate (`L444`).
  - [membership_plans.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/membership_plans.py#L32-L225) (`/api/plans` sa `L37-L106` at `/api/memberships` sa `L141-L225`) — Plans catalog at member subscriptions.
  - [visits.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/visits.py#L18-L228) (`/api/visits`) — Check-in (`L101`), Checkout (`L165`), List (`L186`), Member history (`L228`).
  - [class_sessions.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/class_sessions.py#L21-L386) (`/api/classes`) — Class CRUD (`L125-L223`) at enrollment (`L337-L386`).
  - [pt_sessions.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/pt_sessions.py#L25-L450) (`/api/pt-sessions`) — Trainers (`L104`), Book (`L163`), My bookings (`L213`), Cancel/Approve/Reject (`L240-L304`), Staff CRUD (`L337-L450`).
  - [finance.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L43-L425) (`/api/finance`) — Expense categories (`L107-L188`), Expenses (`L201-L322`), Summary (`L335`), at Annual breakdown (`L425`).
  - [analytics.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/analytics.py#L59-L360) (`/api/analytics` sa `L59` at `/api/churn` sa `L186`, `L220`, `L297`, `L355`) — Dashboard KPIs, churn overview, at AI model retrain.
  - [retention.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/retention.py#L29-L188) (`/api/retention`) — Generate strategy (`L59`), Get member strategy (`L165`), at Dispatch offer (`L183`).
  - [notifications.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/notifications.py#L18-L189) (`/api/notifications`) — List (`L64`), Clear/Delete (`L84-L99`), Read (`L124-L151`), SMS status (`L178`), SMS test (`L189`).
  - [access_control.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L56-L486) (`/api`) — Pairing (`L104-L135`), Tap (`L144-L168`), WebSocket live feed (`L216`), Logs (`L290`), Keycards (`L345-L420`), Scanners (`L467-L486`).
  - [payments.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L47-L523) (`/api/payments`) — Create checkout (`L203`), Xendit webhook (`L326`), Verify invoice (`L418`), Gateway status (`L515`).
- **Strict Pydantic Validation:** Lahat ng request/response payloads ay may strict schemas (`extra="forbid"`) sa 9 modules ng `backend/app/schemas/`: `auth.py`, `account.py`, `gym.py`, `finance.py`, `analytics.py`, `retention.py`, `access_control.py`, `training_and_visits.py`, at `common_types.py`.

### 1.2 PostgreSQL Database & SQLAlchemy Async ORM
Ako ang nag-design ng relational database schema, async connection pooling, at startup migrations:
- **Async Engine & URL Normalization:** [backend/app/database.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/database.py#L12-L91)
  - `prepare_async_database_config` (`L12-L55`): Awtomatikong kino-convert ang Neon/Render `postgres://` o `postgresql://` URL papuntang `postgresql+asyncpg://`, nililipat ang `sslmode` sa `connect_args["ssl"]`, tinatanggal ang `channel_binding`, at dini-disable ang `statement_cache_size` (`L51-L52`) kapag gumagamit ng PgBouncer (`-pooler.`).
  - Naka-setup dito ang `engine = create_async_engine` (`L70`), `AsyncSessionLocal` (`L73-L79`), `Base` (`L81`), at `get_db()` dependency (`L84-L91`).
- **21 SQLAlchemy ORM Models (`backend/app/models/`):**
  - Core Auth & Users: `user.py`, `user_biometric.py`, `user_profile.py`, `revoked_token.py`, `audit_log.py`
  - Gym Operations & Access: `member.py`, `membership_plan.py`, `member_membership.py`, `member_keycard.py`, `keycard_tap_log.py`, `access_scanner.py`, `visit.py`, `class_session.py`, `pt_session.py`
  - Finance, AI & Retention: `expense.py`, `expense_category.py`, `raw_transaction.py`, `processed_customer.py`, `prediction.py`, `retention_strategy.py`, `notification.py`
- **Startup Migrations:** [backend/app/database_migrations.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/database_migrations.py#L8-L55)
  - `run_startup_column_migrations` (`L8-L55`) ay idempotent startup migration na nagdadagdag ng bagong columns/indexes gaya ng `visits.entry_method`, `visits.keycard_id`, `visits.scanner_id`, `uq_visits_member_active_open`, `uq_member_memberships_payment_reference_nonempty`, at `users.tokens_valid_after` nang hindi nasisira ang existing database data.

### 1.3 Authentication, Security & Biometric Verification
Ako ang nag-implement ng defense-in-depth security layer ng backend:
- **Password Hashing & Anti-Enumeration:** [backend/app/core/security.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/security.py#L15-L49)
  - Gumagamit ng Argon2id `PasswordHasher` (`L15`), `hash_password` (`L31-L33`), at `verify_password` (`L36-L49`) na may `_DUMMY_ARGON2_HASH` (`L18`) para pareho ang oras ng response kahit hindi nag-e-exist ang email (iwas timing attack).
- **JWT Session & Persistent Revocation:** [backend/app/core/security.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/security.py#L52-L275)
  - `create_access_token` (`L52-L75`) at `decode_access_token` (`L121-L150`) na may `jti`, `iss`, `aud`, `iat`, `exp`.
  - Stateful token revocation kapag nag-logout o nag-reset ng password: `revoke_token` (`L78-L109`), `persist_revoked_token` (`L205-L232`), `persist_user_session_revocation` (`L235-L244`), at `is_session_revoked_in_db` (`L247-L274`).
  - Naka-set sa `HttpOnly; SameSite=Lax` cookie ([auth.py#L340-L359](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L340-L359)) para hindi manakaw ng JavaScript (XSS).
- **Role-Based Access Control (RBAC):** [backend/app/core/deps.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/deps.py#L30-L115)
  - `resolve_authenticated_user` (`L30-L79`), `get_current_user` (`L80-L100`), at `require_roles` (`L102-L115`) na nag-e-enforce ng `UserRole` (`admin`, `staff`, `trainer`, `member` sa [user.py#L8-L12](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/models/user.py#L8-L12)).
- **Persistent Rate Limiting:** [backend/app/core/rate_limit.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/rate_limit.py#L19-L198)
  - `resolve_client_ip` (`L19`), `_check_persistent_bucket` (`L99-L144`), `require_rate_limit` (`L161-L186`), at pre-configured limiters (`rate_limit_auth`, `rate_limit_sensitive`, `rate_limit_ai`, `rate_limit_ocr_burst`, `rate_limit_ocr_hourly`, `rate_limit_ocr_global_daily`, `L190-L197`).
- **2-Step Face Verification & ID OCR Backend:**
  - Challenge & verify endpoints sa [auth.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L168-L339) at `L491-L944`, short-lived single-use `face_2fa` tokens (`create_face_challenge_token` sa [security.py#L153-L166](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/security.py#L153-L166) at `decode_face_challenge_token` `L169`).
  - Biometric math at privacy: Euclidean distance thresholds (`FACE_LOGIN_MATCH_THRESHOLD = 0.55` sa `L14`, `ID_SELFIE_MATCH_THRESHOLD = 0.62` sa `L16`, `euclidean_distance` sa `L54`) at keyed ID hashing gamit `BIOMETRIC_HMAC_SECRET` (`mask_and_hash_id_number` `L75`, `build_biometric_record` `L95`) sa [biometrics.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/biometrics.py#L14-L125), plus cloud OCR & Face++ (`extract_id_text_ocr_space` `L91`, `compare_faces_facepp` `L138` sa [external_vision.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/external_vision.py#L91-L180)).

### 1.4 Third-Party & Hardware Integrations
Ako ang nag-integrate ng external APIs at real-time hardware workflows sa backend:
- **Xendit Payment Gateway:** [payments.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L121-L523), [xendit_service.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/xendit_service.py#L54-L228), [membership_activation.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/membership_activation.py#L38-L135)
  - Invoice creation (`create_checkout_session` `L203-L323` -> `create_xendit_invoice` `L75-L153`), asynchronous webhook na may `hmac.compare_digest` verification sa `x-callback-token` at amount check (`xendit_webhook` `L326-L415`), status fallback (`verify_checkout_status` `L418-L510`, `get_xendit_invoice` `L156-L188`), at atomic activation (`_activate_membership_from_xendit` `L121-L200` -> `activate_member_and_notify_on_payment` `L97`).
- **TextBee SMS Gateway:** [sms_service.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/sms_service.py#L33-L248), [notifications.py#L178-L214](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/notifications.py#L178-L214), [retention.py#L183](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/retention.py#L183)
  - Nagpapadala ng HTTP POST sa `TEXTBEE_API_BASE` (`L33`) via `send_sms` (`L94-L150`) at `notify_retention_offer_sms` (`L225-L248`), may E.164 normalization (`normalize_ph_e164` `L84`), at `AUTO_SMS_ENABLED` cost guard (`is_auto_sms_enabled` `L53-L58`).
- **Web NFC Scanner & WebSockets:** [access_control.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L63-L290)
  - Dual-auth NFC check-in endpoints (`authenticate_tap_caller` `L63`, `POST /api/access/tap` `L144`, `POST /api/access/webhook-tap` `L168`) at Origin-validated Cookie-auth WebSocket feed (`WS /api/access/ws/live-feed` `L216-L289`) na nakakonekta sa `LiveFeedConnectionManager` ([access_service.py#L98-L130](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/access_service.py#L98-L130)).

### 1.5 AI Churn Prediction & Analytics Engine
Ako ang nag-integrate ng Machine Learning churn model at backend aggregation queries:
- **XGBoost + StandardScaler Scoring:** [churn_ml.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/churn_ml.py#L32-L252)
  - Gumagamit ng JSON-only model artifacts (`churn_model.json`, `scaler.json` sa halip na unsafe `.pkl` files) at nag-e-expose ng `train_baseline_model` (`L96`) at `predict_churn_batch` (`L238`).
- **Feature Engineering Pipeline:** [churn_pipeline.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/churn_pipeline.py#L27-L215)
  - `_compute_features_for_members` (`L27`) ay kumukuha ng SQL features mula sa `visits`, `class_enrollments`, `pt_sessions`, at `member_memberships`, at ina-update ang predictions via `_refresh_predictions` (`L121`, gamit ang `await asyncio.to_thread(predict_churn_batch, ...)` sa `L133`), `refresh_member_churn_prediction` (`L183`), at `refresh_all_predictions` (`L195`).
- **Dashboard KPI & Finance Aggregations:** [overview_kpis.py#L49-L88](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/overview_kpis.py#L49-L88) (`period_bounds` `L49`, `compute_overview_kpis` `L88`), [analytics.py#L59-L382](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/analytics.py#L59-L382), at [finance.py#L335-L515](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L335-L515).

### 1.6 Testing, CI/CD & Production Deployment
Ako rin ang nag-setup ng backend verification suites, GitHub Actions CI, at deployment configs:
- **5 Verification Test Suites (2,125 total lines):**
  - [backend/verify_config.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/verify_config.py) (271 lines) — Config & fail-closed production checks.
  - [backend/verify_biometric_auth.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/verify_biometric_auth.py) (573 lines) — Face embedding, OCR, at 2-step auth tests.
  - [backend/verify_security_and_scale.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/verify_security_and_scale.py) (424 lines) — RBAC, JWT revocation, CSRF, at rate limit tests.
  - [backend/verify_gym_workflows.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/verify_gym_workflows.py) (464 lines) — End-to-end member, visits, classes, PT, at NFC WebSocket workflows.
  - [backend/verify_xendit_payments.py](file:///C:/Users/Administrator/Documents/The_D_gym/backend/verify_xendit_payments.py) (393 lines) — Checkout, webhook signature verification, at auto-activation tests.
- **CI/CD & Deployment Configs:**
  - [.github/workflows/ci.yml](file:///C:/Users/Administrator/Documents/The_D_gym/.github/workflows/ci.yml#L1-L76) — Automated Frontend lint/tsc/build + Backend PostgreSQL 16 test run + `scripts/create_admin.py` smoke test.
  - Fail-closed startup guard `validate_settings` sa [backend/app/config.py#L138-L180](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/config.py#L138-L180).
  - Container & reverse proxy setups: [Dockerfile.render](file:///C:/Users/Administrator/Documents/The_D_gym/Dockerfile.render#L1-L54), [render.yaml](file:///C:/Users/Administrator/Documents/The_D_gym/render.yaml#L1-L43), [docker-compose.yml](file:///C:/Users/Administrator/Documents/The_D_gym/docker-compose.yml#L1-L66), at [deploy/nginx/default.conf.template](file:///C:/Users/Administrator/Documents/The_D_gym/deploy/nginx/default.conf.template#L1-L107).

---

## 2. Nasaan ang Routing at Paano Ito Gumagana?

### 2.1 Frontend Routing (React Router — SPA)
- **Main Route Table:** [frontend/src/App.tsx](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/App.tsx#L210-L368)
  - **Public Routes (`L223-L237`):** `/`, `/about`, `/membership`, `/classes`, `/trainers`, `/contact`, `/faq`, `/privacy`, `/terms`, `/login`, `/register`, `/payment` (hindi kailangan mag-login).
  - **Protected & Role-Based Routes (`L213-L220`, `L240-L367`):** `/settings` (`member`), `/dashboard` (`dashboard`, `dashboard/book`, `dashboard/plan`), `/manage` (`admin`), `/manage/members`, `/manage/visits`, `/manage/classes`, `/manage/pt-sessions`, `/manage/finance`, `/manage/expenses`, `/manage/analytics`, at `/manage/scanner` (`admin`, `staff` sa `L314`).
  - **Custom 404 Fallback:** Catch-all route `<Route path="*" element={<NotFoundPage />} />` sa [App.tsx#L236](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/App.tsx#L236) na nagpapakita ng custom 404 page kapag mali ang URL path.
- **Route Guards (Frontend Access Protection):**
  - [frontend/src/components/auth/ProtectedRoute.tsx](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/auth/ProtectedRoute.tsx#L12-L55) — Tsine-check kung authenticated ang user at kung tugma ang role niya (`allowedRoles`); kung hindi, automatic na nire-redirect sa `/login` (`L28`).
  - [frontend/src/components/layout/ManagementLayout.tsx](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/layout/ManagementLayout.tsx#L25-L150) — Layout wrapper at role-filtered sidebar navigation (`NAV_ITEMS` `L25`, `filteredNav` `L144`) para sa `/dashboard` at `/manage/*`.
- **Paano Gumagana ang Client-Side SPA Routing (at Bakit Hindi Nag-404 sa Refresh):**
  1. Kapag nag-click ang user ng link sa React app, hindi nagre-reload ang buong browser; pinapalitan lang ng React Router ang DOM at URL sa client side gamit ang Browser History API.
  2. Kapag nag-hard refresh (F5) ang user sa isang deep link tulad ng `/manage/analytics`, kailangan itong saluhin ng server para ibalik ang `index.html`:
     - **Sa Render / FastAPI Single-Container Deploy:** May SPA fallback middleware sa [backend/app/main.py#L134-L150](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L134-L150) (`_resolve_spa_file`) at `L281-L291` (`spa_file = _resolve_spa_file(...)` sa `L288`) na nagse-serve ng `index.html` para sa lahat ng non-API GET routes.
     - **Sa Nginx Deploy:** Naka-configure ang SPA `try_files $uri $uri/ /index.html;` rewrite sa [deploy/nginx/default.conf.template#L95-L96](file:///C:/Users/Administrator/Documents/The_D_gym/deploy/nginx/default.conf.template#L95-L96).

### 2.2 Backend API Routing (FastAPI `APIRouter`)
- **Router Mounting:** Lahat ng 15 `APIRouter` instances ay naka-register sa [backend/app/main.py#L372-L386](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L372-L386) + health check endpoint `@app.get("/api/health")` sa `L393`.
- **Prefix Mapping (`backend/app/routers/*.py`):**
  - `/api/auth` ([auth.py#L70](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L70)), `/api/account` & `/api/uploads` ([account.py#L27-L28](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/account.py#L27-L28)), `/api/users` ([users.py#L15](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/users.py#L15)), `/api/members` ([members.py#L36](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/members.py#L36)), `/api/plans` & `/api/memberships` ([membership_plans.py#L32-L39](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/membership_plans.py#L32-L39)), `/api/visits` ([visits.py#L18](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/visits.py#L18)), `/api/classes` ([class_sessions.py#L21](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/class_sessions.py#L21)), `/api/pt-sessions` ([pt_sessions.py#L25](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/pt_sessions.py#L25)), `/api/finance` ([finance.py#L43](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L43)), `/api/analytics` & `/api/churn` ([analytics.py#L35-L61](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/analytics.py#L35-L61)), `/api/retention` ([retention.py#L29](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/retention.py#L29)), `/api/notifications` ([notifications.py#L18](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/notifications.py#L18)), `/api` ([access_control.py#L56](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L56)), at `/api/payments` ([payments.py#L47](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L47)).
  - Bawat router method (`@router.get`, `@router.post`, `@router.patch`, `@router.delete`, `@router.websocket`) ay automatic na na-va-validate ng Pydantic schemas bago tumakbo ang Python handler.
- **Paano Nakakarating ang `/api/*` Calls mula Frontend:**
  - **Local Development:** Nire-redirect ng Vite dev proxy sa [frontend/vite.config.ts#L168-L175](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/vite.config.ts#L168-L175) ang lahat ng `/api/*` requests (HTTP at WebSocket) papuntang FastAPI backend port (`http://127.0.0.1:8000`) para walang CORS error at gumana ang cookies.
  - **Production:** Ang Nginx reverse proxy ([default.conf.template#L52-L67](file:///C:/Users/Administrator/Documents/The_D_gym/deploy/nginx/default.conf.template#L52-L67)) o same-origin FastAPI server ([main.py#L288](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L288)) ang dumidiretso ng `/api/*` papuntang Python backend bago ang SPA fallback.

---

## 3. Pag Nagulo ang Chart, Paano Aayusin? (Chart & Data Integrity)

### 3.1 Nasaan ang Mga Charts at Analytics Components?
| Dashboard / View | Frontend Component & Lines | Backend Data Source |
|---|---|---|
| **Admin Overview KPIs** | [ManageOverviewPage.tsx#L15-L53](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/manage/ManageOverviewPage.tsx#L15-L53), [OverviewKpiGrid.tsx#L65-L175](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/manage/OverviewKpiGrid.tsx#L65-L175) | [overview_kpis.py#L49-L88](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/overview_kpis.py#L49-L88) |
| **Admin Analytics & Churn Charts** | [ManageAnalyticsPage.tsx#L47-L64](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/manage/ManageAnalyticsPage.tsx#L47-L64), `L337-L475` (Hourly Bar Chart & Risk Bars) | [analytics.py#L59-L360](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/analytics.py#L59-L360) |
| **Admin Finance Charts** | [ManageFinancePage.tsx#L62-L145](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/manage/ManageFinancePage.tsx#L62-L145), `L348-L457` (`<svg viewBox="0 0 1200 240">` Net Income + Monthly Bars) | [finance.py#L335-L515](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L335-L515) |
| **Trainer Dashboard Analytics** | [TrainerDashboard.tsx#L234-L287](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/dashboard/TrainerDashboard.tsx#L234-L287), `L948` (High/Medium Risk Client Alerts) | [members.py#L161](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/members.py#L161), [analytics.py#L220](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/analytics.py#L220), [pt_sessions.py#L357](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/pt_sessions.py#L357) |
| **Member Dashboard & Plan Progress** | [DashboardPage.tsx#L157-L235](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/DashboardPage.tsx#L157-L235), `L838-L875`, [YourPlanPage.tsx#L415-L473](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/YourPlanPage.tsx#L415-L473) (Weight SVG Curve), [PlanOnboardingWizard.tsx#L181-L212](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/plan/PlanOnboardingWizard.tsx#L181-L212) | [account.py#L27](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/account.py#L27), [class_sessions.py#L140](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/class_sessions.py#L140), [pt_sessions.py#L213](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/pt_sessions.py#L213) |

### 3.2 End-to-End Data Pipeline ng Charts
```text
[PostgreSQL Tables] (visits, raw_transactions, expenses, predictions, member_memberships)
       │
       ▼  SQLAlchemy Async Aggregation Queries
[FastAPI Backend] (overview_kpis.py:L88 / analytics.py:L59-L360 / finance.py:L335-L515)
       │
       ▼  Validated Pydantic JSON Response
[Frontend API Client] (frontend/src/services/api.ts:L133-L274, L631-L651)
       │
       ▼  React useState + useEffect Fetch & Data Mapping
[Chart / SVG Component] (OverviewKpiGrid, ManageAnalyticsPage, ManageFinancePage, YourPlanPage)
```

### 3.3 4-Step Troubleshooting Checklist (Kapag Nag-break o Nagmukhang Sira ang Chart)
1. **Step 1 — Data / API Shape Mismatch:**
   - Buksan ang **Browser DevTools -> Network tab** at tingnan ang JSON response galing `/api/analytics/overview`, `/api/churn/overview`, o `/api/finance/annual-breakdown`.
   - I-check kung may `null`, `NaN`, o maling date format na dumating, o kung hindi tugma ang key names ng backend Pydantic response sa inaasahan ng chart sa frontend (at kung may safe `?? 0`, `Math.max(0, ...)` o empty array `[]` fallback).
2. **Step 2 — Container & CSS Layout Sizing:**
   - Kapag blank ang chart, collapsed, o nag-o-overlap sa ibang screen sizes, i-check ang parent wrapper CSS: siguraduhing may explicit height (halimbawa `h-48`, `h-64 sm:h-72`, o `min-h-[300px]` kung may `ResponsiveContainer`), tamang `viewBox` + `preserveAspectRatio="none"` sa custom SVG ([ManageFinancePage.tsx#L359-L365](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/manage/ManageFinancePage.tsx#L359-L365)), at `min-w-0` sa flex/grid parents para hindi mag-collapse ang width.
3. **Step 3 — State & Re-render Sync:**
   - I-check ang `useEffect` dependency array sa page component ([ManageAnalyticsPage.tsx#L62](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/manage/ManageAnalyticsPage.tsx#L62), [ManageFinancePage.tsx#L62-L107](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/manage/ManageFinancePage.tsx#L62-L107)), para siguradong nagre-refetch kapag nagpalit ng `year`/`month` filter o pagkatapos ng model retrain, at may proper loading + empty state bago mag-render ang chart.
4. **Step 4 — ML / Analytics Seed & Calculation Check:**
   - Kung zero o luma lahat ng numbers, i-verify ang actual rows sa PostgreSQL at ang backend aggregation queries (`compute_overview_kpis` sa [overview_kpis.py#L88](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/overview_kpis.py#L88), `get_finance_summary` / `get_annual_finance_breakdown` sa [finance.py#L335-L515](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/finance.py#L335-L515)) o i-check kung napagana ang churn scoring pipeline ([churn_pipeline.py#L121-L215](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/churn_pipeline.py#L121-L215) at [churn_ml.py#L79-L252](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/churn_ml.py#L79-L252)).

---

## 4. Paano Nagco-connect ang Lahat ng Integrations?

### 4.1 System Connection Overview Diagram
```text
                       ┌──────────────────────────────────────────┐
                       │   React + Vite Frontend (SPA UI)         │
                       │ frontend/src/services/api.ts + BrowserHW │
                       └───────────┬───────────────────┬──────────┘
                                   │ REST + Cookie     │ WebSocket (Live Feed)
                                   ▼                   ▼
┌──────────────┐       ┌──────────────────────────────────────────┐       ┌─────────────────┐
│  Xendit API  │◄─────►│       FastAPI Backend (main.py)          │◄─────►│   PostgreSQL    │
│ (Checkout &  │HTTPS/ │  • payments.py     • auth.py             │asyncpg│  (21 ORM Models │
│  Webhooks)   │HMAC   │  • retention.py    • access_control.py   │       │   + Migrations) │
└──────────────┘       │  • analytics.py    • churn_pipeline.py   │       └─────────────────┘
                       └───────────┬───────────────────┬──────────┘
                                   │ HTTP POST         │ Distance / Face++ Check
                                   ▼                   ▼
                       ┌──────────────┐     ┌─────────────────────┐
                       │ TextBee SMS  │     │ Biometrics & ID OCR │
                       │  (SMS API)   │     │  (biometrics.py /   │
                       └──────────────┘     │ external_vision.py) │
                                            └─────────────────────┘
```

### 4.2 Detailed Integration Flows (Exact Files & Lines)

1. **Frontend <-> Backend <-> PostgreSQL:**
   - **Frontend (`frontend/src/services/api.ts`):** Ang [api.ts#L133-L205](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/services/api.ts#L133-L205) ang nagpapadala ng lahat ng `fetch` requests na may `credentials: 'include'` (`L169`, para sumama ang `HttpOnly` JWT cookie) at `X-Requested-With: XMLHttpRequest` CSRF header (`L143-L145`).
   - **Backend Auth & DB:** Dumadaan ito sa CSRF middleware ng [main.py#L228-L269](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/main.py#L228-L269), nire-resolve ang user at role sa [deps.py#L30-L115](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/core/deps.py#L30-L115), at nag-qu-query sa PostgreSQL gamit ang `AsyncSession` (`get_db` sa [database.py#L84-L91](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/database.py#L84-L91)).

2. **Xendit Payment Integration:**
   - **Checkout Creation:** Sa [PaymentPage.tsx#L161](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/PaymentPage.tsx#L161), tatawag ang frontend (`api.createPaymentCheckout` sa [api.ts#L841](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/services/api.ts#L841)) sa `POST /api/payments/create-checkout` ([payments.py#L203-L323](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L203-L323)) -> tatawagin ng backend ang `create_xendit_invoice` ([xendit_service.py#L75-L153](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/xendit_service.py#L75-L153)) at ibabalik ang Xendit hosted `invoice_url`.
   - **Webhook & Auto-Activation:** Pagkabayad ng user sa Xendit, magse-send ang Xendit ng async POST sa `POST /api/payments/webhook/xendit` ([payments.py#L326-L415](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/payments.py#L326-L415)). Bine-verify muna ng backend ang `x-callback-token` gamit ang `hmac.compare_digest` (`L343`) at paid amount (may fallback verify din sa `GET /api/payments/verify/{invoice_id}` sa `L418-L510` / `get_xendit_invoice` `L156`), saka tatawagin ang `_activate_membership_from_xendit` (`L121-L200`) -> `activate_member_and_notify_on_payment` ([membership_activation.py#L97](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/membership_activation.py#L97)) para gawing active ang membership sa PostgreSQL at mag-notify sa Admins.

3. **TextBee SMS Integration:**
   - Kapag nag-trigger ng retention message ([retention.py#L183](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/retention.py#L183)) o admin test SMS ([notifications.py#L189-L214](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/notifications.py#L189-L214)), tinatawag ng backend ang `notify_retention_offer_sms` (`sms_service.py#L225-L248`) -> `send_sms` ([sms_service.py#L94-L150](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/sms_service.py#L94-L150)) na nagpo-POST sa `TEXTBEE_API_BASE` (`L33`) gamit ang TextBee API key at device ID.

4. **ID OCR & 2-Step Face Verification / Liveness:**
   - **Camera & Extraction:** Ginagamit ng frontend ang browser `navigator.mediaDevices.getUserMedia` camera API sa [IdScannerStep.tsx#L88-L165](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/auth/IdScannerStep.tsx#L88-L165) at [FaceLivenessStep.tsx#L92-L190](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/auth/FaceLivenessStep.tsx#L92-L190) kasama ang [faceBiometrics.ts#L118-L190](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/utils/faceBiometrics.ts#L118-L190) at [phIdOcr.ts#L138-L230](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/utils/phIdOcr.ts#L138-L230) para kunin ang ID text at 128-D face descriptor vector.
   - **Backend Verification & Storage:** Ipinapasa ito sa `/api/auth` ([auth.py#L294-L339](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/auth.py#L294-L339), `L698-L943`), kinukumpara ang distance sa [biometrics.py#L14-L58](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/biometrics.py#L14-L58) (o via `compare_faces_facepp` sa [external_vision.py#L138](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/external_vision.py#L138)), hina-hash ang ID number gamit `BIOMETRIC_HMAC_SECRET` ([biometrics.py#L75-L93](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/biometrics.py#L75-L93)), at sine-save sa PostgreSQL `user_biometrics` ([user_biometric.py#L9-L55](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/models/user_biometric.py#L9-L55)).

5. **Web NFC Scanner & WebSockets (Real-Time Check-In):**
   - **Tap & Validate:** Kapag tinap ang NFC card sa [MobileScannerPage.tsx#L250-L295](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/pages/manage/MobileScannerPage.tsx#L250-L295) (`startPhoneNfcScan`, `ndef.scan`), nagpapadala ito ng request sa `POST /api/access/tap` o `POST /api/access/webhook-tap` ([access_control.py#L144-L215](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L144-L215)) para i-validate ang keycard (`process_card_tap` sa [access_service.py#L856](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/services/access_service.py#L856)) at i-log ang `Visit` sa PostgreSQL.
   - **Live Broadcast:** Pagka-save sa DB, nagbo-broadcast agad ang backend sa `WS /api/access/ws/live-feed` ([access_control.py#L216-L289](file:///C:/Users/Administrator/Documents/The_D_gym/backend/app/routers/access_control.py#L216-L289)) na nakakabit sa [LiveKeycardMonitor.tsx#L117-L145](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/manage/LiveKeycardMonitor.tsx#L117-L145), [MemberKeycardsCard.tsx#L144-L160](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/manage/MemberKeycardsCard.tsx#L144-L160), at [NotificationBell.tsx#L99-L115](file:///C:/Users/Administrator/Documents/The_D_gym/frontend/src/components/notifications/NotificationBell.tsx#L99-L115).
