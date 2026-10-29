import { useState, useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { CreditCard } from 'lucide-react'
import { api } from '@/services/api'
import { SearchableSelect, type SelectOption } from '@/components/ui/SearchableSelect'
import { LiveKeycardMonitor } from '@/components/manage/LiveKeycardMonitor'
import type { Visit, VisitType, Member, KeycardTapLog } from '@/types/auth'

gsap.registerPlugin()

// ─── Types ───────────────────────────────────────────────────────────────────

const VISIT_TYPE_LABELS: Record<string, string> = {
  walk_in: 'Walk-In',
  class: 'Class',
  pt_session: 'PT Session',
  open_gym: 'Open Gym',
}

const VISIT_TYPE_COLORS: Record<string, string> = {
  walk_in: 'text-blue-400 bg-blue-400/10 border-blue-400/20',
  class: 'text-purple-400 bg-purple-400/10 border-purple-400/20',
  pt_session: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',
  open_gym: 'text-green-400 bg-green-400/10 border-green-400/20',
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function CheckInPanel({
  memberOptions,
  onCheckedIn,
}: {
  memberOptions: SelectOption[]
  onCheckedIn: () => void
}) {
  const [memberId, setMemberId] = useState('')
  const [visitType, setVisitType] = useState<VisitType>('walk_in')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const id = parseInt(memberId)
    if (!id) {
      setError('Please select a member to check in.')
      return
    }
    setLoading(true)
    try {
      await api.checkInMember({ member_id: id, visit_type: visitType, notes: notes || undefined })
      window.dispatchEvent(new CustomEvent('dgym:refresh-notifications'))
      setSuccess(true)
      setMemberId('')
      setNotes('')
      setTimeout(() => {
        setSuccess(false)
        onCheckedIn()
      }, 1500)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Check-in failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface border border-white/10 rounded-xl p-6 space-y-4">
      <h2 className="text-base font-semibold text-white">Quick Check-In</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Searchable Member Dropdown with columns ID, Names */}
        <div>
          <SearchableSelect
            label="Select Member"
            required
            placeholder="Search & choose member…"
            value={memberId ? parseInt(memberId) : ''}
            onChange={(id) => setMemberId(id.toString())}
            options={memberOptions}
            idColLabel="MEMBER CODE"
            nameColLabel="MEMBER NAME"
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-widest text-white/40 block mb-1.5 font-mono">
            Visit Type
          </label>
          <select
            value={visitType}
            onChange={(e) => setVisitType(e.target.value as VisitType)}
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-red/50 transition-colors"
          >
            {Object.entries(VISIT_TYPE_LABELS).map(([val, label]) => (
              <option key={val} value={val} className="bg-zinc-900">
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-widest text-white/40 block mb-1.5 font-mono">
          Notes (optional)
        </label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any remarks..."
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/50 transition-colors"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-400 font-semibold">Check-in recorded successfully!</p>}
      <button
        type="submit"
        disabled={loading || !memberId}
        className="bg-red text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-red/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Recording…' : 'Record Check-In'}
      </button>
    </form>
  )
}

function VisitRow({ visit, onCheckOut }: { visit: Visit; onCheckOut: (id: number) => void }) {
  const [checkingOut, setCheckingOut] = useState(false)

  const handleCheckOut = async () => {
    setCheckingOut(true)
    await onCheckOut(visit.id)
    setCheckingOut(false)
  }

  const durationStr = visit.checked_out_at
    ? `${Math.round(
        (new Date(visit.checked_out_at).getTime() - new Date(visit.checked_in_at).getTime()) / 60000
      )} mins`
    : 'Active'

  const typeColor = VISIT_TYPE_COLORS[visit.visit_type] ?? 'text-white/40 bg-white/5 border-white/10'

  return (
    <tr className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
      <td className="py-3 px-4">
        <p className="text-sm font-medium text-white">{visit.member_name ?? '—'}</p>
        <p className="text-xs text-white/40 font-mono">{visit.member_code ?? ''}</p>
      </td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${typeColor}`}>
            {VISIT_TYPE_LABELS[visit.visit_type] ?? visit.visit_type}
          </span>
          {visit.entry_method === 'rfid_tap' && (
            <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
              <CreditCard className="w-2.5 h-2.5" />
              RFID TAP
            </span>
          )}
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-white/70 font-mono">
        {new Date(visit.checked_in_at).toLocaleTimeString('en-PH', {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </td>
      <td className="py-3 px-4 text-sm text-white/50 font-mono">
        {visit.checked_out_at
          ? new Date(visit.checked_out_at).toLocaleTimeString('en-PH', {
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—'}
      </td>
      <td className="py-3 px-4 text-sm text-white/50">{durationStr}</td>
      <td className="py-3 px-4 text-sm text-white/40 truncate max-w-xs">{visit.notes ?? '—'}</td>
      <td className="py-3 px-4">
        {!visit.checked_out_at ? (
          <button
            disabled={checkingOut}
            onClick={handleCheckOut}
            className="text-xs border border-white/10 hover:border-red text-white/60 hover:text-red px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
          >
            {checkingOut ? '…' : 'Check Out'}
          </button>
        ) : (
          <span className="text-xs text-white/20 font-mono">Closed</span>
        )}
      </td>
    </tr>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function ManageVisitsPage() {
  const [visits, setVisits] = useState<Visit[]>([])
  const [tapLogs, setTapLogs] = useState<KeycardTapLog[]>([])
  const [activeLogTab, setActiveLogTab] = useState<'visits' | 'tap_audit'>('visits')
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)

  const loadData = async (silent = false) => {
    if (!silent) setLoading(true)
    try {
      const [visitsData, membersData, tapLogsData] = await Promise.all([
        api.getVisits({ limit: 100 }),
        api.getMembers({ limit: 200 }),
        api.getKeycardTapLogs({ limit: 80 }),
      ])
      setVisits(visitsData)
      setMembers(membersData)
      setTapLogs(tapLogsData)
    } catch {
      /* silent */
    } finally {
      if (!silent) setLoading(false)
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
    subtitle: m.phone || m.email || undefined,
  }))

  const handleCheckOut = async (visitId: number) => {
    try {
      await api.checkOutVisit(visitId)
      const data = await api.getVisits({ limit: 100 })
      setVisits(data)
    } catch {
      /* silent */
    }
  }

  // Today's stats
  const today = new Date().toDateString()
  const todayVisits = visits.filter((v) => new Date(v.checked_in_at).toDateString() === today)
  const activeNow = visits.filter((v) => !v.checked_out_at).length

  return (
    <div ref={containerRef} className="p-6 md:p-8 space-y-8 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <p className="text-xs uppercase tracking-widest text-white/40 font-mono mb-1">
          Attendance & Access
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-white">Gym Visits</h1>
        <p className="text-sm text-white/50 mt-1">Track member check-ins and check-outs in real time.</p>
      </div>

      {/* Live Smart Keycard Tap Monitor & Simulator */}
      <LiveKeycardMonitor onTapProcessed={() => loadData(true)} />

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Today's Visits", value: todayVisits.length, color: 'text-white' },
          { label: 'Currently Inside', value: activeNow, color: 'text-green-400' },
          {
            label: 'RFID Taps Today',
            value: todayVisits.filter((v) => v.entry_method === 'rfid_tap').length,
            color: 'text-emerald-400',
          },
          {
            label: 'Denied Taps Logged',
            value: tapLogs.filter((t) => !t.granted).length,
            color: 'text-red',
          },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-surface border border-white/10 rounded-xl p-4">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1 font-mono">{label}</p>
            <p className={`text-3xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Check-In Panel */}
      <CheckInPanel memberOptions={memberOptions} onCheckedIn={() => loadData(true)} />

      {/* Visits & Keycard Tap Audit Table */}
      <div className="bg-surface border border-white/10 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveLogTab('visits')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeLogTab === 'visits'
                  ? 'bg-red text-white'
                  : 'bg-white/5 text-white/50 hover:text-white'
              }`}
            >
              Recent Visits ({visits.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveLogTab('tap_audit')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                activeLogTab === 'tap_audit'
                  ? 'bg-red text-white'
                  : 'bg-white/5 text-white/50 hover:text-white'
              }`}
            >
              Keycard Tap Audit ({tapLogs.length})
            </button>
          </div>
          <span className="text-xs text-white/40 font-mono">
            {activeLogTab === 'visits' ? `${visits.length} visits` : `${tapLogs.length} tap events`}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-white/40 text-sm">Loading attendance records…</div>
        ) : activeLogTab === 'visits' ? (
          visits.length === 0 ? (
            <div className="p-8 text-center text-white/40 text-sm">No visits recorded yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-white/8">
                    {['Member', 'Type', 'Check-In', 'Check-Out', 'Duration', 'Notes', 'Action'].map(
                      (h) => (
                        <th
                          key={h}
                          className="py-3 px-4 text-xs uppercase tracking-widest text-white/30 font-medium font-mono"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {visits.map((v) => (
                    <VisitRow key={v.id} visit={v} onCheckOut={handleCheckOut} />
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tapLogs.length === 0 ? (
          <div className="p-8 text-center text-white/40 text-sm">
            No smart keycard taps recorded yet. Tap a card or use the Tap Simulator above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-white/8">
                  {['Time', 'Card UID', 'Member', 'Decision', 'Plan / Reason', 'Latency'].map((h) => (
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
                {tapLogs.map((log) => (
                  <tr key={log.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 px-4 text-xs font-mono text-white/60">
                      {new Date(log.tapped_at).toLocaleTimeString('en-PH', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 px-4 text-xs font-mono text-white/80">{log.card_uid_masked}</td>
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-white">{log.member_name ?? 'Unassigned'}</p>
                      <p className="text-xs font-mono text-white/40">{log.member_code ?? '—'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border ${
                          log.decision === 'paired_card'
                            ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                            : log.decision === 'already_checked_in' ||
                              log.decision === 'already_checked_out'
                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-300'
                            : log.decision === 'granted_check_out'
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
                            : log.granted
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                            : 'border-red/30 bg-red/10 text-red'
                        }`}
                      >
                        {log.decision.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs text-white/60 max-w-md">{log.reason_message}</td>
                    <td className="py-3 px-4 text-xs font-mono text-white/40">{log.latency_ms}ms</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
