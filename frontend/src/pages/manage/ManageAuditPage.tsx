import { useCallback, useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { RefreshCw, Search, ShieldCheck } from 'lucide-react'
import { api } from '@/services/api'
import { Badge } from '@/components/ui/Badge'
import { PaginationControls } from '@/components/ui/PaginationControls'
import { SEO } from '@/components/ui/SEO'
import type { AuditLogEntry } from '@/types/auth'

const AUDIT_PAGE_SIZE = 25

function getOutcomeBadgeVariant(outcome: string) {
  switch (outcome.toUpperCase()) {
    case 'SUCCESS':
      return 'success' as const
    case 'DENIED':
      return 'warning' as const
    case 'FAILED':
      return 'danger' as const
    default:
      return 'default' as const
  }
}

function getRoleBadgeVariant(role: string | null) {
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return 'danger' as const
    case 'trainer':
      return 'warning' as const
    case 'system':
      return 'info' as const
    case 'member':
      return 'success' as const
    default:
      return 'default' as const
  }
}

function formatAuditTimestamp(iso: string): string {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export function ManageAuditPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

  const [logs, setLogs] = useState<AuditLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [skip, setSkip] = useState(0)
  const [hasNext, setHasNext] = useState(false)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useGSAP(
    () => {
      if (!containerRef.current) return
      gsap.from(containerRef.current, {
        opacity: 0,
        y: 16,
        duration: 0.4,
        ease: 'power2.out',
      })
    },
    { scope: containerRef },
  )

  const fetchAuditLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await api.getAuditLogsPage({
        search: search.trim() || undefined,
        outcome: outcomeFilter || undefined,
        actor_role: roleFilter || undefined,
        skip,
        limit: AUDIT_PAGE_SIZE,
      })
      if (mountedRef.current) {
        setLogs(page.items)
        setHasNext(page.has_next)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load audit logs.')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [search, outcomeFilter, roleFilter, skip])

  useEffect(() => {
    const timer = window.setTimeout(fetchAuditLogs, 220)
    return () => window.clearTimeout(timer)
  }, [fetchAuditLogs])

  const handleSearchChange = (value: string) => {
    setSearch(value)
    setSkip(0)
  }

  const handleOutcomeChange = (value: string) => {
    setOutcomeFilter(value)
    setSkip(0)
  }

  const handleRoleChange = (value: string) => {
    setRoleFilter(value)
    setSkip(0)
  }

  return (
    <div ref={containerRef} className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      <SEO title="Audit Trail" description="System-wide security and operational audit logs." noIndex />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <ShieldCheck className="w-4 h-4 text-red" />
            <p className="text-xs uppercase tracking-widest text-white/40 font-mono">
              Security &amp; Compliance Trail
            </p>
          </div>
          <h1 className="text-3xl font-bold tracking-tight uppercase">Audit Logs</h1>
        </div>

        <button
          type="button"
          onClick={fetchAuditLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-surface text-xs font-mono text-white/75 hover:text-white hover:border-white/25 transition-colors cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Trail</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="md:col-span-2 relative">
          <Search className="w-4 h-4 text-white/35 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search actor email, action, IP address, or target..."
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-red/40 transition-colors"
          />
        </div>

        <select
          aria-label="Filter by outcome"
          value={outcomeFilter}
          onChange={(e) => handleOutcomeChange(e.target.value)}
          className="px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
        >
          <option value="" className="bg-surface-2">All Outcomes</option>
          <option value="SUCCESS" className="bg-surface-2">SUCCESS</option>
          <option value="DENIED" className="bg-surface-2">DENIED</option>
          <option value="FAILED" className="bg-surface-2">FAILED</option>
        </select>

        <select
          aria-label="Filter by actor role"
          value={roleFilter}
          onChange={(e) => handleRoleChange(e.target.value)}
          className="px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
        >
          <option value="" className="bg-surface-2">All Actor Roles</option>
          <option value="admin" className="bg-surface-2">Admin</option>
          <option value="trainer" className="bg-surface-2">Trainer</option>
          <option value="member" className="bg-surface-2">Member</option>
          <option value="user" className="bg-surface-2">User</option>
          <option value="system" className="bg-surface-2">System / Webhook</option>
        </select>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red/30 bg-red/10 text-xs font-mono text-red-200">
          {error}
        </div>
      )}

      {/* Audit Trail Table */}
      <div className="rounded-xl border border-white/10 bg-surface p-4 space-y-4">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-[10px] font-mono uppercase tracking-widest text-white/40">
                <th className="py-3 px-3">Timestamp</th>
                <th className="py-3 px-3">Actor &amp; Role</th>
                <th className="py-3 px-3">Action</th>
                <th className="py-3 px-3">Target &amp; Details</th>
                <th className="py-3 px-3">Source (IP / Agent)</th>
                <th className="py-3 px-3">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/40 font-mono text-xs">
                    Loading immutable audit logs...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-white/40 font-mono text-xs">
                    No matching audit records found.
                  </td>
                </tr>
              ) : (
                logs.map((entry) => (
                  <tr key={entry.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-3 text-xs font-mono text-white/55 whitespace-nowrap">
                      {formatAuditTimestamp(entry.created_at)}
                    </td>
                    <td className="py-3 px-3">
                      <p className="text-xs font-medium text-white truncate max-w-[200px]">
                        {entry.actor_email || 'anonymous'}
                      </p>
                      <div className="mt-1">
                        <Badge variant={getRoleBadgeVariant(entry.actor_role)}>
                          {(entry.actor_role || 'guest').toUpperCase()}
                        </Badge>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono text-xs text-red whitespace-nowrap">
                      {entry.action}
                    </td>
                    <td className="py-3 px-3 max-w-xs">
                      {(entry.target_type || entry.target_id) && (
                        <p className="text-[11px] font-mono text-white/75">
                          {entry.target_type || 'resource'}
                          {entry.target_id ? ` #${entry.target_id}` : ''}
                        </p>
                      )}
                      <p className="text-xs text-white/50 truncate" title={entry.details || ''}>
                        {entry.details || '—'}
                      </p>
                    </td>
                    <td className="py-3 px-3 max-w-[210px]">
                      <p className="text-xs font-mono text-white/65">{entry.ip_address || 'unknown'}</p>
                      {entry.user_agent && (
                        <p
                          className="text-[10px] font-mono text-white/35 truncate"
                          title={entry.user_agent}
                        >
                          {entry.user_agent}
                        </p>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <Badge variant={getOutcomeBadgeVariant(entry.outcome)}>{entry.outcome}</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          skip={skip}
          limit={AUDIT_PAGE_SIZE}
          itemCount={logs.length}
          hasNext={hasNext}
          loading={loading}
          onPrev={() => setSkip((prev) => Math.max(0, prev - AUDIT_PAGE_SIZE))}
          onNext={() => setSkip((prev) => prev + AUDIT_PAGE_SIZE)}
          itemLabel="audit logs"
        />
      </div>
    </div>
  )
}
