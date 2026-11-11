import { useState, useMemo, useEffect, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Calendar,
  Bell,
  Settings,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Clock,
  Check,
  X,
  ShieldAlert,
  Dumbbell,
  CreditCard,
} from 'lucide-react';

interface AgendaSession {
  id: string;
  time: string;
  type: 'assessment' | 'pt' | 'group';
  clientName: string;
  clientAvatar: string;
  focus: string;
  injuryNote?: string;
  status: 'SCHEDULED' | 'ATTENDED' | 'NO_SHOW' | 'RESCHEDULED';
  headcount?: string;
}

interface BookingRequest {
  id: string;
  clientName: string;
  requestedTime: string;
  sessionType: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

interface ClientAlert {
  id: string;
  clientName: string;
  tier: 'HIGH' | 'MEDIUM';
  reason: string;
  lastVisit: string;
  sessionsLeft: number;
}

interface Milestone {
  id: string;
  clientName: string;
  achievement: string;
  timeAgo: string;
}

const NEUTRAL_PILL =
  'px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700';

const NEUTRAL_ACTION_BTN =
  'px-2.5 py-1.5 rounded-lg text-xs font-mono border bg-zinc-900 border-zinc-800 text-zinc-300 transition-colors cursor-pointer';

export function TrainerDashboard() {
  // Tab Switcher States
  const [scheduleTab, setScheduleTab] = useState<'agenda' | 'requests'>('agenda');
  const [insightsTab, setInsightsTab] = useState<'flags' | 'milestones'>('flags');

  // 1. Agenda State
  const [sessions, setSessions] = useState<AgendaSession[]>([
    {
      id: 'sess-1',
      time: '08:30 AM',
      type: 'assessment',
      clientName: 'Carlos Rivera',
      clientAvatar: 'CR',
      focus: 'Initial Mobility & Functional Movement Screen',
      status: 'ATTENDED',
    },
    {
      id: 'sess-2',
      time: '10:00 AM',
      type: 'pt',
      clientName: 'Alex Cruz',
      clientAvatar: 'AC',
      focus: 'Lower Body Hypertrophy & Deadlift Form Refinement',
      injuryNote: 'Patellar Tendinopathy (Avoid high impact jumps)',
      status: 'SCHEDULED',
    },
    {
      id: 'sess-3',
      time: '02:00 PM',
      type: 'pt',
      clientName: 'Marcus Vance',
      clientAvatar: 'MV',
      focus: 'Bench Press Sticking Point & Upper Back Volume',
      status: 'SCHEDULED',
    },
    {
      id: 'sess-4',
      time: '04:30 PM',
      type: 'group',
      clientName: 'Turf Conditioning Clinic',
      clientAvatar: 'TC',
      focus: 'High Intensity Calisthenics & Sled Pushes',
      status: 'SCHEDULED',
      headcount: '6 / 8 Athletes Booked',
    },
  ]);

  // 2. Booking Requests State
  const [bookingRequests, setBookingRequests] = useState<BookingRequest[]>([
    {
      id: 'req-1',
      clientName: 'Jordan Ramos',
      requestedTime: 'Tomorrow at 09:00 AM',
      sessionType: '1-on-1 Technique Assessment',
      status: 'PENDING',
    },
    {
      id: 'req-2',
      clientName: 'Elena Garcia',
      requestedTime: 'Friday at 03:00 PM',
      sessionType: 'Strength Coaching 1-on-1',
      status: 'PENDING',
    },
  ]);

  // 3. Calendar Block Toggle
  const [isBreakBlocked, setIsBreakBlocked] = useState(false);

  // 4. Quick Logger Modal State
  const [isLoggerOpen, setIsLoggerOpen] = useState(false);
  const [activeLoggingClient, setActiveLoggingClient] = useState('Alex Cruz');
  const [exerciseName, setExerciseName] = useState('Barbell Conventional Deadlift');
  const [exerciseWeight, setExerciseWeight] = useState('160');
  const [exerciseReps, setExerciseReps] = useState('5');
  const [exerciseRpe, setExerciseRpe] = useState('8.5');
  const [logSuccessToast, setLogSuccessToast] = useState(false);

  // 5. Client Retention & Churn Alerts
  const [clientAlerts, setClientAlerts] = useState<ClientAlert[]>([
    {
      id: 'alt-1',
      clientName: 'Juan Dela Cruz',
      tier: 'HIGH',
      reason: '14 days without gym visit; 2 consecutive session cancels',
      lastVisit: '14 days ago',
      sessionsLeft: 1,
    },
    {
      id: 'alt-2',
      clientName: 'Bianca Santos',
      tier: 'MEDIUM',
      reason: 'Package expiring soon; only 2 sessions remaining',
      lastVisit: '3 days ago',
      sessionsLeft: 2,
    },
    {
      id: 'alt-3',
      clientName: 'Alex Cruz',
      tier: 'MEDIUM',
      reason: 'Renewal warning: 2 sessions left in current bundle',
      lastVisit: 'Today',
      sessionsLeft: 2,
    },
  ]);

  // 6. Recent Milestones
  const milestones: Milestone[] = useMemo(
    () => [
      {
        id: 'ms-1',
        clientName: 'Marcus Vance',
        achievement: 'Logged new 140kg Barbell Back Squat PR (+10kg)',
        timeAgo: 'Yesterday',
      },
      {
        id: 'ms-2',
        clientName: 'Carlos Rivera',
        achievement: 'Completed 12-day continuous consistency streak',
        timeAgo: '2 days ago',
      },
    ],
    [],
  );

  // Up-next client (first upcoming scheduled session)
  const upNextSession = useMemo(
    () => sessions.find((s) => s.status === 'SCHEDULED' && s.type !== 'group'),
    [sessions],
  );

  const pendingCount = useMemo(
    () => bookingRequests.filter((r) => r.status === 'PENDING').length,
    [bookingRequests],
  );

  // Actions for sessions
  const updateSessionStatus = (
    id: string,
    newStatus: 'SCHEDULED' | 'ATTENDED' | 'NO_SHOW' | 'RESCHEDULED',
  ) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: newStatus } : s)),
    );
  };

  // Actions for requests
  const handleRequestAction = (id: string, newStatus: 'APPROVED' | 'REJECTED') => {
    setBookingRequests((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: newStatus } : r)),
    );
  };

  // Liveness heartbeat for floor operations
  useEffect(() => {
    const timer = setInterval(() => {
      // Periodic synchronization of session timestamps
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  const handleDismissAlert = (id: string) => {
    setClientAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSaveLog = (e: FormEvent) => {
    e.preventDefault();
    setLogSuccessToast(true);
    setTimeout(() => {
      setLogSuccessToast(false);
      setIsLoggerOpen(false);
    }, 1200);
  };

  const attendedCount = sessions.filter((s) => s.status === 'ATTENDED').length;
  const scheduledCount = sessions.filter((s) => s.status === 'SCHEDULED').length;

  const kpiCards = [
    {
      label: "Today's Sessions",
      value: `${sessions.length} Appointments`,
      sub: `${attendedCount} Attended • ${scheduledCount} Scheduled`,
      icon: Calendar,
    },
    {
      label: 'Active Client Roster',
      value: '8 Athletes',
      sub: '100% Retained this cycle',
      icon: User,
    },
    {
      label: 'At-Risk Clients',
      value: `${clientAlerts.length} Flagged`,
      sub: 'Action required for retention',
      icon: ShieldAlert,
    },
    {
      label: 'Monthly PT Volume',
      value: '₱18,500.00',
      sub: '37 Completed PT Hours',
      icon: CreditCard,
    },
  ];

  return (
    <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5">
              <span className={NEUTRAL_PILL}>TRAINER COMMAND CENTER</span>
              <span className="text-xs text-zinc-400 font-mono">
                Coach Mark • Rosario Facility
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Daily Floor Operations &amp; Athlete Roster
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsLoggerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-all shadow-[0_0_15px_rgba(229,32,26,0.28)] cursor-pointer"
            >
              <Dumbbell className="w-4 h-4" />
              <span>Quick Workout Logger</span>
            </button>
            <Link
              to="/manage/pt-sessions"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono transition-colors"
            >
              <Calendar className="w-4 h-4 text-zinc-400" />
              <span>Full Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/manage/pt-sessions"
              className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Link>
            <Link
              to="/manage/members"
              className="p-2 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 1. COMPACT KPI STRIP (TOP ROW) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 px-4 py-3.5"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] uppercase font-mono tracking-widest text-zinc-400">
                    {card.label}
                  </span>
                  <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400">
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-black font-mono text-white leading-tight">
                  {card.value}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">{card.sub}</p>
              </div>
            );
          })}
        </div>

        {/* 2. 2-COLUMN BENTO GRID RESTRUCTURE (MAIN CONTENT) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (7 cols) — UNIFIED SCHEDULE HUB */}
          <div className="lg:col-span-7 rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 space-y-4">
            {/* Hub Header & Tab Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-800/80">
              <div className="inline-flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 w-fit">
                <button
                  type="button"
                  onClick={() => setScheduleTab('agenda')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 ${
                    scheduleTab === 'agenda'
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Today&apos;s Agenda ({sessions.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setScheduleTab('requests')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer flex items-center gap-2 ${
                    scheduleTab === 'requests'
                      ? 'bg-zinc-800 text-white font-semibold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>Pending Requests ({pendingCount})</span>
                  {pendingCount > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-red" aria-hidden="true" />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsBreakBlocked((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-colors cursor-pointer w-fit ${
                  isBreakBlocked
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:border-zinc-700'
                }`}
              >
                {isBreakBlocked ? '🔒 Break Blocked (12:00 PM)' : '🔓 Block Break Time'}
              </button>
            </div>

            {scheduleTab === 'agenda' ? (
              <div className="space-y-3">
                {sessions.map((sess) => (
                  <div
                    key={sess.id}
                    className={`p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 transition-colors hover:border-zinc-700 ${
                      sess.status === 'ATTENDED' || sess.status === 'NO_SHOW' ? 'opacity-75' : ''
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <div className="px-2.5 py-1 rounded-md bg-zinc-900 border border-zinc-800 text-xs font-mono font-bold text-zinc-200 shrink-0 mt-0.5">
                          {sess.time}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-white">
                              {sess.clientName}
                            </span>
                            <span className={NEUTRAL_PILL}>{sess.type.toUpperCase()}</span>
                            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-zinc-800">
                              {sess.status}
                            </span>
                          </div>

                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                            {sess.focus}
                          </p>

                          {sess.injuryNote && (
                            <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              <span>{sess.injuryNote}</span>
                            </div>
                          )}

                          {sess.headcount && (
                            <div className="mt-1.5 text-[11px] text-zinc-400 font-mono">
                              👥 {sess.headcount}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Monochrome Outline Action Buttons (subtle semantic states on active/hover) */}
                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => updateSessionStatus(sess.id, 'ATTENDED')}
                          className={`${NEUTRAL_ACTION_BTN} flex items-center gap-1 ${
                            sess.status === 'ATTENDED'
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400 font-semibold'
                              : 'hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/10'
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Attended</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateSessionStatus(sess.id, 'NO_SHOW')}
                          className={`${NEUTRAL_ACTION_BTN} flex items-center gap-1 ${
                            sess.status === 'NO_SHOW'
                              ? 'bg-red/15 border-red/40 text-red font-semibold'
                              : 'hover:border-red/40 hover:text-red hover:bg-red/10'
                          }`}
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>No-Show</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => updateSessionStatus(sess.id, 'RESCHEDULED')}
                          className={`${NEUTRAL_ACTION_BTN} ${
                            sess.status === 'RESCHEDULED'
                              ? 'bg-zinc-800 border-zinc-600 text-white font-semibold'
                              : 'hover:text-white hover:border-zinc-700'
                          }`}
                        >
                          Reschedule
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {bookingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-white">
                          {req.clientName}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded-md border ${
                            req.status === 'APPROVED'
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                              : req.status === 'REJECTED'
                              ? 'bg-red/10 text-red border-red/20'
                              : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>
                      <p className="text-zinc-400 text-xs font-mono">
                        {req.sessionType} • {req.requestedTime}
                      </p>
                    </div>

                    {req.status === 'PENDING' && (
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleRequestAction(req.id, 'APPROVED')}
                          className={`${NEUTRAL_ACTION_BTN} hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/10`}
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestAction(req.id, 'REJECTED')}
                          className={`${NEUTRAL_ACTION_BTN} hover:border-red/40 hover:text-red hover:bg-red/10`}
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN (5 cols) — LIVE SNAPSHOT & CLIENT INSIGHTS */}
          <div className="lg:col-span-5 space-y-6">
            {/* Top Card: Up-Next Client Snapshot */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/80 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase font-mono tracking-widest text-zinc-300 font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red animate-pulse" aria-hidden="true" />
                  UP-NEXT CLIENT SNAPSHOT
                </span>
                <span className="text-xs font-mono text-zinc-400">
                  {upNextSession?.time ?? 'No immediate session'}
                </span>
              </div>

              {upNextSession ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-white font-bold font-mono text-sm">
                      {upNextSession.clientAvatar}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {upNextSession.clientName}
                      </h3>
                      <p className="text-xs text-zinc-400 font-mono">
                        Active Athlete • 4 Sessions Completed
                      </p>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 text-xs space-y-2">
                    <p className="text-zinc-500 font-mono uppercase text-[10px]">
                      Session Focus:
                    </p>
                    <p className="text-zinc-200 font-medium">{upNextSession.focus}</p>
                    {upNextSession.injuryNote && (
                      <div className="pt-2 border-t border-zinc-800/80">
                        <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          ⚠️ Restriction: {upNextSession.injuryNote}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveLoggingClient(upNextSession.clientName);
                      setIsLoggerOpen(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-white text-xs font-mono font-semibold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Dumbbell className="w-3.5 h-3.5 text-red" />
                    <span>Open Real-Time Logger</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-zinc-500 py-4 text-center font-mono">
                  All scheduled floor sessions for today are completed!
                </p>
              )}
            </div>

            {/* Bottom Card: Tabbed Insights Card (Action Flags & Milestones) */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <div className="inline-flex items-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 w-full">
                  <button
                    type="button"
                    onClick={() => setInsightsTab('flags')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                      insightsTab === 'flags'
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Action Flags ({clientAlerts.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInsightsTab('milestones')}
                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-colors cursor-pointer ${
                      insightsTab === 'milestones'
                        ? 'bg-zinc-800 text-white font-semibold'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Milestones &amp; PRs ({milestones.length})
                  </button>
                </div>
              </div>

              {insightsTab === 'flags' ? (
                <div className="space-y-2.5">
                  {clientAlerts.length === 0 ? (
                    <p className="text-xs text-zinc-500 py-6 text-center font-mono">
                      No active retention flags right now.
                    </p>
                  ) : (
                    clientAlerts.map((alt) => (
                      <div
                        key={alt.id}
                        className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex items-start justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-semibold text-sm text-white">
                              {alt.clientName}
                            </span>
                            <span
                              className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border font-semibold ${
                                alt.tier === 'HIGH'
                                  ? 'bg-red/10 text-red border-red/20'
                                  : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                              }`}
                            >
                              {alt.tier} CHURN RISK
                            </span>
                          </div>
                          <p className="text-xs text-zinc-400 leading-relaxed">{alt.reason}</p>
                          <p className="text-[11px] text-zinc-500 font-mono mt-1">
                            Last Check-In: {alt.lastVisit} • Remaining:{' '}
                            <span className="text-amber-400 font-semibold">
                              {alt.sessionsLeft} left
                            </span>
                          </p>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <Link
                            to="/manage/pt-sessions"
                            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white text-[11px] font-mono border border-zinc-800 transition-colors"
                          >
                            Action &rarr;
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDismissAlert(alt.id)}
                            className="p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
                            title="Dismiss Alert"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              ) : (
                <div className="space-y-2.5">
                  {milestones.map((ms) => (
                    <div
                      key={ms.id}
                      className="p-3 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex items-start gap-3"
                    >
                      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-300 shrink-0">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-white">{ms.clientName}</p>
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0">
                            {ms.timeAgo}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-300 mt-0.5">{ms.achievement}</p>
                      </div>
                    </div>
                  ))}

                  <div className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/30 text-center space-y-1.5 mt-2">
                    <p className="text-xs text-zinc-400">
                      Ready to assign updated workout programs or review 1RM trends?
                    </p>
                    <Link
                      to="/manage/members"
                      className="inline-block text-xs text-red hover:underline font-mono"
                    >
                      View All Assigned Clients &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Quick Workout Logger Modal */}
        {isLoggerOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
            onClick={() => setIsLoggerOpen(false)}
          >
            <div
              className="w-full max-w-lg rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-red" />
                  <h3 className="font-bold text-base uppercase text-white font-mono">
                    Real-Time Workout Logger
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoggerOpen(false)}
                  className="text-zinc-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {logSuccessToast ? (
                <div className="p-6 rounded-xl bg-zinc-900 border border-zinc-800 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-white font-bold text-sm">Set Logged Successfully!</p>
                  <p className="text-xs text-zinc-400">
                    Data recorded to client&apos;s athlete training ledger.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSaveLog} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase font-mono text-zinc-400 mb-1">
                      Athlete
                    </label>
                    <input
                      type="text"
                      value={activeLoggingClient}
                      onChange={(e) => setActiveLoggingClient(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase font-mono text-zinc-400 mb-1">
                      Exercise
                    </label>
                    <input
                      type="text"
                      value={exerciseName}
                      onChange={(e) => setExerciseName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs uppercase font-mono text-zinc-400 mb-1">
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        value={exerciseWeight}
                        onChange={(e) => setExerciseWeight(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase font-mono text-zinc-400 mb-1">
                        Reps
                      </label>
                      <input
                        type="number"
                        value={exerciseReps}
                        onChange={(e) => setExerciseReps(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase font-mono text-zinc-400 mb-1">
                        RPE (1-10)
                      </label>
                      <input
                        type="text"
                        value={exerciseRpe}
                        onChange={(e) => setExerciseRpe(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-zinc-900 border border-zinc-800 text-white text-sm focus:outline-none focus:border-red"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-zinc-800 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLoggerOpen(false)}
                      className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-xs font-mono transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-red hover:bg-red-hover text-white text-xs font-bold font-mono uppercase tracking-wider transition-colors shadow-md cursor-pointer"
                    >
                      Save Set Record
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
