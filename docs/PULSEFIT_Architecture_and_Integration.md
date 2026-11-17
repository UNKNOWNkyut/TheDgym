# PULSEFIT / The DGym — System Architecture & System Integration Documentation

**Research Deliverable — PULSEFIT Integrated Gym Operations, Biometric Access & Churn Analytics Platform**

---

## 1. System Architecture Overview

PULSEFIT / The DGym adopts a **4-Tier Hybrid Client–Server and Event-Driven Architecture** combining a decoupled React Single Page Application (SPA), an asynchronous Python FastAPI application backend, a composite-indexed PostgreSQL relational data tier, and external cloud/hardware service gateways.

### 1.1 Architectural Tiers & Actors

- **Primary Actors:**
  - **Administrator (`/manage/*`):** Full governance over members, plans, users, finance/expenses, ML churn analytics, notifications, and system-wide immutable audit logs (`/manage/audit`).
  - **Front-Desk Staff (`/manage/scanner`):** Real-time NFC keycard tap verification, manual check-in/check-out, and counter payment confirmation.
  - **Coach / Trainer (`/dashboard`):** 1-on-1 PT agenda, request approval/rejection, class rosters, and the **Client Progress Report Modal** tracking assigned workout/meal plans, progressive overload metrics (`sets × reps × weight`, RPE/RIR, rest intervals), body composition measurements, resting heart rate, and attendance consistency streaks.
  - **Registered User vs. Active Member (`UserRole.USER` / `UserRole.MEMBER`):** Newly registered visitors start with restricted `user` privileges (`/dashboard`, `/membership`, `/payment`, `/settings`) without appearing in the active facility roster and are denied coaching/class reservations (`403 Forbidden`) until payment confirmation promotes their account to `member`. Expired passes—including exact 24-hour Day Passes—automatically demote lapsed members back to `user`.
  - **Hardware / Mobile NFC Terminal:** Android Chrome Web NFC (`NDEFReader`) or USB HID RFID scanner authenticated via either a Staff HttpOnly JWT session or an `X-Scanner-API-Key` header.

- **Presentation Tier (React 19 + Vite + TypeScript + Tailwind CSS + GSAP):**
  - Role-guarded routes (`ProtectedRoute`), HttpOnly cookie authentication (`withCredentials`, CSRF `X-Requested-With` enforcement), interactive workout/nutrition planners (`YourPlanPage` synced to `/api/progress/me/plan`), and real-time WebSocket alert subscribers (`NotificationBell`, `LiveKeycardMonitor`).

- **Application & Security Tier (FastAPI Async + Middleware):**
  - Security middleware enforcing origin-checked CORS, CSP/HSTS headers, database-backed rate limits (`RateLimitHit`), and token revocation (`RevokedToken`).
  - Domain routers cleanly separated from service modules (`membership_activation.py`, `access_service.py`, `audit.py`, `pagination.py`, `churn_ml.py`, `visit_sweeper.py`).
  - **Background Lifecycle Sweeper (`lifespan` 60-second interval):** Automatically checks out overdue open visits and expires elapsed memberships (including 24h Day Passes), demoting lapsed members to `user`.
  - **System-Wide Audit Logger (`audit.py`):** Captures actor ID, email, role, standardized action code, resource target, proxy-aware client IP, user-agent, outcome (`SUCCESS` / `DENIED` / `FAILED`), and UTC timestamp with automatic sensitive-token redaction.
  - **Deterministic `limit + 1` Pagination & In-Memory TTL Read Cache (`pagination.py`):** Uses `(timestamp DESC, id DESC)` tie-breakers and `limit + 1` slicing (`has_next = len(rows) > limit`) to eliminate expensive `SELECT COUNT(*)` full-table scans, backed by a 15-second prefix-invalidated in-memory TTL cache without requiring external Redis infrastructure.

- **Data Persistence Tier (PostgreSQL 16 + SQLAlchemy 2.0 Async + Composite Indexes):**
  - Stores core identity, biometrics, memberships, visits, PT/class schedules, training plans, client progress metrics, and immutable audit trails with composite indexes (`(created_at, id)`, `(joined_at, id)`, `(checked_in_at, id)`, `(tapped_at, id)`), partial unique indexes for active open visits and idempotent payment references.

---

## 2. System Integration Architecture

PULSEFIT integrates internal analytical modules, browser hardware APIs, and third-party cloud platforms using four distinct integration patterns:

1. **API-Based Synchronous REST/JSON Integration:**
   - The React SPA communicates over HTTPS with FastAPI Pydantic-validated JSON endpoints (`application/json` + HttpOnly cookies). FastAPI asynchronously calls external REST APIs via `httpx`: **Xendit** (`POST /v2/invoices`), **OCR.space** (ID text extraction), **Face++** (`compare` ID-to-selfie confidence scoring), **Google OAuth 2.0** (token info), and **TextBee SMS Gateway** (`POST /api/v1/gateway/devices/{id}/send-sms`).
2. **Event-Driven Asynchronous Webhooks & WebSockets (`->` / `<->`):**
   - Payment completion events arrive asynchronously from Xendit via signed callbacks (`POST /api/payments/webhook/xendit`, verified via constant-time `x-callback-token` HMAC comparison). Upon `PAID`, FastAPI atomically activates the membership, promotes `UserRole.USER -> UserRole.MEMBER`, records an audit log (`actor_role="system"`), persists Admin notifications, and pushes a live WebSocket event over `/api/access/ws/live-feed`.
3. **Embedded In-Process ML Inference (`XGBoost JSON + Scaler`):**
   - Rather than deploying a separate external ML microservice with network serialization overhead, PULSEFIT executes deterministic XGBoost inference directly inside Python using validated JSON model artifacts (`churn_model.json`, `scaler.json`), computing behavioral features from PostgreSQL `visits`, `member_memberships`, `pt_sessions`, and `class_enrollments` tables (`churn_pipeline.py`).
4. **Browser Hardware & Media Integration (`Web NFC` & `WebRTC MediaDevices`):**
   - **Web NFC (`NDEFReader`):** Mobile Reception terminals read physical NTAG/MIFARE tag serial numbers (`serialNumber`) natively in Chrome and dispatch `POST /api/access/tap` to run sub-50ms card verification, visit open/close recording, and WebSocket gate display broadcasts.
   - **MediaDevices (`getUserMedia`) & Local `face-api.js`:** Captures live camera frames for biometric liveness and 128-dimension face descriptor extraction during Step-1 registration and Step-2 2FA challenge verification.
