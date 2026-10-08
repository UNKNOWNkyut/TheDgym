import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import type { PTSession, Member, TrainerProfile } from '@/types/auth'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  confirmed: 'text-green-400 bg-green-400/10 border-green-400/20',
  scheduled: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  rejected: 'text-red-400 bg-red-400/10 border-red-400/20',
  completed: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  cancelled: 'text-white/40 bg-white/5 border-white/10',
  no_show: 'text-orange-400 bg-orange-400/10 border-orange-400/20',
}

// ─── PT Session Row ───────────────────────────────────────────────────────────

function PTRow({ session, onUpdate }: { session: PTSession; onUpdate: () => void }) {
  const [updating, setUpdating] = useState(false)

  const handleApprove = async () => {
    setUpdating(true)
    try {
      await api.approvePTSession(session.id)
      onUpdate()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to approve booking.')
    } finally {
      setUpdating(false)
    }
  }

  const handleReject = async () => {
    const reason = prompt(
      'Reason for declining this booking request (optional):',
      'Coach is unavailable at this time slot.'
    )
    if (reason === null) return // cancelled prompt
    setUpdating(true)
    try {
      await api.rejectPTSession(session.id, reason)
      onUpdate()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to decline booking.')
    } finally {
      setUpdating(false)
    }
  }

  const handleStatus = async (newStatus: string) => {
    setUpdating(true)
    try {
      await api.updatePTSession(session.id, { status: newStatus })
      onUpdate()
    } catch {
      /* silent */
    } finally {
      setUpdating(false)
    }
  }

  const statusClass = STATUS_COLORS[session.status] ?? 'text-white/40 bg-white/5 border-white/10'

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-white">{session.member_name ?? '—'}</p>
        <p className="text-xs text-white/40 font-mono">{session.member_code ?? ''}</p>
        {session.notes && (
          <p className="text-[11px] text-white/50 italic mt-0.5 truncate max-w-xs">
            "{session.notes}"
          </p>
        )}
      </td>
      <td className="py-3 px-4 text-sm text-white/70">{session.trainer_name ?? '—'}</td>
      <td className="py-3 px-4 text-sm text-white/70 font-mono">
        {new Date(session.scheduled_at).toLocaleString('en-PH', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td className="py-3 px-4 text-sm text-white/50">{session.duration_minutes}min</td>
      <td className="py-3 px-4">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusClass}`}>
          {session.status.replace('_', ' ').toUpperCase()}
        </span>
      </td>
      <td className="py-3 px-4">
        {session.status === 'pending' ? (
          <div className="flex gap-1.5">
            <button
              disabled={updating}
              onClick={handleApprove}
              className="text-xs bg-green-500/20 border border-green-500/40 text-green-300 hover:bg-green-500/30 font-semibold px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              Approve
            </button>
            <button
              disabled={updating}
              onClick={handleReject}
              className="text-xs border border-red-400/30 text-red-400 hover:bg-red-400/10 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              Decline
            </button>
          </div>
        ) : session.status === 'scheduled' || session.status === 'confirmed' ? (
          <div className="flex gap-1.5">
            <button
              disabled={updating}
              onClick={() => handleStatus('completed')}
              className="text-xs border border-green-400/30 text-green-400 hover:bg-green-400/10 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              Done
            </button>
            <button
              disabled={updating}
              onClick={() => handleStatus('cancelled')}
              className="text-xs border border-red-400/30 text-red-400 hover:bg-red-400/10 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              disabled={updating}
              onClick={() => handleStatus('no_show')}
              className="text-xs border border-orange-400/30 text-orange-400 hover:bg-orange-400/10 px-2 py-1 rounded-lg transition-colors disabled:opacity-50"
            >
              No-Show
            </button>
          </div>
        ) : (
          <span className="text-xs text-white/30 font-mono">—</span>
        )}
      </td>
    </tr>
  )
}

// ─── Create PT Session Modal (Direct Staff Schedule) ──────────────────────────

function CreatePTModal({
  memberOptions,
  trainerOptions,
  onClose,
  onCreated,
}: {
  memberOptions: SelectOption[]
  trainerOptions: SelectOption[]
  onClose: () => void
  onCreated: () => void
}) {
  const { user } = useAuth()
  const [form, setForm] = useState({
    member_id: '',
    trainer_id: user?.id?.toString() ?? '',
    scheduled_at: '',
    duration_minutes: 60,
    notes: '',
    coach_notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const memberId = parseInt(form.member_id)
    if (!memberId) {
      setError('Please select a member.')
      return
    }
    if (!form.scheduled_at) {
      setError('Please select a date and time.')
      return
    }
    setLoading(true)
    try {
      await api.createPTSession({
        member_id: memberId,
        trainer_id: form.trainer_id ? parseInt(form.trainer_id) : undefined,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: form.duration_minutes,
        notes: form.notes || undefined,
        coach_notes: form.coach_notes || undefined,
      })
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to schedule PT session.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-white">Direct Schedule PT Session</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Member Searchable Dropdown */}
          <SearchableSelect
            label="Select Member"
            required
            placeholder="Search & choose member…"
            value={form.member_id ? parseInt(form.member_id) : ''}
            onChange={(id) => setForm((f) => ({ ...f, member_id: id.toString() }))}
            options={memberOptions}
            idColLabel="MEMBER CODE"
            nameColLabel="MEMBER NAME"
          />

          {/* Trainer Searchable Dropdown */}
          <SearchableSelect
            label="Assigned Instructor"
            placeholder="Search & choose coach…"
            value={form.trainer_id ? parseInt(form.trainer_id) : ''}
            onChange={(id) => setForm((f) => ({ ...f, trainer_id: id.toString() }))}
            options={trainerOptions}
            idColLabel="COACH ID"
            nameColLabel="COACH NAME"
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
                Date & Time *
              </label>
              <input
                required
                type="datetime-local"
                value={form.scheduled_at}
                onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
                Duration (minutes)
              </label>
              <input
                type="number"
                min={15}
                max={240}
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
              Session Notes
            </label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/50 transition-colors resize-none"
              placeholder="Notes for the member…"
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
              Coach Notes (private)
            </label>
            <textarea
              rows={2}
              value={form.coach_notes}
              onChange={(e) => setForm((f) => ({ ...f, coach_notes: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/50 transition-colors resize-none"
              placeholder="Internal coach notes…"
            />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 border border-white/10 text-white/60 hover:text-white text-sm py-2.5 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 bg-red text-white font-semibold text-sm py-2.5 rounded-lg hover:bg-red/80 transition-colors disabled:opacity-50"
            >
              {loading ? 'Scheduling…' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ManagePTSessionsPage() {
  const { user } = useAuth()
  const [sessions, setSessions] = useState<PTSession[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [trainers, setTrainers] = useState<TrainerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const params = user?.role === 'trainer' ? { trainer_id: user.id, limit: 100 } : { limit: 100 }
      const [sessionsData, membersData, trainersData] = await Promise.all([
        api.getPTSessions(params),
        api.getMembers({ limit: 200 }),
        api.getAvailableTrainers(),
      ])
      setSessions(sessionsData)
      setMembers(membersData)
      setTrainers(trainersData)
    } catch {
      /* silent */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  useGSAP(() => {
    if (!loading) {
      gsap.from(containerRef.current, { opacity: 0, y: 20, duration: 0.5, ease: 'power2.out' })
    }
  }, { dependencies: [loading] })

  const memberOptions: SelectOption[] = members.map((m) => ({
    id: m.id,
    codeOrId: m.member_code,
    name: m.full_name,
    subtitle: m.email || m.phone || undefined,
  }))

  const trainerOptions: SelectOption[] = trainers.map((t) => ({
    id: t.id,
    codeOrId: `ID #${t.id}`,
    name: t.full_name,
    subtitle: t.specialties?.slice(0, 2).join(', ') || t.email,
  }))

  const filtered = statusFilter === 'all' ? sessions : sessions.filter((s) => s.status === statusFilter)

  const pendingRequests = sessions.filter((s) => s.status === 'pending')
  const upcoming = sessions.filter((s) => s.status === 'scheduled' || s.status === 'confirmed').length
  const done = sessions.filter((s) => s.status === 'completed').length

  return (
    <div ref={containerRef} className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40 font-mono mb-1">
            Coaching & 1-on-1 Sessions
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Personal Training</h1>
          <p className="text-sm text-white/50 mt-1">
            Approve booking requests and track 1-on-1 personal training sessions.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 bg-red text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-red/80 transition-colors"
        >
          + Schedule PT
        </button>
      </div>

      {/* Pending Requests Alert Banner */}
      {pendingRequests.length > 0 && (
        <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-amber-400 animate-pulse shrink-0" />
            <div>
              <p className="text-sm font-bold text-amber-300">
                {pendingRequests.length} Member Booking Request{pendingRequests.length > 1 ? 's' : ''} Awaiting Approval
              </p>
              <p className="text-xs text-amber-300/70 mt-0.5">
                Review and approve or decline incoming member requests.
              </p>
            </div>
          </div>
          <button
            onClick={() => setStatusFilter('pending')}
            className="text-xs bg-amber-400 text-black font-bold px-4 py-2 rounded-lg hover:bg-amber-300 transition-colors self-start md:self-auto shrink-0 font-mono uppercase tracking-wider"
          >
            Review Requests
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Pending Approval', value: pendingRequests.length, color: 'text-amber-400' },
          { label: 'Upcoming', value: upcoming, color: 'text-blue-400' },
          { label: 'Completed', value: done, color: 'text-green-400' },
          { label: 'Declined/Cancelled', value: sessions.filter((s) => s.status === 'cancelled' || s.status === 'rejected').length, color: 'text-white/40' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-white/10 rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1 font-mono">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'confirmed', 'scheduled', 'completed', 'rejected', 'cancelled', 'no_show'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
              statusFilter === s
                ? 'bg-white/10 text-white border-white/20'
                : 'border-white/10 text-white/40 hover:text-white'
            }`}
          >
            {s.replace('_', ' ')}
            {s === 'pending' && pendingRequests.length > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full bg-amber-400 text-black font-bold text-[10px]">
                {pendingRequests.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-surface border border-white/10 rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading sessions…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">No PT sessions found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/8">
                  {['Member', 'Trainer', 'Scheduled', 'Duration', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="py-3 px-4 text-xs uppercase tracking-widest text-white/30 font-medium font-mono"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => (
                  <PTRow key={s.id} session={s} onUpdate={loadData} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreatePTModal
          memberOptions={memberOptions}
          trainerOptions={trainerOptions}
          onClose={() => setShowCreate(false)}
          onCreated={loadData}
        />
      )}
    </div>
  )
}
