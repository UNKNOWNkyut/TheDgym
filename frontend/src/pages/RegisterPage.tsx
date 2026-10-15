import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { useAuth } from '@/context/AuthContext'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { QuarterRing } from '@/components/ui/quarter-ring'

const PLANS_OPTIONS = [
  {
    slug: 'day-pass',
    name: 'Day Pass',
    period: 'per visit',
    badge: null,
    description: 'Full gym access for one day. No commitment.',
    features: ['Full equipment access', 'Locker use', 'No sign-up required'],
  },
  {
    slug: 'monthly',
    name: 'Monthly',
    period: 'per month',
    badge: 'Most Popular',
    description: 'Unlimited access, billed monthly. Cancel anytime.',
    features: ['Unlimited gym access', 'Group class access', 'Locker use', 'Flexible month-to-month'],
  },
  {
    slug: 'quarterly',
    name: 'Quarterly',
    period: 'per quarter',
    badge: 'Best Value',
    description: 'Three months upfront. Best value per session.',
    features: ['Everything in Monthly', 'Better rate per session', 'Priority class booking', 'One PT session included'],
  },
]

export function RegisterPage() {
  const [step, setStep] = useState<1 | 2>(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [showLoading, setShowLoading] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const { register, isLoading, error, clearError } = useAuth()
  const navigate = useNavigate()

  useGSAP(() => {
    if (!cardRef.current) return
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 24, scale: 0.98 },
      { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power3.out' }
    )
  }, [step])

  const handleStep1Next = (e: React.FormEvent) => {
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

    setStep(2)
  }

  const handleCompleteRegistration = async (withPlan: boolean) => {
    setValidationError(null)
    clearError()
    setShowLoading(true)

    const planSlugToSubmit = withPlan ? selectedPlan || undefined : undefined

    try {
      await Promise.all([
        register({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          plan_slug: planSlugToSubmit,
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 800)),
      ])

      // If user chose a plan, they are an active member -> send to /dashboard
      // If user skipped, they are a registered user -> send to public home page
      if (withPlan && planSlugToSubmit) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/', { replace: true })
      }
    } catch {
      setShowLoading(false)
    }
  }

  return (
    <>
      <SEO
        title="Create an Account"
        description="Register for a DGym account in Rosario, Batangas."
        canonical="https://thedgym.com/register"
      />

      {/* Loading Screen */}
      <div
        className={`fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#090909] transition-opacity duration-300 ${
          showLoading ? 'visible opacity-100' : 'invisible pointer-events-none opacity-0'
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
        <p className="mt-2 text-xs text-white/30">Please wait...</p>
      </div>

      <div className="min-h-[85vh] flex items-center justify-center py-16 px-4">
        {/* Ambient Glow */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[320px] bg-red/6 rounded-full blur-[130px] pointer-events-none" />

        <div
          ref={cardRef}
          className={`relative z-10 w-full ${
            step === 1 ? 'max-w-md' : 'max-w-2xl'
          } p-8 md:p-10 rounded-2xl bg-surface/90 border border-white/10 backdrop-blur-xl shadow-2xl transition-all duration-300`}
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

            {step === 1 ? (
              <>
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Create Account
                </h1>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1">
                  Join The DGym Rosario Batangas
                </p>
              </>
            ) : (
              <>
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Start Your Training Plan?
                </h1>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1 max-w-md mx-auto">
                  Choose a membership plan to activate your gym access, or skip to finish creating your registered account.
                </p>
              </>
            )}
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

          {/* STEP 1: Account Information */}
          {step === 1 && (
            <form onSubmit={handleStep1Next} className="space-y-4">
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
                className="w-full mt-4"
              >
                Next Step →
              </Button>

              <p className="text-center text-[11px] text-white/35 mt-4 leading-relaxed">
                By creating an account, you agree to our separate{' '}
                <Link to="/terms" target="_blank" className="text-white/60 hover:text-white underline transition-colors">
                  Terms of Use
                </Link>{' '}
                and{' '}
                <Link to="/privacy" target="_blank" className="text-white/60 hover:text-white underline transition-colors">
                  Privacy Policy
                </Link>.
              </p>

              <p className="text-center text-xs text-white/40 mt-5">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-white hover:text-red font-medium underline underline-offset-2 transition-colors duration-150"
                >
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {/* STEP 2: Training Plan Selection */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Plan Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {PLANS_OPTIONS.map((plan) => {
                  const isSelected = selectedPlan === plan.slug
                  return (
                    <div
                      key={plan.slug}
                      onClick={() => setSelectedPlan(plan.slug)}
                      className={`relative flex flex-col justify-between p-5 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
                        isSelected
                          ? 'border-red/70 bg-red/[0.08] ring-2 ring-red/40 shadow-[0_0_24px_rgba(229,32,26,0.2)]'
                          : 'border-white/10 bg-surface-2/60 hover:border-white/25 hover:bg-surface-2'
                      }`}
                    >
                      {/* Badge or Selected Indicator */}
                      <div className="flex items-center justify-between mb-3">
                        {plan.badge ? (
                          <Badge variant={plan.slug === 'monthly' ? 'red' : 'default'} size="sm">
                            {plan.badge}
                          </Badge>
                        ) : <span />}

                        {isSelected && (
                          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red text-white text-[10px] font-bold">
                            ✓
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <h3 className="font-display text-lg font-bold uppercase text-white tracking-wide">
                          {plan.name}
                        </h3>
                        <p className="text-[11px] text-white/40 font-mono mt-0.5">
                          {plan.period}
                        </p>
                        <p className="text-xs text-white/60 mt-2 leading-relaxed">
                          {plan.description}
                        </p>
                      </div>

                      <ul className="space-y-1.5 pt-3 border-t border-white/8 text-[11px] text-white/50">
                        {plan.features.map((f, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span className="text-green-400 font-bold">✓</span>
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-3">
                {/* Dark unclickable CONTINUE button until plan is chosen */}
                <button
                  type="button"
                  disabled={!selectedPlan || isLoading || showLoading}
                  onClick={() => handleCompleteRegistration(true)}
                  className="w-full py-3.5 px-4 rounded-xl bg-[#141416] hover:bg-[#1c1c20] border border-white/20 hover:border-white/40 text-white font-bold text-xs uppercase tracking-widest transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:border-white/20 disabled:hover:bg-[#141416] cursor-pointer shadow-md flex items-center justify-center gap-2"
                >
                  <span>Continue</span>
                  {selectedPlan && <span>→</span>}
                </button>

                {/* Hollow SKIP & REGISTER button with gray border */}
                <button
                  type="button"
                  disabled={isLoading || showLoading}
                  onClick={() => handleCompleteRegistration(false)}
                  className="w-full py-3.5 px-4 rounded-xl border border-white/20 hover:border-white/40 bg-transparent hover:bg-white/[0.04] text-white/70 hover:text-white font-semibold text-xs uppercase tracking-widest transition-all duration-200 cursor-pointer"
                >
                  Skip & Register
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setValidationError(null)
                      setStep(1)
                    }}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    ← Back to account details
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
