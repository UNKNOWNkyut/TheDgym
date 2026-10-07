# DESIGN.md — THE DGYM Visual Source of Truth

> Version: 0.1.0 | Status: Phase 0 Draft | Last Updated: 2026-10-02

---

## 1. Brand Identity

### Business Name
**The DGym** (stylized: THE DGYM)

### Tagline (verified from Facebook)
"Elevate your fitness journey at our Premium Fitness Gym"

### Location (verified from Facebook metadata)
Lobo *(municipality — full address is a placeholder until confirmed)*

### Social Followers (verified)
116 followers as of discovery date

### Brand Character
- Athletic, modern, premium
- Energetic without being chaotic
- Confident, structured, human
- Performance-oriented

---

## 2. Logo

### Files
| File | Description | Usage |
|------|-------------|-------|
| `assets/logos/thedgym.png` | White + red transparent version | Dark backgrounds, overlays |
| `assets/logos/thedgym2.png` | Full lockup on black background | Profile, print, standalone use |

### Logo Anatomy
- **Icon:** Flexing arm (bicep curl pose) in white silhouette
- **Letterform D:** Bold red block letter, geometric
- **GYM wordmark:** Bold white, condensed sans-serif, uppercase
- **"THE":** Smaller weight, stacked above "GYM"

### Logo Rules
- Never replace with AI-generated alternatives
- Never redraw, distort, or recolor the logo
- Preserve aspect ratio at all times
- Use `thedgym.png` (transparent) on dark site backgrounds
- Use `thedgym2.png` only for isolated print/icon contexts
- Minimum display size: 120px wide on desktop, 80px wide on mobile
- Clear space: Minimum 16px on all sides
- Do NOT place on light/white backgrounds — the logo is designed for dark contexts

---

## 3. Color System

### Primary Palette

| Token | Value | Usage |
|-------|-------|-------|
| `--color-black` | `#000000` | Page background (primary) |
| `--color-surface` | `#0A0A0A` | Elevated surface, cards |
| `--color-surface-2` | `#111111` | Nested surfaces, inputs |
| `--color-surface-3` | `#1A1A1A` | Hover backgrounds |
| `--color-border` | `rgba(255,255,255,0.08)` | Subtle dividers, card edges |
| `--color-border-strong` | `rgba(255,255,255,0.15)` | Active states, focus rings |

### Brand Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-red` | `#E5201A` | Primary accent (from logo D) |
| `--color-red-hover` | `#FF2B24` | Button hover, active states |
| `--color-red-muted` | `rgba(229,32,26,0.12)` | Tinted backgrounds, badges |
| `--color-white` | `#FFFFFF` | Primary text |
| `--color-white-70` | `rgba(255,255,255,0.70)` | Body text, secondary content |
| `--color-white-40` | `rgba(255,255,255,0.40)` | Muted text, placeholders, labels |
| `--color-white-20` | `rgba(255,255,255,0.20)` | Disabled states |
| `--color-white-10` | `rgba(255,255,255,0.10)` | Ghost backgrounds |

### Functional Colors

| Token | Value | Usage |
|-------|-------|-------|
| `--color-success` | `#22C55E` | Confirmed, active membership |
| `--color-warning` | `#F59E0B` | Medium risk, attention |
| `--color-danger` | `#EF4444` | High churn risk, errors |
| `--color-info` | `#3B82F6` | Informational, AI output |

### Risk Tier Colors
| Token | Value | Threshold |
|-------|-------|-----------|
| `--color-risk-low` | `#22C55E` | Probability ≤ 0.40 |
| `--color-risk-medium` | `#F59E0B` | 0.40 < Probability ≤ 0.70 |
| `--color-risk-high` | `#EF4444` | Probability > 0.70 |

---

## 4. Typography

### Font Strategy
- **Display / Hero:** `"Bebas Neue"` or `"Barlow Condensed"` — bold, athletic condensed headers
- **UI / Body:** `"Inter"` — neutral, high legibility, modern system-feel
- **Mono:** `"JetBrains Mono"` — data tables, code, metrics

### Type Scale

| Token | Size | Weight | Tracking | Usage |
|-------|------|--------|----------|-------|
| `--text-hero` | `clamp(3rem, 8vw, 7rem)` | 900 | `-0.04em` | Hero headline |
| `--text-display` | `clamp(2rem, 5vw, 4rem)` | 800 | `-0.03em` | Section headers |
| `--text-heading-1` | `2.25rem / 36px` | 700 | `-0.02em` | Page titles |
| `--text-heading-2` | `1.5rem / 24px` | 600 | `-0.01em` | Card titles, sub-sections |
| `--text-heading-3` | `1.125rem / 18px` | 600 | `0` | Labels, widget headers |
| `--text-body-lg` | `1rem / 16px` | 400 | `0` | Primary body text |
| `--text-body` | `0.875rem / 14px` | 400 | `0` | Secondary body, descriptions |
| `--text-small` | `0.75rem / 12px` | 400 | `0.02em` | Captions, meta text |
| `--text-label` | `0.6875rem / 11px` | 500 | `0.08em` | Uppercase labels, tags |

### Typography Rules
- Hero and display text use uppercase or title case — never sentence case
- Body paragraphs max-width: `65ch` (approximately `max-w-2xl`)
- Labels that act as category tags: `text-xs uppercase tracking-widest text-white/40`
- Line height for body: `1.65`
- Line height for headings: `1.1`

---

## 5. Spacing System

Based on a 4px base unit. Tailwind spacing scale applies directly.

| Token | Value | Tailwind Class |
|-------|-------|----------------|
| `--space-1` | `4px` | `p-1` |
| `--space-2` | `8px` | `p-2` |
| `--space-3` | `12px` | `p-3` |
| `--space-4` | `16px` | `p-4` |
| `--space-6` | `24px` | `p-6` |
| `--space-8` | `32px` | `p-8` |
| `--space-12` | `48px` | `p-12` |
| `--space-16` | `64px` | `p-16` |
| `--space-20` | `80px` | `p-20` |
| `--space-24` | `96px` | `p-24` |

### Section Spacing
- Vertical section padding: `py-20` (desktop), `py-12` (mobile)
- Container max-width: `max-w-7xl mx-auto px-4 md:px-8`
- Card internal padding: `p-6` standard, `p-8` featured

---

## 6. Borders & Radii

| Token | Value | Tailwind |
|-------|-------|----------|
| `--radius-sm` | `4px` | `rounded` |
| `--radius-md` | `8px` | `rounded-lg` |
| `--radius-lg` | `12px` | `rounded-xl` |
| `--radius-xl` | `16px` | `rounded-2xl` |
| `--radius-full` | `9999px` | `rounded-full` |

### Border Rules
- Default card border: `border border-white/8`
- Active/hover card border: `border border-white/15`
- Input border: `border border-white/10 focus:border-white/30`
- No heavy outer shadows on cards — use subtle inner glow only

---

## 7. Shadows & Glows

| Name | Value | Usage |
|------|-------|-------|
| `shadow-card` | `0 1px 3px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)` | Base card elevation |
| `shadow-elevated` | `0 8px 32px rgba(0,0,0,0.6)` | Modals, dropdowns |
| `glow-red` | `0 0 24px rgba(229,32,26,0.3)` | CTA hover, active risk badges |
| `glow-subtle` | `0 0 40px rgba(255,255,255,0.03)` | Hero section ambient |

---

## 8. Breakpoints

| Name | Value | Tailwind |
|------|-------|----------|
| `sm` | `640px` | `sm:` |
| `md` | `768px` | `md:` |
| `lg` | `1024px` | `lg:` |
| `xl` | `1280px` | `xl:` |
| `2xl` | `1536px` | `2xl:` |

### Layout Rules
- Mobile-first always
- Single column on mobile, multi-column from `md:` upward
- Navigation collapses to hamburger at `md:` and below

---

## 9. Component Rules

### Buttons

| Variant | Class Pattern | Usage |
|---------|--------------|-------|
| Primary | `bg-red text-white rounded-lg px-6 py-3 font-semibold hover:bg-red-hover` | Main CTA |
| Secondary | `border border-white/15 text-white rounded-lg px-6 py-3 hover:bg-white/5` | Secondary action |
| Ghost | `text-white/70 hover:text-white` | Tertiary, navigation |
| Danger | `bg-danger text-white rounded-lg px-6 py-3` | Destructive actions |

**Rules:**
- All buttons include `:focus-visible` with visible ring
- Minimum touch target: 44px height on mobile
- Never use more than two button variants in the same visible area
- Primary CTA always contains a strong verb and clear outcome

### Cards

- Background: `bg-surface border border-white/8 rounded-xl`
- Hover state: `hover:border-white/15 transition-colors duration-200`
- No box-shadow by default — use border to indicate elevation
- Card content always has internal padding `p-6`
- Do NOT fill every layout with identical cards

### Forms & Inputs

- Background: `bg-surface-2 border border-white/10`
- Focus: `focus:border-white/30 focus:ring-1 focus:ring-white/20`
- Placeholder: `placeholder:text-white/30`
- Label: Above input, `text-sm font-medium text-white/70 mb-1.5`
- Error state: `border-danger text-danger`
- Success state: `border-success`

### Navigation

- Sticky header: `position: sticky; top: 0; z-index: 50`
- Header background: `bg-black/80 backdrop-blur-md border-b border-white/8`
- Nav link style: `text-sm text-white/70 hover:text-white transition-colors`
- Active nav link: `text-white font-medium`
- Mobile menu: Full-screen overlay, enters from top or right

---

## 10. Motion Rules

### Principles
- Animate `transform` and `opacity` only — never `width`, `height`, `top`, `left`
- Use GSAP with `useGSAP()` hook — never raw `useEffect` for animations
- Register GSAP plugins at file top: `gsap.registerPlugin(ScrollTrigger)`
- Prefer short durations: `0.3s–0.6s` for UI interactions
- Section entrance animations: `0.6s–0.9s` with stagger
- Avoid loops unless genuinely serving the user

### Animation Tokens
| Name | Duration | Easing | Usage |
|------|----------|--------|-------|
| `micro` | `0.15s` | `power2.out` | Hover, focus states |
| `fast` | `0.3s` | `power2.out` | Button interactions |
| `base` | `0.5s` | `power3.out` | Component reveal |
| `slow` | `0.8s` | `power4.out` | Hero entrances |
| `stagger` | `0.08s` offset | — | List/card reveals |

### Lenis Smooth Scroll
- Enable Lenis on all public pages
- Disable inside modals and drawers
- `lerp: 0.08` for athletic feel — slightly snappy

---

## 11. Accessibility Rules

- All interactive elements have visible `:focus-visible` ring: `ring-2 ring-white/50`
- Color is never the sole indicator of meaning (always pair with text/icon)
- Minimum contrast ratio: 4.5:1 for body text, 3:1 for large text
- All form inputs have associated `<label>` elements
- All images have descriptive `alt` attributes (or `alt=""` if decorative)
- Skip-to-content link at top of every page
- Keyboard navigation must follow logical DOM order
- `aria-live` regions for dynamic content (search results, notifications)
- Modal/drawer: trap focus inside when open, restore on close
- No content appears only on hover without a keyboard equivalent

---

## 12. Content Rules

- No em dashes in website copy
- No fabricated statistics, testimonials, awards, or certifications
- No generic AI-style phrases ("Transform your...", "Unlock...", etc.)
- Tagline is verified: "Elevate your fitness journey at our Premium Fitness Gym"
- One idea per section
- Lead with benefit before feature
- CTAs contain a clear verb and clear outcome
- Placeholders clearly marked as `[PLACEHOLDER]` until verified

---

## 13. Image Usage

- All photography must be real or royalty-free with proper attribution
- No AI-generated photographs to represent the actual gym or real people
- Compress all images before use (WebP preferred, JPEG acceptable)
- Lazy-load all below-the-fold images
- Responsive `srcset` where feasible
- Never use images wider than actually needed

---

## 14. Logo Usage Summary

| Context | File | Notes |
|---------|------|-------|
| Site header (dark bg) | `thedgym.png` | Transparent, white+red version |
| Profile / icon | `thedgym2.png` | Black background version |
| Footer | `thedgym.png` | Reduced opacity allowed (`opacity-70`) |
| Print | `thedgym2.png` | Full lockup |
| Never | Any AI-generated version | Strictly prohibited |
