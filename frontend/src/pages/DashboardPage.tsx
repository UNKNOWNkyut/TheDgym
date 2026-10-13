import { useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

const QUICK_PLANS = [
  {
    name: 'Day Pass',
    slug: 'day-pass',
    period: 'per visit',
    description: 'Full gym access for one day. No commitment.',
  },
  {
    name: 'Monthly',
    slug: 'monthly',
    period: 'per month',
    badge: 'Most Popular',
    description: 'Unlimited access, billed monthly. Cancel anytime.',
  },
  {
    name: 'Quarterly',
    slug: 'quarterly',
    period: 'per quarter',
    badge: 'Best Value',
    description: 'Three months upfront. Best value per session.',
  },
]

export function DashboardPage() {
  const { user, availPlan } = useAuth()
  const [activatingSlug, setActivatingSlug] = useState<string | null>(null)
  const [activateError, setActivateError] = useState<string | null>(null)

  if (!user) return null

  // Admin and Staff are routed directly to the Management Hub
  if (user.role === 'admin' || user.role === 'staff') {
    return <Navigate to="/manage" replace />
  }

  const handleQuickAvail = async (slug: string) => {
    setActivatingSlug(slug)
    setActivateError(null)
    try {
      await availPlan(slug)
    } catch {
      setActivateError('Unable to activate plan. Please try again or visit front desk.')
    } finally {
      setActivatingSlug(null)
    }
  }

  const isMemberActive = Boolean(user.has_active_membership)

  return (
    <>
      <SEO
        title="Dashboard"
        description="The DGym member & trainer portal."
      />

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header bar - Account ID removed per design requirement */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-8 border-b border-white/8 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {user.role === 'trainer' ? (
                <Badge variant="warning" dot>
                  TRAINER
                </Badge>
              ) : isMemberActive ? (
                <Badge variant="success" dot>
                  ACTIVE MEMBER
                </Badge>
              ) : (
                <Badge variant="default" dot>
                  REGISTERED USER
                </Badge>
              )}
            </div>
            <h1 className="font-display text-3xl md:text-5xl font-black uppercase tracking-tight text-white">
              Welcome, {user.full_name}
            </h1>
            <p className="text-sm text-white/50 mt-1 max-w-xl">
              {user.role === 'trainer'
                ? 'Assigned personal training roster, coaching schedules, and athlete sessions.'
                : isMemberActive
                ? 'Your active membership pass, class access, and coaching details.'
                : 'Your registered athlete account. Select a membership plan to activate your gym pass.'}
            </p>
          </div>

          {!isMemberActive && user.role === 'member' && (
            <Link to="/membership">
              <Button variant="primary" size="lg">
                View All Plans →
              </Button>
            </Link>
          )}
        </div>

        {/* User profile & privileges summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
              Account Credentials
            </p>
            <p className="font-display text-lg font-bold text-white truncate">
              {user.email}
            </p>
            <p className="text-xs text-white/40 mt-1">
              {user.phone ? `Phone: ${user.phone}` : 'No phone linked'}
            </p>
          </Card>

          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
              Membership Status
            </p>
            {isMemberActive ? (
              <>
                <p className="font-display text-lg font-bold text-green-400 uppercase">
                  Active & Verified
                </p>
                <p className="text-xs text-white/40 mt-1">
                  The DGym Rosario Batangas
                </p>
              </>
            ) : (
              <>
                <p className="font-display text-lg font-bold text-amber-400 uppercase">
                  No Active Plan
                </p>
                <p className="text-xs text-white/40 mt-1">
                  Registered Account User
                </p>
              </>
            )}
          </Card>

          <Card className="p-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
              Member Since
            </p>
            <p className="font-display text-lg font-bold text-white">
              {new Date(user.created_at).toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </p>
            <p className="text-xs text-white/40 mt-1">
              Official Athlete Profile
            </p>
          </Card>
        </div>

        {/* Trainer Specific View */}
        {user.role === 'trainer' && (
          <div className="space-y-6">
            <div className="p-8 rounded-2xl border border-white/8 bg-surface">
              <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white mb-2">
                Trainer Portal
              </h2>
              <p className="text-sm text-white/50 mb-6">
                Manage your client sessions, workout logs, and attendance checks.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Link
                  to="/manage/pt-sessions"
                  className="p-5 rounded-xl border border-white/10 bg-surface-2 hover:border-white/20 transition-colors block"
                >
                  <p className="font-semibold text-white">View PT Schedule →</p>
                  <p className="text-xs text-white/40 mt-1">Check scheduled one-on-one athlete bookings.</p>
                </Link>
                <Link
                  to="/manage/members"
                  className="p-5 rounded-xl border border-white/10 bg-surface-2 hover:border-white/20 transition-colors block"
                >
                  <p className="font-semibold text-white">Client Roster →</p>
                  <p className="text-xs text-white/40 mt-1">View athlete profiles and contact details.</p>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Member Specific View */}
        {user.role === 'member' && (
          <div className="space-y-6">
            {/* If Member HAS Active Plan */}
            {isMemberActive ? (
              <>
                <div className="p-8 rounded-2xl border border-white/8 bg-surface">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
                        Membership Pass
                      </h2>
                      <p className="text-sm text-white/50 mt-1">
                        Present this pass at front desk for seamless check-in.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs uppercase tracking-widest text-green-400 font-semibold font-mono">
                        Access Granted
                      </span>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border border-white/10 bg-surface-2 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/40 font-mono mb-1">
                        Pass Type
                      </p>
                      <p className="text-xl font-bold text-white font-display uppercase">
                        {user.plan_name ? `${user.plan_name.toUpperCase()} PASS` : 'MONTHLY UNLIMITED PASS'}
                      </p>
                      <p className="text-xs text-white/50 mt-1">
                        Includes open gym equipment access and standard barbell turf.
                      </p>
                    </div>
                    <div className="text-left md:text-right">
                      <p className="text-xs uppercase tracking-widest text-white/40 font-mono mb-1">
                        Location
                      </p>
                      <p className="text-sm font-semibold text-white">
                        Rosario, Batangas
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-6 rounded-xl border border-white/8 bg-surface">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display text-lg font-bold uppercase text-white">
                        Group Conditioning
                      </h3>
                      <span className="text-xs uppercase tracking-widest text-red font-mono font-semibold">Active</span>
                    </div>
                    <p className="text-sm text-white/50 mb-3">
                      Strength, conditioning, and barbell turf sessions available daily. Inquire with staff at front desk.
                    </p>
                    <div className="text-xs text-white/40 space-y-1 font-mono">
                      <p>• Barbell Club: Mon/Wed/Fri 6:00 AM</p>
                      <p>• Conditioning Circuit: Tue/Thu 5:00 PM</p>
                      <p>• Powerlifting Clinic: Saturdays 8:00 AM</p>
                    </div>
                  </div>

                  <div className="p-6 rounded-xl border border-white/8 bg-surface">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-display text-lg font-bold uppercase text-white">
                        Personal Coaching
                      </h3>
                      <span className="text-xs uppercase tracking-widest text-green-400 font-mono font-semibold">Available</span>
                    </div>
                    <p className="text-sm text-white/50 mb-3">
                      Work directly with DGym certified coaches for tailored programming and technique refinement.
                    </p>
                    <div className="text-xs text-white/40 space-y-1 font-mono">
                      <p>• Powerlifting & Strength Assessment</p>
                      <p>• Form & Velocity Optimization</p>
                      <p>• Custom Block Periodization</p>
                    </div>
                    <Link
                      to="/dashboard/book"
                      className="inline-block mt-4 text-xs font-semibold bg-red text-white px-4 py-2 rounded-lg hover:bg-red/80 transition-colors uppercase tracking-wider font-mono"
                    >
                      Book a Coach →
                    </Link>
                  </div>
                </div>
              </>
            ) : (
              /* If Member has NOT availed a plan yet */
              <div className="space-y-6">
                <div className="p-8 rounded-2xl border border-amber-500/20 bg-amber-500/[0.03]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-xs uppercase tracking-widest text-amber-400 font-semibold font-mono">
                          Pass Inactive • No Plan Availed
                        </span>
                      </div>
                      <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wide text-white">
                        Activate Your Gym Membership
                      </h2>
                      <p className="text-sm text-white/60 mt-1 max-w-xl">
                        You are currently registered as an account holder. Choose a training plan to activate your membership pass and get full access to the barbell turf, group classes, and personal coaching.
                      </p>
                    </div>
                  </div>

                  {activateError && (
                    <div className="mb-6 p-4 rounded-xl border border-red/30 bg-red/10 text-white text-xs">
                      {activateError}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                    {QUICK_PLANS.map((plan) => (
                      <div
                        key={plan.slug}
                        className="p-5 rounded-xl border border-white/10 bg-surface-2 flex flex-col justify-between hover:border-white/20 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-display text-lg font-bold uppercase text-white">
                              {plan.name}
                            </h3>
                            {plan.badge && (
                              <Badge variant={plan.slug === 'monthly' ? 'red' : 'default'} size="sm">
                                {plan.badge}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-white/40 font-mono mb-2">{plan.period}</p>
                          <p className="text-xs text-white/60 mb-4">{plan.description}</p>
                        </div>
                        <Button
                          size="sm"
                          variant={plan.slug === 'monthly' ? 'primary' : 'secondary'}
                          loading={activatingSlug === plan.slug}
                          disabled={activatingSlug !== null}
                          onClick={() => handleQuickAvail(plan.slug)}
                          className="w-full mt-2"
                        >
                          Avail {plan.name}
                        </Button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-white/40">
                    <p>Want to see the complete list of training programs?</p>
                    <Link
                      to="/membership"
                      className="text-white hover:text-red underline underline-offset-2 transition-colors font-medium"
                    >
                      Explore Membership & Classes Page →
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
