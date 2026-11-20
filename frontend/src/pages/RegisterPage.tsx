import { useState, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { Eye, EyeOff } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { QuarterRing } from '@/components/ui/quarter-ring'
import { PUBLIC_PLANS } from '@/constants/plans'
import { IdScannerStep, type IdScanCompletedData } from '@/components/auth/IdScannerStep'
import { FaceLivenessStep, type FaceLivenessResult } from '@/components/auth/FaceLivenessStep'

type RegisterStep = 'account' | 'id_scan' | 'face_liveness' | 'plan'

const REGISTER_STEPS: { id: RegisterStep; label: string }[] = [
  { id: 'account', label: '1. Account' },
  { id: 'id_scan', label: '2. Valid ID' },
  { id: 'face_liveness', label: '3. Face Scan' },
  { id: 'plan', label: '4. Plan' },
]

export function RegisterPage() {
  const [step, setStep] = useState<RegisterStep>('account')
  const [idScanData, setIdScanData] = useState<IdScanCompletedData | null>(null)
  const [livenessData, setLivenessData] = useState<FaceLivenessResult | null>(null)
  const [identityVerified, setIdentityVerified] = useState(false)
  const [verifyingIdentity, setVerifyingIdentity] = useState(false)
  const [identityGateError, setIdentityGateError] = useState<string | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
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
    if (password.length < 8) {
      setValidationError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setValidationError('Passwords do not match.')
      return
    }
    if (!acceptedLegal) {
      setValidationError('Please read and agree to the Privacy Policy and Terms & Conditions.')
      return
    }

    setIdentityVerified(false)
    setIdentityGateError(null)
    setStep('id_scan')
  }

  const handleFaceGateVerified = async (result: FaceLivenessResult) => {
    if (!idScanData || typeof result.idMatchScore !== 'number') {
      setIdentityGateError('Please scan your valid ID before live face verification.')
      return
    }

    setVerifyingIdentity(true)
    setIdentityGateError(null)
    setValidationError(null)
    clearError()

    try {
      await api.verifyRegistrationIdentity({
        email: email.trim(),
        face_descriptor: result.descriptor,
        liveness_passed: result.livenessPassed,
        id_type: idScanData.idType,
        id_number: idScanData.idNumber || undefined,
        id_ocr_name: idScanData.idOcrName || idScanData.fullName || undefined,
        id_face_match_score: result.idMatchScore,
        id_image_base64: idScanData.idImageBase64,
        live_image_base64: result.liveImageBase64,
      })
      setLivenessData(result)
      setIdentityVerified(true)
      setStep('plan')
    } catch (err) {
      setIdentityVerified(false)
      setIdentityGateError(
        err instanceof Error
          ? err.message
          : 'Unable to verify your identity against existing records. Please try again.',
      )
      throw err
    } finally {
      setVerifyingIdentity(false)
    }
  }

  const handleCompleteRegistration = async (withPlan: boolean) => {
    setValidationError(null)
    clearError()

    if (!acceptedLegal) {
      setValidationError('Please read and agree to the Privacy Policy and Terms & Conditions.')
      setStep('account')
      return
    }

    if (
      !idScanData ||
      !livenessData ||
      !identityVerified ||
      typeof livenessData.idMatchScore !== 'number'
    ) {
      setValidationError('Please complete Valid ID, live face scan, and duplicate identity checks first.')
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
          id_ocr_name: idScanData.idOcrName || idScanData.fullName || undefined,
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
        <QuarterRing className="h-16 w-16 text-white" />
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

            {step === 'id_scan' && (
              <>
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Scan Valid ID
                </h1>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1 max-w-md mx-auto">
                  Verify your ID document &amp; extract your reference face photo
                </p>
              </>
            )}

            {step === 'face_liveness' && (
              <>
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Live Face Verification
                </h1>
                <p className="text-xs uppercase tracking-widest text-white/40 mt-1 max-w-md mx-auto">
                  Match your live selfie against your ID &amp; verify unique identity
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

          {/* STEP 1: Account Information */}
          {step === 'account' && (
            <form onSubmit={handleAccountNext} className="space-y-4">
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

              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-password" className="text-sm font-medium text-white/70">
                  Password
                </label>
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="register-confirm-password" className="text-sm font-medium text-white/70">
                  Confirm Password
                </label>
                <div className="relative">
                  <Input
                    id="register-confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Repeat password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-red transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <label
                htmlFor="register-legal-consent"
                className="flex items-start gap-2.5 pt-1 text-xs text-white/60 leading-relaxed cursor-pointer select-none"
              >
                <input
                  id="register-legal-consent"
                  type="checkbox"
                  checked={acceptedLegal}
                  onChange={(e) => setAcceptedLegal(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border border-white/20 bg-surface-2 accent-red cursor-pointer shrink-0"
                  required
                />
                <span>
                  I have read and agree to the{' '}
                  <Link
                    to="/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-red underline underline-offset-2 transition-colors"
                  >
                    Privacy Policy
                  </Link>{' '}
                  and{' '}
                  <Link
                    to="/terms"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white hover:text-red underline underline-offset-2 transition-colors"
                  >
                    Terms &amp; Conditions
                  </Link>
                </span>
              </label>

              <Button
                type="submit"
                size="lg"
                disabled={!acceptedLegal}
                className="w-full mt-4"
              >
                Continue to Valid ID →
              </Button>

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

          {/* STEP 2: Valid ID Scanner + Quality/Type/OCR Verification */}
          {step === 'id_scan' && (
            <div className="space-y-4">
              <IdScannerStep
                stepBadge="Step 2 • Valid ID & OCR Scan"
                title="Philippine Valid ID"
                subtitle="Scan or upload PhilSys National ID, Driver's License, School ID, UMID, or Passport"
                initialFullName={fullName}
                expectedFullName={fullName}
                initialIdType={idScanData?.idType}
                confirmLabel="Continue to Face Scan →"
                onBack={() => {
                  setValidationError(null)
                  clearError()
                  setStep('account')
                }}
                onConfirm={(data) => {
                  setValidationError(null)
                  clearError()
                  setIdScanData(data)
                  setLivenessData(null)
                  setIdentityVerified(false)
                  setIdentityGateError(null)
                  setStep('face_liveness')
                }}
              />
            </div>
          )}

          {/* STEP 3: Live Selfie + Liveness + ID Match + Anti-Duplicate Gate */}
          {step === 'face_liveness' && idScanData && (
            <div className="space-y-4">
              <FaceLivenessStep
                mode="enroll_match"
                stepBadge="Step 3 • Live Face & Anti-Duplicate Check"
                title="Match Face to Valid ID"
                subtitle="Align your face in the frame and blink or turn your head slightly to verify liveness"
                referenceIdDescriptor={idScanData.idDescriptor}
                submitting={verifyingIdentity}
                serverError={identityGateError}
                onBack={() => {
                  setIdentityGateError(null)
                  setValidationError(null)
                  clearError()
                  setStep('id_scan')
                }}
                backLabel="← Rescan Valid ID"
                onVerified={handleFaceGateVerified}
              />

              {identityGateError && (
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setIdentityGateError(null)
                      setValidationError(null)
                      clearError()
                      setStep('account')
                    }}
                    className="text-xs text-white/50 hover:text-white underline underline-offset-2 transition-colors cursor-pointer"
                  >
                    ← Back to Account Details
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 4: Training Plan Selection (strictly gated until Steps 1–3 & identity check pass) */}
          {step === 'plan' && idScanData && livenessData && identityVerified && (
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
                  Skip &amp; Register
                </button>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setValidationError(null)
                      setStep('face_liveness')
                    }}
                    className="text-xs text-white/40 hover:text-white transition-colors"
                  >
                    ← Back to face scan
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
