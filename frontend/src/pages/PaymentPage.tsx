import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Lock,
  QrCode,
  ShieldCheck,
  Smartphone,
  Sparkles,
} from 'lucide-react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { ALL_PUBLIC_PLANS, getPublicPlanBySlug, type PlanSlug } from '@/constants/plans'
import { api } from '@/services/api'
import type { PaymentVerifyResponse } from '@/types/auth'

const PENDING_CHECKOUT_STORAGE_KEY = 'dgym_pending_xendit_checkout'
const FRONT_DESK_ONLY_SLUGS = new Set<PlanSlug>(['student-monthly', 'senior-pwd-monthly'])

function savePendingCheckout(invoiceId: string, externalId?: string): void {
  try {
    sessionStorage.setItem(
      PENDING_CHECKOUT_STORAGE_KEY,
      JSON.stringify({ invoiceId, externalId: externalId ?? null }),
    )
  } catch {
    // Ignore storage unavailability
  }
}

function readPendingCheckoutId(externalIdParam: string | null): string | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { invoiceId?: unknown; externalId?: unknown }
    if (typeof parsed.invoiceId !== 'string' || !parsed.invoiceId.trim()) return null
    if (externalIdParam && parsed.externalId && parsed.externalId !== externalIdParam) {
      return null
    }
    return parsed.invoiceId
  } catch {
    return null
  }
}

function clearPendingCheckout(): void {
  try {
    sessionStorage.removeItem(PENDING_CHECKOUT_STORAGE_KEY)
  } catch {
    // Ignore storage unavailability
  }
}

export function PaymentPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const { user, isAuthenticated, isLoading: isAuthLoading, refreshUser } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const verifiedLookupRef = useRef<string | null>(null)

  const statusParam = searchParams.get('status')
  const invoiceIdParam = searchParams.get('invoice_id')
  const externalIdParam = searchParams.get('external_id')
  const selectedSlug = searchParams.get('plan') || 'monthly'

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Verification state for redirected returns
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [verifyResult, setVerifyResult] = useState<PaymentVerifyResponse | null>(null)
  const [verifyError, setVerifyError] = useState<string | null>(null)

  const activePlan = getPublicPlanBySlug(selectedSlug) ?? ALL_PUBLIC_PLANS[1] // Default to Monthly
  const isFrontDeskOnly = FRONT_DESK_ONLY_SLUGS.has(activePlan.slug)
  const lookupId = invoiceIdParam || externalIdParam || readPendingCheckoutId(externalIdParam)

  const backPath = isAuthenticated ? '/dashboard' : '/membership'
  const backLabel = isAuthenticated ? 'Back to Athlete Portal' : 'Back to Membership Plans'

  useGSAP(
    () => {
      if (!containerRef.current) return
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
      )
    },
    { scope: containerRef, dependencies: [statusParam] },
  )

  const verifyCheckout = useCallback(
    async (targetId: string, isActiveCheck?: () => boolean) => {
      setIsVerifying(true)
      setVerifyError(null)
      try {
        const res = await api.verifyPayment(targetId)
        if (isActiveCheck && !isActiveCheck()) return
        setVerifyResult(res)
        if (res.membership_activated) {
          clearPendingCheckout()
          await refreshUser()
        }
      } catch (err) {
        if (isActiveCheck && !isActiveCheck()) return
        const msg =
          err instanceof Error
            ? err.message
            : 'Unable to verify payment status with gateway.'
        setVerifyError(msg)
      } finally {
        if (!isActiveCheck || isActiveCheck()) {
          setIsVerifying(false)
        }
      }
    },
    [refreshUser],
  )

  // Clear pending checkout marker when user cancels or checkout fails
  useEffect(() => {
    if (statusParam === 'failed') {
      clearPendingCheckout()
    }
  }, [statusParam])

  // Auto-verify if returning from Xendit checkout
  useEffect(() => {
    if (statusParam !== 'success' || isAuthLoading || !isAuthenticated || !lookupId) {
      return
    }
    if (verifiedLookupRef.current === lookupId) {
      return
    }
    verifiedLookupRef.current = lookupId
    let isMounted = true
    void verifyCheckout(lookupId, () => isMounted)
    return () => {
      isMounted = false
    }
  }, [statusParam, isAuthLoading, isAuthenticated, lookupId, verifyCheckout])

  const handleCheckout = async () => {
    if (!isAuthenticated || isFrontDeskOnly) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await api.createPaymentCheckout({
        plan_slug: activePlan.slug,
      })

      if (res?.invoice_url) {
        if (res.invoice_id) {
          savePendingCheckout(res.invoice_id, res.external_id)
        }
        // Redirect to Xendit's secure hosted payment page
        window.location.assign(res.invoice_url)
      } else {
        setErrorMessage('Failed to generate checkout invoice. Please try again.')
        setIsSubmitting(false)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to payment gateway.'
      setErrorMessage(msg)
      setIsSubmitting(false)
    }
  }

  return (
    <>
      <SEO
        title="Checkout & Payment"
        description="Secure online membership payment via GCash, Maya, QR Ph, & Cards for The DGym Rosario, Batangas."
      />

      <section className="min-h-[85vh] flex items-center justify-center py-16 px-4">
        <div ref={containerRef} className="w-full max-w-2xl space-y-6">
          <Link
            to={backPath}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel}</span>
          </Link>

          {/* CASE 1: RETURN FROM XENDIT CHECKOUT */}
          {statusParam === 'success' ? (
            (() => {
              const isConfirmed = Boolean(verifyResult?.membership_activated)
              const isPendingGateway = Boolean(verifyResult && !verifyResult.membership_activated)
              const needsSignIn = !isAuthLoading && !isAuthenticated
              const isChecking = isAuthLoading || isVerifying
              const redirectTarget = `${location.pathname}${location.search}`

              return (
                <div className="rounded-2xl border border-white/10 bg-surface p-8 md:p-10 space-y-8 shadow-[0_0_50px_rgba(34,197,94,0.06)]">
                  <div className="text-center space-y-4">
                    <div
                      className={`w-16 h-16 rounded-2xl border flex items-center justify-center mx-auto ${
                        isConfirmed
                          ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.2)]'
                          : isChecking
                            ? 'border-sky-500/20 bg-sky-500/10 text-sky-400'
                            : 'border-amber-500/20 bg-amber-500/10 text-amber-400'
                      }`}
                    >
                      {isChecking ? (
                        <Loader2 className="w-8 h-8 animate-spin" />
                      ) : isConfirmed ? (
                        <CheckCircle2 className="w-8 h-8" />
                      ) : isPendingGateway ? (
                        <Clock className="w-8 h-8" />
                      ) : (
                        <AlertCircle className="w-8 h-8" />
                      )}
                    </div>

                    <div className="space-y-2 max-w-md mx-auto">
                      <span
                        className={`text-xs uppercase tracking-widest font-mono ${
                          isConfirmed
                            ? 'text-emerald-400'
                            : isChecking
                              ? 'text-sky-400'
                              : 'text-amber-400'
                        }`}
                      >
                        {isConfirmed
                          ? 'Transaction Verified • Xendit'
                          : isChecking
                            ? 'Gateway Verification In Progress'
                            : isPendingGateway
                              ? `Gateway Status: ${verifyResult?.invoice_status || 'PENDING'}`
                              : 'Verification Required'}
                      </span>
                      <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                        {isChecking
                          ? 'Verifying Payment...'
                          : isConfirmed
                            ? 'Payment Confirmed!'
                            : isPendingGateway
                              ? 'Payment Pending Settlement'
                              : needsSignIn
                                ? 'Sign In to Verify Payment'
                                : 'Unable to Confirm Payment'}
                      </h1>
                      <p className="text-sm font-light tracking-wide text-white/60 leading-relaxed">
                        {isChecking
                          ? 'Confirming your transaction directly with Xendit. Please wait a moment...'
                          : isConfirmed
                            ? 'Your membership pass has been activated in the system. Your active plan details are now available in your member portal.'
                            : isPendingGateway
                              ? 'Xendit has not marked this invoice as paid yet. If you completed the payment just now, check again in a few seconds.'
                              : needsSignIn
                                ? 'Please sign in to your account so we can securely verify your invoice and activate your membership pass.'
                                : verifyError ||
                                  'Missing a verifiable Xendit invoice reference for this redirect. Please retry verification or start checkout again.'}
                      </p>
                    </div>
                  </div>

                  {/* Status details pill */}
                  <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="uppercase tracking-widest text-white/40">Activation Status</span>
                      {isChecking ? (
                        <Badge variant="info">Checking Gateway</Badge>
                      ) : isConfirmed ? (
                        <Badge variant="success">Active & Ready</Badge>
                      ) : isPendingGateway ? (
                        <Badge variant="warning">{verifyResult?.invoice_status || 'Pending'}</Badge>
                      ) : (
                        <Badge variant="danger">Unverified</Badge>
                      )}
                    </div>
                    {verifyResult?.amount !== undefined && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="uppercase tracking-widest text-white/40">Invoice Amount</span>
                        <span className="text-white/80 font-mono">
                          ₱{Number(verifyResult.amount).toLocaleString()}
                        </span>
                      </div>
                    )}
                    {(externalIdParam || verifyResult?.invoice_id) && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="uppercase tracking-widest text-white/40">Reference Code</span>
                        <span className="text-white/60 font-mono">
                          {externalIdParam || verifyResult?.invoice_id}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                    {isConfirmed ? (
                      <>
                        <Link to="/dashboard" className="w-full sm:w-auto">
                          <Button variant="primary" fullWidth>
                            Go to Athlete Portal
                          </Button>
                        </Link>
                        <Link to="/membership" className="w-full sm:w-auto">
                          <Button variant="secondary" fullWidth>
                            View All Plans
                          </Button>
                        </Link>
                      </>
                    ) : needsSignIn ? (
                      <Link
                        to={`/login?redirect=${encodeURIComponent(redirectTarget)}`}
                        className="w-full sm:w-auto"
                      >
                        <Button variant="primary" fullWidth>
                          Sign In to Verify
                        </Button>
                      </Link>
                    ) : (
                      <>
                        {lookupId && (
                          <Button
                            variant="primary"
                            loading={isVerifying}
                            disabled={isVerifying}
                            onClick={() => void verifyCheckout(lookupId)}
                            fullWidth
                            className="sm:w-auto"
                          >
                            {isPendingGateway ? 'Check Status Again' : 'Retry Verification'}
                          </Button>
                        )}
                        <Button
                          variant="secondary"
                          onClick={() => setSearchParams({ plan: activePlan.slug })}
                          fullWidth
                          className="sm:w-auto"
                        >
                          Back to Checkout
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )
            })()
          ) : statusParam === 'failed' ? (
            /* CASE 2: FAILED OR CANCELLED CHECKOUT */
            <div className="rounded-2xl border border-white/10 bg-surface p-8 md:p-10 space-y-8 shadow-[0_0_50px_rgba(239,68,68,0.06)]">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl border border-red-500/20 bg-red-500/10 flex items-center justify-center mx-auto text-red-400">
                  <AlertCircle className="w-8 h-8" />
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <span className="text-xs uppercase tracking-widest text-red-400 font-mono">
                    Payment Session Incomplete
                  </span>
                  <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                    Checkout Cancelled
                  </h1>
                  <p className="text-sm font-light tracking-wide text-white/40 leading-relaxed">
                    The payment session was cancelled or timed out. No amount has been deducted from your account.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <Button
                  variant="primary"
                  onClick={() => setSearchParams({ plan: activePlan.slug })}
                  fullWidth
                  className="sm:w-auto"
                >
                  Try Again
                </Button>
                <Link to="/membership" className="w-full sm:w-auto">
                  <Button variant="secondary" fullWidth>
                    Back to Plans
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            /* CASE 3: ACTIVE CHECKOUT INTERFACE */
            <div className="rounded-2xl border border-white/10 bg-surface p-8 md:p-10 space-y-8">
              {/* Header Title */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-white/10">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                    DGym Online Checkout
                  </p>
                  <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                    Membership Activation
                  </h1>
                </div>
                <div className="flex items-center gap-2 text-xs text-white/40 font-mono">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>Xendit Secure Gateway</span>
                </div>
              </div>

              {/* Plan Switcher Pills */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-white/40">
                  Select Membership Tier
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_PUBLIC_PLANS.map((plan) => {
                    const isCurrent = plan.slug === activePlan.slug
                    return (
                      <button
                        key={plan.slug}
                        type="button"
                        onClick={() => {
                          setSearchParams({ plan: plan.slug })
                        }}
                        className={`flex flex-col items-start p-3 rounded-xl border text-left transition-all ${
                          isCurrent
                            ? 'border-red bg-red/10 text-white shadow-[0_0_20px_rgba(229,32,26,0.15)]'
                            : 'border-white/10 bg-white/[0.02] text-white/60 hover:text-white hover:border-white/20'
                        }`}
                      >
                        <span className="text-xs font-semibold uppercase tracking-tight">
                          {plan.name}
                        </span>
                        <span className="text-sm font-bold font-mono text-white mt-1">
                          {plan.priceFormatted}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Selected Plan Details Box */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white">
                        {activePlan.name}
                      </h2>
                      {activePlan.badge && (
                        <Badge variant={activePlan.highlight ? 'red' : 'default'}>
                          {activePlan.badge}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-light text-white/50 mt-1">
                      {activePlan.description}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-2xl font-bold font-mono text-white">
                      {activePlan.priceFormatted}
                    </p>
                    <p className="text-xs text-white/40">{activePlan.period}</p>
                  </div>
                </div>

                {/* Features Checklist */}
                <div className="pt-4 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activePlan.features.map((feat) => (
                    <div key={feat} className="flex items-center gap-2 text-xs text-white/70">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Supported Payment Channels */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs uppercase tracking-widest text-white/40">
                    Accepted Payment Channels
                  </span>
                  <span className="text-xs text-white/40">Zero Convenience Fee</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold text-white">GCash</p>
                      <p className="text-[10px] text-white/40 uppercase">e-Wallet</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold text-white">Maya</p>
                      <p className="text-[10px] text-white/40 uppercase">e-Wallet</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <QrCode className="w-4 h-4 text-amber-400" />
                    <div>
                      <p className="text-xs font-semibold text-white">QR Ph</p>
                      <p className="text-[10px] text-white/40 uppercase">All Banks</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 p-3 rounded-xl border border-white/10 bg-white/[0.02]">
                    <CreditCard className="w-4 h-4 text-sky-400" />
                    <div>
                      <p className="text-xs font-semibold text-white">Cards</p>
                      <p className="text-[10px] text-white/40 uppercase">Visa/Mastercard</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Banner */}
              {errorMessage && (
                <div className="flex items-center gap-3 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Account / Action Area */}
              {isFrontDeskOnly ? (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200 text-xs space-y-1.5">
                    <p className="font-semibold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                      Front-Desk ID Verification Required ({activePlan.requirement || 'Valid ID Required'})
                    </p>
                    <p className="text-amber-200/70 font-light leading-relaxed">
                      Discounted {activePlan.name} passes are processed exclusively in person at
                      The DGym Rosario front desk so our staff can verify your qualifying ID before
                      activation.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    <Link to="/contact" className="w-full sm:flex-1">
                      <Button variant="primary" fullWidth>
                        View Front Desk Hours &amp; Location
                      </Button>
                    </Link>
                    <Button
                      variant="secondary"
                      onClick={() => setSearchParams({ plan: 'monthly' })}
                      fullWidth
                      className="sm:w-auto"
                    >
                      Switch to Monthly (₱1,999)
                    </Button>
                  </div>
                </div>
              ) : isAuthenticated ? (
                <div className="space-y-4 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs text-white/50 bg-white/[0.01] p-3 rounded-xl border border-white/5">
                    <span>
                      Paying as:{' '}
                      <strong className="text-white font-medium">{user?.full_name}</strong> (
                      {user?.email})
                    </span>
                    <span className="text-emerald-400 font-mono text-[11px]">
                      {user?.phone ? user.phone : 'No phone set (Update in Account)'}
                    </span>
                  </div>

                  <Button
                    variant="primary"
                    fullWidth
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    onClick={handleCheckout}
                    className="flex items-center justify-center gap-2 py-4 text-base font-semibold"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Proceed to Secure Payment ({activePlan.priceFormatted})</span>
                    <ExternalLink className="w-4 h-4 opacity-70 ml-1" />
                  </Button>

                  <p className="text-center text-[11px] font-light text-white/40">
                    You will be redirected to Xendit&apos;s encrypted checkout portal to finalize your
                    payment. Upon completion, access activates directly in your member portal.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 pt-4 border-t border-white/10">
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-200 text-xs space-y-1">
                    <p className="font-semibold flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Sign In Required
                    </p>
                    <p className="text-amber-200/70 font-light">
                      Please sign in or create an account to link this membership pass directly to
                      your athlete RFID keycard profile.
                    </p>
                  </div>

                  <Link
                    to={`/login?redirect=${encodeURIComponent(`/payment?plan=${activePlan.slug}`)}`}
                    className="block"
                  >
                    <Button variant="primary" fullWidth>
                      Sign In to Proceed
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
