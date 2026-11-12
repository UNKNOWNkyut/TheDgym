import { useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GYM_INFO } from '@/constants/gymInfo'

/*
 * CONTACT INFO NOTE:
 * Verified address, phone, email, and operating hours from GYM_INFO.
 * Inquiries prepare a pre-filled email draft to GYM_INFO.email rather than claiming server delivery.
 */

interface ContactFormValues {
  name: string
  email: string
  message: string
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateContactForm(form: ContactFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!form.name.trim()) errors.name = 'Name is required.'
  if (!form.email.trim()) errors.email = 'Email is required.'
  else if (!EMAIL_PATTERN.test(form.email.trim())) errors.email = 'Enter a valid email address.'
  if (!form.message.trim()) errors.message = 'Message is required.'
  else if (form.message.trim().length < 10) errors.message = 'Please write at least 10 characters.'
  return errors
}

function buildContactMailtoUrl(form: ContactFormValues): string {
  const trimmedName = form.name.trim()
  const trimmedEmail = form.email.trim()
  const trimmedMessage = form.message.trim()
  const subject = `The DGym Inquiry from ${trimmedName}`
  const body = `Name: ${trimmedName}\nReply Email: ${trimmedEmail}\n\n${trimmedMessage}`
  return `mailto:${GYM_INFO.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}

function formatInquiryClipboardText(form: ContactFormValues): string {
  return `To: ${GYM_INFO.email}\nFrom: ${form.name.trim()} <${form.email.trim()}>\n\n${form.message.trim()}`
}

function getContactInputClasses(hasError: boolean): string {
  return [
    '!bg-white !text-zinc-900 placeholder:!text-zinc-400 dark:!bg-surface-2 dark:!text-white dark:placeholder:!text-white/30',
    hasError
      ? ''
      : '!border-zinc-300 focus:!border-zinc-500 dark:!border-white/10 dark:focus:!border-white/30',
  ]
    .filter(Boolean)
    .join(' ')
}

export function ContactPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const [form, setForm] = useState<ContactFormValues>({ name: '', email: '', message: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [draftUrl, setDraftUrl] = useState<string | null>(null)
  const [copyFeedback, setCopyFeedback] = useState<'idle' | 'copied' | 'failed'>('idle')

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateContactForm(form)
    if (Object.keys(errs).length > 0) {
      setErrors(errs)
      return
    }
    const mailtoUrl = buildContactMailtoUrl(form)
    setErrors({})
    setCopyFeedback('idle')
    setDraftUrl(mailtoUrl)
    window.location.href = mailtoUrl
  }

  const handleCopyInquiry = async () => {
    try {
      await navigator.clipboard.writeText(formatInquiryClipboardText(form))
      setCopyFeedback('copied')
    } catch {
      setCopyFeedback('failed')
    }
  }

  const update =
    (field: keyof ContactFormValues) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
      <div ref={heroRef} className="border-b border-zinc-200 dark:border-white/8 section-padding">
        <div className="container-dgym">
          <p className="hero-item text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
            Get in touch • Rosario, Batangas
          </p>
          <h1 className="hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-zinc-950 dark:text-white mb-4 max-w-2xl">
            Contact Us
          </h1>
          <p className="hero-item text-lg text-zinc-600 dark:text-zinc-400 max-w-lg leading-relaxed">
            Questions about membership, group classes, or personal training in Rosario, Batangas?
            Reach us directly or prepare an email inquiry below.
          </p>
        </div>
      </div>

      <div className="container-dgym section-padding">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Contact Info */}
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-zinc-950 dark:text-white mb-8">
              Find Us
            </h2>

            <div className="space-y-6">
              {/* Location */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-red/10 border border-red/20 flex items-center justify-center text-red shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white mb-0.5">
                    Location
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {GYM_INFO.streetAddress}
                    <br />
                    <span className="text-zinc-500 dark:text-zinc-400 text-xs">
                      {GYM_INFO.landmark}
                    </span>
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-red/10 border border-red/20 flex items-center justify-center text-red shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.17 11.63 19.79 19.79 0 0 1 1.08 3C1.08 1.95 1.95 1.08 3 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.09 8.91a16 16 0 0 0 6.07 6.07l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white mb-0.5">
                    Phone
                  </p>
                  <a
                    href={GYM_INFO.phoneHref}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors underline underline-offset-2"
                  >
                    {GYM_INFO.phoneDisplay} ({GYM_INFO.phoneInternational})
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-red/10 border border-red/20 flex items-center justify-center text-red shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white mb-0.5">
                    Email
                  </p>
                  <a
                    href={GYM_INFO.emailHref}
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors underline underline-offset-2 break-all"
                  >
                    {GYM_INFO.email}
                  </a>
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
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white mb-0.5">
                    Official Facebook
                  </p>
                  <a
                    href={GYM_INFO.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors underline underline-offset-2"
                  >
                    {GYM_INFO.facebookLabel}
                  </a>
                </div>
              </div>

              {/* Operating Hours */}
              <div className="mt-4 p-5 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-surface">
                <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/55 mb-3">
                  Operating Hours
                </p>
                <div className="space-y-2">
                  {GYM_INFO.operatingHours.map((entry) => (
                    <div
                      key={entry.days}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <span className="text-zinc-600 dark:text-white/65">{entry.days}</span>
                      <span className="text-zinc-950 dark:text-white font-medium text-right">
                        {entry.hours}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Email Inquiry Composer */}
          <div>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-zinc-950 dark:text-white mb-8">
              Send an Email Inquiry
            </h2>

            {draftUrl ? (
              <div
                role="status"
                className="p-8 rounded-xl border border-zinc-200 bg-zinc-50 dark:border-white/10 dark:bg-surface space-y-5 text-center"
              >
                <div className="w-12 h-12 rounded-full bg-red/10 border border-red/20 flex items-center justify-center mx-auto text-red">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </div>

                <div className="space-y-2">
                  <h3 className="font-display text-xl font-bold uppercase text-zinc-950 dark:text-white">
                    Email Draft Prepared
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-md mx-auto">
                    If your default mail app did not open automatically, use the draft link below or
                    copy your inquiry to email{' '}
                    <span className="font-medium text-zinc-900 dark:text-white break-all">
                      {GYM_INFO.email}
                    </span>{' '}
                    directly.
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-1">
                  <a
                    href={draftUrl}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg bg-red hover:bg-red-hover text-white text-sm font-semibold transition-colors"
                  >
                    Open Email Draft
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyInquiry}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-zinc-300 text-zinc-900 hover:bg-zinc-100 dark:border-white/15 dark:text-white dark:hover:bg-white/10 text-sm font-semibold transition-colors cursor-pointer"
                  >
                    {copyFeedback === 'copied'
                      ? 'Copied to Clipboard'
                      : copyFeedback === 'failed'
                        ? 'Clipboard Unavailable'
                        : 'Copy Message'}
                  </button>
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-center gap-4 text-xs">
                  <a
                    href={GYM_INFO.facebookUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2"
                  >
                    Message us on Facebook
                  </a>
                  <button
                    type="button"
                    onClick={() => setDraftUrl(null)}
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white underline underline-offset-2 cursor-pointer"
                  >
                    Edit Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="space-y-5"
                noValidate
                aria-label="Email inquiry form"
              >
                <Input
                  label="Full Name"
                  labelClassName="text-zinc-700 dark:text-white/70"
                  placeholder="Your name"
                  value={form.name}
                  onChange={update('name')}
                  error={errors.name}
                  autoComplete="name"
                  className={getContactInputClasses(Boolean(errors.name))}
                />
                <Input
                  label="Email Address"
                  labelClassName="text-zinc-700 dark:text-white/70"
                  type="email"
                  placeholder="your@email.com"
                  value={form.email}
                  onChange={update('email')}
                  error={errors.email}
                  autoComplete="email"
                  className={getContactInputClasses(Boolean(errors.email))}
                />

                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="message"
                    className="text-sm font-medium text-zinc-700 dark:text-white/70"
                  >
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
                      'w-full bg-white text-zinc-900 placeholder:text-zinc-400',
                      'dark:bg-surface-2 dark:text-white dark:placeholder:text-white/30',
                      'text-sm border rounded-lg px-4 py-3 resize-none',
                      'focus:outline-none transition-all duration-150',
                      errors.message
                        ? 'border-danger focus:border-danger focus:ring-1 focus:ring-danger/30'
                        : 'border-zinc-300 focus:border-zinc-500 dark:border-white/10 dark:focus:border-white/30 focus:ring-1 focus:ring-zinc-400/20 dark:focus:ring-white/10',
                    ].join(' ')}
                  />
                  {errors.message && (
                    <p id="message-error" className="text-xs text-danger" role="alert">
                      {errors.message}
                    </p>
                  )}
                </div>

                <Button type="submit" fullWidth size="lg">
                  Prepare Email Inquiry
                </Button>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center">
                  Opens a pre-filled email draft to {GYM_INFO.email}, or contact us by phone or
                  Facebook above.
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
