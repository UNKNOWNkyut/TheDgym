import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

/**
 * Newsletter signup section.
 * Phase 2: UI only — no backend connection yet (Phase 3+).
 */
export function NewsletterSection() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }
    // Phase 2: No backend yet — show success UI
    setError('')
    setSubmitted(true)
  }

  return (
    <section className="border-t border-white/8 bg-surface">
      <div className="container-dgym py-16 md:py-20">
        <div className="max-w-xl mx-auto text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
            Stay in the loop
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white mb-3">
            Get Updates
          </h2>
          <p className="text-sm text-white/50 mb-8">
            New classes, promotions, and announcements delivered to your inbox.
          </p>

          {submitted ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-12 h-12 rounded-full bg-success/15 border border-success/20 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <p className="text-sm text-white/70">
                You're on the list. We'll be in touch.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row gap-3"
              noValidate
              aria-label="Newsletter signup"
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
                Subscribe
              </Button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
