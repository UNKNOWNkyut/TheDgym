# PROJECT_PLAN.md — THE DGYM

> Version: 0.9.0 | Status: Phase 9 Complete | Last Updated: 2026-11-07

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

## Verified Business Information (Facebook & TDGGYM-QUESTIONNAIRES-1)

| Field | Value | Source |
|-------|-------|--------|
| Business Name | The DGym Rosario Batangas | Facebook OG metadata & Client Questionnaire |
| Street Address | 2nd Floor, Carandang St., Brgy. Namuco, Rosario, Batangas (Along the Highway, in front of Shell Gasoline Station) | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Contact Phone | `0969 483 9896` | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Customer Service Email | `tdgymcustomerservice.825@gmail.com` | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Operating Hours | Mon–Sat: `6:00 AM – 11:00 PM` • Sun: `2:00 PM – 10:00 PM` • Holidays: Depends on Holiday | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Membership Rates | Day Pass `₱400` • Monthly `₱1,999` • Student `₱1,500` • Senior/PWD `₱1,500` • Quarterly `₱5,400` • 6-Month `₱8,000` • Annual `₱13,000` (`₱1,000` renewal fee) | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Payment Methods | Cash, GCash, Bank Transfer, QR Payment, Credit Card, Debit Card | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Official Coaches | Coach Ivan (Muscle Gain), Coach Marta (Muscle Gain & TABATA), Coach Kresler (Boxing & HIIT) | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Personal Training | 12 Sessions Muscle Gain (`₱8,000`), 12 Sessions Boxing 1.5 HR (`₱8,000`), 12 Sessions Cardio Boxing (`₱4,000`) | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Group Classes | TABATA (Coach Marta) & HIIT (Coach Kresler) — Every `6:00 PM`, `₱0` (Free w/ Active Membership) | Client Questionnaire (`TDGGYM-QUESTIONNAIRES-1`) |
| Business Description | High End Premium Weightlifting, Powerlifting, Fitness Gym | Facebook OG metadata |
| Followers | 2,425+ | Facebook OG metadata |
| Facebook URL | https://www.facebook.com/profile.php?id=61577169056417 | Client-verified Facebook URL |

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
| **7** | AI Retention Strategies | ✅ COMPLETE |
| **8** | Security + Performance Hardening | ✅ COMPLETE |
| **9** | Full QA + Integration Testing | ✅ COMPLETE |
| **10** | Deployment + Documentation | ⏳ Next Phase |

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

## Client Input & Infrastructure Checklist

- [x] Full street address of The DGym (`2nd Floor, Carandang St., Brgy. Namuco, Rosario, Batangas`)
- [x] Phone number (`0969 483 9896`)
- [x] Email address (`tdgymcustomerservice.825@gmail.com`)
- [x] Operating hours (`Mon–Sat 6:00 AM – 11:00 PM`, `Sun 2:00 PM – 10:00 PM`, `Holidays: Depends on Holiday`)
- [x] Membership tiers and pricing (7 verified tiers + non-refundable & `₱1,000` annual renewal rules)
- [x] Class schedule and types offered (`6:00 PM` TABATA & HIIT — `₱0` free w/ membership)
- [x] Personal trainer names and packages (`Coach Ivan`, `Coach Marta`, `Coach Kresler` + 3 12-session PT packages)
- [ ] PostgreSQL production connection details / hosting plan
- [ ] OpenAI API key (to be provided as env variable in production)
- [ ] Deployment target (VPS, cloud provider, etc.)
