import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import type { Member, MemberStatus } from '@/types/auth'

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
  const canRegister = user?.role === 'admin' || user?.role === 'staff'

  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [deleting, setDeleting] = useState<number | null>(null)

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

  const handleDeactivate = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this member?')) return
    setDeleting(id)
    try {
      await api.deactivateMember(id)
      setMembers((prev) =>
        prev.map((m) => m.id === id ? { ...m, status: 'inactive' as MemberStatus, is_active: false } : m)
      )
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate member.')
    } finally {
      setDeleting(null)
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
          {canRegister && (
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
        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red/30 bg-red/10 text-red text-sm">
            {error}
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
                            <button className="px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition-colors">
                              View
                            </button>
                          </Link>
                          {canRegister && member.is_active && (
                            <button
                              onClick={() => handleDeactivate(member.id)}
                              disabled={deleting === member.id}
                              className="px-3 py-1.5 text-xs text-red/60 hover:text-red border border-red/10 hover:border-red/30 rounded-lg transition-colors disabled:opacity-40"
                            >
                              {deleting === member.id ? '...' : 'Deactivate'}
                            </button>
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
      </div>
    </>
  )
}
