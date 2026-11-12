import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ALL_PUBLIC_PLANS, PUBLIC_PLANS } from '@/constants/plans'
import { OFFICIAL_COACHES } from '@/constants/coaches'
import { GYM_INFO } from '@/constants/gymInfo'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { ChevronLeft, ChevronRight, Plus, Minus } from 'lucide-react'
import { SEO } from '@/components/ui/SEO'
import { DotPattern, useDotTheme } from '@/components/ui/dot-pattern'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger)

// --- Structured Program Cards (Image 4 Essence) ---
const PROGRAM_CARDS = [
  {
    title: 'Strength & Barbell Program',
    tags: ['STRENGTH DEVELOPMENT', 'PROGRESSIVE OVERLOAD', 'MOVEMENT QUALITY', 'CORE STABILITY'],
    description:
      'A PROGRESSIVE STRENGTH PROGRAM FOCUSED ON BUILDING MUSCLE, POWER, STABILITY, AND CONFIDENCE UNDER HEAVY BARBELL LOAD.',
    ctaLabel: 'Explore Strength',
    href: '/membership',
    image: '/assets/images/img7.jpg',
    alt: 'The DGym dumbbell racks and barbell strength zone in Rosario, Batangas',
  },
  {
    title: 'Conditioning & Tabata',
    tags: ['CARDIO', 'INTERVALS', 'FUNCTIONAL CONDITIONING', 'ENDURANCE'],
    description:
      'IMPROVE ENDURANCE, CARDIOVASCULAR FITNESS, AND WORK CAPACITY THROUGH STRUCTURED 6:00 PM GROUP CONDITIONING SESSIONS.',
    ctaLabel: 'Explore Conditioning',
    href: '/classes',
    image: '/assets/images/img12.jpg',
    alt: 'The DGym conditioning and plate-loaded floor in Rosario, Batangas',
  },
  {
    title: '1-on-1 Personal Coaching',
    tags: ['BIOMECHANICS', 'BOXING PADWORK', 'CUSTOM PROGRAMMING', 'ACCOUNTABILITY'],
    description:
      'DEDICATED ONE-ON-ONE SESSIONS ENGINEERED AROUND YOUR GOALS, FORM REFINEMENT, AND MEASURABLE ATHLETIC MILESTONES.',
    ctaLabel: 'Explore Coaching',
    href: '/trainers',
    image: '/assets/images/img6.jpg',
    alt: 'Personal training session with coach at The DGym Rosario Batangas',
  },
] as const

// --- Pillars Bento Data (Image 3 Essence) ---
const PILLAR_CARDS = [
  {
    tag: 'STRENGTH & POWERLIFTING',
    colSpan: 'lg:col-span-6',
    body: 'BUILD STRONGER, MORE EFFICIENT LIFTING PATTERNS ON COMPETITION DEADLIFT PLATFORMS, ROGUE BARBELLS, AND FULL TECHNOGYM DUMBBELL RUNS UP TO 40KG.',
  },
  {
    tag: 'MOBILITY & CONDITIONING',
    colSpan: 'lg:col-span-3',
    body: 'IMPROVE JOINT CONTROL, METABOLIC WORK CAPACITY, AND STAMINA WITH COMPLIMENTARY DAILY 6:00 PM TABATA AND HIIT GROUP CLASSES.',
  },
  {
    tag: 'RECOVERY & LOUNGE',
    colSpan: 'lg:col-span-3',
    body: 'REDUCE TRAINING FATIGUE IN OUR AIR-CONDITIONED FACILITY FEATURING DEDICATED COACHING, LOCKER ACCESS, AND HIGH-SPEED MEMBER WI-FI.',
  },
] as const

// --- Home FAQ Data (Image 6 Essence) ---
const DAY_PASS_PRICE =
  PUBLIC_PLANS.find((plan) => plan.slug === 'day-pass')?.priceFormatted ?? '₱400'

const COACH_NAMES_SUMMARY = (() => {
  const names = OFFICIAL_COACHES.map((coach) => coach.name.toUpperCase())
  if (names.length <= 1) return names[0] ?? 'OUR COACHES'
  if (names.length === 2) return `${names[0]} AND ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, AND ${names[names.length - 1]}`
})()

const HOME_FAQS = [
  {
    question: 'Is The DGym suitable for beginners?',
    answer:
      'YES. OUR CERTIFIED COACHES PROVIDE FORM ASSESSMENTS, GUIDED EQUIPMENT ORIENTATION, AND SCALABLE WORKOUTS SO BEGINNERS CAN TRAIN SAFELY FROM DAY ONE.',
  },
  {
    question: 'Can I try the gym before committing to a monthly plan?',
    answer:
      `YES. WE OFFER A ${DAY_PASS_PRICE} DAY PASS SO YOU CAN EXPERIENCE OUR TECHNOGYM & ROGUE EQUIPMENT, TRAINING FLOOR, AND ATMOSPHERE BEFORE CHOOSING A MEMBERSHIP.`,
  },
  {
    question: 'What is included in a standard membership?',
    answer:
      'UNLIMITED ACCESS TO ALL CARDIO AND STRENGTH ZONES, FREE 6:00 PM TABATA & HIIT GROUP CLASSES, LOCKER USE, LOUNGE WORKSPACE, AND NFC SMART KEYCARD ENTRY.',
  },
  {
    question: 'Do you offer 1-on-1 personal training and boxing?',
    answer:
      `YES. ${COACH_NAMES_SUMMARY} OFFER DEDICATED 1-ON-1 STRENGTH CONDITIONING AND 90-MINUTE BOXING SESSIONS TAILORED TO YOUR GOALS.`,
  },
  {
    question: 'How do I activate my membership pass?',
    answer:
      'CHOOSE ANY PLAN ONLINE VIA GCASH, MAYA, QR PH, OR CARD—OR PAY AT THE FRONT DESK. ONCE PAYMENT IS CONFIRMED, YOUR PASS ACTIVATES DIRECTLY IN YOUR MEMBER PORTAL.',
  },
] as const

export function HomePage() {
  const heroRef = useRef<HTMLElement>(null)
  const sectionsRef = useRef<HTMLDivElement>(null)
  const programsScrollRef = useRef<HTMLDivElement>(null)
  const faqBaseId = useId()
  const [openFaqIndex, setOpenFaqIndex] = useState<number>(1)
  const { theme } = useDotTheme()
  const isLight = theme === 'light'
  const headingColor = isLight ? 'text-zinc-900' : 'text-white'
  const subTextColor = isLight ? 'text-zinc-600' : 'text-white/65'

  // Hero entrance
  useGSAP(
    () => {
      const el = heroRef.current
      if (!el) return
      gsap.fromTo(
        el.querySelectorAll('.hero-item'),
        { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', stagger: 0.1, delay: 0.15 }
      )
    },
    { scope: heroRef }
  )

  // Scroll-triggered section reveals
  useGSAP(
    () => {
      const blocks = sectionsRef.current?.querySelectorAll('.reveal-block')
      if (!blocks) return
      blocks.forEach((block) => {
        gsap.fromTo(
          block,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            ease: 'power3.out',
            scrollTrigger: { trigger: block, start: 'top 88%', once: true },
          }
        )
      })
    },
    { scope: sectionsRef }
  )

  const scrollPrograms = (direction: 'prev' | 'next') => {
    const container = programsScrollRef.current
    if (!container) return
    const firstCard = container.firstElementChild as HTMLElement | null
    const step = firstCard ? firstCard.getBoundingClientRect().width + 24 : 360
    const offset = direction === 'next' ? step : -step
    container.scrollBy({ left: offset, behavior: 'smooth' })
  }

  return (
    <>
      <SEO
        description="High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas. Free weights, powerlifting platforms, selectorized machines, and elite coaching."
        canonical="https://thedgym.com/"
        ogImage="/assets/images/dgym_bg.jpg"
      />

      {/* ============================================================
          1. HERO — Framed Rounded-3xl Monochrome & Red Showcase (Image 1)
          ============================================================ */}
      <section
        ref={heroRef}
        className="px-3 sm:px-6 pb-8"
        aria-label="The DGym — High End Premium Fitness Gym in Rosario, Batangas"
      >
        <div className="relative rounded-3xl overflow-hidden min-h-[84vh] flex flex-col justify-between border border-white/10 bg-[#09090b] shadow-2xl">
          {/* Background image */}
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
            style={{ backgroundImage: "url('/assets/images/dgym_bg.jpg')" }}
            role="img"
            aria-label="The DGym interior — dark athletic training space with red LED lighting in Rosario, Batangas"
          />

          {/* Dramatic monochrome + subtle crimson atmospheric overlays */}
          <div className="absolute inset-0 bg-black/55" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_35%,rgba(229,32,26,0.22),transparent_60%)]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-black/30" />

          {/* Top Spacer */}
          <div className="pt-8" />

          {/* Middle Horizontal Axis Micro-Labels */}
          <div className="hero-item container-dgym relative z-10 my-auto py-12">
            <div className="flex items-center justify-between text-[10px] sm:text-xs font-mono uppercase tracking-[0.22em] text-white/75 border-y border-white/10 py-3.5">
              <span>BUILD CONSISTENCY</span>
              <span className="text-white">BUILD SPIRITS</span>
              <span>BUILD HABITS</span>
            </div>
          </div>

          {/* Bottom Centered Headline & CTA */}
          <div className="container-dgym relative z-10 pb-14 md:pb-20 text-center space-y-5">
            <p className="hero-item text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-red">
              CHOOSE YOUR FOCUS.
            </p>

            <h1 className="hero-item text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white max-w-3xl mx-auto leading-[1.05]">
              Programs built to
              <br />
              make you stronger
            </h1>

            <p className="hero-item text-xs sm:text-sm font-mono uppercase tracking-widest text-white/70 max-w-xl mx-auto leading-relaxed">
              FOCUSED TRAINING PROGRAMS DESIGNED AROUND STRENGTH, PERFORMANCE, MOVEMENT, AND MEASURABLE PROGRESS IN ROSARIO, BATANGAS.
            </p>

            <div className="hero-item pt-3 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/membership"
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-medium tracking-wide transition-all shadow-[0_0_24px_rgba(229,32,26,0.4)]"
              >
                <span>Avail Membership</span>
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block" />
              </Link>
              <Link
                to="/classes"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white text-xs font-mono uppercase tracking-widest transition-all"
              >
                <span>Explore Classes</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <div ref={sectionsRef} className="space-y-8">
        {/* ============================================================
            2. INTRO STATEMENT & SPLIT BENTO SHOWCASE (Image 2)
            ============================================================ */}
        <section className="relative py-20 md:py-28 overflow-hidden" aria-labelledby="intro-heading">
          <div className="container-dgym space-y-16">
            {/* Centered Statement */}
            <div className="reveal-block max-w-3xl mx-auto text-center space-y-6">
              <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-red">
                CHOOSE YOUR FOCUS.
              </p>

              <h2
                id="intro-heading"
                className={`text-2xl sm:text-4xl md:text-[2.65rem] font-medium tracking-tight leading-[1.2] transition-colors duration-300 ${headingColor}`}
              >
                Whether you&apos;re building your foundation, pushing your performance, or training toward a specific goal, The DGym gives you a structured path forward.
              </h2>

              {/* Verified Coaching & Location Pill */}
              <div className="flex items-center justify-center gap-3 pt-1">
                <div className="flex -space-x-2" aria-hidden="true">
                  {OFFICIAL_COACHES.map((coach, idx) => (
                    <span
                      key={coach.name}
                      className={`w-7 h-7 rounded-full border border-white/20 flex items-center justify-center text-[10px] font-mono font-bold text-white ${
                        idx === 0 ? 'bg-zinc-800' : idx === 1 ? 'bg-zinc-700' : 'bg-red/80'
                      }`}
                    >
                      {coach.name.replace(/^Coach\s+/i, '').slice(0, 2).toUpperCase()}
                    </span>
                  ))}
                </div>
                <span className={`text-[11px] font-mono uppercase tracking-widest transition-colors duration-300 ${subTextColor}`}>
                  {OFFICIAL_COACHES.length} DEDICATED COACHES • {GYM_INFO.cityRegion.toUpperCase()}
                </span>
              </div>

              <div className="pt-2">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-medium transition-all shadow-[0_0_20px_rgba(229,32,26,0.3)]"
                >
                  <span>About The DGym</span>
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block" />
                </Link>
              </div>
            </div>

            {/* Split 2-Column Rounded-3xl Monochrome Bento Photos */}
            <div className="reveal-block grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="group relative rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d11] aspect-[4/3]">
                <img
                  src="/assets/images/img18.jpg"
                  alt="The DGym Rosario Batangas hexagonal lighting and training floor"
                  className="w-full h-full object-cover grayscale contrast-125 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-red">
                    ROSARIO, BATANGAS FACILITY
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    Atmospheric LED Strength Floor
                  </h3>
                </div>
              </div>

              <div className="group relative rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d11] aspect-[4/3]">
                <img
                  src="/assets/images/img10.jpg"
                  alt="Athlete lifting on Rogue competition platform at The DGym"
                  className="w-full h-full object-cover grayscale contrast-125 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-6 left-6 right-6">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-red">
                    COMPETITION GRADE
                  </span>
                  <h3 className="text-xl font-bold text-white mt-1">
                    Technogym &amp; Rogue Equipment
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            3. DARK BENTO PILLARS — Move Better / Recover Better (Image 3)
            ============================================================ */}
        <section className="px-3 sm:px-6" aria-labelledby="pillars-heading">
          <div className="reveal-block relative rounded-3xl overflow-hidden border border-white/10 bg-[#09090b] py-16 md:py-24 px-6 sm:px-12">
            {/* Subtle blurred monochrome backdrop */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-20 grayscale blur-[2px]"
              style={{ backgroundImage: "url('/assets/images/img12.jpg')" }}
              aria-hidden="true"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/80 to-black/95" />

            <div className="relative z-10 max-w-7xl mx-auto space-y-12">
              {/* Split Header */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 pb-10 border-b border-white/10">
                <div className="space-y-3">
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-red">
                    PERFORMANCE &amp; RECOVERY
                  </p>
                  <h2
                    id="pillars-heading"
                    className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.08]"
                  >
                    Move better.
                    <br />
                    Recover better.
                  </h2>
                </div>

                <div className="max-w-md space-y-5">
                  <p className="text-xs font-mono uppercase tracking-wider text-white/70 leading-relaxed">
                    TRAINING ISN&apos;T ONLY ABOUT INTENSITY. TECHNIQUE, CONDITIONING, AND RECOVERY HELP YOUR BODY PERFORM, ADAPT, AND STAY CONSISTENT.
                  </p>
                  <Link
                    to="/classes"
                    className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-medium transition-all"
                  >
                    <span>Explore Classes</span>
                    <span aria-hidden="true" className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block" />
                  </Link>
                </div>
              </div>

              {/* 3-Card Asymmetric Dark Bento Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {PILLAR_CARDS.map((card) => (
                  <div
                    key={card.tag}
                    className={`${card.colSpan} rounded-3xl bg-[#070709]/95 border border-white/10 p-8 min-h-[300px] sm:min-h-[340px] flex flex-col justify-between hover:border-white/20 transition-colors`}
                  >
                    <span className="text-xs font-mono uppercase tracking-widest text-white/80">
                      {card.tag}
                    </span>
                    <p className="text-xs font-mono uppercase tracking-wider text-white/65 leading-relaxed max-w-md">
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            4. STRUCTURED PROGRAMS & MEMBERSHIP TIERS (Image 4)
            ============================================================ */}
        <section className="relative py-20 md:py-28 overflow-hidden" aria-labelledby="programs-heading">
          <div className="container-dgym space-y-12">
            {/* Header + Red Circular Nav Arrows */}
            <div className="reveal-block flex flex-col md:flex-row md:items-end justify-between gap-6">
              <div className="space-y-4 max-w-xl">
                <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-red">
                  HOW PROGRAMS WORK
                </p>
                <h2
                  id="programs-heading"
                  className={`text-4xl sm:text-5xl font-bold tracking-tight transition-colors duration-300 ${headingColor}`}
                >
                  A structure for progress
                </h2>
                <p className={`text-xs font-mono uppercase tracking-wider leading-relaxed transition-colors duration-300 ${subTextColor}`}>
                  EVERY DGYM PROGRAM IS BUILT AROUND CONSISTENCY AND PROGRESSION. WE FOCUS ON WHERE YOU ARE TODAY AND CREATE A CLEAR PATH TOWARD WHERE YOU WANT TO BE.
                </p>
              </div>

              <div className="flex lg:hidden items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => scrollPrograms('prev')}
                  aria-label="Previous program"
                  className="w-10 h-10 rounded-full bg-red hover:bg-red-hover text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-[0_0_16px_rgba(229,32,26,0.35)]"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollPrograms('next')}
                  aria-label="Next program"
                  className="w-10 h-10 rounded-full bg-red hover:bg-red-hover text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-[0_0_16px_rgba(229,32,26,0.35)]"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tall Monochrome Program Bento Cards */}
            <div
              ref={programsScrollRef}
              className="reveal-block flex lg:grid lg:grid-cols-3 gap-6 overflow-x-auto lg:overflow-visible snap-x snap-mandatory pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {PROGRAM_CARDS.map((prog) => (
                <div
                  key={prog.title}
                  className="group relative shrink-0 w-[85%] sm:w-[62%] lg:w-auto snap-start rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d11] min-h-[480px] sm:min-h-[540px] flex flex-col justify-between p-7"
                >
                  {/* Monochrome Background Photo */}
                  <img
                    src={prog.image}
                    alt={prog.alt}
                    className="absolute inset-0 w-full h-full object-cover grayscale contrast-125 group-hover:grayscale-0 group-hover:scale-105 transition-all duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-b from-black/75 via-black/35 to-black/90" />

                  {/* Top Micro-Tags Row */}
                  <div className="relative z-10 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] font-mono uppercase tracking-widest text-white/80">
                    {prog.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>

                  {/* Bottom Content & Red Button */}
                  <div className="relative z-10 space-y-4 pt-12">
                    <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                      {prog.title}
                    </h3>
                    <p className="text-xs font-mono uppercase tracking-wider text-white/70 leading-relaxed">
                      {prog.description}
                    </p>
                    <div className="pt-1">
                      <Link
                        to={prog.href}
                        className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-medium transition-all"
                      >
                        <span>{prog.ctaLabel}</span>
                        <span aria-hidden="true" className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block" />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Membership Quick-Select Bento Strip */}
            <div className="reveal-block rounded-3xl border border-white/10 bg-[#0d0d11]/90 p-8 md:p-10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
                <div>
                  <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-red mb-2">
                    TRANSPARENT RATES
                  </p>
                  <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                    Choose your training pass
                  </h3>
                </div>
                <Link
                  to="/membership"
                  className="inline-flex items-center gap-2 text-xs font-mono uppercase tracking-widest text-white/70 hover:text-white transition-colors"
                >
                  <span>View All {ALL_PUBLIC_PLANS.length} Membership Tiers →</span>
                </Link>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {PUBLIC_PLANS.map((plan) => (
                  <Link
                    key={plan.slug}
                    to={`/payment?plan=${plan.slug}`}
                    className={[
                      'rounded-2xl p-6 border transition-all duration-200 flex flex-col justify-between gap-6',
                      plan.highlight
                        ? 'bg-red/10 border-red/40 hover:border-red shadow-[0_0_25px_rgba(229,32,26,0.12)]'
                        : 'bg-white/[0.02] border-white/10 hover:border-white/25',
                    ].join(' ')}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-mono uppercase tracking-widest text-white/60">
                          {plan.name}
                        </span>
                        {plan.badge && (
                          <span className="text-[10px] font-mono uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-red text-white">
                            {plan.badge}
                          </span>
                        )}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-3xl font-bold font-mono text-white">
                          {plan.priceFormatted}
                        </span>
                        <span className="text-xs font-mono text-white/40">{plan.period}</span>
                      </div>
                      <p className="text-xs text-white/60 leading-relaxed">{plan.shortDesc}</p>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono uppercase tracking-wider text-white pt-3 border-t border-white/10">
                      <span>Avail Pass</span>
                      <span aria-hidden="true" className="w-1.5 h-1.5 rounded-[1px] bg-red inline-block" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            5. DOT PATTERN CTA — "Not sure where to start?" (Image 5)
            ============================================================ */}
        <section className="px-3 sm:px-6" aria-labelledby="start-cta-heading">
          <div className="reveal-block relative rounded-3xl overflow-hidden border border-white/10 bg-[#09090b] py-28 md:py-40 px-6">
            <DotPattern
              cy={1}
              cr={1}
              cx={1}
              className={cn(
                '[mask-image:radial-gradient(400px_circle_at_center,white,transparent)]',
                theme === 'light'
                  ? 'fill-zinc-200/70 md:fill-white/80'
                  : 'fill-slate-500/45 md:fill-slate-400/60'
              )}
            />

            {/* Centered Call to Action */}
            <div className="relative z-10 max-w-md mx-auto text-center space-y-5">
              <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-red">
                FIND YOUR PROGRAM
              </p>
              <h2
                id="start-cta-heading"
                className="text-4xl sm:text-5xl font-bold tracking-tight text-white leading-[1.1]"
              >
                Not sure where
                <br />
                to start?
              </h2>
              <div className="pt-2">
                <Link
                  to="/trainers"
                  className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-medium transition-all shadow-[0_0_24px_rgba(229,32,26,0.4)]"
                >
                  <span>Talk To A Coach</span>
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-[1px] bg-white inline-block" />
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================
            6. SPLIT FAQ ACCORDION + MONOCHROME PHOTO (Image 6)
            ============================================================ */}
        <section className="relative py-20 md:py-28 overflow-hidden" aria-labelledby="faq-heading">
          <div className="container-dgym space-y-14">
            {/* Top Split Header */}
            <div className="reveal-block grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-7 space-y-3">
                <p className="text-[11px] font-mono font-semibold uppercase tracking-[0.25em] text-red">
                  FAQ
                </p>
                <h2
                  id="faq-heading"
                  className={`text-3xl sm:text-5xl font-bold tracking-tight leading-[1.1] transition-colors duration-300 ${headingColor}`}
                >
                  Everything you need to know
                  <br />
                  before getting started
                </h2>
              </div>

              <div className="lg:col-span-5">
                <p className={`text-xs font-mono uppercase tracking-wider leading-relaxed transition-colors duration-300 ${subTextColor}`}>
                  STARTING YOUR FITNESS JOURNEY SHOULD FEEL SIMPLE. FIND ANSWERS ABOUT MEMBERSHIPS, FACILITIES, PERSONAL TRAINING, AND WHAT TO EXPECT AT THE DGYM ROSARIO.
                </p>
              </div>
            </div>

            {/* Bottom Split: Accordion Left + Rounded-3xl Photo Right */}
            <div className="reveal-block grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
              {/* Left Accordion */}
              <div className={`lg:col-span-7 divide-y border-y transition-colors duration-300 ${isLight ? 'divide-zinc-300 border-zinc-300' : 'divide-white/10 border-white/10'}`}>
                {HOME_FAQS.map((item, idx) => {
                  const isOpen = openFaqIndex === idx
                  const buttonId = `${faqBaseId}-btn-${idx}`
                  const panelId = `${faqBaseId}-panel-${idx}`
                  return (
                    <div key={item.question} className="py-5">
                      <button
                        id={buttonId}
                        type="button"
                        onClick={() => setOpenFaqIndex(isOpen ? -1 : idx)}
                        className="w-full flex items-center justify-between gap-4 text-left cursor-pointer group"
                        aria-expanded={isOpen}
                        aria-controls={panelId}
                      >
                        <span
                          className={[
                            'text-base sm:text-lg font-medium transition-colors',
                            isOpen
                              ? 'text-red'
                              : isLight
                                ? 'text-zinc-900 group-hover:text-red'
                                : 'text-white/85 group-hover:text-white',
                          ].join(' ')}
                        >
                          {item.question}
                        </span>
                        <span aria-hidden="true" className={`${isLight ? 'text-zinc-500 group-hover:text-zinc-900' : 'text-white/50 group-hover:text-white'} shrink-0`}>
                          {isOpen ? <Minus className="w-4 h-4 text-red" /> : <Plus className="w-4 h-4" />}
                        </span>
                      </button>

                      <div
                        id={panelId}
                        role="region"
                        aria-labelledby={buttonId}
                        hidden={!isOpen}
                      >
                        <p className={`mt-3.5 text-xs font-mono uppercase tracking-wider leading-relaxed pr-8 ${subTextColor}`}>
                          {item.answer}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Right Monochrome Rounded-3xl Feature Photo */}
              <div className="lg:col-span-5">
                <div className="rounded-3xl overflow-hidden border border-white/10 bg-[#0d0d11] aspect-[4/3] lg:aspect-[5/4]">
                  <img
                    src="/assets/images/img10.jpg"
                    alt="Athlete training at The DGym Rosario Batangas"
                    className="w-full h-full object-cover grayscale contrast-125 hover:grayscale-0 transition-all duration-700"
                    loading="lazy"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  )
}
