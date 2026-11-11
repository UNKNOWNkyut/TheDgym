import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight } from 'lucide-react'
import { GYM_INFO } from '@/constants/gymInfo'
import { DotPattern, useDotTheme } from '@/components/ui/dot-pattern'

const FOOTER_LINKS = {
  TRAIN: [
    { label: 'MEMBERSHIP', href: '/membership' },
    { label: 'PERSONAL TRAINING', href: '/trainers' },
    { label: 'GROUP CLASSES', href: '/classes' },
    { label: 'YOUR PLAN', href: '/your-plan' },
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

export function Footer() {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const { theme } = useDotTheme()

  const handleSubscribe = (e: FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubscribed(true)
    setEmail('')
  }

  return (
    <footer className="px-3 sm:px-6 pb-4 sm:pb-6 mt-auto" role="contentinfo">
      <div className="relative rounded-3xl overflow-hidden bg-[#0a0a0c] border border-white/10 p-8 sm:p-12 md:p-16 shadow-2xl">
        <DotPattern
          className={
            theme === 'light'
              ? 'fill-zinc-300/35 md:fill-zinc-200/45'
              : 'fill-slate-500/20 md:fill-slate-500/30'
          }
        />

        {/* Top section */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Brand & Newsletter Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
                Built for Strength.
              </h2>
              <p className="text-xs font-mono uppercase tracking-wider text-white/55 leading-relaxed max-w-sm">
                THE DGYM BRINGS TOGETHER PURPOSEFUL TRAINING, EXPERT COACHING, AND A SPACE DESIGNED TO HELP YOU KEEP PROGRESSING.
              </p>
            </div>

            {/* Facility Address & Contact Details */}
            <div className="space-y-1 text-[11px] font-mono text-white/45 max-w-sm">
              <p className="text-white/70">{GYM_INFO.streetAddress}</p>
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
              <p className="pt-0.5 text-white/35">{GYM_INFO.operatingHoursSummary}</p>
            </div>

            {/* Newsletter Input Pill */}
            <div className="pt-2 space-y-2.5 max-w-xs">
              <label
                htmlFor="footer-newsletter-email"
                className="block text-[11px] font-mono uppercase tracking-widest text-white/85"
              >
                SUBSCRIBE TO OUR NEWSLETTER
              </label>
              {subscribed ? (
                <p className="text-xs font-mono text-emerald-400 py-2">
                  ✓ Subscribed to The DGym updates.
                </p>
              ) : (
                <form
                  onSubmit={handleSubscribe}
                  className="flex items-center bg-white rounded-xl p-1 shadow-inner"
                >
                  <input
                    id="footer-newsletter-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email..."
                    required
                    className="flex-1 min-w-0 bg-transparent px-3 py-1.5 text-xs text-black placeholder:text-black/40 focus:outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Subscribe to newsletter"
                    className="w-8 h-8 rounded-lg bg-[#111114] hover:bg-red text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
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
                  <h3 className="text-[11px] font-mono uppercase tracking-widest text-white/40 mb-4">
                    {group}
                  </h3>
                  <ul className="space-y-2.5">
                    {links.map((link) => (
                      <li key={link.label}>
                        <Link
                          to={link.href}
                          className="text-xs font-mono uppercase tracking-wider text-white/75 hover:text-red transition-colors duration-150"
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
                          className="text-xs font-mono uppercase tracking-wider text-white/75 hover:text-red transition-colors duration-150"
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
            <p className="text-[11px] font-mono text-white/30">
              &copy; {CURRENT_YEAR} {GYM_INFO.facebookLabel}. All rights reserved.
            </p>
          </div>

          <p className="text-[11px] font-mono uppercase tracking-wider text-white/45 max-w-md md:text-right leading-relaxed">
            THE DGYM ROSARIO BATANGAS IS A PERFORMANCE-DRIVEN TRAINING FACILITY BUILT FOR STRENGTH, DISCIPLINE, AND LONG-TERM PROGRESS.
          </p>
        </div>
      </div>
    </footer>
  )
}
