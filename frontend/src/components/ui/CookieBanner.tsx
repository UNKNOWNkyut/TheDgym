import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'

const STORAGE_KEY = 'dgym_cookie_consent'

export function CookieBanner() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY)
    if (!consent) {
      // Delay slightly so it doesn't flash on load
      const t = setTimeout(() => setVisible(true), 1200)
      return () => clearTimeout(t)
    }
  }, [])

  const accept = () => {
    localStorage.setItem(STORAGE_KEY, 'accepted')
    setVisible(false)
  }

  const decline = () => {
    localStorage.setItem(STORAGE_KEY, 'declined')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label="Cookie consent"
      className={[
        'fixed bottom-0 left-0 right-0 z-[100]',
        'bg-surface/95 backdrop-blur-md',
        'border-t border-white/8',
        'px-4 py-4 md:py-5',
        'animate-in fade-in slide-in-from-bottom-4 duration-300',
      ].join(' ')}
    >
      <div className="container-dgym flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
        <p className="text-sm text-white/60 max-w-2xl">
          We use cookies to improve your experience on our site. By continuing to browse, you agree to our use of cookies.{' '}
          <a
            href="/privacy"
            className="text-white/80 underline underline-offset-2 hover:text-white transition-colors"
          >
            Privacy Policy
          </a>
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={decline}
            className="text-sm text-white/40 hover:text-white/70 transition-colors focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2 rounded"
          >
            Decline
          </button>
          <Button size="sm" onClick={accept}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}
