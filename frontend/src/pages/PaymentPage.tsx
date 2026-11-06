import { useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { ArrowLeft, CreditCard } from 'lucide-react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { getPublicPlanBySlug } from '@/constants/plans'

export function PaymentPage() {
  const [searchParams] = useSearchParams()
  const { isAuthenticated } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)

  const selectedPlan = getPublicPlanBySlug(searchParams.get('plan'))
  const backPath = isAuthenticated ? '/dashboard' : '/membership'
  const backLabel = isAuthenticated ? 'Back to Dashboard' : 'Back to Membership Plans'

  useGSAP(
    () => {
      if (!containerRef.current) return
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 24 },
        { opacity: 1, y: 0, duration: 0.5, ease: 'power3.out' },
      )
    },
    { scope: containerRef },
  )

  return (
    <>
      <SEO
        title="Checkout & Payment"
        description="Complete your membership payment at The DGym Rosario, Batangas."
      />

      <section className="min-h-[75vh] flex items-center justify-center py-16 px-4">
        <div ref={containerRef} className="w-full max-w-xl space-y-6">
          <Link
            to={backPath}
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel}</span>
          </Link>

          <div className="rounded-2xl border border-white/10 bg-surface p-8 md:p-10 space-y-8">
            {selectedPlan && (
              <div className="flex items-center justify-between gap-4 pb-6 border-b border-white/10">
                <div>
                  <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                    Selected Plan
                  </p>
                  <div className="flex items-center gap-2.5">
                    <h2 className="font-display text-2xl font-bold uppercase tracking-tight text-white">
                      {selectedPlan.name}
                    </h2>
                    {selectedPlan.badge && (
                      <Badge variant={selectedPlan.highlight ? 'red' : 'default'}>
                        {selectedPlan.badge}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold font-mono text-white">
                    {selectedPlan.priceFormatted}
                  </p>
                  <p className="text-xs text-white/40">{selectedPlan.period}</p>
                </div>
              </div>
            )}

            <div className="text-center py-6 space-y-4">
              <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/[0.03] flex items-center justify-center mx-auto text-white/60">
                <CreditCard className="w-5 h-5" />
              </div>

              <div className="space-y-2 max-w-md mx-auto">
                <h1 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                  Payment section is coming soon
                </h1>
                <p className="text-sm font-light tracking-wide text-white/40 leading-relaxed">
                  Online checkout via PayMongo, GCash, and Maya is currently being integrated.
                </p>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/membership" className="w-full sm:w-auto">
                <Button variant="secondary" fullWidth>
                  View Plans
                </Button>
              </Link>
              {isAuthenticated && (
                <Link to="/dashboard" className="w-full sm:w-auto">
                  <Button variant="primary" fullWidth>
                    Return to Portal
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
