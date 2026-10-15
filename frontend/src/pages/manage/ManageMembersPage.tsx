import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import type { Member, MemberStatus } from '@/types/auth'
import { AlertCircle, X, Trash2, UserX, UserCheck } from 'lucide-react'
import { QuarterRing } from '@/components/ui/quarter-ring'

gsap.registerPlugin()

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All Statuses' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
]

function getStatusBadgeVariant(status: MemberStatus) {
  switch (status) {
    case 'active': return 'success' as const
    case 'expired': return 'warning' as const
    case 'suspended': return 'danger' as const
    default: return 'default' as const
  }
}

export function ManageMembersPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  
  // Modal states for Deactivate, Reactivate & Delete
  const [deactivateTarget, setDeactivateTarget] = useState<Member | null>(null)
  const [reactivateTarget, setReactivateTarget] = useState<Member | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null)
  const [isActionLoading, setIsActionLoading] = useState(false)
  const [actionLoadingText, setActionLoadingText] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  // GSAP entrance animation
  useGSAP(() => {
    gsap.from(containerRef.current, { opacity: 0, y: 16, duration: 0.4, ease: 'power2.out' })
  }, { scope: containerRef })

  const fetchMembers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getMembers({
        search: search || undefined,
        status: statusFilter || undefined,
      })
      setMembers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load members.')
    } finally {
      setLoading(false)
    }
  }, [search, statusFilter])

  // Debounced fetch on search/filter change
  useEffect(() => {
    const timer = setTimeout(fetchMembers, 350)
    return () => clearTimeout(timer)
  }, [fetchMembers])

  const confirmDeactivate = async () => {
    if (!deactivateTarget) return
    setIsActionLoading(true)
    setActionError(null)
    setActionLoadingText(`Deactivating ${deactivateTarget.full_name}...`)
    try {
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 800)),
        api.deactivateMember(deactivateTarget.id),
      ])
      setMembers((prev) =>
        prev.map((m) =>
          m.id === deactivateTarget.id
            ? { ...m, status: 'inactive' as MemberStatus, is_active: false }
            : m
        )
      )
      setDeactivateTarget(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to deactivate member.')
    } finally {
      setIsActionLoading(false)
      setActionLoadingText(null)
    }
  }

  const confirmReactivate = async () => {
    if (!reactivateTarget) return
    setIsActionLoading(true)
    setActionError(null)
    setActionLoadingText(`Reactivating ${reactivateTarget.full_name}...`)
    try {
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 800)),
        api.reactivateMember(reactivateTarget.id),
      ])
      setMembers((prev) =>
        prev.map((m) =>
          m.id === reactivateTarget.id
            ? { ...m, status: 'active' as MemberStatus, is_active: true }
            : m
        )
      )
      setReactivateTarget(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reactivate member.')
    } finally {
      setIsActionLoading(false)
      setActionLoadingText(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setIsActionLoading(true)
    setActionError(null)
    setActionLoadingText(`Deleting ${deleteTarget.full_name} permanently...`)
    try {
      await Promise.all([
        new Promise((resolve) => setTimeout(resolve, 800)),
        api.deleteMember(deleteTarget.id),
      ])
      setMembers((prev) => prev.filter((m) => m.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete member.')
    } finally {
      setIsActionLoading(false)
      setActionLoadingText(null)
    }
  }

  // Get the active membership (most recent active one)
  const getActiveMembership = (member: Member) => {
    return member.memberships.find((ms) => ms.status === 'active') ?? null
  }

  return (
    <>
      <SEO title="Members" description="Manage gym members at The DGym." />

      <div ref={containerRef} className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Gym Management</p>
            <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Members
            </h1>
            <p className="text-sm text-white/50 mt-1">
              {loading ? 'Loading...' : `${members.length} members found`}
            </p>
          </div>
          {isAdmin && (
            <Link to="/manage/members/new">
              <Button variant="primary" size="md">
                + Register Member
              </Button>
            </Link>
          )}
        </div>
        {/* Search + Filter */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search by name, email, phone, or member code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/40 transition-colors"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-surface-2">
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Error */}
        {(error || actionError) && (
          <div className="mb-6 p-4 rounded-xl border border-red/30 bg-red/10 text-red text-sm flex items-center justify-between gap-2">
            <span>{error || actionError}</span>
            {actionError && (
              <button
                type="button"
                onClick={() => setActionError(null)}
                className="text-red/70 hover:text-red cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Table */}
        <div className="border border-white/8 rounded-xl overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 border-b border-white/8 text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="py-3 px-4">Member</th>
                  <th className="py-3 px-4">Code</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Plan</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-32" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-20" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-28" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-20" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-16" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-20" /></td>
                      <td className="py-4 px-4" />
                    </tr>
                  ))
                ) : members.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-white/40 text-sm">
                      No members found. {search ? 'Try a different search.' : ''}
                    </td>
                  </tr>
                ) : members.map((member) => {
                  const activePlan = getActiveMembership(member)
                  return (
                    <tr key={member.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{member.full_name}</p>
                        <p className="text-xs text-white/40">{member.email || 'No email'}</p>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs text-red">{member.member_code}</span>
                      </td>
                      <td className="py-3 px-4 text-white/60 text-xs">
                        {member.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        {activePlan ? (
                          <span className="text-xs text-white/80">{activePlan.plan_name}</span>
                        ) : (
                          <span className="text-xs text-white/30">No plan</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getStatusBadgeVariant(member.status)}>
                          {member.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-white/40 text-xs font-mono">
                        {new Date(member.joined_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link to={`/manage/members/${member.id}`}>
                            <button
                              type="button"
                              className="px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition-colors cursor-pointer"
                            >
                              View
                            </button>
                          </Link>

                          {isAdmin && (
                            <>
                              {member.is_active ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionError(null)
                                    setDeactivateTarget(member)
                                  }}
                                  className="px-2.5 py-1.5 text-xs text-amber-400/80 hover:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  title="Deactivate Member"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                  <span>Deactivate</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActionError(null)
                                    setReactivateTarget(member)
                                  }}
                                  className="px-2.5 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/20 hover:border-emerald-500/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                  title="Reactivate Member"
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                  <span>Reactivate</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => {
                                  setActionError(null)
                                  setDeleteTarget(member)
                                }}
                                className="p-1.5 text-red/60 hover:text-red border border-red/10 hover:border-red/30 rounded-lg transition-colors cursor-pointer"
                                title="Delete Member"
                                aria-label="Delete member"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ===================================================================
            DEACTIVATE CONFIRMATION MODAL (Rendered to document.body via Portal)
        =================================================================== */}
        {deactivateTarget &&
          createPortal(
            <div
              className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
              onClick={() => !isActionLoading && setDeactivateTarget(null)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="relative w-full max-w-md rounded-2xl border border-amber-500/30 bg-[#121214] p-6 shadow-2xl space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                      <UserX className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white uppercase tracking-tight">
                        Deactivate Member
                      </h3>
                      <p className="text-xs text-white/40 font-mono">
                        CODE: {deactivateTarget.member_code}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeactivateTarget(null)}
                    disabled={isActionLoading}
                    className="text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {actionError && (
                  <div className="p-3 rounded-xl border border-red/30 bg-red/10 text-red text-xs">
                    {actionError}
                  </div>
                )}

                <div className="space-y-2 text-sm text-white/70">
                  <p className="text-white font-medium">
                    Are you sure you want to deactivate{' '}
                    <span className="text-amber-400 font-semibold">{deactivateTarget.full_name}</span>?
                  </p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Their membership pass will be paused, turnstile gate access will be set to inactive, 
                    and they will no longer be marked as an active facility lifter.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeactivateTarget(null)}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDeactivate}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isActionLoading ? 'Deactivating...' : 'Yes, Deactivate'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* ===================================================================
            REACTIVATE CONFIRMATION MODAL (Rendered to document.body via Portal)
        =================================================================== */}
        {reactivateTarget &&
          createPortal(
            <div
              className="fixed inset-0 z-[99999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
              onClick={() => !isActionLoading && setReactivateTarget(null)}
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
                        CODE: {reactivateTarget.member_code}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReactivateTarget(null)}
                    disabled={isActionLoading}
                    className="text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {actionError && (
                  <div className="p-3 rounded-xl border border-red/30 bg-red/10 text-red text-xs">
                    {actionError}
                  </div>
                )}

                <div className="space-y-2 text-sm text-white/70">
                  <p className="text-white font-medium">
                    Are you sure you want to reactivate{' '}
                    <span className="text-emerald-400 font-semibold">{reactivateTarget.full_name}</span>?
                  </p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    Their membership profile will be restored to active status, allowing them to enter the facility, 
                    enroll in classes, and be assigned membership plans.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setReactivateTarget(null)}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmReactivate}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40"
                  >
                    {isActionLoading ? 'Reactivating...' : 'Yes, Reactivate'}
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )}

        {/* ===================================================================
            DELETE MEMBER CONFIRMATION MODAL (Rendered to document.body via Portal)
        =================================================================== */}
        {deleteTarget &&
          createPortal(
            <div
              className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
              onClick={() => !isActionLoading && setDeleteTarget(null)}
              role="dialog"
              aria-modal="true"
            >
              <div
                className="relative w-full max-w-md rounded-2xl border border-red/40 bg-[#121214] p-6 shadow-2xl space-y-5"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-red/10 border border-red/30 flex items-center justify-center text-red shrink-0">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white uppercase tracking-tight">
                        Delete Member
                      </h3>
                      <p className="text-xs text-white/40 font-mono">
                        CODE: {deleteTarget.member_code}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={isActionLoading}
                    className="text-white/40 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {actionError && (
                  <div className="p-3 rounded-xl border border-red/30 bg-red/10 text-red text-xs">
                    {actionError}
                  </div>
                )}

                <div className="space-y-2 text-sm text-white/70">
                  <p className="text-white font-medium">
                    Are you sure you want to delete{' '}
                    <span className="text-red font-semibold">{deleteTarget.full_name}</span>?
                  </p>
                  <p className="text-xs text-white/50 leading-relaxed">
                    This action is <strong className="text-red">permanent and irreversible</strong>. 
                    All associated check-ins, package records, and athlete details will be completely removed.
                  </p>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(null)}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 text-xs text-white/70 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={isActionLoading}
                    className="px-4 py-2 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_15px_rgba(229,32,26,0.3)] disabled:opacity-40"
                  >
                    {isActionLoading ? 'Deleting...' : 'Yes, Delete Permanently'}
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
              <QuarterRing className="h-14 w-14 text-red" />
              <p className="mt-6 text-sm uppercase tracking-[0.25em] font-mono text-white/80 font-bold">
                {actionLoadingText}
              </p>
              <p className="mt-2 text-xs font-mono text-white/40">
                Updating member records in database...
              </p>
            </div>,
            document.body,
          )}
      </div>
    </>
  )
}
