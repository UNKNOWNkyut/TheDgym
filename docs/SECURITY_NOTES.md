# SECURITY_NOTES.md — THE DGYM

> This file records security decisions, reviews, and findings per phase.

---

## Phase 0 — Architecture Security Decisions

### Authentication
- JWT tokens delivered via httpOnly secure cookies (not localStorage)
- CSRF protection required for cookie-based auth
- Argon2/bcrypt for password hashing
- Session expiration enforced server-side

### Authorization
- All admin routes protected server-side
- Frontend role checks are supplementary only — never sole enforcement
- Deny-by-default on all protected resources

### Database
- ORM-enforced parameterized queries only
- Least-privilege database roles
- No raw SQL string concatenation
- Connection pooling configured

### Secrets
- API keys and secrets in environment variables only
- `.env` files in `.gitignore`
- OpenAI API key stays server-side — never exposed to browser

### CORS
- Restricted to known frontend origin in production
- No wildcard `*` in production configuration

### AI Security
- Generated content treated as untrusted
- Sanitized before storage and display
- No secrets in AI prompts
- Rate limiting on AI endpoints

---

## Phase 1 — PENDING REVIEW

## Phase 2 — PENDING REVIEW

## Phase 3 — Authentication & RBAC Security Review
- **Password Hashing:** Argon2id (`argon2-cffi`) applied to all passwords with memory-hard work factors. Plaintext passwords never logged or stored.
- **Session Tokens:** PyJWT HS256 tokens with server-side expiration (`exp`), subject claim (`sub`), and issued-at (`iat`).
- **Token Transport:** Delivered in `httpOnly` secure cookies (`samesite="lax"`) to mitigate XSS-based token theft, alongside `Authorization: Bearer` support.
- **RBAC Enforcement:** Server-side dependency injection (`require_roles([UserRole.ADMIN, ...])`). Client role checks are purely presentational; all sensitive operations enforce 403 Forbidden at the API layer.
- **Input Sanitization:** Pydantic v2 schemas validate email format (`EmailStr`) and enforce minimum password lengths.
- **CORS:** Restricted strictly to authorized frontend development and production origins with `allow_credentials=True`.

## Phase 4–7 — Core Gym, Visits/Classes/PT, ML Analytics & AI Retention Security Review
- **Database Parameterization (Check 17):** All queries across members, plans, visits, classes, PT sessions, finance, and analytics use SQLAlchemy 2.0 ORM parameterized statements (`select()`, `where()`, `delete()`). Zero raw SQL string concatenation.
- **Role-Based Access Control (Checks 06, 07, 34):** Admin, Staff, Trainer, and Member routes are strictly separated via `require_roles(...)` dependencies on FastAPI routers.
- **BOLA / IDOR Protection (Checks 06, 33):**
  - `GET /api/visits/member/{member_id}` verifies member ownership when requested by a `MEMBER`.
  - `GET /api/pt-sessions` and `GET /api/pt-sessions/{id}` scope results strictly to the authenticated member's own record.
  - `PATCH /api/notifications/{id}/read` verifies notification ownership before marking as read.
  - `GET /api/classes` and `GET /api/classes/{id}` redact other members' enrollment PII when queried by a regular `MEMBER`.

---

## Phase 8 — Vibe-Coded App Security (70-Check Audit & Hardening) — ✅ COMPLETE

### 1. Authentication, JWT & Session Lifecycle (Checks 03, 04, 05, 25, 26, 27, 30, 63)
- **Strict JWT Claims (`backend/app/core/security.py`):** Every token includes `jti` (unique ID), `iss` (`JWT_ISSUER`), `aud` (`JWT_AUDIENCE`), `iat`, and `exp`. Decoding enforces explicit algorithm whitelisting (`[settings.ALGORITHM]`), signature, expiration, issuer, and audience verification.
- **Server-Side Token Revocation (Check 25):**
  - `POST /api/auth/logout` revokes the token's `jti` server-side in addition to clearing the `httpOnly` cookie.
  - Changing a password (`POST /api/account/change-password`), deactivating/deleting a user or member, or changing a user's role calls `revoke_user_sessions(user_id)` to immediately invalidate all previously issued tokens for that user.
- **Constant-Time Password Verification (Check 26):** `verify_password()` runs a dummy Argon2id verification when a user email is not found, eliminating timing side-channels for account enumeration.
- **Google OAuth Hardening (Check 30):** Verifies `iss` (`accounts.google.com` / `https://accounts.google.com`), `aud` (`GOOGLE_CLIENT_ID`), and `email_verified == true`.

### 2. Rate Limiting & DoS Protection (Checks 28, 43, 64)
- **Sliding-Window Rate Limiter (`backend/app/core/rate_limit.py`):**
  - `rate_limit_auth` (15 req / 60s per IP) on `/api/auth/login`, `/api/auth/register`, `/api/auth/google`.
  - `rate_limit_sensitive` (10 req / 60s per IP) on password changes, profile updates, plan availment, and destructive admin actions.
  - `rate_limit_ai` (15 req / 60s per IP) on `/api/retention/generate/{member_id}` and `/api/churn/retrain`.
- **Payload Size Limits (Check 64):** Middleware rejects requests exceeding `MAX_REQUEST_BODY_BYTES` (6 MB) with `413 Payload Too Large` before buffering.

### 3. Strict Input Validation & Mass-Assignment Prevention (Checks 16, 51, 57, 62)
- All Pydantic input schemas (`auth.py`, `gym.py`, `account.py`, `finance.py`, `phase5.py`, `retention.py`) enforce `ConfigDict(extra="forbid")`, `max_length` constraints, positive price/amount bounds, and safe internal URL validation (`action_url` must start with `/` and never `//` or `javascript:`).

### 4. File Upload Hardening (Checks 21, 22)
- `POST /api/account/profile-picture` inspects actual file **magic bytes** (`\xff\xd8\xff` for JPEG, `\x89PNG\r\n\x1a\n` for PNG, `RIFF....WEBP` for WebP) rather than trusting client-supplied `Content-Type` headers, renames files to `user_{id}_{uuid4().hex}.{ext}`, enforces a 5 MB stream cap, and serves `/api/uploads` with a restrictive `Content-Security-Policy: default-src 'none'; img-src 'self'; sandbox` header.

### 5. AI Security, Prompt Injection Defense & PII Minimization (Checks 39, 65, 66, 69)
- `backend/app/services/retention_ai.py` minimizes PII sent to OpenAI (sends only sanitized `first_name`, omitting full name, email, phone, and member code), instructs the model to treat telemetry JSON as untrusted data, caps `max_tokens=600`, and strictly validates/clamps all LLM JSON output fields (`_validate_and_sanitize_ai_output`).

### 6. HTTP Security Headers, Production Hardening & Audit Logging (Checks 10, 12, 19, 35, 42, 46)
- **Security Headers (`backend/app/main.py`):** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`, `X-XSS-Protection: 0`, and `Strict-Transport-Security` in production.
- **No Stack Trace Leaks (Check 12):** Global `@app.exception_handler(Exception)` logs redacted errors server-side and returns a generic 500 JSON message.
- **Production Hardening (Check 10):** Swagger/Redoc/OpenAPI endpoints are automatically disabled when `ENVIRONMENT=production`; Vite production sourcemaps are disabled (`sourcemap: false`); Demo quick-login buttons on `LoginPage.tsx` are gated behind `import.meta.env.DEV`.
- **Security Audit Trail (`backend/app/models/audit_log.py` & `backend/app/services/audit.py`):** Records authentication, password changes, user/member lifecycle mutations, and AI actions with automatic regex secret redaction (`GET /api/users/audit-logs`).

### 7. Non-Applicable Checks Excluded by Architecture
- **Check 08 (Firebase/Supabase/S3 Rules):** Not applicable (uses FastAPI + SQLAlchemy relational DB).
- **Check 18 (NoSQL Injection):** Not applicable (uses relational SQL with SQLAlchemy ORM).
- **Checks 31 & 59 (Payment Webhook Signatures & Idempotency):** Not applicable (no external payment webhooks).
- **Check 49 (Multi-Tenant SaaS Isolation):** Not applicable (single-gym platform; user-level isolation enforced via Checks 06 & 33).
- **Check 67 (AI Excessive Agency):** Not applicable (AI only drafts text; human Admin must review and dispatch).
- **Check 70 (GraphQL / WebSockets):** Not applicable (REST-only API).
