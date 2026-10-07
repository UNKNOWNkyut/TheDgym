import { useState, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { useAuth } from '@/context/AuthContext'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@thedgym.com', pass: 'admin12345', badge: 'Full Access' },
  { role: 'Staff', email: 'staff@thedgym.com', pass: 'staff12345', badge: 'Front Desk' },
  { role: 'Trainer', email: 'trainer@thedgym.com', pass: 'trainer12345', badge: 'Coaching' },
  { role: 'Member', email: 'member@thedgym.com', pass: 'member12345', badge: 'Client' },
]

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const { login, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Redirect destination after login
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'

  // Animate card entrance
  useGSAP(() => {
    if (!cardRef.current) return
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 30, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' }
    )
  }, { scope: cardRef })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setValidationError(null)
    clearError()

    if (!email || !email.includes('@')) {
      setValidationError('Please enter a valid email address.')
      return
    }
    if (!password) {
      setValidationError('Please enter your password.')
      return
    }

    try {
      const loggedInUser = await login({ email, password })
      const defaultDest = (loggedInUser.role === 'admin' || loggedInUser.role === 'staff') ? '/manage' : '/dashboard'
      const dest = (from && from !== '/dashboard' && from !== '/' && !from.startsWith('/login')) ? from : defaultDest
      navigate(dest, { replace: true })
    } catch {
      // Error is stored in context and displayed
    }
  }

  const fillDemo = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail)
    setPassword(demoPass)
    setValidationError(null)
    clearError()
  }

  return (
    <>
      <SEO
        title="Sign In"
        description="Sign in to The DGym member and staff portal."
        canonical="https://thedgym.com/login"
      />

      <div className="min-h-[85vh] flex items-center justify-center py-16 px-4">
        {/* Ambient background glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[300px] bg-red/6 rounded-full blur-[120px] pointer-events-none" />

        <div
          ref={cardRef}
          className="relative z-10 w-full max-w-md p-8 md:p-10 rounded-2xl bg-surface/90 border border-white/10 backdrop-blur-xl shadow-2xl"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <Link to="/" className="inline-block mb-4">
              <img
                src="/assets/logos/thedgym.png"
                alt="The DGym"
                width={160}
                height={50}
                className="h-10 w-auto mx-auto object-contain"
              />
            </Link>
            <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
              Welcome Back
            </h1>
            <p className="text-xs uppercase tracking-widest text-white/40 mt-1">
              Sign in to your DGym account
            </p>
          </div>

          {/* Error Banner */}
          {(validationError || error) && (
            <div
              role="alert"
              className="mb-6 p-4 rounded-xl border border-red/30 bg-red/10 text-white flex items-start gap-3 text-sm animate-fade-in"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red shrink-0 mt-0.5">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{validationError || error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Input
                label="Email Address"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <Input
                label="Password"
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <Button
              type="submit"
              size="lg"
              loading={isLoading}
              className="w-full mt-2"
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>

          {/* Sign up prompt */}
          <p className="text-center text-xs text-white/40 mt-6">
            Don't have an account yet?{' '}
            <Link
              to="/register"
              className="text-white hover:text-red font-medium underline underline-offset-2 transition-colors duration-150"
            >
              Register here
            </Link>
          </p>

          {/* Quick Demo Accounts Selection */}
          <div className="mt-8 pt-6 border-t border-white/8">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 text-center mb-3">
              One-Click Role Demo Logins
            </p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc.email, acc.pass)}
                  className="p-2.5 rounded-lg border border-white/8 bg-surface-2 hover:border-white/20 hover:bg-white/5 transition-all duration-150 text-left group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white group-hover:text-red transition-colors">
                      {acc.role}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-white/30 px-1.5 py-0.5 rounded bg-white/5">
                      {acc.badge}
                    </span>
                  </div>
                  <p className="text-[10px] text-white/40 font-mono truncate mt-0.5">
                    {acc.email}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
