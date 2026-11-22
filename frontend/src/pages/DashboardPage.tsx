import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Dumbbell,
  Flame,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SEO } from '@/components/ui/SEO';
import { InactiveMemberPortalView } from '@/components/dashboard/InactiveMemberPortalView';
import { MemberClassesSection } from '@/components/dashboard/MemberClassesSection';
import { TrainerDashboard } from '@/components/dashboard/TrainerDashboard';
import { api } from '@/services/api';
import {
  extractErrorMessage,
  formatScheduleDateTime as formatSessionDateTime,
  getInitials,
} from '@/utils/formatters';
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

        {/* CONDITIONAL VIEW: ACTIVE MEMBER */}
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

            <MemberClassesSection
              groupClasses={groupClasses}
              reservedCount={reservedClasses.length}
              classFeedback={classFeedback}
              isLoadingClasses={isLoadingClasses}
              classesError={classesError}
              togglingClassId={togglingClassId}
              onRetry={handleRetryClasses}
              onToggleReservation={handleToggleReservation}
            />

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

        {/* CONDITIONAL VIEW: REGISTERED / INACTIVE USER */}
        {viewMode === 'INACTIVE' && (
          <InactiveMemberPortalView
            activationStepsCompleted={activationStepsCompleted}
            isPendingPayment={isPendingPayment}
            email={profile?.email || user.email}
            onSelectPlan={(slug) => navigate(`/payment?plan=${encodeURIComponent(slug)}`)}
          />
        )}
      </main>
    </div>
  );
}
