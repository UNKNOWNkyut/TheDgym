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

## Phase 4 — PENDING REVIEW

## Phase 5 — PENDING REVIEW

## Phase 6 — PENDING REVIEW

## Phase 7 — PENDING REVIEW (AI integration)

## Phase 8 — DEDICATED HARDENING PHASE

## Phase 9 — PENDING REVIEW

## Phase 10 — PENDING REVIEW
