# PERFORMANCE_NOTES.md — THE DGYM

> This file records performance decisions, measurements, and findings per phase.

---

## Phase 0 — Architecture Performance Decisions

### Frontend
- Route-level code splitting via React lazy + Suspense
- GSAP animations on transform/opacity only (GPU-accelerated)
- Images: WebP format, lazy-loaded below fold, responsive srcset
- Tree shaking enabled via Vite
- Defer non-critical scripts

### Backend
- Async FastAPI + asyncpg for non-blocking I/O
- Connection pooling configured on SQLAlchemy engine
- Paginate all list endpoints
- Cache safe GET responses where appropriate
- Avoid N+1 queries (use eager loading / selectinload)

### Database
- Indexes added where justified by query patterns
- Avoid SELECT * — return only needed fields
- Paginate large result sets
- Inspect slow queries before optimization

### Performance Baseline
- To be measured in Phase 1 (frontend bundle size)
- API latency to be measured in Phase 4

---

## Phase 1 — PENDING MEASUREMENT

## Phase 2 — PENDING MEASUREMENT

## Phase 3 — Authentication Performance Measurements
- **Frontend Build Time:** 509ms with Vite v8.
- **Lazy-Loaded Route Chunks:**
  - `LoginPage-vS6Uz-kT.js`: 4.58 kB (1.94 kB gzip)
  - `RegisterPage-DuJ9fEIv.js`: 3.81 kB (1.69 kB gzip)
  - `DashboardPage-DE3iSTFi.js`: 9.60 kB (2.49 kB gzip)
- **Backend Latency:**
  - `/api/health`: < 5ms response time
  - `/api/auth/login` (Argon2 verification + JWT generation): ~40-60ms (optimal password hashing work factor)
  - `/api/users` (async SQLAlchemy query): < 15ms
- **Non-blocking I/O:** Fully async request lifecycle from FastAPI through AsyncSessionLocal.

## Phase 4 — PENDING MEASUREMENT

## Phase 5 — PENDING MEASUREMENT

## Phase 6 — PENDING MEASUREMENT

## Phase 7 — PENDING MEASUREMENT

## Phase 8 — DEDICATED PERFORMANCE HARDENING

## Phase 9 — PENDING MEASUREMENT

## Phase 10 — PENDING
