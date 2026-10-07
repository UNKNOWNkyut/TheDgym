# AGENTS.md — THE DGYM Project Rules

> This file is the permanent rule set for all AI agents working on this project.
> It must be read and followed at the start of every session.

---

## Project Identity

- **Project Name:** THE DGYM
- **Project Root:** `C:\Users\Administrator\Documents\The_D_gym`
- **Logo Directory:** `assets/logos/`
- **Logo Files:** `thedgym.png` (transparent), `thedgym2.png` (black bg)
- **Brand Primary Color:** `#E5201A` (red)
- **Facebook:** https://www.facebook.com/p/The-DGym-61577109742790/

---

## Non-Negotiable Rules

### 1. PHASED DEVELOPMENT
- Build ONE phase at a time
- NEVER implement future-phase features
- STOP after every phase and wait for human approval

### 2. LOGOS
- NEVER replace, redraw, or AI-generate the brand logo
- Use `thedgym.png` on dark web backgrounds
- Use `thedgym2.png` for icon/print contexts
- Preserve aspect ratio always

### 3. NO FABRICATION
- NEVER invent business data (address, phone, email, hours, pricing, services)
- NEVER generate fake testimonials, reviews, statistics, awards
- Use `[PLACEHOLDER]` markers for unverified content

### 4. TECHNOLOGY STACK
- Frontend: React + Vite + TypeScript + Tailwind CSS + GSAP + Lenis
- Backend: Python + FastAPI + SQLAlchemy + PostgreSQL
- ML: scikit-learn + XGBoost
- AI: OpenAI GPT-4o-mini (server-side only)
- NO Streamlit. NO Bootstrap. NO Framer Motion. NO Material UI.

### 5. ANIMATIONS
- Always use `useGSAP()` hook (never raw `useEffect` for animations)
- Always register plugins: `gsap.registerPlugin(ScrollTrigger)`
- Animate `transform` and `opacity` only — never layout properties

### 6. SECURITY
- JWT tokens in httpOnly cookies (not localStorage)
- All admin authorization enforced server-side
- OpenAI API key never leaves the server
- No secrets committed to Git

### 7. DATABASE
- Frontend → FastAPI → PostgreSQL (never direct DB from frontend)
- Parameterized queries / ORM only
- Risk thresholds: HIGH >0.70, MEDIUM 0.40–0.70, LOW ≤0.40

### 8. DOCUMENTATION
- Every phase must update: PHASE_LOG.md, TEST_REPORT.md
- Security changes → SECURITY_NOTES.md
- Performance changes → PERFORMANCE_NOTES.md

### 9. COPY RULES
- No em dashes in website copy
- No generic AI phrases ("Transform your...", "Unlock...", "Revolutionize...")
- No fake social proof
- One idea per section

### 10. MANDATORY STOP
After every phase:
```
PHASE COMPLETE
Implemented: [summary]
Files changed: [list]
Testing: [list]
Debugging: [list]
Security: [list]
Performance: [list]
Known issues: [list]
Next phase: [phase name]
STATUS: WAITING FOR HUMAN APPROVAL
```

---

## Phase Status Summary

| Phase | Status |
|-------|--------|
| 0 - Discovery + Architecture | ✅ COMPLETE |
| 1 - Frontend Foundation | ⏳ PENDING APPROVAL |
| 2 - Public Website | ⏳ PENDING |
| 3 - Auth + Roles | ⏳ PENDING |
| 4 - Core Management | ⏳ PENDING |
| 5 - Visits / Classes / PT | ⏳ PENDING |
| 6 - Analytics + ML | ⏳ PENDING |
| 7 - AI Retention | ⏳ PENDING |
| 8 - Security + Performance | ⏳ PENDING |
| 9 - QA | ⏳ PENDING |
| 10 - Deployment | ⏳ PENDING |
