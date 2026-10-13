
import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { useAuth } from '@/context/AuthContext'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { QuarterRing } from '@/components/ui/quarter-ring'

const DEMO_ACCOUNTS = [
  { role: 'Admin', email: 'admin@thedgym.com', pass: 'admin12345', badge: 'Full Access' },
  { role: 'Staff', email: 'staff@thedgym.com', pass: 'staff12345', badge: 'Front Desk' },
  { role: 'Trainer', email: 'trainer@thedgym.com', pass: 'trainer12345', badge: 'Coach' },
  { role: 'Active Member', email: 'member@thedgym.com', pass: 'member12345', badge: 'Verified Plan' },
  { role: 'Registered User', email: 'user@thedgym.com', pass: 'user12345', badge: 'No Plan' },
]

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showLoading, setShowLoading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const googleBtnContainerRef = useRef<HTMLDivElement>(null)
  const [gisLoaded, setGisLoaded] = useState(false)

  const { login, loginWithGoogle, isLoading, error, clearError } = useAuth()
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

    // Show loading screen
    setShowLoading(true)

    try {
      // Keep loading ring visible for a snappy, polished transition
      const [loggedInUser] = await Promise.all([
        login({ email, password }),
        new Promise<void>((resolve) => setTimeout(resolve, 800)),
      ])

      const defaultDest = (loggedInUser.role === 'admin' || loggedInUser.role === 'staff') ? '/manage' : (loggedInUser.has_active_membership ? '/dashboard' : '/')
      const dest = (from && from !== '/dashboard' && from !== '/' && !from.startsWith('/login')) ? from : defaultDest

      navigate(dest, { replace: true })
    } catch {
      // Hide loading screen if login fails
      setShowLoading(false)
      // Error is stored in context and displayed
    }
  }

  const handleGoogleCredential = async (credential: string) => {
    setShowLoading(true)
    try {
      const [loggedInUser] = await Promise.all([
        loginWithGoogle(credential),
        new Promise<void>((resolve) => setTimeout(resolve, 800)),
      ])
      const defaultDest = (loggedInUser.role === 'admin' || loggedInUser.role === 'staff') ? '/manage' : (loggedInUser.has_active_membership ? '/dashboard' : '/')
      const dest = (from && from !== '/dashboard' && from !== '/' && !from.startsWith('/login')) ? from : defaultDest
      navigate(dest, { replace: true })
    } catch {
      setShowLoading(false)
    }
  }

  useEffect(() => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) return

    const initGIS = () => {
      if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
        const google = (window as any).google
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (res: { credential?: string }) => {
            if (res?.credential) {
              handleGoogleCredential(res.credential)
            }
          },
        })

        if (googleBtnContainerRef.current) {
          googleBtnContainerRef.current.innerHTML = ''
          const containerWidth = Math.min(Math.max(googleBtnContainerRef.current.offsetWidth || 360, 200), 400)
          google.accounts.id.renderButton(googleBtnContainerRef.current, {
            theme: 'filled_black',
            size: 'large',
            shape: 'pill',
            width: containerWidth,
            text: 'signin_with',
            logo_alignment: 'left',
          })
          setGisLoaded(true)
        }

        try {
          google.accounts.id.prompt()
        } catch {
          // Ignore One Tap prompt errors if dismissed or in cooldown
        }
      }
    }

    if ((window as any).google?.accounts?.id) {
      initGIS()
    } else {
      const interval = setInterval(() => {
        if ((window as any).google?.accounts?.id) {
          initGIS()
          clearInterval(interval)
        }
      }, 250)
      return () => clearInterval(interval)
    }
  }, [from, navigate])

  const handleGoogleSignInClick = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
    if (!clientId) {
      setValidationError('Google Client ID is not yet configured. Please set VITE_GOOGLE_CLIENT_ID in your environment file.')
      return
    }

    if (typeof window !== 'undefined' && (window as any).google?.accounts?.id) {
      const google = (window as any).google
      google.accounts.id.initialize({
        client_id: clientId,
        callback: (res: { credential?: string }) => {
          if (res?.credential) {
            handleGoogleCredential(res.credential)
          }
        },
      })
      if (googleBtnContainerRef.current) {
        googleBtnContainerRef.current.innerHTML = ''
        const containerWidth = Math.min(Math.max(googleBtnContainerRef.current.offsetWidth || 360, 200), 400)
        google.accounts.id.renderButton(googleBtnContainerRef.current, {
          theme: 'filled_black',
          size: 'large',
          shape: 'pill',
          width: containerWidth,
          text: 'signin_with',
          logo_alignment: 'left',
        })
        setGisLoaded(true)
      }
      try {
        google.accounts.id.prompt()
      } catch {
        // Ignore One Tap prompt errors
      }
    } else {
      setValidationError('Google Sign-In SDK is loading. Please check your internet connection and refresh.')
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

      {/* Loading Screen - added without changing the original login design */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090909] transition-opacity duration-300 ${
          showLoading
            ? 'visible opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
        aria-hidden={!showLoading}
        role="status"
        aria-label="Signing in"
      >
        <img
          src="/assets/logos/thedgym.png"
          alt="The DGym"
          className="mb-10 h-auto w-40 object-contain"
        />

        <QuarterRing className="h-16 w-16 text-red-500" />

        <p className="mt-6 text-sm uppercase tracking-[0.3em] text-white/60">
          Signing You In
        </p>

        <p className="mt-2 text-xs text-white/30">
          Please wait...
        </p>
      </div>

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
              disabled={isLoading || showLoading}
              className="w-full mt-2"
            >
              {isLoading ? 'Authenticating...' : 'Sign In'}
            </Button>
          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-[10px] uppercase tracking-widest font-mono">
              <span className="bg-[#121215] px-3 text-white/40">Or continue with</span>
            </div>
          </div>

          {/* Google Sign In */}
          <div className="w-full flex flex-col items-center justify-center">
            <div
              ref={googleBtnContainerRef}
              className={`w-full flex justify-center min-h-[44px] ${
                gisLoaded ? 'block' : 'hidden'
              }`}
            />

            {!gisLoaded && (
              <button
                type="button"
                onClick={handleGoogleSignInClick}
                disabled={isLoading || showLoading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/30 text-white font-medium text-xs tracking-wide transition-all duration-200 disabled:opacity-50 cursor-pointer group shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span className="text-white/90 group-hover:text-white transition-colors">
                  Sign in with Google
                </span>
              </button>
            )}
          </div>

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
              {DEMO_ACCOUNTS.map((acc, idx) => (
                <button
                  key={acc.role}
                  type="button"
                  onClick={() => fillDemo(acc.email, acc.pass)}
                  disabled={isLoading || showLoading}
                  className={`p-2.5 rounded-lg border border-white/8 bg-surface-2 hover:border-white/20 hover:bg-white/5 transition-all duration-150 text-left group disabled:opacity-50 cursor-pointer ${
                    idx === 4 ? 'col-span-2' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white group-hover:text-red transition-colors">
                      {acc.role}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-mono ${
                        acc.badge === 'Verified Plan'
                          ? 'bg-green-500/10 text-green-400 border border-green-500/25'
                          : acc.badge === 'No Plan'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/25'
                          : 'bg-white/5 text-white/40'
                      }`}
                    >
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
