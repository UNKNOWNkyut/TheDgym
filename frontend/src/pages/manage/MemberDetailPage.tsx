import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useParams, Link, useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { api } from '@/services/api'
import type { Member, MemberStatus, MembershipPlan } from '@/types/auth'
import { AssignMembershipModal } from '@/components/manage/AssignMembershipModal'
import { MemberKeycardsCard } from '@/components/manage/MemberKeycardsCard'
import { UserCheck, X, AlertTriangle } from 'lucide-react'
import { QuarterRing } from '@/components/ui/quarter-ring'

gsap.registerPlugin()

function getStatusBadgeVariant(status: MemberStatus) {
  switch (status) {
    case 'active': return 'success' as const
    case 'expired': return 'warning' as const
    case 'suspended': return 'danger' as const
    default: return 'default' as const
  }
}

function getMembershipStatusVariant(status: string) {
  switch (status) {
    case 'active': return 'success' as const
    case 'expired': return 'warning' as const
    case 'cancelled': return 'danger' as const
    default: return 'default' as const
  }
}

export function MemberDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const fromAnalytics = (location.state as { from?: string } | null)?.from === 'analytics'
  const backTo = fromAnalytics ? '/manage/analytics' : '/manage/members'
  const backLabel = fromAnalytics ? 'Analytics' : 'Members'
  const containerRef = useRef<HTMLDivElement>(null)

  const [member, setMember] = useState<Member | null>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAssignModal, setShowAssignModal] = useState(false)
  const [showReactivateModal, setShowReactivateModal] = useState(false)
  const [isReactivating, setIsReactivating] = useState(false)
  const [actionLoadingText, setActionLoadingText] = useState<string | null>(null)
  const [reactivateError, setReactivateError] = useState<string | null>(null)

  useGSAP(() => {
    if (!loading && member) {
      gsap.from(containerRef.current, { opacity: 0, y: 16, duration: 0.4, ease: 'power2.out' })
    }
  }, { scope: containerRef, dependencies: [loading] })

  useEffect(() => {
    const load = async () => {
      if (!id) return
      setLoading(true)
      setError(null)
      try {
        const [m, p] = await Promise.all([
          api.getMember(parseInt(id)),
          api.getPlans(),
        ])
        setMember(m)
        setPlans(p)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load member.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const refreshMember = async () => {
    if (!id) return
    try {
      const m = await api.getMember(parseInt(id))
      setMember(m)
    } catch {
      // ignore
    }
  }

  const handleReactivate = async () => {
    if (!member) return
    setIsReactivating(true)
    setReactivateError(null)
    setActionLoadingText(`Reactivating ${member.full_name}...`)
    try {
      const [, updated] = await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 800)),
        api.reactivateMember(member.id),
      ])
      setMember(updated)
      setShowReactivateModal(false)
    } catch (err) {
      setReactivateError(err instanceof Error ? err.message : 'Failed to reactivate member.')
    } finally {
      setIsReactivating(false)
      setActionLoadingText(null)
    }
  }

  if (loading) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-white/5 rounded w-1/4" />
          <div className="h-10 bg-white/5 rounded w-1/2" />
          <div className="grid grid-cols-3 gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-24 bg-white/5 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !member) {
    return (
      <div className="p-6 md:p-8 max-w-4xl mx-auto">
        <div className="p-6 rounded-xl border border-red/30 bg-red/10 text-red">
          {error || 'Member not found.'}
        </div>
        <Link to={backTo} className="mt-4 inline-block text-sm text-white/50 hover:text-white">
          ← Back to {backLabel}
        </Link>
      </div>
    )
  }

  const activeMembership = member.memberships.find((ms) => ms.status === 'active') ?? null

  return (
    <>
      <SEO title={`${member.full_name} — Member`} description={`Member profile for ${member.full_name} at The DGym.`} />

      <div ref={containerRef} className="p-6 md:p-8 max-w-4xl mx-auto">
        {/* Back */}
        <Link to={backTo} className="inline-flex items-center gap-2 text-sm text-white/40 hover:text-white transition-colors mb-6">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel}
        </Link>

        {/* Profile Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-red/10 border border-red/20 flex items-center justify-center flex-shrink-0">
              <span className="text-red text-xl font-black font-display">
                {member.first_name[0]}{member.last_name[0]}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs text-red">{member.member_code}</span>
                <Badge variant={getStatusBadgeVariant(member.status)}>{member.status}</Badge>
              </div>
              <h1 className="font-display text-2xl md:text-3xl font-black uppercase tracking-tight text-white">
                {member.full_name}
              </h1>
              <p className="text-sm text-white/50">{member.email || 'No email on file'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!member.is_active || member.status === 'inactive' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setReactivateError(null)
                    setShowReactivateModal(true)
                  }}
                  className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-950/40"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Reactivate Member</span>
                </button>
                <button
                  type="button"
                  disabled
                  title="Cannot assign a plan to a deactivated member. Please reactivate first."
                  className="px-3.5 py-2 text-xs text-white/30 border border-white/10 rounded-xl cursor-not-allowed font-medium"
                >
                  + Assign Plan
                </button>
              </>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setShowAssignModal(true)}
              >
                + Assign Plan
              </Button>
            )}
          </div>
        </div>

        {/* Deactivated Notice Banner */}
        {(!member.is_active || member.status === 'inactive') && (
          <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
              <div>
                <p className="font-semibold text-amber-300 text-sm">Account Deactivated</p>
                <p className="text-xs text-amber-400/80">
                  This member cannot be assigned a plan while deactivated. Reactivate this account to restore plan access.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setReactivateError(null)
                setShowReactivateModal(true)
              }}
              className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer"
            >
              Reactivate Account
            </button>
          </div>
        )}

        {/* Active Membership Banner */}
        {activeMembership ? (
          <div className="mb-6 p-4 rounded-xl border border-green-400/20 bg-green-400/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-widest text-green-400/70 mb-0.5">Active Membership</p>
              <p className="font-semibold text-white">{activeMembership.plan_name}</p>
              <p className="text-xs text-white/40">
                {new Date(activeMembership.start_date).toLocaleDateString()} →{' '}
                {new Date(activeMembership.end_date).toLocaleDateString()}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              Active
            </span>
          </div>
        ) : (
          <div className="mb-6 p-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5">
            <p className="text-xs uppercase tracking-widest text-yellow-400/70 mb-0.5">No Active Membership</p>
            <p className="text-sm text-white/60">This member has no current plan.{' '}
              <button onClick={() => setShowAssignModal(true)} className="text-red hover:underline">
                Assign a plan →
              </button>
            </p>
          </div>
        )}

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Personal Info */}
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-4">Personal Details</p>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-white/40">Phone</dt>
                <dd className="text-white">{member.phone || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Date of Birth</dt>
                <dd className="text-white">{member.date_of_birth ? new Date(member.date_of_birth).toLocaleDateString() : '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Gender</dt>
                <dd className="text-white capitalize">{member.gender?.replace('_', ' ') || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Address</dt>
                <dd className="text-white text-right max-w-xs">{member.address || '—'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-white/40">Joined</dt>
                <dd className="text-white">{new Date(member.joined_at).toLocaleDateString()}</dd>
              </div>
            </dl>
          </Card>

          {/* Emergency Contact */}
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-4">Emergency Contact</p>
            {member.emergency_contact_name ? (
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-white/40">Name</dt>
                  <dd className="text-white">{member.emergency_contact_name}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-white/40">Phone</dt>
                  <dd className="text-white">{member.emergency_contact_phone || '—'}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-white/30">No emergency contact recorded.</p>
            )}

            {member.notes && (
              <div className="mt-4 pt-4 border-t border-white/8">
                <p className="text-xs uppercase tracking-widest text-white/40 mb-2">Admin Notes</p>
                <p className="text-sm text-white/60">{member.notes}</p>
              </div>
            )}
          </Card>
        </div>

        {/* Smart Keycard Access Management */}
        <MemberKeycardsCard
          memberId={member.id}
          memberCode={member.member_code}
          memberName={member.full_name}
        />

        {/* Membership History */}
        <div>
          <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white mb-4">
            Membership History
          </h2>
          {member.memberships.length === 0 ? (
            <div className="p-6 rounded-xl border border-white/8 bg-surface text-center text-white/40 text-sm">
              No membership records yet.
            </div>
          ) : (
            <div className="border border-white/8 rounded-xl overflow-hidden bg-surface">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface-2 border-b border-white/8 text-xs uppercase tracking-wider text-white/40">
                    <tr>
                      <th className="py-3 px-4">Plan</th>
                      <th className="py-3 px-4">Period</th>
                      <th className="py-3 px-4">Paid</th>
                      <th className="py-3 px-4">Method</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {member.memberships.map((ms) => (
                      <tr key={ms.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4 font-medium text-white">{ms.plan_name}</td>
                        <td className="py-3 px-4 text-xs text-white/50 font-mono">
                          {new Date(ms.start_date).toLocaleDateString()} →{' '}
                          {new Date(ms.end_date).toLocaleDateString()}
                        </td>
                        <td className="py-3 px-4 text-white">
                          {ms.paid_amount ? `₱${parseFloat(ms.paid_amount).toLocaleString()}` : '—'}
                        </td>
                        <td className="py-3 px-4 text-white/50 capitalize">
                          {ms.payment_method?.replace('_', ' ') || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getMembershipStatusVariant(ms.status)}>{ms.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Assign Membership Modal */}
      {showAssignModal && (
        <AssignMembershipModal
          member={member}
          plans={plans}
          onClose={() => setShowAssignModal(false)}
          onSuccess={async () => {
            setShowAssignModal(false)
            await refreshMember()
          }}
        />
      )}

      {/* Reactivate Confirmation Modal */}
      {showReactivateModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
            onClick={() => !isReactivating && setShowReactivateModal(false)}
            role="dialog"
            aria-modal="true"
          >
            <div
              className="relative w-full max-w-md rounded-2xl border border-emerald-500/30 bg-[#121214] p-6 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white uppercase tracking-tight">
                      Reactivate Member
                    </h3>
                    <p className="text-xs text-white/40 font-mono">
                      CODE: {member.member_code}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReactivateModal(false)}
                  disabled={isReactivating}
                  className="text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {reactivateError && (
                <div className="p-3 rounded-xl border border-red/30 bg-red/10 text-red text-xs">
                  {reactivateError}
                </div>
              )}

              <div className="space-y-2 text-sm text-white/70">
                <p className="text-white font-medium">
                  Are you sure you want to reactivate{' '}
                  <span className="text-emerald-400 font-semibold">{member.full_name}</span>?
                </p>
                <p className="text-xs text-white/50 leading-relaxed">
                  Their account will be restored to active status, turnstile access will be unblocked, 
                  and you will be able to assign membership plans to them.
                </p>
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReactivateModal(false)}
                  disabled={isReactivating}
                  className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReactivate}
                  disabled={isReactivating}
                  className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
                >
                  {isReactivating ? 'Reactivating...' : 'Yes, Reactivate'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Action Loading Full-Screen Overlay */}
      {actionLoadingText &&
        createPortal(
          <div
            className="fixed inset-0 z-[100000] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in"
            role="status"
            aria-live="polite"
          >
            <img
              src="/assets/logos/thedgym.png"
              alt="The DGym"
              className="mb-8 h-12 w-auto object-contain"
            />
            <QuarterRing className="h-14 w-14 text-emerald-500" />
            <p className="mt-6 text-sm uppercase tracking-[0.25em] font-mono text-white/80 font-bold">
              {actionLoadingText}
            </p>
            <p className="mt-2 text-xs font-mono text-white/40">
              Restoring membership privileges in database...
            </p>
          </div>,
          document.body,
        )}
    </>
  )
}
