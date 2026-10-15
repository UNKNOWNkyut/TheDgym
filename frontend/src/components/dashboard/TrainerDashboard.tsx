import React, { useState, useMemo, useEffect } from 'react';
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
  Flame,
  Dumbbell,
  CreditCard,
  Sparkles,
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

export function TrainerDashboard() {
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
  const upNextSession = useMemo(() => {
    return sessions.find((s) => s.status === 'SCHEDULED' && s.type !== 'group');
  }, [sessions]);

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

  const handleSaveLog = (e: React.FormEvent) => {
    e.preventDefault();
    setLogSuccessToast(true);
    setTimeout(() => {
      setLogSuccessToast(false);
      setIsLoggerOpen(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1.5">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                TRAINER COMMAND CENTER
              </span>
              <span className="text-xs text-white/40 font-mono">
                Coach Mark • Rosario Facility
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Daily Floor Operations &amp; Athlete Roster
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setIsLoggerOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-all shadow-[0_0_15px_rgba(229,32,26,0.3)] cursor-pointer"
            >
              <Dumbbell className="w-4 h-4" />
              <span>Quick Workout Logger</span>
            </button>
            <Link
              to="/manage/pt-sessions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/80 hover:text-white text-xs font-mono transition-all"
            >
              <Calendar className="w-4 h-4 text-white/40" />
              <span>Full Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/manage/pt-sessions"
              className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Notifications"
            >
              <Bell className="w-4 h-4" />
            </Link>
            <Link
              to="/manage/members"
              className="p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 4 Top KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-mono tracking-widest text-white/40">
                Today's Sessions
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Calendar className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-white">
              4 Appointments
            </p>
            <p className="text-xs text-emerald-400 mt-1 font-mono">
              1 Attended • 3 Scheduled
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-mono tracking-widest text-white/40">
                Active Client Roster
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <User className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-white">
              8 Athletes
            </p>
            <p className="text-xs text-white/40 mt-1 font-mono">
              100% Retained this cycle
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-mono tracking-widest text-white/40">
                At-Risk Clients
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-amber-400">
              2 Flagged
            </p>
            <p className="text-xs text-amber-400/70 mt-1 font-mono">
              Action required for retention
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs uppercase font-mono tracking-widest text-white/40">
                Monthly PT Volume
              </span>
              <div className="w-8 h-8 rounded-lg bg-red/10 border border-red/20 flex items-center justify-center text-red">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-black font-mono text-white">
              ₱18,500.00
            </p>
            <p className="text-xs text-white/40 mt-1 font-mono">
              37 Completed PT Hours
            </p>
          </div>
        </div>

        {/* Section 1: Daily Operations & Schedule */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Agenda Timeline (2 cols) */}
          <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-5">
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-red" />
                  Today's Agenda &amp; Floor Schedule
                </h2>
                <p className="text-xs text-white/40 mt-0.5">
                  Instant check-in and attendance confirmation for floor sessions
                </p>
              </div>

              {/* Personal Break Block Toggle */}
              <button
                type="button"
                onClick={() => setIsBreakBlocked((prev) => !prev)}
                className={`text-xs px-3 py-1.5 rounded-lg border font-mono transition-all cursor-pointer ${
                  isBreakBlocked
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
                }`}
              >
                {isBreakBlocked ? '🔒 Break Blocked (12:00 PM)' : '🔓 Block Break Time'}
              </button>
            </div>

            {/* Agenda List */}
            <div className="space-y-3">
              {sessions.map((sess) => (
                <div
                  key={sess.id}
                  className={`p-4 rounded-xl border transition-all ${
                    sess.status === 'ATTENDED'
                      ? 'border-emerald-500/20 bg-emerald-500/[0.03] opacity-75'
                      : sess.status === 'NO_SHOW'
                      ? 'border-red/20 bg-red/[0.03] opacity-75'
                      : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-xs font-mono font-bold text-white shrink-0 mt-0.5">
                        {sess.time}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-white">
                            {sess.clientName}
                          </span>
                          <span
                            className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded border ${
                              sess.type === 'assessment'
                                ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                : sess.type === 'group'
                                ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                : 'bg-red/10 text-red border-red/20'
                            }`}
                          >
                            {sess.type.toUpperCase()}
                          </span>

                          <span
                            className={`text-[9px] uppercase font-mono px-1.5 py-0.5 rounded font-bold ${
                              sess.status === 'ATTENDED'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : sess.status === 'NO_SHOW'
                                ? 'bg-red/20 text-red'
                                : 'bg-white/10 text-white/60'
                            }`}
                          >
                            {sess.status}
                          </span>
                        </div>

                        <p className="text-xs text-white/60 mt-1 leading-relaxed">
                          {sess.focus}
                        </p>

                        {sess.injuryNote && (
                          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-amber-400/90 font-mono">
                            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                            <span>{sess.injuryNote}</span>
                          </div>
                        )}

                        {sess.headcount && (
                          <div className="mt-1 text-[11px] text-purple-400 font-mono">
                            👥 {sess.headcount}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Action Buttons */}
                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      <button
                        type="button"
                        onClick={() => updateSessionStatus(sess.id, 'ATTENDED')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1 ${
                          sess.status === 'ATTENDED'
                            ? 'bg-emerald-500 text-black font-bold'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>Attended</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateSessionStatus(sess.id, 'NO_SHOW')}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors flex items-center gap-1 ${
                          sess.status === 'NO_SHOW'
                            ? 'bg-red text-white font-bold'
                            : 'bg-red/10 text-red hover:bg-red/20 border border-red/30'
                        }`}
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>No-Show</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => updateSessionStatus(sess.id, 'RESCHEDULED')}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-mono bg-white/5 text-white/60 hover:text-white hover:bg-white/10 border border-white/10 transition-colors"
                      >
                        Reschedule
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Up-Next Client & Booking Requests (1 col) */}
          <div className="space-y-6">
            {/* Up-Next Snapshot */}
            <div className="rounded-2xl border border-red/30 bg-gradient-to-b from-red/10 to-transparent p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono tracking-widest text-red font-bold flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-red" />
                  UP-NEXT CLIENT SNAPSHOT
                </span>
                <span className="text-xs font-mono text-white/40">
                  {upNextSession?.time ?? 'No immediate session'}
                </span>
              </div>

              {upNextSession ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-red/20 border border-red/40 flex items-center justify-center text-white font-bold font-mono text-base">
                      {upNextSession.clientAvatar}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">
                        {upNextSession.clientName}
                      </h3>
                      <p className="text-xs text-white/50 font-mono">
                        Active Athlete • 4 Sessions Completed
                      </p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-xs space-y-1.5">
                    <p className="text-white/40 font-mono uppercase text-[10px]">
                      Session Focus:
                    </p>
                    <p className="text-white font-medium">{upNextSession.focus}</p>
                    {upNextSession.injuryNote && (
                      <p className="text-amber-400 font-mono text-[11px] pt-1 border-t border-white/5">
                        ⚠️ Restriction: {upNextSession.injuryNote}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setActiveLoggingClient(upNextSession.clientName);
                      setIsLoggerOpen(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Dumbbell className="w-3.5 h-3.5 text-red" />
                    <span>Open Real-Time Logger</span>
                  </button>
                </div>
              ) : (
                <p className="text-xs text-white/40 py-4 text-center">
                  All scheduled floor sessions for today are completed!
                </p>
              )}
            </div>

            {/* Pending Booking Requests */}
            <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs uppercase font-mono tracking-widest text-white/50 font-bold">
                  Pending Booking Requests
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {bookingRequests.filter((r) => r.status === 'PENDING').length} New
                </span>
              </div>

              <div className="space-y-2.5">
                {bookingRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-3 rounded-xl border border-white/5 bg-white/[0.02] text-xs space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">
                        {req.clientName}
                      </span>
                      <span
                        className={`text-[9px] font-mono px-1.5 py-0.2 rounded ${
                          req.status === 'APPROVED'
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : req.status === 'REJECTED'
                            ? 'text-red bg-red/10'
                            : 'text-amber-400 bg-amber-500/10'
                        }`}
                      >
                        {req.status}
                      </span>
                    </div>

                    <p className="text-white/60 text-[11px] font-mono">
                      {req.sessionType} • {req.requestedTime}
                    </p>

                    {req.status === 'PENDING' && (
                      <div className="flex items-center gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => handleRequestAction(req.id, 'APPROVED')}
                          className="flex-1 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/40 text-[11px] font-mono transition-colors"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRequestAction(req.id, 'REJECTED')}
                          className="flex-1 py-1 rounded bg-red/20 hover:bg-red/30 text-red border border-red/40 text-[11px] font-mono transition-colors"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: Client Roster & Retention Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Retention & Renewal Warnings */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2 font-mono">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                Retention &amp; Session Renewal Warnings
              </h2>
              <span className="text-xs text-white/40 font-mono">Action Flags</span>
            </div>

            <div className="space-y-3">
              {clientAlerts.map((alt) => (
                <div
                  key={alt.id}
                  className="p-3.5 rounded-xl border border-white/5 bg-white/[0.02] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-sm text-white">
                        {alt.clientName}
                      </span>
                      <span
                        className={`text-[9px] uppercase font-mono px-1.5 py-0.2 rounded font-bold ${
                          alt.tier === 'HIGH'
                            ? 'bg-red/20 text-red border border-red/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {alt.tier} CHURN RISK
                      </span>
                    </div>
                    <p className="text-xs text-white/50">{alt.reason}</p>
                    <p className="text-[11px] text-white/30 font-mono mt-1">
                      Last Check-In: {alt.lastVisit} • Remaining Sessions:{' '}
                      <span className="text-amber-400 font-bold">
                        {alt.sessionsLeft} left
                      </span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      to="/manage/pt-sessions"
                      className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-mono border border-white/10 transition-colors"
                    >
                      Action &rarr;
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDismissAlert(alt.id)}
                      className="p-1.5 rounded-lg text-white/30 hover:text-white hover:bg-white/10 transition-colors"
                      title="Dismiss Alert"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Milestones & PRs Highlights */}
          <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h2 className="text-sm font-bold uppercase tracking-wider text-white flex items-center gap-2 font-mono">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                Recent Client Milestones &amp; PRs
              </h2>
              <span className="text-xs text-emerald-400 font-mono">Great Work!</span>
            </div>

            <div className="space-y-3">
              {milestones.map((ms) => (
                <div
                  key={ms.id}
                  className="p-3.5 rounded-xl border border-emerald-500/10 bg-emerald-500/[0.02] flex items-start gap-3"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                    <CheckCircle2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-sm text-white">
                        {ms.clientName}
                      </p>
                      <span className="text-[10px] text-white/30 font-mono">
                        {ms.timeAgo}
                      </span>
                    </div>
                    <p className="text-xs text-emerald-300 mt-0.5">
                      {ms.achievement}
                    </p>
                  </div>
                </div>
              ))}

              <div className="p-4 rounded-xl border border-white/5 bg-black/40 text-center space-y-2">
                <p className="text-xs text-white/50">
                  Ready to assign updated workout programs or review 1RM trends?
                </p>
                <div className="flex items-center justify-center gap-3">
                  <Link
                    to="/manage/members"
                    className="text-xs text-red hover:underline font-mono"
                  >
                    View All Assigned Clients &rarr;
                  </Link>
                </div>
              </div>
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
              className="w-full max-w-lg rounded-2xl border border-white/15 bg-[#111114] p-6 shadow-2xl space-y-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-red" />
                  <h3 className="font-bold text-base uppercase text-white font-mono">
                    Real-Time Workout Logger
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsLoggerOpen(false)}
                  className="text-white/40 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {logSuccessToast ? (
                <div className="p-6 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-emerald-300 font-bold text-sm">
                    Set Logged Successfully!
                  </p>
                  <p className="text-xs text-white/40">
                    Data recorded to client's athlete training ledger.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSaveLog} className="space-y-4">
                  <div>
                    <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                      Athlete
                    </label>
                    <input
                      type="text"
                      value={activeLoggingClient}
                      onChange={(e) => setActiveLoggingClient(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                      Exercise
                    </label>
                    <input
                      type="text"
                      value={exerciseName}
                      onChange={(e) => setExerciseName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red"
                      required
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                        Weight (kg)
                      </label>
                      <input
                        type="number"
                        value={exerciseWeight}
                        onChange={(e) => setExerciseWeight(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                        Reps
                      </label>
                      <input
                        type="number"
                        value={exerciseReps}
                        onChange={(e) => setExerciseReps(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                        RPE (1-10)
                      </label>
                      <input
                        type="text"
                        value={exerciseRpe}
                        onChange={(e) => setExerciseRpe(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-red"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsLoggerOpen(false)}
                      className="px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white text-xs font-mono transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-red hover:bg-red-hover text-white text-xs font-bold font-mono uppercase tracking-wider transition-colors shadow-md"
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
