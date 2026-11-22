import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Calendar,
  Check,
  Clock,
  Dumbbell,
  Flame,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { ClientProgressModal } from '@/components/dashboard/ClientProgressModal';
import { TrainerInsightsColumn } from '@/components/dashboard/TrainerInsightsColumn';
import { TrainerSessionNoteModal } from '@/components/dashboard/TrainerSessionNoteModal';
import { useAuth } from '@/context/AuthContext';
import { CLASS_TYPE_LABELS } from '@/constants/coaches';
import { GYM_INFO } from '@/constants/gymInfo';
import { api } from '@/services/api';
import { extractErrorMessage, formatScheduleDateTime as formatDateTimeLabel } from '@/utils/formatters';
import type {
  AtRiskMemberItem,
  ClassSession,
  MemberStats,
  PTSession,
  PTSessionStatus,
} from '@/types/auth';

const ACTIVE_PT_STATUSES = new Set<PTSessionStatus>(['confirmed', 'scheduled']);

const PT_STATUS_STYLE: Record<PTSessionStatus, { label: string; className: string }> = {
  pending: {
    label: 'Pending',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  confirmed: {
    label: 'Confirmed',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  scheduled: {
    label: 'Scheduled',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  completed: {
    label: 'Completed',
    className: 'bg-zinc-800 text-zinc-200 border-zinc-700',
  },
  no_show: {
    label: 'No-Show',
    className: 'bg-red/15 text-red-300 border-red/30',
  },
  cancelled: {
    label: 'Cancelled',
    className: 'bg-zinc-900 text-zinc-500 border-zinc-800',
  },
  rejected: {
    label: 'Declined',
    className: 'bg-red/10 text-red-300 border-red/20',
  },
};

function sortTrainerAgendaSessions(sessions: PTSession[]): PTSession[] {
  return sessions
    .filter((s) => s.status !== 'pending' && s.status !== 'rejected' && s.status !== 'cancelled')
    .sort((a, b) => {
      const aActive = ACTIVE_PT_STATUSES.has(a.status);
      const bActive = ACTIVE_PT_STATUSES.has(b.status);
      if (aActive !== bActive) return aActive ? -1 : 1;

      const tA = Date.parse(a.scheduled_at);
      const tB = Date.parse(b.scheduled_at);
      if (!Number.isFinite(tA) || !Number.isFinite(tB)) return 0;
      return aActive ? tA - tB : tB - tA;
    });
}

function sortPendingRequests(sessions: PTSession[]): PTSession[] {
  return sessions
    .filter((s) => s.status === 'pending')
    .sort((a, b) => {
      const tA = Date.parse(a.scheduled_at);
      const tB = Date.parse(b.scheduled_at);
      if (!Number.isFinite(tA) || !Number.isFinite(tB)) return 0;
      return tA - tB;
    });
}

function sortCoachClasses(classes: ClassSession[], trainerId?: number): ClassSession[] {
  return classes
    .filter(
      (c) =>
        (trainerId === undefined || c.coach_id === trainerId) &&
        (c.status === 'scheduled' || c.status === 'ongoing'),
    )
    .sort((a, b) => {
      const tA = Date.parse(a.scheduled_at);
      const tB = Date.parse(b.scheduled_at);
      if (!Number.isFinite(tA) || !Number.isFinite(tB)) return 0;
      return tA - tB;
    });
}

function formatCompletedPtHours(sessions: PTSession[]): string {
  const completedMinutes = sessions
    .filter((s) => s.status === 'completed')
    .reduce((sum, s) => sum + Math.max(0, s.duration_minutes || 0), 0);
  const hours = completedMinutes / 60;
  if (Number.isInteger(hours)) return `${hours} ${hours === 1 ? 'hr' : 'hrs'}`;
  return `${hours.toFixed(1)} hrs`;
}

const NEUTRAL_ACTION_BTN =
  'px-2.5 py-1.5 rounded-lg text-xs font-mono border bg-zinc-900 border-zinc-800 text-zinc-300 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

export function TrainerDashboard() {
  const { user } = useAuth();

  const [scheduleTab, setScheduleTab] = useState<'agenda' | 'requests'>('agenda');
  const [insightsTab, setInsightsTab] = useState<'flags' | 'history'>('flags');

  const [ptSessions, setPtSessions] = useState<PTSession[]>([]);
  const [classes, setClasses] = useState<ClassSession[]>([]);
  const [atRiskMembers, setAtRiskMembers] = useState<AtRiskMemberItem[]>([]);
  const [memberStats, setMemberStats] = useState<MemberStats | null>(null);

  const [hasLoaded, setHasLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [ptError, setPtError] = useState<string | null>(null);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [churnError, setChurnError] = useState<string | null>(null);

  const [updatingSessionId, setUpdatingSessionId] = useState<number | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Coach Session Note Logger Modal state (persists to PTSession.coach_notes via PATCH)
  const [loggerTargetSessionId, setLoggerTargetSessionId] = useState<string | null>(null);
  const [progressModalTarget, setProgressModalTarget] = useState<{
    memberId: number;
    memberName?: string;
  } | null>(null);

  const fetchDashboardFeeds = useCallback(async () => {
    if (!user) return;
    const [ptRes, classesRes, churnRes, statsRes] = await Promise.allSettled([
      api.getPTSessions({ trainer_id: user.id, limit: 100 }),
      api.getClassSessions({ limit: 50 }),
      api.getChurnMembers({ limit: 30 }),
      api.getMemberStats(),
    ]);

    if (ptRes.status === 'fulfilled') {
      setPtSessions(ptRes.value);
      setPtError(null);
    } else {
      setPtError(extractErrorMessage(ptRes.reason, 'Unable to load PT sessions.'));
    }

    if (classesRes.status === 'fulfilled') {
      setClasses(sortCoachClasses(classesRes.value, user.id));
      setClassesError(null);
    } else {
      setClassesError(extractErrorMessage(classesRes.reason, 'Unable to load scheduled classes.'));
    }

    if (churnRes.status === 'fulfilled') {
      setAtRiskMembers(
        churnRes.value.filter((item) => item.risk_tier === 'HIGH' || item.risk_tier === 'MEDIUM'),
      );
      setChurnError(null);
    } else {
      setChurnError(extractErrorMessage(churnRes.reason, 'Retention alerts unavailable.'));
    }

    if (statsRes.status === 'fulfilled') {
      setMemberStats(statsRes.value);
    }

    setHasLoaded(true);
  }, [user]);

  useEffect(() => {
    let active = true;

    async function init() {
      if (!user) return;
      const [ptRes, classesRes, churnRes, statsRes] = await Promise.allSettled([
        api.getPTSessions({ trainer_id: user.id, limit: 100 }),
        api.getClassSessions({ limit: 50 }),
        api.getChurnMembers({ limit: 30 }),
        api.getMemberStats(),
      ]);

      if (!active) return;

      if (ptRes.status === 'fulfilled') {
        setPtSessions(ptRes.value);
        setPtError(null);
      } else {
        setPtError(extractErrorMessage(ptRes.reason, 'Unable to load PT sessions.'));
      }

      if (classesRes.status === 'fulfilled') {
        setClasses(sortCoachClasses(classesRes.value, user.id));
        setClassesError(null);
      } else {
        setClassesError(
          extractErrorMessage(classesRes.reason, 'Unable to load scheduled classes.'),
        );
      }

      if (churnRes.status === 'fulfilled') {
        setAtRiskMembers(
          churnRes.value.filter(
            (item) => item.risk_tier === 'HIGH' || item.risk_tier === 'MEDIUM',
          ),
        );
        setChurnError(null);
      } else {
        setChurnError(extractErrorMessage(churnRes.reason, 'Retention alerts unavailable.'));
      }

      if (statsRes.status === 'fulfilled') {
        setMemberStats(statsRes.value);
      }

      setHasLoaded(true);
    }

    void init();

    return () => {
      active = false;
    };
  }, [user]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setActionFeedback(null);
    await fetchDashboardFeeds();
    setIsRefreshing(false);
  };

  const agendaSessions = useMemo(() => sortTrainerAgendaSessions(ptSessions), [ptSessions]);
  const pendingRequests = useMemo(() => sortPendingRequests(ptSessions), [ptSessions]);
  const loggableSessions = useMemo(
    () => ptSessions.filter((s) => s.status !== 'rejected' && s.status !== 'cancelled'),
    [ptSessions],
  );
  const completedSessions = useMemo(
    () =>
      ptSessions
        .filter((s) => s.status === 'completed')
        .sort((a, b) => Date.parse(b.scheduled_at) - Date.parse(a.scheduled_at)),
    [ptSessions],
  );

  const upNextSession = useMemo(
    () => agendaSessions.find((s) => ACTIVE_PT_STATUSES.has(s.status)) ?? null,
    [agendaSessions],
  );

  const openLoggerForSession = (session?: PTSession | null) => {
    const fallbackTarget = session ?? upNextSession ?? loggableSessions[0] ?? null;
    setLoggerTargetSessionId(fallbackTarget ? String(fallbackTarget.id) : '');
  };

  const handleSavedSessionNotes = (updated: PTSession) => {
    setPtSessions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setActionFeedback({
      type: 'success',
      message: `Saved session notes for ${updated.member_name || 'athlete'}.`,
    });
    setLoggerTargetSessionId(null);
  };

  const updateSessionStatus = async (session: PTSession, newStatus: 'completed' | 'no_show') => {
    setUpdatingSessionId(session.id);
    setActionFeedback(null);
    try {
      const updated = await api.updatePTSession(session.id, { status: newStatus });
      setPtSessions((prev) => prev.map((item) => (item.id === session.id ? updated : item)));
      setActionFeedback({
        type: 'success',
        message: `Updated ${session.member_name || 'athlete'} session to ${PT_STATUS_STYLE[newStatus].label}.`,
      });
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: extractErrorMessage(err, 'Failed to update PT session status.'),
      });
    } finally {
      setUpdatingSessionId(null);
    }
  };

  const handleRequestAction = async (
    request: PTSession,
    decision: 'approve' | 'reject',
  ) => {
    setUpdatingSessionId(request.id);
    setActionFeedback(null);
    try {
      const updated =
        decision === 'approve'
          ? await api.approvePTSession(request.id)
          : await api.rejectPTSession(request.id, 'Trainer unavailable at requested time.');
      setPtSessions((prev) => prev.map((item) => (item.id === request.id ? updated : item)));
      setActionFeedback({
        type: 'success',
        message:
          decision === 'approve'
            ? `Confirmed coaching request from ${request.member_name || 'athlete'}.`
            : `Declined coaching request from ${request.member_name || 'athlete'}.`,
      });
    } catch (err) {
      setActionFeedback({
        type: 'error',
        message: extractErrorMessage(err, 'Failed to process booking request.'),
      });
    } finally {
      setUpdatingSessionId(null);
    }
  };

  const activePtCount = agendaSessions.filter((s) => ACTIVE_PT_STATUSES.has(s.status)).length;
  const completedHoursLabel = formatCompletedPtHours(ptSessions);
  const totalClassAthletes = classes.reduce((sum, c) => sum + c.enrolled_count, 0);
  const highRiskCount = atRiskMembers.filter((m) => m.risk_tier === 'HIGH').length;
  const isLoading = !hasLoaded || isRefreshing;

  const kpiCards = [
    {
      label: 'PT Pipeline',
      value: isLoading ? 'Loading...' : `${activePtCount} Active`,
      sub: `${pendingRequests.length} pending approval • ${agendaSessions.length} total non-cancelled`,
      icon: Calendar,
    },
    {
      label: 'Completed PT Volume',
      value: isLoading ? 'Loading...' : `${completedSessions.length} Completed`,
      sub: `${completedHoursLabel} logged coaching time`,
      icon: Clock,
    },
    {
      label: 'Assigned Group Classes',
      value: isLoading ? 'Loading...' : `${classes.length} Scheduled`,
      sub: `${totalClassAthletes} enrolled ${totalClassAthletes === 1 ? 'athlete' : 'athletes'}`,
      icon: Flame,
    },
    {
      label: 'Retention Alerts',
      value: churnError ? 'Unavailable' : isLoading ? 'Loading...' : `${atRiskMembers.length} Flagged`,
      sub: `${highRiskCount} high risk • ${memberStats?.active ?? '—'} active gym members`,
      icon: ShieldAlert,
    },
  ];

  const coachDisplayName = user?.full_name || 'Coach';

  return (
    <div className="min-h-screen bg-[#070709] text-white p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-800/80">
          <div>
            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono uppercase tracking-wider bg-zinc-800 text-zinc-300 border border-zinc-700">
                TRAINER COMMAND CENTER
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {coachDisplayName} • {GYM_INFO.cityRegion}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Floor Operations &amp; Athlete Roster
            </h1>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              disabled={isRefreshing}
              onClick={handleRefresh}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono transition-colors cursor-pointer disabled:opacity-50"
              title="Refresh Coaching Feeds"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              type="button"
              onClick={() => openLoggerForSession(upNextSession)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-all shadow-[0_0_15px_rgba(229,32,26,0.28)] cursor-pointer"
            >
              <Dumbbell className="w-4 h-4" />
              <span>Session Notes Logger</span>
            </button>
            <Link
              to="/manage/pt-sessions"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono transition-colors"
            >
              <Calendar className="w-4 h-4 text-zinc-400" />
              <span>PT Schedule</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <Link
              to="/manage/members"
              className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-zinc-800 bg-zinc-900/90 hover:bg-zinc-800 text-zinc-300 hover:text-white text-xs font-mono transition-colors"
              title="Member Directory"
            >
              <Users className="w-4 h-4 text-zinc-400" />
              <span className="hidden md:inline">Members</span>
            </Link>
          </div>
        </div>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div
            role={actionFeedback.type === 'error' ? 'alert' : 'status'}
            className={`px-4 py-3 rounded-xl border text-xs font-mono flex items-center justify-between gap-3 ${
              actionFeedback.type === 'error'
                ? 'border-red/30 bg-red/10 text-red-200'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
            }`}
          >
            <span>{actionFeedback.message}</span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="text-current/70 hover:text-white cursor-pointer"
              aria-label="Dismiss notification"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 1. COMPACT KPI STRIP */}
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

        {/* 2. 2-COLUMN BENTO GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN (7 cols) — UNIFIED SCHEDULE HUB */}
          <div className="lg:col-span-7 space-y-6">
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 space-y-4">
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
                    <span>PT Agenda ({agendaSessions.length})</span>
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
                    <span>Pending Requests ({pendingRequests.length})</span>
                    {pendingRequests.length > 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red" aria-hidden="true" />
                    )}
                  </button>
                </div>

                <Link
                  to="/manage/pt-sessions"
                  className="text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  Open Full Roster →
                </Link>
              </div>

              {ptError ? (
                <div className="p-4 rounded-xl border border-red/25 bg-red/10 flex items-center justify-between gap-3">
                  <p className="text-xs font-mono text-red-200">{ptError}</p>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    className="px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-mono text-white cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : isLoading ? (
                <div className="space-y-3">
                  {[1, 2].map((idx) => (
                    <div
                      key={idx}
                      className="h-24 rounded-xl border border-zinc-800/80 bg-zinc-900/40 animate-pulse"
                    />
                  ))}
                </div>
              ) : scheduleTab === 'agenda' ? (
                agendaSessions.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-6 text-center font-mono">
                    No active or completed 1-on-1 PT sessions assigned to you yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {agendaSessions.map((sess) => {
                      const statusMeta = PT_STATUS_STYLE[sess.status];
                      const isActive = ACTIVE_PT_STATUSES.has(sess.status);
                      const isBusy = updatingSessionId === sess.id;

                      return (
                        <div
                          key={sess.id}
                          className={`p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 transition-colors hover:border-zinc-700 ${
                            !isActive ? 'opacity-80' : ''
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Link
                                  to={`/manage/members/${sess.member_id}`}
                                  className="font-semibold text-sm text-white hover:text-red transition-colors"
                                >
                                  {sess.member_name || sess.member_code || `Member #${sess.member_id}`}
                                </Link>
                                <span
                                  className={`text-[10px] uppercase font-mono px-2 py-0.5 rounded-md border ${statusMeta.className}`}
                                >
                                  {statusMeta.label}
                                </span>
                                <span className="text-[11px] font-mono text-zinc-400">
                                  {formatDateTimeLabel(sess.scheduled_at)} • {sess.duration_minutes}m
                                </span>
                              </div>

                              {sess.notes && (
                                <p className="text-xs text-zinc-400 leading-relaxed">
                                  Client Goal: {sess.notes}
                                </p>
                              )}
                              {sess.coach_notes && (
                                <p className="text-xs text-zinc-300 font-mono bg-zinc-950/70 border border-zinc-800 rounded-lg px-2.5 py-1.5 mt-1">
                                  Coach Notes: {sess.coach_notes}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                              {isActive && (
                                <>
                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => updateSessionStatus(sess, 'completed')}
                                    className={`${NEUTRAL_ACTION_BTN} flex items-center gap-1 hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/10`}
                                  >
                                    <Check className="w-3.5 h-3.5" />
                                    <span>Complete</span>
                                  </button>

                                  <button
                                    type="button"
                                    disabled={isBusy}
                                    onClick={() => updateSessionStatus(sess, 'no_show')}
                                    className={`${NEUTRAL_ACTION_BTN} flex items-center gap-1 hover:border-red/40 hover:text-red hover:bg-red/10`}
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    <span>No-Show</span>
                                  </button>
                                </>
                              )}

                              <button
                                type="button"
                                onClick={() =>
                                  setProgressModalTarget({
                                    memberId: sess.member_id,
                                    memberName: sess.member_name || sess.member_code || undefined,
                                  })
                                }
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border border-red/30 bg-red/10 text-red hover:bg-red hover:text-white transition-colors cursor-pointer"
                              >
                                <TrendingUp className="w-3.5 h-3.5" />
                                <span>View Progress</span>
                              </button>

                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => openLoggerForSession(sess)}
                                className={`${NEUTRAL_ACTION_BTN} hover:text-white hover:border-zinc-700`}
                              >
                                Log Notes
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              ) : pendingRequests.length === 0 ? (
                <p className="text-xs text-zinc-400 py-6 text-center font-mono">
                  No pending 1-on-1 coaching requests awaiting approval.
                </p>
              ) : (
                <div className="space-y-3">
                  {pendingRequests.map((req) => {
                    const isBusy = updatingSessionId === req.id;
                    return (
                      <div
                        key={req.id}
                        className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Link
                              to={`/manage/members/${req.member_id}`}
                              className="font-semibold text-sm text-white hover:text-red transition-colors"
                            >
                              {req.member_name || req.member_code || `Member #${req.member_id}`}
                            </Link>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-md border bg-amber-500/10 text-amber-300 border-amber-500/20 uppercase">
                              Pending
                            </span>
                          </div>
                          <p className="text-zinc-400 text-xs font-mono">
                            {formatDateTimeLabel(req.scheduled_at)} • {req.duration_minutes} mins
                          </p>
                          {req.notes && (
                            <p className="text-xs text-zinc-300">{req.notes}</p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          <button
                            type="button"
                            onClick={() =>
                              setProgressModalTarget({
                                memberId: req.member_id,
                                memberName: req.member_name || req.member_code || undefined,
                              })
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border border-red/30 bg-red/10 text-red hover:bg-red hover:text-white transition-colors cursor-pointer"
                          >
                            <TrendingUp className="w-3.5 h-3.5" />
                            <span>View Progress</span>
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRequestAction(req, 'approve')}
                            className={`${NEUTRAL_ACTION_BTN} hover:border-emerald-500/40 hover:text-emerald-400 hover:bg-emerald-500/10`}
                          >
                            {isBusy ? 'Saving...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRequestAction(req, 'reject')}
                            className={`${NEUTRAL_ACTION_BTN} hover:border-red/40 hover:text-red hover:bg-red/10`}
                          >
                            Decline
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Assigned Group Classes Card */}
            <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/80 p-5 space-y-3">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800/80">
                <div className="flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" />
                  <h2 className="text-xs font-mono uppercase tracking-widest text-zinc-300 font-semibold">
                    Your Upcoming Group Classes
                  </h2>
                </div>
                <Link
                  to="/manage/classes"
                  className="text-xs font-mono text-zinc-400 hover:text-white transition-colors"
                >
                  Manage Classes →
                </Link>
              </div>

              {classesError ? (
                <p className="text-xs font-mono text-red-200">{classesError}</p>
              ) : classes.length === 0 ? (
                <p className="text-xs font-mono text-zinc-400 py-3">
                  No upcoming group classes currently assigned to {coachDisplayName}.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {classes.map((cls) => (
                    <div
                      key={cls.id}
                      className="p-3.5 rounded-xl border border-zinc-800/80 bg-zinc-900/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-white">{cls.name}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700 uppercase">
                            {CLASS_TYPE_LABELS[cls.class_type] || cls.class_type}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-zinc-400 mt-0.5">
                          {formatDateTimeLabel(cls.scheduled_at)} • {cls.duration_minutes} mins
                          {cls.location ? ` • ${cls.location}` : ''}
                        </p>
                      </div>
                      <span className="text-xs font-mono text-emerald-400 shrink-0">
                        {cls.enrolled_count} / {cls.max_capacity} Enrolled
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <TrainerInsightsColumn
            upNextSession={upNextSession}
            getStatusLabel={(status) => PT_STATUS_STYLE[status].label}
            onOpenLogger={openLoggerForSession}
            insightsTab={insightsTab}
            onTabChange={setInsightsTab}
            atRiskMembers={atRiskMembers}
            churnError={churnError}
            completedSessions={completedSessions}
            onViewProgress={setProgressModalTarget}
          />
        </div>

        {loggerTargetSessionId !== null && (
          <TrainerSessionNoteModal
            initialSessionId={loggerTargetSessionId}
            loggableSessions={loggableSessions}
            getStatusLabel={(status) => PT_STATUS_STYLE[status].label}
            onClose={() => setLoggerTargetSessionId(null)}
            onSaved={handleSavedSessionNotes}
          />
        )}

        <ClientProgressModal
          memberId={progressModalTarget?.memberId ?? null}
          fallbackName={progressModalTarget?.memberName}
          onClose={() => setProgressModalTarget(null)}
        />
      </div>
    </div>
  );
}
