import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { GYM_INFO } from '@/constants/gymInfo'

gsap.registerPlugin(ScrollTrigger)

const FAQS = [
  {
    q: 'Do I need a membership to use the gym?',
    a: 'Walk-ins are welcome with a ₱400 Day Pass for full one-day equipment and locker access—no sign-up required.',
  },
  {
    q: 'Are group classes included with membership?',
    a: 'Yes. Active members enjoy unlimited free (₱0) access to our 6:00 PM TABATA and HIIT group classes. Day passes cover equipment and locker access only.',
  },
  {
    q: 'How do I book a personal training session?',
    a: `Registered members can book directly from their portal, or contact us at ${GYM_INFO.phoneDisplay} / ${GYM_INFO.email} to arrange a 12-session coaching package.`,
  },
  {
    q: 'What equipment is available?',
    a: 'We feature top-tier strength and cardio equipment, free weights, barbells, resistance machines, lounge and workspace access, and free facility-wide Wi-Fi.',
  },
  {
    q: 'Where is The DGym located?',
    a: `We are located at ${GYM_INFO.fullAddress}.`,
  },
  {
    q: 'What are your operating hours?',
    a: 'We are open Monday to Saturday from 6:00 AM to 11:00 PM, and Sunday from 2:00 PM to 10:00 PM. Holiday hours depend on the specific holiday.',
  },
  {
    q: 'Can I cancel or refund my membership?',
    a: `All memberships, personal training packages, and day passes are strictly non-refundable once availed. Reach out to ${GYM_INFO.email} if you have questions before subscribing.`,
  },
  {
    q: 'Is personal training suitable for beginners?',
    a: 'Yes. Our certified coaches work with all fitness levels—from beginners building safe form to experienced lifters and boxers.',
  },
]

function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)

  const toggle = () => setOpen((prev) => !prev)

  useGSAP(() => {
    const el = bodyRef.current
    if (!el) return
    if (open) {
      gsap.fromTo(el, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: 0.3, ease: 'power3.out' })
    } else {
      gsap.to(el, { height: 0, opacity: 0, duration: 0.25, ease: 'power2.in' })
    }
  }, [open])

  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        onClick={toggle}
        aria-expanded={open}
        className={[
          'w-full flex items-center justify-between gap-4',
          'py-5 text-left',
          'focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2 rounded-sm',
          'group transition-colors duration-150',
        ].join(' ')}
      >
        <span
          className={[
            'text-base font-medium transition-colors duration-150',
            open ? 'text-white' : 'text-white/70 group-hover:text-white',
          ].join(' ')}
        >
          {q}
        </span>
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={[
            'shrink-0 text-white/30 transition-transform duration-300',
            open ? 'rotate-180 text-red' : '',
          ].join(' ')}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        ref={bodyRef}
        className="overflow-hidden h-0 opacity-0"
        aria-hidden={!open}
      >
        <p className="text-sm text-white/55 leading-relaxed pb-5 max-w-2xl">
          {a}
        </p>
      </div>
    </div>
  )
}

export function FAQPage() {
  const heroRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!heroRef.current) return
    gsap.fromTo(
      heroRef.current.querySelectorAll('.hero-item'),
      { opacity: 0, y: 36 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
    )
  }, { scope: heroRef })

  return (
    <>
      <SEO
        title="FAQ"
        description="Frequently asked questions about The DGym Rosario Batangas. Membership, classes, personal training, hours, and more."
        canonical="https://thedgym.com/faq"
      />

      {/* Hero */}
      <div ref={heroRef} className="border-b border-white/8 section-padding">
        <div className="container-dgym">
          <p className="hero-item text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            FAQ • Rosario, Batangas
          </p>
          <h1 className="hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-white mb-4 max-w-2xl">
            Common Questions
          </h1>
          <p className="hero-item text-lg text-white/60 max-w-lg leading-relaxed">
            Quick answers to what most people ask before joining The DGym in Rosario, Batangas.
          </p>
        </div>
      </div>

      {/* FAQ list */}
      <div className="container-dgym py-16 md:py-20">
        <div className="max-w-3xl">
          {FAQS.map((item) => (
            <FAQItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>

        <div className="mt-14 p-6 rounded-xl border border-white/8 bg-surface max-w-3xl">
          <p className="text-sm text-white/50">
            Don't see your question here? Call{' '}
            <a href={GYM_INFO.phoneHref} className="text-white/80 hover:text-white underline underline-offset-2 transition-colors">
              {GYM_INFO.phoneDisplay}
            </a>
            ,{' '}
            <a
              href={GYM_INFO.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-white/80 hover:text-white underline underline-offset-2 transition-colors"
            >
              message us on Facebook
            </a>
            , or use our{' '}
            <Link to="/contact" className="text-white/80 hover:text-white underline underline-offset-2 transition-colors">
              contact form
            </Link>.
          </p>
        </div>
      </div>
    </>
  )
}
