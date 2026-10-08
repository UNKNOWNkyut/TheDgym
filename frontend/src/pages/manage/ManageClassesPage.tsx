import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { api } from '@/services/api'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import type { ClassSession, Member, TrainerProfile } from '@/types/auth'

// ─── Types & Helpers ──────────────────────────────────────────────────────────

const CLASS_TYPE_LABELS: Record<string, string> = {
  barbell_club: 'Barbell Club',
  conditioning: 'Conditioning',
  open_gym: 'Open Gym',
  powerlifting: 'Powerlifting',
  strength: 'Strength',
  hiit: 'HIIT',
  other: 'Other',
}

const CLASS_STATUS_COLORS: Record<string, string> = {
  scheduled: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  ongoing: 'text-green-400 bg-green-400/10 border-green-400/20',
  completed: 'text-white/40 bg-white/5 border-white/10',
  cancelled: 'text-red-400 bg-red-400/10 border-red-400/20',
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({
  session,
  memberOptions,
  onUpdate,
}: {
  session: ClassSession
  memberOptions: SelectOption[]
  onUpdate: () => void
}) {
  const [selectedMemberId, setSelectedMemberId] = useState<number | ''>('')
  const [enrollLoading, setEnrollLoading] = useState(false)
  const [enrollError, setEnrollError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const capacityPct = Math.min(100, Math.round((session.enrolled_count / session.max_capacity) * 100))
  const statusClass = CLASS_STATUS_COLORS[session.status] ?? 'text-white/40 bg-white/5 border-white/10'

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault()
    setEnrollError(null)
    if (!selectedMemberId) {
      setEnrollError('Please select a member to enroll.')
      return
    }
    setEnrollLoading(true)
    try {
      await api.enrollMember(session.id, selectedMemberId)
      setSelectedMemberId('')
      onUpdate()
    } catch (err: unknown) {
      setEnrollError(err instanceof Error ? err.message : 'Enrollment failed.')
    } finally {
      setEnrollLoading(false)
    }
  }

  const handleUnenroll = async (memberId: number) => {
    try {
      await api.unenrollMember(session.id, memberId)
      onUpdate()
    } catch {
      /* silent */
    }
  }

  const handleStatusChange = async (newStatus: string) => {
    try {
      await api.updateClassSession(session.id, { status: newStatus })
      onUpdate()
    } catch {
      /* silent */
    }
  }

  return (
    <div className="bg-surface border border-white/10 rounded-xl">
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${statusClass}`}>
                {session.status.toUpperCase()}
              </span>
              <span className="text-xs text-white/40 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full">
                {CLASS_TYPE_LABELS[session.class_type] ?? session.class_type}
              </span>
            </div>
            <h3 className="text-base font-semibold text-white truncate">{session.name}</h3>
            <p className="text-xs text-white/40 mt-0.5">
              {new Date(session.scheduled_at).toLocaleString('en-PH', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
              {' · '}
              {session.duration_minutes}min
              {session.coach_name ? ` · Coach: ${session.coach_name}` : ''}
              {session.location ? ` · ${session.location}` : ''}
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="shrink-0 text-xs border border-white/10 text-white/50 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
          >
            {expanded ? 'Collapse' : 'Manage'}
          </button>
        </div>

        {/* Capacity Bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs text-white/40 mb-1">
            <span>
              {session.enrolled_count} / {session.max_capacity} enrolled
            </span>
            <span>{capacityPct}%</span>
          </div>
          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                capacityPct >= 90 ? 'bg-red' : capacityPct >= 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${capacityPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Expanded Panel */}
      {expanded && (
        <div className="border-t border-white/8 p-5 space-y-4 bg-white/[0.01]">
          {session.description && <p className="text-sm text-white/50">{session.description}</p>}

          {/* Status Controls */}
          <div className="flex flex-wrap gap-2">
            <p className="text-xs uppercase tracking-widest text-white/30 w-full font-mono">
              Change Status:
            </p>
            {(['scheduled', 'ongoing', 'completed', 'cancelled'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                disabled={session.status === s}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                  session.status === s
                    ? 'bg-white/10 text-white border-white/20'
                    : 'border-white/10 text-white/50 hover:text-white hover:border-white/30'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          {/* Searchable Member Enroll Form */}
          <form onSubmit={handleEnroll} className="space-y-2">
            <div className="flex flex-col sm:flex-row gap-2.5 sm:items-end">
              <div className="flex-1 min-w-0">
                <SearchableSelect
                  label="Enroll Member"
                  placeholder="Search & choose member to enroll…"
                  value={selectedMemberId}
                  onChange={(id) => setSelectedMemberId(id)}
                  options={memberOptions}
                  idColLabel="CODE"
                  nameColLabel="MEMBER NAME"
                />
              </div>
              <button
                type="submit"
                disabled={enrollLoading || !selectedMemberId}
                className="bg-red hover:bg-red/80 text-white text-xs font-semibold px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50 h-[42px] shrink-0"
              >
                {enrollLoading ? 'Enrolling…' : 'Enroll'}
              </button>
            </div>
            {enrollError && <p className="text-xs text-red-400">{enrollError}</p>}
          </form>

          {/* Enrollees List */}
          {session.enrollments.length > 0 ? (
            <div className="space-y-1.5 pt-2">
              <p className="text-xs uppercase tracking-widest text-white/30 font-mono">
                Enrolled Members ({session.enrollments.length}):
              </p>
              <div className="divide-y divide-white/5 bg-white/[0.02] border border-white/5 rounded-xl overflow-hidden">
                {session.enrollments.map((e) => (
                  <div
                    key={e.id}
                    className="flex items-center justify-between gap-3 px-3.5 py-2.5 hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs text-red font-mono font-semibold px-1.5 py-0.5 rounded bg-red/10 border border-red/20">
                        {e.member_code ?? '—'}
                      </span>
                      <span className="text-sm font-medium text-white">{e.member_name}</span>
                    </div>
                    <button
                      onClick={() => handleUnenroll(e.member_id)}
                      className="text-xs text-red-400 hover:text-red-300 hover:underline transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-white/30 font-mono">No members enrolled yet.</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Create Session Modal ─────────────────────────────────────────────────────

function CreateSessionModal({
  trainerOptions,
  onClose,
  onCreated,
}: {
  trainerOptions: SelectOption[]
  onClose: () => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    coach_id: '',
    class_type: 'open_gym',
    scheduled_at: '',
    duration_minutes: 60,
    max_capacity: 20,
    location: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await api.createClassSession({
        name: form.name,
        description: form.description || undefined,
        coach_id: form.coach_id ? parseInt(form.coach_id) : undefined,
        class_type: form.class_type,
        scheduled_at: new Date(form.scheduled_at).toISOString(),
        duration_minutes: form.duration_minutes,
        max_capacity: form.max_capacity,
        location: form.location || undefined,
      })
      onCreated()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create session.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold text-white">Create Class Session</h2>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
              Class Name *
            </label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/50 transition-colors"
              placeholder="e.g. Barbell Club — Morning"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
                Class Type
              </label>
              <select
                value={form.class_type}
                onChange={(e) => setForm((f) => ({ ...f, class_type: e.target.value }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red/50 transition-colors"
              >
                {Object.entries(CLASS_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val} className="bg-zinc-900">
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <SearchableSelect
                label="Assigned Coach"
                placeholder="Choose coach…"
                value={form.coach_id ? parseInt(form.coach_id) : ''}
                onChange={(id) => setForm((f) => ({ ...f, coach_id: id.toString() }))}
                options={trainerOptions}
                idColLabel="ID"
                nameColLabel="COACH NAME"
              />
            </div>
          </div>

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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
                Duration (mins)
              </label>
              <input
                type="number"
                min={15}
                max={480}
                value={form.duration_minutes}
                onChange={(e) => setForm((f) => ({ ...f, duration_minutes: parseInt(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
                Max Capacity
              </label>
              <input
                type="number"
                min={1}
                max={200}
                value={form.max_capacity}
                onChange={(e) => setForm((f) => ({ ...f, max_capacity: parseInt(e.target.value) }))}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red/50 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
              Location
            </label>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/50 transition-colors"
              placeholder="e.g. Main Floor"
            />
          </div>

          <div>
            <label className="text-xs uppercase tracking-widest text-white/40 block mb-1 font-mono">
              Description
            </label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/50 transition-colors resize-none"
              placeholder="Optional class description…"
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
              {loading ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ManageClassesPage() {
  const [sessions, setSessions] = useState<ClassSession[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [trainers, setTrainers] = useState<TrainerProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const containerRef = useRef<HTMLDivElement>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [sessionsData, membersData, trainersData] = await Promise.all([
        api.getClassSessions({ limit: 100 }),
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

  const upcoming = sessions.filter((s) => s.status === 'scheduled').length
  const completed = sessions.filter((s) => s.status === 'completed').length
  const totalEnrolled = sessions.reduce((acc, s) => acc + s.enrolled_count, 0)

  return (
    <div ref={containerRef} className="p-6 md:p-8 space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-widest text-white/40 font-mono mb-1">
            Group Fitness & Programs
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-white">Class Sessions</h1>
          <p className="text-sm text-white/50 mt-1">Manage group classes, capacity, and enrollments.</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="shrink-0 bg-red text-white text-sm font-semibold px-4 py-2.5 rounded-lg hover:bg-red/80 transition-colors"
        >
          + New Session
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Upcoming', value: upcoming, color: 'text-blue-400' },
          { label: 'Completed', value: completed, color: 'text-white/40' },
          { label: 'Total Enrollments', value: totalEnrolled, color: 'text-white' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-white/10 rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1 font-mono">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['all', 'scheduled', 'ongoing', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${
              statusFilter === s
                ? 'bg-white/10 text-white border-white/20'
                : 'border-white/10 text-white/40 hover:text-white'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Session Cards */}
      {loading ? (
        <p className="text-white/40 text-sm">Loading sessions…</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-white/30">
          <p className="text-5xl mb-4">🏋️</p>
          <p className="text-sm">No sessions found. Create the first one!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((s) => (
            <SessionCard
              key={s.id}
              session={s}
              memberOptions={memberOptions}
              onUpdate={loadData}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSessionModal
          trainerOptions={trainerOptions}
          onClose={() => setShowCreate(false)}
          onCreated={loadData}
        />
      )}
    </div>
  )
}
