import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

/*
 * CONTACT INFO NOTE:
 * Phone, email, and full address are [PLACEHOLDER] — not verified from client.
 * The contact form is UI-only in Phase 2 — no backend submission yet (Phase 3).
 */

export function ContactPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitted, setSubmitted] = useState(false)

  useGSAP(() => {
    if (!heroRef.current) return
    gsap.fromTo(
      heroRef.current.querySelectorAll('.hero-item'),
      { opacity: 0, y: 36 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
    )
  }, { scope: heroRef })

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.email.trim()) e.email = 'Email is required.'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email address.'
    if (!form.message.trim()) e.message = 'Message is required.'
    else if (form.message.trim().length < 10) e.message = 'Please write at least 10 characters.'
    return e
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    // Phase 2: UI only — no backend yet
    setErrors({})
    setSubmitted(true)
  }

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  return (
    <>
      <SEO
        title="Contact Us"
        description="Get in touch with The DGym Rosario Batangas. Inquire about membership, group classes, or personal training in Rosario, Batangas."
        canonical="https://thedgym.com/contact"
      />

      {/* Hero */}
      <div ref={heroRef} className="border-b border-white/8 section-padding">
        <div className="container-dgym">
          <p className="hero-item text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Get in touch • Rosario, Batangas
          </p>
          <h1 className="hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-white mb-4 max-w-2xl">
            Contact Us
          </h1>
          <p className="hero-item text-lg text-white/60 max-w-lg leading-relaxed">
            Questions about membership, group classes, or personal training in Rosario, Batangas? We're here to help.
          </p>
        </div>
      </div>

      <div className="container-dgym section-padding">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">

          {/* Contact Info */}
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white mb-8">
              Find Us
            </h2>

            <div className="space-y-6">
              {/* Location */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-red/10 border border-red/20 flex items-center justify-center text-red shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">Location</p>
                  <p className="text-sm text-white/70">
                    Rosario, Batangas, Philippines
                    <br />
                    <span className="text-white/40 text-xs">High End Premium Weightlifting & Powerlifting Gym</span>
                  </p>
                </div>
              </div>

              {/* Phone placeholder */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/30 shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 11.63 19.79 19.79 0 0 1 1.08 3C1.08 1.95 1.95 1.08 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6.07 6.07l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/40 mb-0.5">Phone</p>
                  <p className="text-sm text-white/30">[Contact via Facebook for direct inquiries]</p>
                </div>
              </div>

              {/* Email placeholder */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center text-white/30 shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white/40 mb-0.5">Email</p>
                  <p className="text-sm text-white/30">[Send message via form or Facebook]</p>
                </div>
              </div>

              {/* Facebook */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-red/10 border border-red/20 flex items-center justify-center text-red shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-0.5">Official Facebook</p>
                  <a
                    href="https://www.facebook.com/profile.php?id=61577169056417"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/70 hover:text-white transition-colors underline underline-offset-2"
                  >
                    The DGym Rosario Batangas (2,400+ followers)
                  </a>
                </div>
              </div>

              {/* Hours placeholder */}
              <div className="mt-4 p-5 rounded-xl border border-white/8 bg-surface">
                <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
                  Operating Hours
                </p>
                <p className="text-sm text-white/30">
                  [Hours not yet confirmed — check our Facebook page for current hours]
                </p>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white mb-8">
              Send a Message
            </h2>

            {submitted ? (
              <div className="p-8 rounded-xl border border-success/20 bg-success/5 text-center">
                <div className="w-14 h-14 rounded-full bg-success/15 border border-success/20 flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h3 className="font-display text-xl font-bold uppercase text-white mb-2">
                  Message Sent
                </h3>
                <p className="text-sm text-white/50">
                  We'll be in touch. You can also reach us on Facebook for a faster response.
                </p>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
                noValidate
                aria-label="Contact form"
              >
                <Input
                  label="Full Name"
                  placeholder="Your name"
                  value={form.name}
                  onChange={update('name')}
                  error={errors.name}
                  autoComplete="name"
                />
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={update('email')}
                  error={errors.email}
                  autoComplete="email"
                />

                {/* Textarea — manual since we only have Input */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="message" className="text-sm font-medium text-white/70">
                    Message
                  </label>
                  <textarea
                    id="message"
                    rows={5}
                    placeholder="What would you like to know?"
                    value={form.message}
                    onChange={update('message')}
                    aria-describedby={errors.message ? 'message-error' : undefined}
                    aria-invalid={errors.message ? true : undefined}
                    className={[
                      'w-full bg-surface-2 text-white text-sm',
                      'border rounded-lg px-4 py-3 resize-none',
                      'placeholder:text-white/30 focus:outline-none',
                      'transition-all duration-150',
                      errors.message
                        ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger/30'
                        : 'border-white/10 focus:border-white/30 focus:ring-1 focus:ring-white/10',
                    ].join(' ')}
                  />
                  {errors.message && (
                    <p id="message-error" className="text-xs text-danger" role="alert">
                      {errors.message}
                    </p>
                  )}
                </div>

                <Button type="submit" fullWidth size="lg">
                  Send Message
                </Button>

                <p className="text-xs text-white/40 text-center">
                  We typically respond to inquiries within 24 hours.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
