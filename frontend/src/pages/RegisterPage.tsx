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
import { PUBLIC_PLANS } from '@/constants/plans'
import { IdScannerStep, type IdScanCompletedData } from '@/components/auth/IdScannerStep'
import { FaceLivenessStep, type FaceLivenessResult } from '@/components/auth/FaceLivenessStep'

type RegisterStep = 'id_scan' | 'face_liveness' | 'account' | 'plan'

const REGISTER_STEPS: { id: RegisterStep; label: string }[] = [
  { id: 'id_scan', label: '1. Valid ID' },
  { id: 'face_liveness', label: '2. Face Scan' },
  { id: 'account', label: '3. Account' },
  { id: 'plan', label: '4. Plan' },
]

export function RegisterPage() {
  const [step, setStep] = useState<RegisterStep>('id_scan')
  const [idScanData, setIdScanData] = useState<IdScanCompletedData | null>(null)
  const [livenessData, setLivenessData] = useState<FaceLivenessResult | null>(null)
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

  const handleAccountNext = (e: React.FormEvent) => {
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

    setStep('plan')
  }

  const handleCompleteRegistration = async (withPlan: boolean) => {
    setValidationError(null)
    clearError()

    if (!idScanData || !livenessData || typeof livenessData.idMatchScore !== 'number') {
      setValidationError('Please complete Valid ID and live face verification first.')
      setStep(idScanData ? 'face_liveness' : 'id_scan')
      return
    }

    setShowLoading(true)

    const chosenSlug = withPlan ? selectedPlan : null

    try {
      await Promise.all([
        register({
          full_name: fullName.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          plan_slug: chosenSlug ?? undefined,
          password,
          face_descriptor: livenessData.descriptor,
          liveness_passed: livenessData.livenessPassed,
          id_type: idScanData.idType,
          id_number: idScanData.idNumber || undefined,
          id_ocr_name: idScanData.idOcrName || undefined,
          id_face_match_score: livenessData.idMatchScore,
          id_image_base64: idScanData.idImageBase64,
          live_image_base64: livenessData.liveImageBase64,
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 800)),
      ])

      if (chosenSlug) {
        navigate(`/payment?plan=${encodeURIComponent(chosenSlug)}`, { replace: true })
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
            step === 'account' ? 'max-w-md' : 'max-w-2xl'
          } p-6 sm:p-8 md:p-10 rounded-2xl bg-surface/90 border border-white/10 backdrop-blur-xl shadow-2xl transition-all duration-300`}
        >
          {/* Header */}
          <div className="text-center mb-6">
            <Link to="/" className="inline-block mb-4">
              <img
                src="/assets/logos/thedgym.png"
                alt="The DGym"
                width={160}
                height={50}
                className="h-10 w-auto mx-auto object-contain"
              />
            </Link>

            {step === 'id_scan' && (
              <>
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Scan Valid ID
                </h1>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1 max-w-md mx-auto">
                  Auto-fill your details &amp; extract your reference face photo
                </p>
              </>
            )}

            {step === 'face_liveness' && (
              <>
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Live Face Verification
                </h1>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1 max-w-md mx-auto">
                  Match your live selfie against your ID &amp; complete liveness check
                </p>
              </>
            )}

            {step === 'account' && (
              <>
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Create Account
                </h1>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1">
                  Join The DGym Rosario Batangas
                </p>
              </>
            )}

            {step === 'plan' && (
              <>
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Start Your Training Plan?
                </h1>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1 max-w-md mx-auto">
                  Select a membership plan to proceed to payment, or skip to finish creating your registered account.
                </p>
              </>
            )}

            {/* 4-Step Progress Indicator */}
            <div className="grid grid-cols-4 gap-2 mt-5 max-w-lg mx-auto">
              {REGISTER_STEPS.map((item, idx) => {
                const currentIdx = REGISTER_STEPS.findIndex((s) => s.id === step)
                const isDone = idx < currentIdx
                const isActive = idx === currentIdx
                return (
                  <div key={item.id} className="text-left">
                    <div
                      className={`h-1 rounded-full transition-colors ${
                        isActive ? 'bg-red' : isDone ? 'bg-green-500/70' : 'bg-white/10'
                      }`}
                    />
                    <p
                      className={`mt-1.5 text-[10px] uppercase tracking-wider font-mono truncate ${
                        isActive ? 'text-white' : isDone ? 'text-green-400/80' : 'text-white/35'
                      }`}
                    >
                      {item.label}
                    </p>
                  </div>
                )
              })}
            </div>
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

          {/* STEP 1: Valid ID Scanner + OCR Auto-Fill */}
          {step === 'id_scan' && (
            <div className="space-y-4">
              <IdScannerStep
                title="Philippine Valid ID"
                subtitle="Scan or upload PhilSys National ID, Driver's License, School ID, UMID, or Passport"
                initialFullName={fullName}
                initialIdType={idScanData?.idType}
                confirmLabel="Continue to Live Face Scan →"
                onConfirm={(data) => {
                  setValidationError(null)
                  clearError()
                  setIdScanData(data)
                  setFullName(data.fullName)
                  setLivenessData(null)
                  setStep('face_liveness')
                }}
              />
              <p className="text-center text-xs text-white/40 pt-2">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="text-white hover:text-red font-medium underline underline-offset-2 transition-colors duration-150"
                >
                  Sign in
                </Link>
              </p>
            </div>
          )}

          {/* STEP 2: Live Selfie + Liveness + ID Face Match */}
          {step === 'face_liveness' && idScanData && (
            <FaceLivenessStep
              mode="enroll_match"
              title="Match Face to Valid ID"
              subtitle="Align your face in the frame and blink or turn your head slightly to verify liveness"
              referenceIdDescriptor={idScanData.idDescriptor}
              onBack={() => {
                setValidationError(null)
                clearError()
                setStep('id_scan')
              }}
              backLabel="← Rescan Valid ID"
              onVerified={(result) => {
                setValidationError(null)
                clearError()
                setLivenessData(result)
                setStep('account')
              }}
            />
          )}

          {/* STEP 3: Account Information */}
          {step === 'account' && (
            <form onSubmit={handleAccountNext} className="space-y-4">
              {idScanData && livenessData && (
                <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-xl border border-green-500/25 bg-green-500/10 text-xs">
                  <div className="text-green-300">
                    <span className="font-semibold">ID &amp; Live Face Verified</span>
                    {typeof livenessData.idMatchScore === 'number' && (
                      <span className="text-green-300/75 ml-2 font-mono">
                        ({Math.round(livenessData.idMatchScore * 100)}% match)
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep('id_scan')}
                    className="text-[11px] uppercase tracking-wider text-white/60 hover:text-white underline underline-offset-2 cursor-pointer"
                  >
                    Rescan
                  </button>
                </div>
              )}

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

              <div className="flex flex-col sm:flex-row gap-3 mt-4">
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => {
                    setValidationError(null)
                    clearError()
                    setStep('face_liveness')
                  }}
                  className="sm:w-1/3"
                >
                  ← Back
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1"
                >
                  Next Step →
                </Button>
              </div>

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

          {/* STEP 4: Training Plan Selection */}
          {step === 'plan' && (
            <div className="space-y-6">
              {/* Plan Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                {PUBLIC_PLANS.map((plan) => {
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
                          <Badge variant={plan.highlight ? 'red' : 'default'} size="sm">
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
                        <div className="flex items-baseline gap-1.5 mt-1">
                          <span className="font-mono font-bold text-xl text-white">
                            {plan.priceFormatted}
                          </span>
                          <span className="text-[11px] text-white/40 font-mono">
                            {plan.period}
                          </span>
                        </div>
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
                  <span>Continue to Payment</span>
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
                      setStep('account')
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
