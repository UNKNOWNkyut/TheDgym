import React, { useState, useMemo, useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Calendar,
  Settings,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Lock,
  QrCode,
  Flame,
  Dumbbell,
  Clock,
  Check,
  X,
  ShieldAlert,
  CreditCard,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SEO } from '@/components/ui/SEO';
import { TrainerDashboard } from '@/components/dashboard/TrainerDashboard';

interface GroupClass {
  id: string;
  name: string;
  schedule: string;
  instructor: string;
  capacity: number;
  bookedCount: number;
  isReserved: boolean;
}

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export function DashboardPage() {
  void React;
  const { user, logout } = useAuth();

  // If Admin is logged in, redirect to Management Hub
  if (user?.role === 'admin') {
    return <Navigate to="/manage" replace />;
  }

  // If Trainer is logged in, render the dedicated Trainer Command Center
  if (user?.role === 'trainer') {
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

  // Derive viewMode directly from user's active membership status
  const viewMode: 'ACTIVE' | 'INACTIVE' = user?.has_active_membership ? 'ACTIVE' : 'INACTIVE';

  // Modals & Popovers State
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPlanForPayment, setSelectedPlanForPayment] = useState<string | null>(null);
  const [paymentCopiedToast, setPaymentCopiedToast] = useState(false);

  // Rotating Gate Pass PIN
  const [pinCode, setPinCode] = useState('849-201');

  // Mock Users paired with viewMode
  const mockUsers = useMemo(
    () => ({
      ACTIVE: {
        id: 1,
        name: 'Alex Cruz',
        email: 'alex.cruz@example.com',
        phone: '+63 917 555 0192',
        emergencyContact: 'Elena Cruz (+63 918 222 3344)',
        roleBadge: 'ACTIVE MEMBER',
        membershipPlan: 'Monthly Unlimited Barbell Access',
        daysRemaining: 18,
        totalPlanDays: 30,
        attendanceStreak: '12 Visits • 3-Week Consistency Streak',
        coachingCreditsRemaining: 4,
        totalCoachingCredits: 10,
        gatePassStatus: 'ACCESS GRANTED',
        floorTraffic: 'LOW',
        prs: [
          { lift: 'Squat', weight: '140 kg', date: 'Oct 12' },
          { lift: 'Bench Press', weight: '100 kg', date: 'Oct 04' },
          { lift: 'Deadlift', weight: '180 kg', date: 'Sep 28' },
        ],
      },
      INACTIVE: {
        id: 2,
        name: 'Jordan Ramos',
        email: 'jordan.ramos@example.com',
        phone: '+63 928 444 8819',
        emergencyContact: 'Teresa Ramos (+63 920 111 9988)',
        roleBadge: 'REGISTERED USER',
        membershipPlan: 'No Active Membership Pass',
        daysRemaining: 0,
        totalPlanDays: 0,
        attendanceStreak: '0 Visits • Account Created',
        coachingCreditsRemaining: 0,
        totalCoachingCredits: 0,
        gatePassStatus: 'PASS INACTIVE',
        floorTraffic: 'LOW',
        prs: [],
      },
    }),
    [],
  );

  const currentUserData = useMemo(() => {
    const base = mockUsers[viewMode];
    return {
      ...base,
      name: user?.full_name || base.name,
      email: user?.email || base.email,
    };
  }, [mockUsers, viewMode, user]);

  const userInitials = (currentUserData.name || 'DG')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  // Interactive Group Conditioning Classes (Active member feature)
  const [groupClasses, setGroupClasses] = useState<GroupClass[]>([
    {
      id: 'cls-1',
      name: 'Powerlifting Barbell Club',
      schedule: 'Tuesday & Thursday • 07:00 AM',
      instructor: 'Coach Mark',
      capacity: 12,
      bookedCount: 10,
      isReserved: true,
    },
    {
      id: 'cls-2',
      name: 'Functional Turf Conditioning',
      schedule: 'Wednesday & Friday • 05:30 PM',
      instructor: 'Coach Sarah',
      capacity: 10,
      bookedCount: 6,
      isReserved: false,
    },
    {
      id: 'cls-3',
      name: 'Mobility & Form Assessment Clinic',
      schedule: 'Saturday • 09:00 AM',
      instructor: 'Coach Mark',
      capacity: 8,
      bookedCount: 7,
      isReserved: false,
    },
  ]);

  // Toggle class reservation immutably
  const handleToggleReservation = (classId: string) => {
    setGroupClasses((prev) =>
      prev.map((cls) => {
        if (cls.id === classId) {
          const nextReserved = !cls.isReserved;
          const nextCount = nextReserved
            ? Math.min(cls.capacity, cls.bookedCount + 1)
            : Math.max(0, cls.bookedCount - 1);
          return {
            ...cls,
            isReserved: nextReserved,
            bookedCount: nextCount,
          };
        }
        return cls;
      }),
    );
  };

  // Interactive Onboarding Checklist (Registered User feature)
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: 'chk-1', label: 'Create DGym athlete account', done: true },
    { id: 'chk-2', label: 'Choose a training pass (Day Pass, Monthly, Quarterly)', done: false },
    { id: 'chk-3', label: 'Book complimentary 1-on-1 coach assessment tour', done: false },
  ]);

  const toggleChecklistItem = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, done: !item.done } : item,
      ),
    );
  };

  const completedChecklistCount = checklist.filter((i) => i.done).length;

  // Plan Pricing Data for Registered User
  const pricingPlans = [
    {
      name: 'Day Pass',
      price: '₱150',
      period: 'per visit',
      description: 'Single day full facility pass. Locker room & shower included.',
      highlight: false,
    },
    {
      name: 'Monthly Unlimited',
      price: '₱1,500',
      period: 'per month',
      description: 'Unlimited 24/7 keycard access, free class bookings, 1 free coaching check-in.',
      highlight: true,
      badge: 'Most Popular',
    },
    {
      name: 'Quarterly Athlete',
      price: '₱4,000',
      period: '3 months',
      description: 'Maximum savings with 3 months upfront. Includes 3 personal coaching sessions.',
      highlight: false,
      badge: 'Best Value',
    },
  ];

  // Rotate PIN every 30 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      const randomPin = `${Math.floor(100 + Math.random() * 900)}-${Math.floor(
        100 + Math.random() * 900,
      )}`;
      setPinCode(randomPin);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-[#070709] text-white font-sans antialiased">
      <SEO
        title={`${currentUserData.name} — Member Portal`}
        description="The DGym member dashboard & digital gate pass."
      />

      {/* Top Demo Navigation Bar */}
      <header className="border-b border-white/10 bg-[#0d0d11]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-xs font-mono text-white/50 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Back to Home</span>
            </Link>
            <span className="text-white/20">|</span>
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-white truncate">
              DGym Athlete Portal
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/settings"
              className="text-xs font-mono text-white/50 hover:text-white transition-colors"
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
              className={`w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-black text-lg border shrink-0 ${
                viewMode === 'ACTIVE'
                  ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/15 border-amber-500/30 text-amber-400'
              }`}
            >
              {userInitials}
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
                  {currentUserData.roleBadge}
                </span>
              </div>

              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white truncate">
                Welcome back, {currentUserData.name}
              </h1>

              <p className="text-xs text-white/50 font-mono mt-1">
                {currentUserData.membershipPlan}
              </p>
            </div>
          </div>

          {/* Quick Action in Header */}
          {viewMode === 'ACTIVE' ? (
            <button
              type="button"
              onClick={() => setIsQrModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(229,32,26,0.35)] cursor-pointer self-start sm:self-center"
            >
              <QrCode className="w-4 h-4" />
              <span>Digital Gate Pass QR</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setSelectedPlanForPayment('Monthly Unlimited');
                setIsPaymentModalOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(229,32,26,0.35)] cursor-pointer self-start sm:self-center"
            >
              <CreditCard className="w-4 h-4" />
              <span>Avail Membership Plan</span>
            </button>
          )}
        </div>

        {/* =========================================================================
            CONDITIONAL VIEW: ACTIVE MEMBER (Alex Cruz)
        ========================================================================= */}
        {viewMode === 'ACTIVE' && (
          <div className="space-y-8 animate-fade-in">
            {/* Top Stat Cards: Countdown Bar, Attendance Streak, Coaching Credits */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Pass Countdown Progress Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/40 uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    Pass Validity
                  </span>
                  <span className="text-emerald-400 font-bold">
                    {currentUserData.daysRemaining} Days Left
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-emerald-400 rounded-full transition-all"
                    style={{
                      width: `${(currentUserData.daysRemaining / currentUserData.totalPlanDays) * 100}%`,
                    }}
                  />
                </div>
                <p className="text-[11px] text-white/40 font-mono">
                  Renews on 1st of next month • Auto-renewal active
                </p>
              </div>

              {/* Attendance Streak Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/40 uppercase tracking-wider">Attendance Streak</span>
                  <Flame className="w-4 h-4 text-orange-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  12 Visits
                </p>
                <p className="text-xs text-orange-400 font-mono flex items-center gap-1">
                  <span>🔥 3-Week Consistency Streak</span>
                </p>
              </div>

              {/* Coaching Credits Card */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-5 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-white/40 uppercase tracking-wider">Coaching Credits</span>
                  <Dumbbell className="w-4 h-4 text-blue-400" />
                </div>
                <p className="text-xl sm:text-2xl font-black text-white font-mono">
                  {currentUserData.coachingCreditsRemaining} / {currentUserData.totalCoachingCredits}
                </p>
                <p className="text-xs text-blue-400 font-mono">
                  1-on-1 technique sessions remaining
                </p>
              </div>
            </div>

            {/* Digital Gate Pass Card & Personal Coaching PRs */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Digital Gate Pass Interface (1 col) */}
              <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                    <span className="text-xs font-mono uppercase tracking-widest text-white/50 font-bold">
                      Digital Gate Access
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      ACCESS GRANTED
                    </span>
                  </div>

                  <div className="text-center py-4 space-y-3">
                    <div className="w-28 h-28 mx-auto rounded-2xl bg-white p-2.5 flex items-center justify-center shadow-lg">
                      <QrCode className="w-full h-full text-black" />
                    </div>

                    <div>
                      <p className="text-[10px] uppercase font-mono tracking-widest text-white/40">
                        Rotating Fast-Pass PIN:
                      </p>
                      <p className="text-2xl font-mono font-black tracking-widest text-white">
                        {pinCode}
                      </p>
                      <p className="text-[10px] text-white/30 font-mono mt-0.5">
                        Rotates automatically every 30 seconds
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-white/50">Floor Traffic Status:</span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      LOW CROWD
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsQrModalOpen(true)}
                    className="w-full py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-mono transition-colors text-center flex items-center justify-center gap-1"
                  >
                    <span>View Large Turnstile Pass</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Group Conditioning Reservations & Big 3 PRs (2 cols) */}
              <div className="lg:col-span-2 space-y-6">
                {/* Group Conditioning Reservation Section */}
                <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <div>
                      <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono">
                        Group Conditioning &amp; Class Reservations
                      </h2>
                      <p className="text-xs text-white/40">
                        Exclusive complimentary athlete bookings included in your plan
                      </p>
                    </div>
                    <span className="text-xs font-mono text-emerald-400">
                      {groupClasses.filter((c) => c.isReserved).length} Active Booking
                    </span>
                  </div>

                  <div className="space-y-3">
                    {groupClasses.map((cls) => {
                      const spotsRemaining = Math.max(0, cls.capacity - cls.bookedCount);
                      return (
                        <div
                          key={cls.id}
                          className="p-4 rounded-xl border border-white/5 bg-white/[0.02] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-white">
                                {cls.name}
                              </span>
                              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/5 text-white/60">
                                {cls.instructor}
                              </span>
                            </div>
                            <p className="text-xs text-white/50 font-mono mt-1">
                              {cls.schedule}
                            </p>
                            <p className="text-[11px] text-white/30 font-mono mt-0.5">
                              Capacity: {cls.bookedCount} / {cls.capacity} ({spotsRemaining} spots left)
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggleReservation(cls.id)}
                            className={`px-3 py-2 rounded-xl text-xs font-mono transition-all shrink-0 cursor-pointer ${
                              cls.isReserved
                                ? 'bg-red/20 text-red border border-red/40 hover:bg-red/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/30'
                            }`}
                          >
                            {cls.isReserved ? 'Cancel Reservation' : 'Reserve Spot'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Big 3 Personal Records (PRs) */}
                <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/10">
                    <h2 className="text-sm font-bold uppercase tracking-wider text-white font-mono flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-amber-400" />
                      Verified Powerlifting PRs (Big 3)
                    </h2>
                    <span className="text-xs font-mono text-white/40">Verified by Coach</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {currentUserData.prs.map((pr) => (
                      <div
                        key={pr.lift}
                        className="p-4 rounded-xl border border-white/5 bg-white/[0.02] text-center space-y-1"
                      >
                        <p className="text-xs uppercase font-mono text-white/40">{pr.lift}</p>
                        <p className="text-xl font-mono font-black text-white">{pr.weight}</p>
                        <p className="text-[10px] font-mono text-emerald-400">Logged {pr.date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            CONDITIONAL VIEW: REGISTERED USER (Jordan Ramos)
        ========================================================================= */}
        {viewMode === 'INACTIVE' && (
          <div className="space-y-8 animate-fade-in">
            {/* Onboarding Checklist & Welcome Callout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Onboarding Checklist (2 cols) */}
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div>
                    <h2 className="text-base font-bold uppercase tracking-tight text-white font-mono">
                      Getting Started Checklist
                    </h2>
                    <p className="text-xs text-white/40">
                      Complete these 3 steps to activate your pass and hit the floor
                    </p>
                  </div>
                  <span className="text-xs font-mono text-amber-400 font-bold">
                    {completedChecklistCount} of 3 Completed
                  </span>
                </div>

                <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all"
                    style={{
                      width: `${(completedChecklistCount / checklist.length) * 100}%`,
                    }}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  {checklist.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => toggleChecklistItem(item.id)}
                      className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 cursor-pointer ${
                        item.done
                          ? 'border-emerald-500/20 bg-emerald-500/[0.02]'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-5 h-5 rounded-md flex items-center justify-center border transition-colors ${
                            item.done
                              ? 'bg-emerald-500 border-emerald-500 text-black'
                              : 'border-white/30 bg-white/5'
                          }`}
                        >
                          {item.done && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                        <span
                          className={`text-xs font-mono ${
                            item.done ? 'text-white/80 line-through' : 'text-white'
                          }`}
                        >
                          {item.label}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-white/30">
                        {item.done ? 'Done' : 'Click to toggle'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Notice Card (1 col) */}
              <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-500/10 to-transparent p-6 space-y-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider mb-2">
                    <ShieldAlert className="w-4 h-4" />
                    <span>NO ACTIVE PASS</span>
                  </div>
                  <h3 className="text-base font-bold text-white">
                    Ready to Start Training?
                  </h3>
                  <p className="text-xs text-white/60 mt-1 leading-relaxed">
                    Your athlete profile is registered at our Rosario facility. Choose a pass below to unlock turnstile gate access, lockers, and coaching sessions.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-[11px] font-mono space-y-1">
                  <p className="text-white/40 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-white/30" />
                    Facility Hours:
                  </p>
                  <p className="text-white">Monday - Sunday: 06:00 AM - 10:00 PM</p>
                  <p className="text-emerald-400 pt-1">🟢 Floor Traffic: Currently Low</p>
                </div>
              </div>
            </div>

            {/* Pricing Grid */}
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-bold uppercase tracking-tight text-white font-mono">
                  Select a Training Pass
                </h2>
                <p className="text-xs text-white/40">
                  Instant activation via OTC Cash or GCash counter verification
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {pricingPlans.map((plan) => (
                  <div
                    key={plan.name}
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
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-3xl font-black font-mono text-white">
                          {plan.price}
                        </span>
                        <span className="text-xs font-mono text-white/40">
                          {plan.period}
                        </span>
                      </div>
                      <p className="text-xs text-white/60 mt-2 leading-relaxed">
                        {plan.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPlanForPayment(plan.name);
                        setIsPaymentModalOpen(true);
                      }}
                      className={`w-full py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                        plan.highlight
                          ? 'bg-red hover:bg-red-hover text-white shadow-md'
                          : 'bg-white/10 hover:bg-white/20 text-white'
                      }`}
                    >
                      Avail {plan.name} &rarr;
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Locked Group Conditioning Preview */}
            <div className="rounded-2xl border border-white/10 bg-[#0d0d11] p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-white/40" />
                  <h3 className="text-sm font-bold uppercase tracking-wider text-white/60 font-mono">
                    Group Conditioning Classes (Pass Required)
                  </h3>
                </div>
                <span className="text-xs font-mono text-amber-400">
                  Locked for Non-Members
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 opacity-50 pointer-events-none">
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <p className="font-semibold text-sm text-white">Barbell Club</p>
                  <p className="text-xs text-white/40 font-mono mt-0.5">
                    Tues &amp; Thurs • 07:00 AM
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <p className="font-semibold text-sm text-white">Turf Conditioning</p>
                  <p className="text-xs text-white/40 font-mono mt-0.5">
                    Wed &amp; Fri • 05:30 PM
                  </p>
                </div>
                <div className="p-4 rounded-xl border border-white/5 bg-white/[0.02]">
                  <p className="font-semibold text-sm text-white">Mobility Clinic</p>
                  <p className="text-xs text-white/40 font-mono mt-0.5">
                    Saturday • 09:00 AM
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* =========================================================================
          MODALS & POPOVERS (Pure Tailwind with Strict Escape Hatches)
      ========================================================================= */}

      {/* 1. Large QR Code Gate Pass Modal */}
      {isQrModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsQrModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#111114] p-6 shadow-2xl space-y-5 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <span className="text-xs uppercase font-mono font-bold text-white/60">
                Digital Turnstile Pass
              </span>
              <button
                type="button"
                onClick={() => setIsQrModalOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="w-48 h-48 mx-auto bg-white p-3 rounded-2xl shadow-xl flex items-center justify-center">
              <QrCode className="w-full h-full text-black" />
            </div>

            <div className="space-y-1">
              <p className="text-xs uppercase font-mono tracking-widest text-white/40">
                Athlete Access Code:
              </p>
              <p className="text-3xl font-mono font-black tracking-widest text-white">
                {pinCode}
              </p>
              <p className="text-xs text-emerald-400 font-mono">
                Valid today at Rosario Facility turnstiles
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsQrModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-mono font-bold uppercase transition-colors"
            >
              Close Pass
            </button>
          </div>
        </div>
      )}

      {/* 2. OTC / GCash Pending Payment Verification Modal */}
      {isPaymentModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsPaymentModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111114] p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-red" />
                <h3 className="font-bold text-sm uppercase text-white font-mono">
                  Pending Payment Verification
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/40">Selected Plan:</span>
                <span className="text-white font-bold">{selectedPlanForPayment}</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/40">Transaction Reference:</span>
                <span className="text-emerald-400 font-mono font-bold">DGYM-2026-8841</span>
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-white/40">Status:</span>
                <span className="text-amber-400 font-mono font-bold flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  AWAITING COUNTER OTC
                </span>
              </div>
            </div>

            <div className="text-xs text-white/60 space-y-2 leading-relaxed">
              <p>
                Present this reference code <strong className="text-white">DGYM-2026-8841</strong> at the DGym Rosario front desk, or send GCash payment to our registered merchant:
              </p>
              <div className="p-3 rounded-lg bg-black/40 border border-white/10 font-mono text-[11px] text-white/80 space-y-1">
                <p>GCash Merchant: The DGym Rosario</p>
                <p>Account No.: 0917-882-9912</p>
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentCopiedToast(true);
                  setTimeout(() => setPaymentCopiedToast(false), 2000);
                }}
                className="flex-1 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-mono transition-colors"
              >
                {paymentCopiedToast ? 'Copied Reference!' : 'Copy Reference'}
              </button>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Account Settings Modal (Houses Credentials) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111114] p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-white/60" />
                <h3 className="font-bold text-sm uppercase text-white font-mono">
                  Account Credentials &amp; Profile
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="text-white/40 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                  Full Name
                </label>
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                  {currentUserData.name}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                  Email Address
                </label>
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                  {currentUserData.email}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                  Contact Phone
                </label>
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                  {currentUserData.phone}
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase font-mono text-white/40 mb-1">
                  Emergency Contact
                </label>
                <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-white text-sm">
                  {currentUserData.emergencyContact}
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-white/10 flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(false);
                  logout();
                }}
                className="text-xs text-red hover:underline font-mono"
              >
                Sign Out of Account
              </button>

              <button
                type="button"
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-xs font-mono transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
