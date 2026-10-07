import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

gsap.registerPlugin(ScrollTrigger)

/*
 * MEMBERSHIP PRICING NOTE:
 * Prices are [PLACEHOLDER] — actual pricing not yet verified from client.
 * Tier names (Day Pass, Monthly, Quarterly) are reasonable industry standard.
 * Do NOT present placeholders as real prices.
 */

const PLANS = [
  {
    name: 'Day Pass',
    price: null, // [PLACEHOLDER]
    period: 'per visit',
    description: 'Full gym access for one day. No commitment.',
    features: [
      'Full equipment access',
      'Locker use',
      'No sign-up required',
    ],
    highlight: false,
    badge: null,
  },
  {
    name: 'Monthly',
    price: null, // [PLACEHOLDER]
    period: 'per month',
    description: 'Unlimited access, billed monthly. Cancel anytime.',
    features: [
      'Unlimited gym access',
      'Group class access',
      'Locker use',
      'Flexible — month to month',
    ],
    highlight: true,
    badge: 'Most Popular',
  },
  {
    name: 'Quarterly',
    price: null, // [PLACEHOLDER]
    period: 'per quarter',
    description: 'Three months upfront. Best value per session.',
    features: [
      'Everything in Monthly',
      'Better rate per session',
      'Priority class booking',
      'One PT session included',
    ],
    highlight: false,
    badge: 'Best Value',
  },
]

export function MembershipPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const plansRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!heroRef.current) return
    gsap.fromTo(
      heroRef.current.querySelectorAll('.hero-item'),
      { opacity: 0, y: 36 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
    )
  }, { scope: heroRef })

  useGSAP(() => {
    if (!plansRef.current) return
    plansRef.current.querySelectorAll('.plan-card').forEach((el, i) => {
      gsap.fromTo(el, { opacity: 0, y: 40 }, {
        opacity: 1, y: 0, duration: 0.6, ease: 'power3.out', delay: i * 0.08,
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      })
    })
  }, { scope: plansRef })

  return (
    <>
      <SEO
        title="Membership Plans"
        description="View The DGym membership plans in Rosario, Batangas. Day passes, monthly, and quarterly options. High End Premium Fitness Gym."
        canonical="https://thedgym.com/membership"
        ogImage="/assets/images/dgym_bg.jpg"
      />

      {/* Hero */}
      <div ref={heroRef} className="border-b border-white/8 section-padding">
        <div className="container-dgym">
          <p className="hero-item text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Membership • Rosario, Batangas
          </p>
          <h1 className="hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-white mb-4 max-w-2xl">
            Plans That Fit<br />Your Training
          </h1>
          <p className="hero-item text-lg text-white/60 max-w-lg leading-relaxed">
            Simple, transparent options for lifters and fitness enthusiasts in Rosario, Batangas. Contact us for current pricing.
          </p>
        </div>
      </div>

      {/* Pricing notice */}
      <div className="border-b border-white/8 bg-surface">
        <div className="container-dgym py-4">
          <p className="text-sm text-white/40">
            <span className="text-warning font-medium">Note:</span>{' '}
            Pricing is not yet listed online. Reach out via{' '}
            <a href="https://www.facebook.com/profile.php?id=61577169056417" target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white underline underline-offset-2 transition-colors">
              The DGym Rosario Batangas Facebook Page
            </a>{' '}
            or our{' '}
            <Link to="/contact" className="text-white/70 hover:text-white underline underline-offset-2 transition-colors">
              contact form
            </Link>{' '}
            to get current rates.
          </p>
        </div>
      </div>

      {/* Plans */}
      <div ref={plansRef} className="container-dgym section-padding">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 max-w-5xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={[
                'plan-card relative flex flex-col rounded-2xl border p-8 transition-all duration-200',
                plan.highlight
                  ? 'bg-surface border-red/30 hover:border-red/50 shadow-[0_0_40px_rgba(229,32,26,0.1)]'
                  : 'bg-surface border-white/8 hover:border-white/15',
              ].join(' ')}
            >
              {/* Badge */}
              {plan.badge && (
                <div className="absolute -top-3 left-6">
                  <Badge variant={plan.highlight ? 'red' : 'default'}>
                    {plan.badge}
                  </Badge>
                </div>
              )}

              <div className="mb-6">
                <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white mb-2">
                  {plan.name}
                </h2>
                {/* Price placeholder */}
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-bold text-white/20 font-mono tracking-tight">
                    —
                  </span>
                  <span className="text-sm text-white/30">{plan.period}</span>
                </div>
                <p className="text-sm text-white/50 leading-relaxed">
                  {plan.description}
                </p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-3 text-sm text-white/60">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <Link to="/contact" className="block">
                <Button
                  fullWidth
                  variant={plan.highlight ? 'primary' : 'secondary'}
                >
                  Ask About This Plan
                </Button>
              </Link>
            </div>
          ))}
        </div>

        {/* All plans note */}
        <p className="text-center text-sm text-white/30 mt-10">
          All memberships include full equipment access during operating hours.
          Personal training is available as an add-on.
        </p>
      </div>
    </>
  )
}
