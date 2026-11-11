import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
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
import { ALL_PUBLIC_PLANS, getPublicPlanBySlug } from '@/constants/plans'
import { api } from '@/services/api'
import type { PaymentVerifyResponse } from '@/types/auth'

export function PaymentPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, isAuthenticated } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)

  const statusParam = searchParams.get('status')
  const invoiceIdParam = searchParams.get('invoice_id')
  const externalIdParam = searchParams.get('external_id')
  const initialPlanSlug = searchParams.get('plan') || 'monthly'

  const [selectedSlug, setSelectedSlug] = useState<string>(initialPlanSlug)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Verification state for redirected returns
  const [isVerifying, setIsVerifying] = useState<boolean>(false)
  const [verifyResult, setVerifyResult] = useState<PaymentVerifyResponse | null>(null)

  const activePlan = getPublicPlanBySlug(selectedSlug) ?? ALL_PUBLIC_PLANS[1] // Default to Monthly

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

  // Auto-verify if returning from Xendit checkout
  useEffect(() => {
    const lookupId = invoiceIdParam || externalIdParam
    if (statusParam === 'success' && lookupId && !verifyResult && !isVerifying) {
      let isMounted = true
      setIsVerifying(true)
      api
        .verifyPayment(lookupId)
        .then((res) => {
          if (isMounted) setVerifyResult(res)
        })
        .catch((err) => {
          console.warn('Payment status verification check failed:', err)
        })
        .finally(() => {
          if (isMounted) setIsVerifying(false)
        })
      return () => {
        isMounted = false
      }
    }
  }, [statusParam, invoiceIdParam, externalIdParam, verifyResult, isVerifying])

  const handleCheckout = async () => {
    if (!isAuthenticated) return
    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      const res = await api.createPaymentCheckout({
        plan_slug: activePlan.slug,
      })

      if (res?.invoice_url) {
        // Redirect to Xendit's secure hosted payment page
        window.location.href = res.invoice_url
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

          {/* ─────────────────────────────────────────────────────────────
              CASE 1: SUCCESS RETURN FROM XENDIT
          ───────────────────────────────────────────────────────────── */}
          {statusParam === 'success' ? (
            <div className="rounded-2xl border border-white/10 bg-surface p-8 md:p-10 space-y-8 shadow-[0_0_50px_rgba(34,197,94,0.06)]">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_30px_rgba(52,211,153,0.2)]">
                  {isVerifying ? (
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  ) : (
                    <CheckCircle2 className="w-8 h-8" />
                  )}
                </div>

                <div className="space-y-2 max-w-md mx-auto">
                  <span className="text-xs uppercase tracking-widest text-emerald-400 font-mono">
                    Transaction Settled • Xendit
                  </span>
                  <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                    Payment Confirmed!
                  </h1>
                  <p className="text-sm font-light tracking-wide text-white/60 leading-relaxed">
                    {verifyResult?.membership_activated || !isVerifying
                      ? 'Your membership pass has been activated in the system. An automated welcome SMS confirmation has been dispatched to your mobile number.'
                      : 'Verifying payment details with the gateway...'}
                  </p>
                </div>
              </div>

              {/* Status details pill */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="uppercase tracking-widest text-white/40">Activation Status</span>
                  <Badge variant="success">Active & Ready</Badge>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="uppercase tracking-widest text-white/40">SMS Notification</span>
                  <span className="text-white/80 font-mono">Dispatched via TextBee</span>
                </div>
                {externalIdParam && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="uppercase tracking-widest text-white/40">Reference Code</span>
                    <span className="text-white/60 font-mono">{externalIdParam}</span>
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
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
              </div>
            </div>
          ) : statusParam === 'failed' ? (
            /* ─────────────────────────────────────────────────────────────
                CASE 2: FAILED OR CANCELLED CHECKOUT
            ───────────────────────────────────────────────────────────── */
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
                  onClick={() => setSearchParams({ plan: selectedSlug })}
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
            /* ─────────────────────────────────────────────────────────────
                CASE 3: ACTIVE CHECKOUT INTERFACE
            ───────────────────────────────────────────────────────────── */
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
                  {ALL_PUBLIC_PLANS.slice(0, 6).map((plan) => {
                    const isCurrent = plan.slug === activePlan.slug
                    return (
                      <button
                        key={plan.slug}
                        type="button"
                        onClick={() => {
                          setSelectedSlug(plan.slug)
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
              {isAuthenticated ? (
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
                    payment. Upon completion, access is activated immediately with SMS confirmation.
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
