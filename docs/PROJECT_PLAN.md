# PROJECT_PLAN.md — THE DGYM

> Version: 0.1.0 | Status: Phase 0 Complete | Last Updated: 2026-10-02

---

## Project Summary

**THE DGYM** is a full-stack fitness gym management and AI-powered member retention platform.

It consists of:
1. A premium public-facing website for the gym (Lobo)
2. A management system for staff: members, memberships, visits, classes, personal training
3. A data intelligence pipeline: ingestion, cleaning, feature engineering
4. A machine learning churn prediction system (XGBoost)
5. An AI retention strategy generator (OpenAI GPT-4o-mini)

---

## Verified Business Information (from Facebook)

| Field | Value | Source |
|-------|-------|--------|
| Business Name | The DGym Rosario Batangas | Facebook OG metadata & User directive |
| Location | Rosario, Batangas | Facebook OG metadata & User directive |
| Business Description | High End Premium Weightlifting, Powerlifting, Fitness Gym | Facebook OG metadata |
| Followers | 2,425+ | Facebook OG metadata |
| Facebook URL | https://www.facebook.com/profile.php?id=61577169056417 | Client-verified Facebook URL |

**NOT VERIFIED (placeholders required):**
- Full street address
- Phone number
- Email address
- Operating hours
- Membership pricing
- Services list (beyond what logo implies)
- Staff names

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS, GSAP, Lenis |
| Backend | Python, FastAPI, SQLAlchemy (async), Pydantic v2 |
| Database | PostgreSQL |
| Data Processing | Pandas, Polars |
| Validation | Pandera (data), Pydantic (API) |
| ML | scikit-learn, XGBoost |
| AI | OpenAI GPT-4o-mini (Python SDK) |
| Auth | JWT via httpOnly cookies |
| Migrations | Alembic |

---

## Phase Roadmap

| Phase | Name | Status |
|-------|------|--------|
| **0** | Discovery, Architecture & Design System | ✅ COMPLETE |
| **1** | Frontend Design Foundation | ✅ COMPLETE |
| **2** | Public Gym Website | ✅ COMPLETE |
| **3** | Authentication + User Roles | ✅ COMPLETE |
| **4** | Core Gym Management System | ✅ COMPLETE |
| **5** | Visits, Classes & Personal Training | ✅ COMPLETE |
| **6** | Analytics + Churn Prediction | ✅ COMPLETE |
| **7** | AI Retention Strategies | ⏳ Next Phase |
| **8** | Security + Performance Hardening | ⏳ Pending |
| **9** | Full QA + Integration Testing | ⏳ Pending |
| **10** | Deployment + Documentation | ⏳ Pending |

---

## Phase 0 — Discovery Findings

### Assets Found
- `assets/logos/thedgym.png` (238 KB) — White + red transparent logo, dark background use
- `assets/logos/thedgym2.png` (188 KB) — Full lockup on black, profile/icon use

### Logo Description
- Flexing arm (white silhouette bicep icon)
- Large geometric red block letter "D"
- Bold white condensed "GYM" with smaller "THE" stacked above
- Designed for dark backgrounds

### Brand Colors Extracted from Logo
- Pure black background: `#000000`
- Accent red: approximately `#E5201A` (from the "D" letterform)
- White: `#FFFFFF` (arm silhouette, text)

### Facebook Access
- Page accessible as HTML metadata (full JS rendering not available)
- Business name, location, tagline, follower count extracted from OG meta tags
- Photographs, posts, service details, pricing NOT accessible without login
- All inaccessible information marked as placeholder — no fabrication

### Environment
| Tool | Version |
|------|---------|
| Node.js | v25.2.1 |
| npm | 11.6.2 |
| Python | 3.14.0b2 |
| pip | 26.2.1 |
| Git | 2.50.0 |

---

## Dependency Strategy

### Frontend Dependencies (Phase 1)
- `react`, `react-dom` — core
- `react-router-dom` v6 — routing
- `vite` — build tool
- `typescript` — language
- `tailwindcss`, `autoprefixer`, `postcss` — styling
- `gsap`, `@gsap/react` — animation
- `lenis` (or `@studio-freight/lenis`) — smooth scroll

### Backend Dependencies (Phase 3+)
- `fastapi` — web framework
- `uvicorn` — ASGI server
- `sqlalchemy[asyncio]` — ORM
- `asyncpg` — PostgreSQL async driver
- `alembic` — migrations
- `pydantic[email]` — validation
- `python-jose` or `PyJWT` — JWT tokens
- `argon2-cffi` — password hashing
- `slowapi` — rate limiting

### Data / ML Dependencies (Phase 6+)
- `pandas`, `polars` — data processing
- `pandera` — data validation
- `scikit-learn` — ML pipeline
- `xgboost` — classifier

### AI Dependencies (Phase 7)
- `openai` — OpenAI Python SDK

---

## Known Constraints

1. Facebook page requires login for full content — business details are unverified beyond OG meta
2. Python 3.14.0b2 is a beta release — monitor for stability issues with dependencies
3. No existing application code in the project directory — clean start
4. All address/contact/pricing fields must use verified placeholders until confirmed by client

---

## Unresolved Items (Requires Client Input)

- [ ] Full street address of The DGym (Lobo)
- [ ] Phone number
- [ ] Email address
- [ ] Operating hours (weekday/weekend)
- [ ] Membership tiers and pricing
- [ ] Class schedule and types offered
- [ ] Personal trainer names and credentials
- [ ] Any ongoing promotions or special offers
- [ ] PostgreSQL connection details / hosting plan
- [ ] OpenAI API key (to be provided as env variable)
- [ ] Deployment target (VPS, cloud provider, etc.)
