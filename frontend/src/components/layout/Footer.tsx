import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { GYM_INFO } from '@/constants/gymInfo'
import { DotPattern } from '@/components/ui/dot-pattern'

const FOOTER_LINKS = {
  TRAIN: [
    { label: 'MEMBERSHIP', href: '/membership' },
    { label: 'PERSONAL TRAINING', href: '/trainers' },
    { label: 'GROUP CLASSES', href: '/classes' },
    { label: 'YOUR PLAN', href: '/dashboard/plan' },
  ],
  'THE DGYM': [
    { label: 'ABOUT', href: '/about' },
    { label: 'PROGRAMS', href: '/membership' },
    { label: 'COACHES', href: '/trainers' },
    { label: 'CONTACT', href: '/contact' },
  ],
  EXPLORE: [
    { label: 'FAQS', href: '/faq' },
    { label: 'PRIVACY POLICY', href: '/privacy' },
    { label: 'TERMS & CONDITIONS', href: '/terms' },
  ],
} as const

const CURRENT_YEAR = new Date().getFullYear()
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function Footer() {
  const [email, setEmail] = useState('')
  const [newsletterError, setNewsletterError] = useState('')
  const [draftPreparedFor, setDraftPreparedFor] = useState<string | null>(null)

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setNewsletterError('Please enter a valid email address.')
      return
    }
    setNewsletterError('')
    const subject = encodeURIComponent('Newsletter & Updates Request')
    const body = encodeURIComponent(
      `Hi The DGym team,\n\nPlease add ${trimmed} to gym updates and class announcements.`,
    )
    window.location.href = `${GYM_INFO.emailHref}?subject=${subject}&body=${body}`
    setDraftPreparedFor(trimmed)
    setEmail('')
  }

  return (
    <footer className="px-3 sm:px-6 pb-4 sm:pb-6 mt-auto" role="contentinfo">
      <div className="relative rounded-3xl overflow-hidden bg-[#0a0a0c] border border-white/10 p-8 sm:p-12 md:p-16 shadow-2xl">
        <DotPattern className="fill-slate-500/20 md:fill-slate-500/30" />

        {/* Top section */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Brand & Newsletter Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Built for Strength.
              </h2>
              <p className="text-xs font-mono uppercase tracking-wider text-white/65 leading-relaxed max-w-sm">
                THE DGYM BRINGS TOGETHER PURPOSEFUL TRAINING, EXPERT COACHING, AND A SPACE DESIGNED TO HELP YOU KEEP PROGRESSING.
              </p>
            </div>

            {/* Facility Address & Contact Details */}
            <div className="space-y-1 text-[11px] font-mono text-white/60 max-w-sm">
              <p className="text-white/80">{GYM_INFO.streetAddress}</p>
              <p>{GYM_INFO.landmark}</p>
              <p>
                <a href={GYM_INFO.phoneHref} className="hover:text-white transition-colors">
                  {GYM_INFO.phoneDisplay}
                </a>
                {' • '}
                <a href={GYM_INFO.emailHref} className="hover:text-white transition-colors break-all">
                  {GYM_INFO.email}
                </a>
              </p>
              <p className="pt-0.5 text-white/55">{GYM_INFO.operatingHoursSummary}</p>
            </div>

            {/* Newsletter / Updates Request */}
            <div className="pt-2 space-y-2.5 max-w-xs">
              <label
                htmlFor="footer-newsletter-email"
                className="block text-[11px] font-mono uppercase tracking-widest text-white/85"
              >
                REQUEST GYM UPDATES BY EMAIL
              </label>
              {draftPreparedFor ? (
                <div className="space-y-1.5 py-1 text-xs font-mono text-white/75">
                  <p>
                    Email draft opened for <span className="text-white">{draftPreparedFor}</span> to{' '}
                    <a href={GYM_INFO.emailHref} className="underline text-red hover:text-red-hover">
                      {GYM_INFO.email}
                    </a>
                    .
                  </p>
                  <button
                    type="button"
                    onClick={() => setDraftPreparedFor(null)}
                    className="text-[11px] uppercase tracking-wider text-white/55 hover:text-white underline cursor-pointer"
                  >
                    Use another email
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSubscribe}
                  noValidate
                  className="space-y-2"
                >
                  <div className="flex items-center bg-white rounded-xl p-1 shadow-inner">
                    <input
                      id="footer-newsletter-email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value)
                        if (newsletterError) setNewsletterError('')
                      }}
                      placeholder="Enter your email..."
                      aria-invalid={newsletterError ? true : undefined}
                      aria-describedby={newsletterError ? 'footer-newsletter-error' : undefined}
                      required
                      className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-xs text-black placeholder:text-black/45 focus:outline-none"
                    />
                    <button
                      type="submit"
                      aria-label="Send updates request via email"
                      className="w-8 h-8 rounded-lg bg-[#111114] hover:bg-red text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {newsletterError && (
                    <p id="footer-newsletter-error" role="alert" className="text-[11px] font-mono text-red-400">
                      {newsletterError}
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>

          {/* Navigation Columns & Media Card */}
          <div className="lg:col-span-7 flex flex-col justify-between gap-10">
            {/* 3-Column Monospace Links */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
              {Object.entries(FOOTER_LINKS).map(([group, links]) => (
                <div key={group}>
                  <h3 className="text-[11px] font-mono uppercase tracking-widest text-white/55 mb-4">
                    {group}
                  </h3>
                  <ul className="space-y-2.5">
                    {links.map((link) => (
                      <li key={link.label}>
                        <Link
                          to={link.href}
                          className="text-xs font-mono uppercase tracking-wider text-white/80 hover:text-red transition-colors duration-150"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                    {group === 'EXPLORE' && (
                      <li>
                        <a
                          href={GYM_INFO.facebookUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Follow The DGym Rosario Batangas on Facebook"
                          className="text-xs font-mono uppercase tracking-wider text-white/80 hover:text-red transition-colors duration-150"
                        >
                          FACEBOOK ↗
                        </a>
                      </li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="relative z-10 pt-12 mt-12 border-t border-white/10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <Link
              to="/"
              aria-label="The DGym — Go to homepage"
              className="inline-block transition-transform duration-200 hover:scale-[1.02]"
            >
              <img
                src="/assets/logos/thedgym.png"
                alt="The DGym Rosario Batangas Logo"
                className="h-12 sm:h-14 md:h-16 w-auto object-contain"
                loading="lazy"
              />
            </Link>
            <p className="text-[11px] font-mono text-white/55">
              &copy; {CURRENT_YEAR} {GYM_INFO.facebookLabel}. All rights reserved.
            </p>
          </div>

          <p className="text-[11px] font-mono uppercase tracking-wider text-white/60 max-w-md md:text-right leading-relaxed">
            THE DGYM ROSARIO BATANGAS IS A PERFORMANCE-DRIVEN TRAINING FACILITY BUILT FOR STRENGTH, DISCIPLINE, AND LONG-TERM PROGRESS.
          </p>
        </div>
      </div>
    </footer>
  )
}
