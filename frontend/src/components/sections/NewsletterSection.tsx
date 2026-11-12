import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GYM_INFO } from '@/constants/gymInfo'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim())
}

function buildUpdatesMailtoUrl(trimmedEmail: string): string {
  const subject = encodeURIComponent('Newsletter & Updates Request')
  const body = encodeURIComponent(
    `Hi The DGym team,\n\nPlease add ${trimmedEmail} to gym updates and class announcements.`,
  )
  return `${GYM_INFO.emailHref}?subject=${subject}&body=${body}`
}

/**
 * Newsletter updates section.
 * Opens a pre-filled email request to GYM_INFO.email (no automated mailing backend).
 */
export function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [draftPrepared, setDraftPrepared] = useState<{
    email: string
    mailtoUrl: string
  } | null>(null)
  const [error, setError] = useState('')

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim()
    if (!isValidEmail(trimmed)) {
      setError('Please enter a valid email address.')
      return
    }
    const mailtoUrl = buildUpdatesMailtoUrl(trimmed)
    setError('')
    setDraftPrepared({ email: trimmed, mailtoUrl })
    setEmail('')
    window.location.href = mailtoUrl
  }

  return (
    <section className="border-t border-white/10 bg-surface">
      <div className="container-dgym py-16 md:py-20">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/55 mb-3">
            Stay in the loop
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white mb-3">
            Get Gym Updates
          </h2>
          <p className="text-sm text-white/65 mb-8">
            Request class schedules, promos, and announcements via email or follow our official
            Facebook page.
          </p>

          {draftPrepared ? (
            <div
              role="status"
              className="flex flex-col items-center gap-4 py-5 px-6 rounded-2xl border border-white/10 bg-surface-2"
            >
              <p className="text-sm text-white/80 leading-relaxed">
                Email draft opened for{' '}
                <span className="font-semibold text-white">{draftPrepared.email}</span> to{' '}
                <a
                  href={GYM_INFO.emailHref}
                  className="text-red hover:text-red-hover underline underline-offset-2 break-all"
                >
                  {GYM_INFO.email}
                </a>
                .
              </p>

              <div className="flex flex-wrap items-center justify-center gap-3 text-xs">
                <a
                  href={draftPrepared.mailtoUrl}
                  className="px-4 py-2 rounded-lg bg-red hover:bg-red-hover text-white font-semibold transition-colors"
                >
                  Open Email Draft
                </a>
                <a
                  href={GYM_INFO.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg border border-white/15 text-white/80 hover:text-white hover:bg-white/10 font-semibold transition-colors"
                >
                  Follow on Facebook
                </a>
                <button
                  type="button"
                  onClick={() => setDraftPrepared(null)}
                  className="text-white/60 hover:text-white underline underline-offset-2 cursor-pointer"
                >
                  Use another email
                </button>
              </div>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3"
              noValidate
              aria-label="Gym updates email request"
            >
              <div className="flex-1">
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (error) setError('')
                  }}
                  error={error}
                  aria-label="Email address"
                  autoComplete="email"
                />
              </div>
              <Button type="submit" size="md" className="shrink-0 sm:self-start">
                Request Updates
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
