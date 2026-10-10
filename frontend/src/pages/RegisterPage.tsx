
import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { useAuth } from '@/context/AuthContext'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { QuarterRing } from '@/components/ui/quarter-ring'

export function RegisterPage() {
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showLoading, setShowLoading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const { register, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()

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

    if (!fullName.trim()) {
      setValidationError('Please enter your full name.')
      return
    }
    if (!email || !email.includes('@')) {
      setValidationError('Please enter a valid email address.')
      return
    }
    if (password.length < 6) {
      setValidationError('Password must be at least 6 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.')
      return
    }

    // Show loading screen
    setShowLoading(true)

    try {
      // Keep loading ring visible for a snappy, polished transition
      await Promise.all([
        register({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 800)),
      ])

      navigate('/dashboard', { replace: true })
    } catch {
      // Hide loading screen if registration fails
      setShowLoading(false)
      // Error is set in context
    }
  }

  return (
    <>
      <SEO
        title="Create an Account"
        description="Register for a DGym member account in Rosario, Batangas."
        canonical="https://thedgym.com/register"
      />

      {/* Loading Screen - added without changing the original design */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090909] transition-opacity duration-300 ${
          showLoading
            ? 'visible opacity-100'
            : 'invisible pointer-events-none opacity-0'
        }`}
        aria-hidden={!showLoading}
        role="status"
        aria-label="Creating your account"
      >
        <img
          src="/assets/logos/thedgym.png"
          alt="The DGym"
          className="mb-10 h-auto w-40 object-contain"
        />

        <QuarterRing className="h-16 w-16 text-red-500" />

        <p className="mt-6 text-sm uppercase tracking-[0.3em] text-white/60">
          Creating Your Account
        </p>

        <p className="mt-2 text-xs text-white/30">
          Please wait...
        </p>
      </div>

      <div className="min-h-[85vh] flex items-center justify-center py-16 px-4">
        {/* Glow */}
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
              Create Account
            </h1>
            <p className="text-xs uppercase tracking-widest text-white/40 mt-1">
              Join The DGym Rosario Batangas
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
                <line x1="12" y1="8" x2="12.01" y2="8" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span>{validationError || error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              type="text"
              name="fullName"
              placeholder="Alex Cruz"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />

            <Input
              label="Email Address"
              type="email"
              name="email"
              placeholder="alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <Input
              label="Phone Number (Optional)"
              type="tel"
              name="phone"
              placeholder="+63 917 123 4567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <Input
              label="Password"
              type="password"
              name="password"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <Input
              label="Confirm Password"
              type="password"
              name="confirmPassword"
              placeholder="Repeat password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />

            <Button
              type="submit"
              size="lg"
              loading={isLoading}
              disabled={isLoading || showLoading}
              className="w-full mt-4"
            >
              {isLoading ? 'Creating Account...' : 'Register'}
            </Button>
          </form>

          <p className="text-center text-xs text-white/40 mt-6">
            Already have an account?{' '}
            <Link
              to="/login"
              className="text-white hover:text-red font-medium underline underline-offset-2 transition-colors duration-150"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </>
  )
}
