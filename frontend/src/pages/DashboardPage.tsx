import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Clock,
  CreditCard,
  Dumbbell,
  Flame,
  Lock,
  RefreshCw,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SEO } from '@/components/ui/SEO';
import { TrainerDashboard } from '@/components/dashboard/TrainerDashboard';
import { CLASS_TYPE_LABELS, OFFICIAL_GROUP_CLASSES } from '@/constants/coaches';
import { GYM_INFO } from '@/constants/gymInfo';
import { PUBLIC_PLANS } from '@/constants/plans';
import { api } from '@/services/api';
import { getInitials } from '@/utils/formatters';
import type { AccountProfile } from '@/types/account';
import type {
  ClassEnrollment,
  ClassSession,
  PTSession,
  PTSessionStatus,
  User,
  UserRole,
} from '@/types/auth';

type MemberPortalProps = {
  user: User;
};

const ROLE_DASHBOARD_REDIRECTS: Partial<Record<UserRole, string>> = {
  admin: '/manage',
  staff: '/manage/scanner',
};

const ACTIVE_PT_STATUSES = new Set<PTSessionStatus>(['pending', 'confirmed', 'scheduled']);

const PT_STATUS_META: Record<PTSessionStatus, { label: string; badgeClass: string }> = {
  pending: {
    label: 'Pending Approval',
    badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  confirmed: {
    label: 'Confirmed',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  scheduled: {
    label: 'Scheduled',
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-white/10 text-white/75 border-white/15',
  },
  cancelled: {
    label: 'Cancelled',
    badgeClass: 'bg-white/5 text-white/50 border-white/10',
  },
  rejected: {
    label: 'Declined',
    badgeClass: 'bg-red/15 text-red-300 border-red/30',
  },
  no_show: {
    label: 'No Show',
    badgeClass: 'bg-red/15 text-red-300 border-red/30',
  },
};

const dateTimeFormatter = new Intl.DateTimeFormat('en-PH', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

function formatSessionDateTime(iso: string): string {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return 'Schedule pending';
  return dateTimeFormatter.format(new Date(timestamp));
}

function sortUpcomingClasses(classes: ClassSession[]): ClassSession[] {
  return [...classes].sort((a, b) => {
    const tA = Date.parse(a.scheduled_at);
    const tB = Date.parse(b.scheduled_at);
    if (!Number.isFinite(tA) || !Number.isFinite(tB)) return 0;
    return tA - tB;
  });
}

function sortMemberBookings(bookings: PTSession[]): PTSession[] {
  return [...bookings].sort((a, b) => {
    const aActive = ACTIVE_PT_STATUSES.has(a.status);
    const bActive = ACTIVE_PT_STATUSES.has(b.status);
    if (aActive !== bActive) return aActive ? -1 : 1;

    const tA = Date.parse(a.scheduled_at);
    const tB = Date.parse(b.scheduled_at);
    if (!Number.isFinite(tA) || !Number.isFinite(tB)) return 0;
    return aActive ? tA - tB : tB - tA;
  });
}

function applySelfEnrollment(
  sessions: ClassSession[],
  sessionId: number,
  enrollment: ClassEnrollment,
): ClassSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const alreadyPresent = session.enrollments.length > 0;
    return {
      ...session,
      enrolled_count: alreadyPresent ? session.enrolled_count : session.enrolled_count + 1,
      enrollments: [enrollment],
    };
  });
}

function removeSelfEnrollment(
  sessions: ClassSession[],
  sessionId: number,
): ClassSession[] {
  return sessions.map((session) => {
    if (session.id !== sessionId) return session;
    const wasEnrolled = session.enrollments.length > 0;
    return {
      ...session,
      enrolled_count: wasEnrolled ? Math.max(0, session.enrolled_count - 1) : session.enrolled_count,
      enrollments: [],
    };
  });
}

function extractErrorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export function DashboardPage() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  const redirectPath = ROLE_DASHBOARD_REDIRECTS[user.role];
  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  if (user.role === 'trainer') {
    return (
      <>
        <SEO
          title="Trainer Command Center"
          description="The DGym Trainer Floor Operations & Coaching Roster."
        />
        <TrainerDashboard />
      </>
    );
  }

  return <MemberPortalDashboard user={user} />;
}

function MemberPortalDashboard({ user }: MemberPortalProps) {
  const navigate = useNavigate();

  const viewMode: 'ACTIVE' | 'INACTIVE' = user.has_active_membership ? 'ACTIVE' : 'INACTIVE';
  const isPendingPayment = user.membership_status === 'pending' && !user.has_active_membership;

  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [brokenAvatarUrl, setBrokenAvatarUrl] = useState<string | null>(null);

  const [groupClasses, setGroupClasses] = useState<ClassSession[]>([]);
  const [hasLoadedClasses, setHasLoadedClasses] = useState(false);
  const [isRefreshingClasses, setIsRefreshingClasses] = useState(false);
  const [classesError, setClassesError] = useState<string | null>(null);
  const [togglingClassId, setTogglingClassId] = useState<number | null>(null);
  const [classFeedback, setClassFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const [ptBookings, setPtBookings] = useState<PTSession[]>([]);
  const [hasLoadedBookings, setHasLoadedBookings] = useState(false);
  const [isRefreshingBookings, setIsRefreshingBookings] = useState(false);
  const [bookingsError, setBookingsError] = useState<string | null>(null);
  const [cancellingBookingId, setCancellingBookingId] = useState<number | null>(null);
  const [bookingFeedback, setBookingFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const fetchClasses = useCallback(async () => {
    const sessions = await api.getClassSessions({ status: 'scheduled', limit: 30 });
    return sortUpcomingClasses(sessions);
  }, []);

  const fetchBookings = useCallback(async () => {
    const bookings = await api.getMyBookings();
    return sortMemberBookings(bookings);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadPortal() {
      const profilePromise = api.getProfile();

      if (viewMode !== 'ACTIVE') {
        try {
          const prof = await profilePromise;
          if (active) setProfile(prof);
        } catch {
          if (active) setProfile(null);
        }
        return;
      }

      const [profRes, classesRes, bookingsRes] = await Promise.allSettled([
        profilePromise,
        fetchClasses(),
        fetchBookings(),
      ]);

      if (!active) return;

      if (profRes.status === 'fulfilled') {
        setProfile(profRes.value);
      }

      if (classesRes.status === 'fulfilled') {
        setGroupClasses(classesRes.value);
        setClassesError(null);
      } else {
        setClassesError(
          extractErrorMessage(classesRes.reason, 'Unable to load scheduled group classes.'),
        );
      }
      setHasLoadedClasses(true);

      if (bookingsRes.status === 'fulfilled') {
        setPtBookings(bookingsRes.value);
        setBookingsError(null);
      } else {
        setBookingsError(
          extractErrorMessage(bookingsRes.reason, 'Unable to load your coaching bookings.'),
        );
      }
      setHasLoadedBookings(true);
    }

    void loadPortal();

    return () => {
      active = false;
    };
  }, [user.id, viewMode, fetchClasses, fetchBookings]);

  const handleRetryClasses = async () => {
    setIsRefreshingClasses(true);
    setClassesError(null);
    try {
      const next = await fetchClasses();
      setGroupClasses(next);
    } catch (err) {
      setClassesError(extractErrorMessage(err, 'Unable to load scheduled group classes.'));
    } finally {
      setHasLoadedClasses(true);
      setIsRefreshingClasses(false);
    }
  };

  const handleRetryBookings = async () => {
    setIsRefreshingBookings(true);
    setBookingsError(null);
    try {
      const next = await fetchBookings();
      setPtBookings(next);
    } catch (err) {
      setBookingsError(extractErrorMessage(err, 'Unable to load your coaching bookings.'));
    } finally {
      setHasLoadedBookings(true);
      setIsRefreshingBookings(false);
    }
  };

  const handleToggleReservation = async (cls: ClassSession) => {
    const isReserved = cls.enrollments.length > 0;
    setTogglingClassId(cls.id);
    setClassFeedback(null);

    try {
      if (isReserved) {
        await api.unenrollSelfClass(cls.id);
        setGroupClasses((prev) => removeSelfEnrollment(prev, cls.id));
        setClassFeedback({
          type: 'success',
          message: `Cancelled reservation for ${cls.name}.`,
        });
      } else {
        const enrollment = await api.enrollSelfClass(cls.id);
        setGroupClasses((prev) => applySelfEnrollment(prev, cls.id, enrollment));
        setClassFeedback({
          type: 'success',
          message: `Spot reserved in ${cls.name}.`,
        });
      }
    } catch (err) {
      setClassFeedback({
        type: 'error',
        message: extractErrorMessage(err, 'Could not update your class reservation.'),
      });
      // Reconcile list cleanly when server state rejected the toggle (e.g., full/already booked)
      try {
        const fresh = await fetchClasses();
        setGroupClasses(fresh);
      } catch {
        // Keep visible inline error even if background sync fails
      }
    } finally {
      setTogglingClassId(null);
    }
  };

  const handleCancelBooking = async (booking: PTSession) => {
    setCancellingBookingId(booking.id);
    setBookingFeedback(null);

    try {
      const updated = await api.cancelPTSession(booking.id);
      setPtBookings((prev) =>
        sortMemberBookings(prev.map((item) => (item.id === booking.id ? updated : item))),
      );
      setBookingFeedback({
        type: 'success',
        message: `Cancelled coaching session with ${booking.trainer_name || 'your coach'}.`,
      });
    } catch (err) {
      setBookingFeedback({
        type: 'error',
        message: extractErrorMessage(err, 'Unable to cancel this coaching booking.'),
      });
    } finally {
      setCancellingBookingId(null);
    }
  };

  const memberName = profile?.full_name || user.full_name || 'Athlete';
  const avatarUrl = profile?.profile_picture_url ?? user.profile_picture_url ?? null;
  const userInitials = getInitials(memberName);
  const roleBadge =
    viewMode === 'ACTIVE'
      ? 'ACTIVE MEMBER'
      : isPendingPayment
        ? 'PAYMENT PENDING'
        : 'REGISTERED USER';
  const membershipPlan =
    user.plan_name ||
    (viewMode === 'ACTIVE' ? 'Active Membership Pass' : 'No Active Membership Pass');

  const reservedClasses = useMemo(
    () => groupClasses.filter((cls) => cls.enrollments.length > 0),
    [groupClasses],
  );
  const activePtBookings = useMemo(
    () => ptBookings.filter((booking) => ACTIVE_PT_STATUSES.has(booking.status)),
    [ptBookings],
  );
  const completedPtCount = useMemo(
    () => ptBookings.filter((booking) => booking.status === 'completed').length,
    [ptBookings],
  );
  const nextPtBooking = activePtBookings[0] ?? null;
  const nextReservedClass = reservedClasses[0] ?? null;

  const isLoadingClasses = viewMode === 'ACTIVE' && ((!hasLoadedClasses && !classesError) || isRefreshingClasses);
  const isLoadingBookings = viewMode === 'ACTIVE' && ((!hasLoadedBookings && !bookingsError) || isRefreshingBookings);

  const activationStepsCompleted = isPendingPayment ? 2 : 1;

  return (
    <div className="min-h-screen bg-[#070709] text-white font-sans antialiased">
      <SEO
        title={`${memberName} — Member Portal`}
        description="The DGym member dashboard & training portal."
      />

      {/* Portal Quick Header */}
      <header className="border-b border-white/10 bg-[#0d0d11]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-white/60 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
            <span className="text-white/20">|</span>
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-white truncate">
              DGym Athlete Portal
            </span>
          </div>

          <div className="flex items-center gap-4">
            {viewMode === 'ACTIVE' && (
              <Link
                to="/dashboard/plan"
                className="text-xs font-mono text-white/60 hover:text-white transition-colors hidden sm:inline"
              >
                Your Plan →
              </Link>
            )}
            <Link
              to="/settings"
              className="text-xs font-mono text-white/60 hover:text-white transition-colors"
            >
              Settings →
            </Link>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Athlete Profile Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-white/10">
          <div className="flex items-start gap-4">
            <div
              className={`w-14 h-14 rounded-2xl overflow-hidden flex items-center justify-center font-mono font-black text-lg border shrink-0 ${
                viewMode === 'ACTIVE'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              {avatarUrl && brokenAvatarUrl !== avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={`${memberName} avatar`}
                  onError={() => setBrokenAvatarUrl(avatarUrl)}
                  className="h-full w-full object-cover"
                />
              ) : (
                userInitials
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase border ${
                    viewMode === 'ACTIVE'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}
                >
                  {roleBadge}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white truncate">
                Welcome back, {memberName}
              </h1>

              <p className="text-xs text-white/60 font-mono mt-1">{membershipPlan}</p>
            </div>
          </div>

          {viewMode === 'INACTIVE' ? (
            <button
              type="button"
              onClick={() => navigate(isPendingPayment ? '/payment' : '/payment?plan=monthly')}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(229,32,26,0.35)] cursor-pointer self-start sm:self-center"
            >
              <CreditCard className="w-4 h-4" />
              <span>{isPendingPayment ? 'Complete Pending Payment' : 'Avail Membership Plan'}</span>
            </button>
          ) : (
            <Link
              to="/dashboard/book"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors self-start sm:self-center"
            >
              <Dumbbell className="w-4 h-4 text-red" />
              <span>Book a Coach</span>
            </Link>
          )}
        </div>

        {/* =========================================================================
            CONDITIONAL VIEW: ACTIVE MEMBER
        ========================================================================= */}
        {viewMode === 'ACTIVE' && (
          <div className="space-y-8 animate-fade-in">
            {/* Top Summary Cards backed by verified auth & API data */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Membership Pass Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 space-y-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Membership Pass
                  </span>
                  <span className="text-emerald-400 font-bold">Active</span>
                </div>
                <p className="text-lg sm:text-xl font-black text-white truncate">
                  {membershipPlan}
                </p>
                <div className="flex items-center justify-between text-xs font-mono pt-1">
                  <span className="text-white/50">NFC Keycard Ready</span>
                  <Link
                    to="/dashboard/plan"
                    className="text-emerald-400 hover:text-emerald-300 underline transition-colors"
                  >
                    Workout Plan →
                  </Link>
                </div>
              </div>

              {/* 1-on-1 Coaching Bookings Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 space-y-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/50 uppercase tracking-wider">Coaching Sessions</span>
                  <Dumbbell className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  {isLoadingBookings
                    ? 'Loading...'
                    : `${activePtBookings.length} Upcoming`}
                </p>
                <div className="text-xs font-mono flex items-center justify-between gap-2">
                  <span className="text-white/55 truncate">
                    {nextPtBooking
                      ? `${nextPtBooking.trainer_name || 'Coach'} • ${formatSessionDateTime(nextPtBooking.scheduled_at)}`
                      : `${completedPtCount} completed`}
                  </span>
                  <Link
                    to="/dashboard/book"
                    className="text-blue-400 underline hover:text-blue-300 transition-colors shrink-0"
                  >
                    Book a Coach
                  </Link>
                </div>
              </div>

              {/* Group Class Reservations Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 space-y-2.5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/50 uppercase tracking-wider">Group Classes</span>
                  <Flame className="w-4 h-4 text-orange-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  {isLoadingClasses
                    ? 'Loading...'
                    : `${reservedClasses.length} Reserved`}
                </p>
                <div className="text-xs font-mono flex items-center justify-between gap-2">
                  <span className="text-white/55 truncate">
                    {nextReservedClass
                      ? `${nextReservedClass.name} • ${formatSessionDateTime(nextReservedClass.scheduled_at)}`
                      : `${groupClasses.length} scheduled available`}
                  </span>
                  <Link
                    to="/classes"
                    className="text-orange-400 underline hover:text-orange-300 transition-colors shrink-0"
                  >
                    Schedule
                  </Link>
                </div>
              </div>
            </div>

            {/* Live Group Conditioning & Class Reservations */}
            <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                    Group Conditioning &amp; Class Reservations
                  </h2>
                  <p className="text-xs text-white/50">
                    Reserve complimentary athlete slots for upcoming floor sessions
                  </p>
                </div>
                <span className="text-xs font-mono text-emerald-400">
                  {reservedClasses.length} Active{' '}
                  {reservedClasses.length === 1 ? 'Booking' : 'Bookings'}
                </span>
              </div>

              {classFeedback && (
                <div
                  role={classFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-mono ${
                    classFeedback.type === 'error'
                      ? 'border-red/30 bg-red/10 text-red-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  {classFeedback.message}
                </div>
              )}

              {isLoadingClasses ? (
                <div className="space-y-3">
                  {[1, 2].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="h-20 rounded-xl border border-white/8 bg-white/[0.02] animate-pulse"
                    />
                  ))}
                </div>
              ) : classesError ? (
                <div className="p-5 rounded-xl border border-red/25 bg-red/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs font-mono text-red-200">{classesError}</p>
                  <button
                    type="button"
                    onClick={handleRetryClasses}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-xs font-mono text-white cursor-pointer self-start sm:self-center"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : groupClasses.length === 0 ? (
                <div className="p-6 rounded-xl border border-white/8 bg-white/[0.02] space-y-3">
                  <p className="text-xs font-mono text-white/75">
                    No upcoming class sessions are open for advance reservation right now.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {OFFICIAL_GROUP_CLASSES.map((cls) => (
                      <div
                        key={cls.classType}
                        className="p-3.5 rounded-lg border border-white/8 bg-black/30 space-y-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-semibold text-white">{cls.name}</span>
                          <span className="text-[11px] font-mono text-emerald-400">
                            {cls.rateLabel}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-white/55">
                          {cls.coachName} • {cls.scheduleTime}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {groupClasses.map((cls) => {
                    const isReserved = cls.enrollments.length > 0;
                    const spotsRemaining = Math.max(0, cls.max_capacity - cls.enrolled_count);
                    const isFull = !isReserved && spotsRemaining === 0;
                    const isUpdating = togglingClassId === cls.id;
                    const typeLabel = CLASS_TYPE_LABELS[cls.class_type] || cls.class_type;

                    return (
                      <div
                        key={cls.id}
                        className="p-4 rounded-xl border border-white/8 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-white">{cls.name}</span>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/8 text-white/75">
                              {cls.coach_name || typeLabel}
                            </span>
                            {cls.coach_name && (
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded border border-white/10 text-white/55">
                                {typeLabel}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-white/60 font-mono mt-1">
                            {formatSessionDateTime(cls.scheduled_at)} • {cls.duration_minutes} mins
                            {cls.location ? ` • ${cls.location}` : ''}
                          </p>
                          <p className="text-[11px] text-white/45 font-mono mt-0.5">
                            Capacity: {cls.enrolled_count} / {cls.max_capacity} ({spotsRemaining}{' '}
                            {spotsRemaining === 1 ? 'spot' : 'spots'} left)
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={isUpdating || isFull}
                          onClick={() => handleToggleReservation(cls)}
                          className={`px-3 py-2 rounded-xl text-xs font-mono transition-all shrink-0 ${
                            isFull
                              ? 'bg-white/5 text-white/40 border border-white/10 cursor-not-allowed'
                              : isReserved
                                ? 'bg-red/20 text-red border border-red/40 hover:bg-red/30 cursor-pointer disabled:opacity-60'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30 cursor-pointer disabled:opacity-60'
                          }`}
                        >
                          {isUpdating
                            ? 'Updating...'
                            : isFull
                              ? 'Class Full'
                              : isReserved
                                ? 'Cancel Reservation'
                                : 'Reserve Spot'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* My 1-on-1 Coaching Bookings */}
            <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-white/10">
                <div>
                  <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                    My 1-on-1 Coaching Bookings
                  </h2>
                  <p className="text-xs text-white/50">
                    Track coach confirmations and upcoming personal training sessions
                  </p>
                </div>
                <Link
                  to="/dashboard/book"
                  className="text-xs font-mono text-red hover:underline self-start sm:self-center"
                >
                  + Request Session →
                </Link>
              </div>

              {bookingFeedback && (
                <div
                  role={bookingFeedback.type === 'error' ? 'alert' : 'status'}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-mono ${
                    bookingFeedback.type === 'error'
                      ? 'border-red/30 bg-red/10 text-red-300'
                      : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  }`}
                >
                  {bookingFeedback.message}
                </div>
              )}

              {isLoadingBookings ? (
                <div className="space-y-3">
                  {[1, 2].map((skeleton) => (
                    <div
                      key={skeleton}
                      className="h-16 rounded-xl border border-white/8 bg-white/[0.02] animate-pulse"
                    />
                  ))}
                </div>
              ) : bookingsError ? (
                <div className="p-5 rounded-xl border border-red/25 bg-red/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <p className="text-xs font-mono text-red-200">{bookingsError}</p>
                  <button
                    type="button"
                    onClick={handleRetryBookings}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/15 bg-white/10 hover:bg-white/15 text-xs font-mono text-white cursor-pointer self-start sm:self-center"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry</span>
                  </button>
                </div>
              ) : ptBookings.length === 0 ? (
                <div className="p-6 rounded-xl border border-white/8 bg-white/[0.02] text-center space-y-2">
                  <p className="text-xs font-mono text-white/75">
                    No 1-on-1 coaching bookings submitted yet
                  </p>
                  <p className="text-[11px] text-white/50 font-mono">
                    Schedule a Muscle Gain, Boxing, or Cardio Boxing block with Coach Ivan, Coach Marta, or Coach Kresler.
                  </p>
                  <div className="pt-2">
                    <Link
                      to="/dashboard/book"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-mono text-white transition-colors"
                    >
                      Browse Coaches &amp; Packages
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {ptBookings.map((booking) => {
                    const statusMeta = PT_STATUS_META[booking.status];
                    const canCancel = ACTIVE_PT_STATUSES.has(booking.status);
                    const isCancelling = cancellingBookingId === booking.id;

                    return (
                      <div
                        key={booking.id}
                        className="p-4 rounded-xl border border-white/8 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-sm text-white">
                              {booking.trainer_name || 'Assigned Coach'}
                            </span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded border uppercase tracking-wider ${statusMeta.badgeClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          </div>
                          <p className="text-xs text-white/60 font-mono">
                            {formatSessionDateTime(booking.scheduled_at)} • {booking.duration_minutes} mins
                          </p>
                          {(booking.coach_notes || booking.rejection_reason || booking.notes) && (
                            <p className="text-[11px] text-white/50 font-mono">
                              {booking.rejection_reason || booking.coach_notes || booking.notes}
                            </p>
                          )}
                        </div>

                        {canCancel && (
                          <button
                            type="button"
                            disabled={isCancelling}
                            onClick={() => handleCancelBooking(booking)}
                            className="px-3 py-2 rounded-xl text-xs font-mono bg-red/15 text-red border border-red/30 hover:bg-red/25 transition-colors shrink-0 cursor-pointer disabled:opacity-60"
                          >
                            {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* =========================================================================
            CONDITIONAL VIEW: REGISTERED / INACTIVE USER
        ========================================================================= */}
        {viewMode === 'INACTIVE' && (
          <div className="space-y-8 animate-fade-in">
            {/* Membership Activation Steps & Status Notice */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h2 className="text-base font-bold uppercase tracking-tight text-white font-mono">
                      Membership Activation Progress
                    </h2>
                    <p className="text-xs text-white/50">
                      Follow these 3 steps to activate your pass and unlock bookings
                    </p>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {activationStepsCompleted} of 3 Done
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{ width: `${(activationStepsCompleted / 3) * 100}%` }}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  {/* Step 1: Account Created */}
                  <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.03] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-white">DGym athlete account active</p>
                        <p className="text-[11px] font-mono text-white/50 truncate">
                          {profile?.email || user.email}
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 shrink-0">
                      Completed
                    </span>
                  </div>

                  {/* Step 2: Select & Pay Membership Pass */}
                  <div
                    className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isPendingPayment
                        ? 'border-amber-500/35 bg-amber-500/[0.05]'
                        : 'border-white/10 bg-white/[0.02]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white">
                        {isPendingPayment
                          ? 'Verify pending checkout payment'
                          : 'Choose a training pass (Day Pass, Monthly, or Long-Term)'}
                      </p>
                      <p className="text-[11px] font-mono text-white/50 mt-0.5">
                        {isPendingPayment
                          ? 'Your invoice is awaiting payment verification.'
                          : 'Pick a plan below to proceed to secure Xendit checkout.'}
                      </p>
                    </div>
                    <Link
                      to={isPendingPayment ? '/payment' : '/payment?plan=monthly'}
                      className="text-xs font-mono font-bold text-amber-400 hover:underline shrink-0"
                    >
                      {isPendingPayment ? 'Resume Payment →' : 'Go to Checkout →'}
                    </Link>
                  </div>

                  {/* Step 3: Keycard Pairing & Floor Access */}
                  <div className="p-3.5 rounded-xl border border-white/10 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-mono text-white/80">
                        Collect NFC smart keycard at reception &amp; book floor classes
                      </p>
                      <p className="text-[11px] font-mono text-white/45 mt-0.5">
                        Available immediately once your pass status turns Active.
                      </p>
                    </div>
                    <Link
                      to="/trainers"
                      className="text-xs font-mono text-white/60 hover:text-white transition-colors shrink-0"
                    >
                      Meet Coaches →
                    </Link>
                  </div>
                </div>
              </div>

              {/* Status Notice Card */}
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-6 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>{isPendingPayment ? 'PAYMENT PENDING' : 'NO ACTIVE PASS'}</span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    {isPendingPayment ? 'Checkout Awaiting Verification' : 'Ready to Start Training?'}
                  </h3>
                  <p className="text-xs text-white/65 mt-1 leading-relaxed">
                    {isPendingPayment
                      ? 'Your checkout invoice is pending confirmation. Resume payment verification to activate your NFC smart keycard and gym access.'
                      : 'Your athlete profile is registered at our Rosario facility. Choose a pass below to unlock NFC smart keycard access, lockers, and coaching sessions.'}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/8 text-[11px] font-mono space-y-1">
                  <p className="text-white/50 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-white/40" />
                    Facility Hours:
                  </p>
                  <p className="text-white">{GYM_INFO.operatingHoursSummary}</p>
                </div>
              </div>
            </div>

            {/* Pricing Grid */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight text-white font-mono">
                  Select a Training Pass
                </h2>
                <p className="text-xs text-white/50">
                  Automatic membership activation upon payment
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {PUBLIC_PLANS.map((plan) => (
                  <div
                    key={plan.slug}
                    className={`rounded-2xl border p-6 flex flex-col justify-between space-y-5 transition-all ${
                      plan.highlight
                        ? 'border-red/40 bg-gradient-to-b from-red/10 to-[#0d0d11] shadow-[0_0_20px_rgba(229,32,26,0.15)]'
                        : 'border-white/10 bg-[#0d0d11] hover:border-white/20'
                    }`}
                  >
                    <div>
                      {plan.badge && (
                        <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-widest bg-red/20 text-red border border-red/30 mb-3">
                          {plan.badge}
                        </span>
                      )}
                      <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                      <div className="mt-2 flex items-baseline gap-1.5">
                        <span className="text-3xl font-black font-mono text-white">
                          {plan.priceFormatted}
                        </span>
                        <span className="text-xs font-mono text-white/50">{plan.period}</span>
                      </div>
                      <p className="text-xs text-white/65 mt-2 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => navigate(`/payment?plan=${encodeURIComponent(plan.slug)}`)}
                      className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        plan.highlight
                          ? 'bg-red hover:bg-red-hover text-white shadow-md'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      Avail This Plan
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Locked Group Conditioning Preview (Official Schedule) */}
            <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-white/50" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/75 font-mono">
                    Complimentary Evening Classes (Pass Required)
                  </h3>
                </div>
                <span className="text-xs font-mono text-amber-400">Included with Membership</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-70">
                {OFFICIAL_GROUP_CLASSES.map((cls) => (
                  <div
                    key={cls.classType}
                    className="p-4 rounded-xl border border-white/8 bg-white/[0.02] space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-sm text-white">{cls.name}</p>
                      <span className="text-[11px] font-mono text-emerald-400">{cls.rateLabel}</span>
                    </div>
                    <p className="text-xs text-white/55 font-mono">
                      {cls.coachName} • {cls.scheduleTime}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
