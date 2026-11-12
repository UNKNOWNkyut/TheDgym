import { useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { GYM_INFO } from '@/constants/gymInfo'
import { PUBLIC_PLANS } from '@/constants/plans'

gsap.registerPlugin(ScrollTrigger)

interface FAQEntry {
  q: string
  a: string
}

const DAY_PASS_PRICE = PUBLIC_PLANS.find((plan) => plan.slug === 'day-pass')?.priceFormatted ?? '₱400'

const FAQS: readonly FAQEntry[] = [
  {
    q: 'Do I need a membership to use the gym?',
    a: `Walk-ins are welcome with a ${DAY_PASS_PRICE} Day Pass for full one-day equipment and locker access—no sign-up required.`,
  },
  {
    q: 'Are group classes included with membership?',
    a: 'Yes. Active members enjoy unlimited free (₱0) access to our 6:00 PM TABATA and HIIT group classes. Day passes cover equipment and locker access only.',
  },
  {
    q: 'How do I book a personal training session?',
    a: `Members with an active plan can book directly from their portal, or contact us at ${GYM_INFO.phoneDisplay} / ${GYM_INFO.email} to arrange a 12-session coaching package.`,
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

function toggleFaqQuestion(openQuestions: string[], question: string): string[] {
  return openQuestions.includes(question)
    ? openQuestions.filter((item) => item !== question)
    : [...openQuestions, question]
}

function areAllFaqsOpen(openQuestions: readonly string[], entries: readonly FAQEntry[]): boolean {
  return entries.length > 0 && entries.every((entry) => openQuestions.includes(entry.q))
}

function FAQItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string
  a: string
  open: boolean
  onToggle: () => void
}) {
  const itemRef = useRef<HTMLDivElement>(null)
  const answerRef = useRef<HTMLParagraphElement>(null)
  const buttonId = useId()
  const panelId = useId()

  useGSAP(
    () => {
      if (!open || !answerRef.current) return
      gsap.fromTo(
        answerRef.current,
        { opacity: 0, y: -6 },
        { opacity: 1, y: 0, duration: 0.25, ease: 'power2.out' },
      )
    },
    { scope: itemRef, dependencies: [open] },
  )

  return (
    <div ref={itemRef} className="border-b border-zinc-200 dark:border-white/8 last:border-0">
      <button
        id={buttonId}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={[
          'w-full flex items-center justify-between gap-4 cursor-pointer',
          'py-5 text-left',
          'focus-visible:outline-2 focus-visible:outline-zinc-900/50 dark:focus-visible:outline-white/50 focus-visible:outline-offset-2 rounded-sm',
          'group transition-colors duration-150',
        ].join(' ')}
      >
        <span
          className={[
            'text-base font-medium transition-colors duration-150',
            open
              ? 'text-zinc-950 dark:text-white'
              : 'text-zinc-800 dark:text-white/75 group-hover:text-zinc-950 dark:group-hover:text-white',
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
            'shrink-0 transition-transform duration-300',
            open
              ? 'rotate-180 text-red'
              : 'text-zinc-400 dark:text-white/40 group-hover:text-zinc-700 dark:group-hover:text-white/70',
          ].join(' ')}
          aria-hidden="true"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        aria-hidden={!open}
        className={[
          'grid transition-[grid-template-rows] duration-250 ease-out',
          open ? 'grid-rows-[1fr] visible' : 'grid-rows-[0fr] invisible',
        ].join(' ')}
      >
        <div className="overflow-hidden">
          <p
            ref={answerRef}
            className="text-sm text-zinc-600 dark:text-white/65 leading-relaxed pb-5 max-w-2xl"
          >
            {a}
          </p>
        </div>
      </div>
    </div>
  )
}

export function FAQPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [openQuestions, setOpenQuestions] = useState<string[]>([])
  const allExpanded = areAllFaqsOpen(openQuestions, FAQS)

  useGSAP(
    () => {
      if (!heroRef.current) return
      gsap.fromTo(
        heroRef.current.querySelectorAll('.hero-item'),
        { opacity: 0, y: 36 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 },
      )
    },
    { scope: heroRef },
  )

  return (
    <>
      <SEO
        title="FAQ"
        description="Frequently asked questions about The DGym Rosario Batangas. Membership, classes, personal training, hours, and more."
        canonical="https://thedgym.com/faq"
      />

      {/* Hero */}
      <div ref={heroRef} className="border-b border-zinc-200 dark:border-white/8 section-padding">
        <div className="container-dgym">
          <p className="hero-item text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
            FAQ • Rosario, Batangas
          </p>
          <h1 className="hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-zinc-950 dark:text-white mb-4 max-w-2xl">
            Common Questions
          </h1>
          <p className="hero-item text-lg text-zinc-600 dark:text-zinc-400 max-w-lg leading-relaxed">
            Quick answers to what most people ask before joining The DGym in Rosario, Batangas.
          </p>
        </div>
      </div>

      {/* FAQ list */}
      <div className="container-dgym py-16 md:py-20">
        <div className="max-w-3xl flex items-center justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/8 mb-2">
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 dark:text-zinc-400">
            {FAQS.length} Questions
          </span>
          <button
            type="button"
            onClick={() => setOpenQuestions(allExpanded ? [] : FAQS.map((item) => item.q))}
            className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-white/60 hover:text-red dark:hover:text-white transition-colors cursor-pointer"
          >
            {allExpanded ? 'Collapse All' : 'Expand All'}
          </button>
        </div>

        <div className="max-w-3xl">
          {FAQS.map((item) => (
            <FAQItem
              key={item.q}
              q={item.q}
              a={item.a}
              open={openQuestions.includes(item.q)}
              onToggle={() => setOpenQuestions((prev) => toggleFaqQuestion(prev, item.q))}
            />
          ))}
        </div>

        <div className="mt-14 p-6 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-surface max-w-3xl shadow-sm dark:shadow-none">
          <p className="text-sm text-zinc-600 dark:text-white/65">
            Don't see your question here? Call{' '}
            <a
              href={GYM_INFO.phoneHref}
              className="font-medium text-zinc-900 dark:text-white underline underline-offset-2 hover:text-red dark:hover:text-red transition-colors"
            >
              {GYM_INFO.phoneDisplay}
            </a>
            ,{' '}
            <a
              href={GYM_INFO.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-zinc-900 dark:text-white underline underline-offset-2 hover:text-red dark:hover:text-red transition-colors"
            >
              message us on Facebook
            </a>
            , or use our{' '}
            <Link
              to="/contact"
              className="font-medium text-zinc-900 dark:text-white underline underline-offset-2 hover:text-red dark:hover:text-red transition-colors"
            >
              contact form
            </Link>
            .
          </p>
        </div>
      </div>
    </>
  )
}
