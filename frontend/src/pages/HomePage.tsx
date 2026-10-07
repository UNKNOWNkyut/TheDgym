import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { NewsletterSection } from '@/components/sections/NewsletterSection'

gsap.registerPlugin(ScrollTrigger)

// --- Feature icons (inline SVG, no external icon lib needed) ---
function IconStrength() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6.5 6.5L3 10l9 9 3.5-3.5" /><path d="M14 4l6 6" /><path d="M4 20l2-2" /><path d="M9 5l10 10" />
    </svg>
  )
}
function IconSchedule() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}
function IconCoach() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function IconEquipment() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  )
}

const FEATURES = [
  {
    icon: <IconStrength />,
    title: 'Full Strength Zone',
    body: 'A full floor of free weights, barbells, and resistance machines built for serious training.',
  },
  {
    icon: <IconCoach />,
    title: 'Personal Training',
    body: 'One-on-one sessions with dedicated coaches who program around your goals, not a template.',
  },
  {
    icon: <IconSchedule />,
    title: 'Group Classes',
    body: 'Structured group sessions that keep your training consistent and your motivation high.',
  },
  {
    icon: <IconEquipment />,
    title: 'Premium Equipment',
    body: 'Maintained machines, updated regularly. Train without compromising on equipment quality.',
  },
]

export function HomePage() {
  const heroRef = useRef<HTMLElement>(null)
  const featuresRef = useRef<HTMLElement>(null)
  const ctaRef = useRef<HTMLElement>(null)

  // Hero entrance
  useGSAP(() => {
    const el = heroRef.current
    if (!el) return
    gsap.fromTo(
      el.querySelectorAll('.hero-item'),
      { opacity: 0, y: 50 },
      { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.12, delay: 0.2 }
    )
  }, { scope: heroRef })

  // Features reveal
  useGSAP(() => {
    const cards = featuresRef.current?.querySelectorAll('.feature-card')
    if (!cards) return
    cards.forEach((card) => {
      gsap.fromTo(
        card,
        { opacity: 0, y: 36 },
        {
          opacity: 1, y: 0, duration: 0.6, ease: 'power3.out',
          scrollTrigger: { trigger: card, start: 'top 90%', once: true },
        }
      )
    })
  }, { scope: featuresRef })

  // CTA reveal
  useGSAP(() => {
    const el = ctaRef.current
    if (!el) return
    gsap.fromTo(
      el.querySelectorAll('.cta-item'),
      { opacity: 0, y: 24 },
      {
        opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', stagger: 0.1,
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
      }
    )
  }, { scope: ctaRef })

  return (
    <>
      <SEO
        title="The DGym"
        description="High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas. Free weights, powerlifting platforms, selectorized machines, and elite coaching."
        canonical="https://thedgym.com/"
        ogImage="/assets/images/dgym_bg.jpg"
      />

      {/* ============================================================
          HERO — Full viewport, real gym photo background
          ============================================================ */}
      <section
        ref={heroRef}
        className="relative flex items-end min-h-screen overflow-hidden"
        aria-label="The DGym — High End Premium Fitness Gym in Rosario, Batangas"
      >
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/assets/images/dgym_bg.jpg')" }}
          role="img"
          aria-label="The DGym interior — dark athletic training space with red LED lighting in Rosario, Batangas"
        />

        {/* Layered overlay: bottom-heavy gradient for text legibility + subtle dark veil */}
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-transparent" />

        {/* Content — sits at the bottom of the hero */}
        <div className="container-dgym relative z-10 pb-20 md:pb-28 pt-36">
          {/* <p className="hero-item text-xs font-semibold uppercase tracking-[0.25em] text-red mb-5">
            Rosario, Batangas • High End Premium Fitness
          </p> */}

          <h1 className="hero-item font-display text-6xl sm:text-7xl md:text-8xl lg:text-[7rem] font-black uppercase leading-none tracking-tight text-white mb-6 max-w-4xl">
            Train Hard.<br />
            <span className="text-red">Get Stronger.</span>
          </h1>

          <p className="hero-item text-lg md:text-xl text-white/75 max-w-2xl mb-10 leading-relaxed font-light">
            High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas. Real Technogym & Rogue equipment, dedicated coaching, and an authentic lifting atmosphere.
          </p>

          <div className="hero-item flex flex-wrap gap-4">
            <Link to="/membership">
              <Button size="lg">
                View Membership
              </Button>
            </Link>
            <Link to="/classes">
              <Button variant="secondary" size="lg">
                See Classes
              </Button>
            </Link>
          </div>
        </div>

        {/* Scroll cue */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40" aria-hidden="true">
          <span className="text-xs uppercase tracking-widest text-white">Scroll</span>
          <div className="w-px h-8 bg-white/40 animate-pulse" />
        </div>
      </section>

      {/* ============================================================
          FEATURES — What The DGym offers
          ============================================================ */}
      <section
        ref={featuresRef}
        className="section-padding border-b border-white/8"
        aria-labelledby="features-heading"
      >
        <div className="container-dgym">
          <div className="mb-12 md:mb-16">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
              What we offer
            </p>
            <h2
              id="features-heading"
              className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight text-white"
            >
              Built for<br className="sm:hidden" /> Serious Training
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FEATURES.map((f) => (
              <Card key={f.title} className="feature-card group">
                <div className="w-11 h-11 rounded-lg bg-red/10 border border-red/20 flex items-center justify-center text-red mb-5 group-hover:bg-red/20 transition-colors duration-200">
                  {f.icon}
                </div>
                <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-white/50 leading-relaxed">
                  {f.body}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
          FACILITY SHOWCASE — Authentic Photos of The DGym Rosario Batangas
          ============================================================ */}
      <section
        className="section-padding border-b border-white/8 relative overflow-hidden"
        aria-labelledby="facility-heading"
      >
        <div className="container-dgym">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
                The Facility • Rosario, Batangas
              </p>
              <h2
                id="facility-heading"
                className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight text-white"
              >
                Inside The DGym
              </h2>
            </div>
            <p className="text-sm text-white/50 max-w-md mt-4 md:mt-0 leading-relaxed">
              Equipped with Technogym and Rogue equipment, dedicated deadlift platforms, custom plate-loaded machines, and air-conditioned training zones.
            </p>
          </div>

          {/* Photo Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Feature 1: Free weights */}
            <div className="group relative rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-[4/3] md:aspect-[3/4]">
              <img
                src="/assets/images/img7.jpg"
                alt="The DGym dumbbell racks with Technogym weights, red benches, and STRONGER neon"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-red">Weightlifting Zone</span>
                <h3 className="font-display text-xl font-bold uppercase text-white mt-0.5">Technogym Dumbbell Racks</h3>
                <p className="text-xs text-white/60 mt-1">Full dumbbell run up to 40kg with competition benches</p>
              </div>
            </div>

            {/* Feature 2: Plate-loaded machines (center featured) */}
            <div className="group relative rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-[4/3] md:aspect-[3/4]">
              <img
                src="/assets/images/img12.jpg"
                alt="The DGym plate-loaded strength machines with STRONGER mirror sign"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-red">Strength Machinery</span>
                <h3 className="font-display text-xl font-bold uppercase text-white mt-0.5">Plate-Loaded Floor</h3>
                <p className="text-xs text-white/60 mt-1">Heavy-duty chest, back, and leg selectorized equipment</p>
              </div>
            </div>

            {/* Feature 3: Powerlifting & Platforms */}
            <div className="group relative rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-[4/3] md:aspect-[3/4]">
              <img
                src="/assets/images/img10.jpg"
                alt="Member deadlifting on lifting platform with Rogue competition plates at The DGym"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-red">Powerlifting</span>
                <h3 className="font-display text-xl font-bold uppercase text-white mt-0.5">Rogue Lifting Platforms</h3>
                <p className="text-xs text-white/60 mt-1">Dedicated deadlift platforms with Olympic bumper plates</p>
              </div>
            </div>
          </div>

          {/* Secondary photo row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="group relative rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-[16/9]">
              <img
                src="/assets/images/img6.jpg"
                alt="Coach personal training session at The DGym Rosario Batangas"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-red">Coaching</span>
                <h3 className="font-display text-xl font-bold uppercase text-white mt-0.5">1-on-1 Personal Training</h3>
                <p className="text-xs text-white/60 mt-1">Hands-on technique refinement and custom progressive programming</p>
              </div>
            </div>

            <div className="group relative rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-[16/9]">
              <img
                src="/assets/images/img18.jpg"
                alt="The DGym members and coaches under hexagonal lighting in Rosario, Batangas"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-red">Community</span>
                <h3 className="font-display text-xl font-bold uppercase text-white mt-0.5">The DGym Rosario Community</h3>
                <p className="text-xs text-white/60 mt-1">Over 2,400+ followers and athletes training under one roof</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          MEMBERSHIP PREVIEW
          ============================================================ */}
      <section
        className="section-padding border-b border-white/8 bg-surface"
        aria-labelledby="membership-preview-heading"
      >
        <div className="container-dgym">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
                Membership
              </p>
              <h2
                id="membership-preview-heading"
                className="font-display text-4xl md:text-5xl font-bold uppercase tracking-tight text-white mb-5"
              >
                Plans for<br />Every Goal
              </h2>
              <p className="text-base text-white/60 max-w-md mb-8 leading-relaxed">
                Whether you're starting out or training at an advanced level, we have a membership plan that fits your schedule and your budget.
              </p>
              <Link to="/membership">
                <Button>View All Plans</Button>
              </Link>
            </div>

            {/* Membership tier preview cards */}
            <div className="space-y-3">
              {[
                { name: 'Day Pass', desc: 'Drop in and train on your schedule.', highlight: false },
                { name: 'Monthly', desc: 'Unlimited access, billed monthly. Flexible.', highlight: true },
                { name: 'Quarterly', desc: 'Commit and save. Best value per session.', highlight: false },
              ].map((plan) => (
                <div
                  key={plan.name}
                  className={[
                    'flex items-center justify-between',
                    'p-5 rounded-xl border transition-all duration-200',
                    plan.highlight
                      ? 'bg-red/8 border-red/30 hover:border-red/50'
                      : 'bg-surface-2 border-white/8 hover:border-white/15',
                  ].join(' ')}
                >
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-display text-lg font-bold uppercase tracking-wide text-white">
                        {plan.name}
                      </h3>
                      {plan.highlight && (
                        <span className="text-xs font-semibold uppercase tracking-widest text-red border border-red/30 px-2 py-0.5 rounded-full">
                          Popular
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/50">{plan.desc}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30 shrink-0 ml-4" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          CTA BAND
          ============================================================ */}
      <section
        ref={ctaRef}
        className="section-padding relative overflow-hidden"
        aria-labelledby="cta-heading"
      >
        {/* Ambient glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] bg-red/6 rounded-full blur-[100px] pointer-events-none" aria-hidden="true" />

        <div className="container-dgym text-center relative z-10">
          <p className="cta-item text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Ready to start
          </p>
          <h2
            id="cta-heading"
            className="cta-item font-display text-4xl md:text-6xl font-black uppercase tracking-tight text-white mb-5"
          >
            Your Next Rep<br />
            <span className="text-red">Starts Here</span>
          </h2>
          <p className="cta-item text-base text-white/50 max-w-md mx-auto mb-10">
            Come in, see the space, and start training. No long commitments required to get started.
          </p>
          <div className="cta-item flex flex-wrap justify-center gap-4">
            <Link to="/contact">
              <Button size="lg">Find Us</Button>
            </Link>
            <Link to="/membership">
              <Button variant="secondary" size="lg">View Plans</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <NewsletterSection />
    </>
  )
}
