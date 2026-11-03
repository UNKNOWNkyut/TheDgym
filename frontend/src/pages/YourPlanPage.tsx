import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  Activity,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  Plus,
  RotateCcw,
  Scale,
  Search,
  Sparkles,
  Trash2,
  User,
  Utensils,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SEO } from '@/components/ui/SEO';
import { QuarterRing } from '@/components/ui/quarter-ring';
import { ExerciseLibrarySection } from '@/components/plan/ExerciseLibrarySection';
import {
  AddExerciseToRoutineModal,
  ExerciseDetailModal,
  MembershipRequiredModal,
} from '@/components/plan/PlanModals';
import { PlanOnboardingWizard } from '@/components/plan/PlanOnboardingWizard';
import {
  buildInitialDailyRoutines,
  buildWeeklyWorkoutSplit,
  calculatePlanMetrics,
  cleanExerciseName,
  DEFAULT_PLAN_DRAFT,
  draftFromSavedPlan,
  getBmiMarkerPercent,
  getBmiStatus,
  GOAL_STRATEGY_LABEL,
  MEAL_BLUEPRINT,
  RECOVERY_PILLARS,
  resolveUserStorageKey,
  toRoutineExercise,
  type ExerciseItem,
  type ExperienceType,
  type FocusArea,
  type GoalType,
  type PlanDraft,
  type RoutineExercise,
  type UserPlanData,
} from '@/components/plan/planUtils';

export type {
  ExerciseItem,
  ExperienceType,
  FocusArea,
  GoalType,
  RoutineExercise,
  UserPlanData,
};

type PlanTabId = 'workout' | 'nutrition' | 'library';

interface InitialHydratedPlanState {
  userPlan: UserPlanData | null;
  draft: PlanDraft;
  wizardStep: number;
  isWizardOpen: boolean;
  showMembershipModal: boolean;
  savedRoutines: Record<number, RoutineExercise[]> | null;
}

// Load Saved Plan & Routines from user-specific localStorage key
function readHydratedPlanState(
  planStorageKey: string,
  routinesStorageKey: string,
  isVerifiedMember: boolean
): InitialHydratedPlanState {
  try {
    const saved = localStorage.getItem(planStorageKey);
    const rawRoutines = localStorage.getItem(routinesStorageKey);
    const savedRoutines = rawRoutines
      ? (JSON.parse(rawRoutines) as Record<number, RoutineExercise[]>)
      : null;

    if (saved) {
      const parsed = JSON.parse(saved) as UserPlanData;
      // Unsubscribed user who already completed Personalization:
      // Go directly to the "Membership Plan Required" prompt instead of repeating Step 1!
      return {
        userPlan: parsed,
        draft: draftFromSavedPlan(parsed),
        wizardStep: isVerifiedMember ? 1 : 9,
        isWizardOpen: false,
        showMembershipModal: !isVerifiedMember,
        savedRoutines,
      };
    }

    // First time entering Your Plan for this user: prompt wizard automatically
    return {
      userPlan: null,
      draft: DEFAULT_PLAN_DRAFT,
      wizardStep: 1,
      isWizardOpen: true,
      showMembershipModal: false,
      savedRoutines,
    };
  } catch {
    return {
      userPlan: null,
      draft: DEFAULT_PLAN_DRAFT,
      wizardStep: 1,
      isWizardOpen: true,
      showMembershipModal: false,
      savedRoutines: null,
    };
  }
}

export function YourPlanPage() {
  const { user } = useAuth();
  const location = useLocation();

  // Exercise Library & Selected Exercise for Modal Preview
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loadingExercises, setLoadingExercises] = useState<boolean>(true);

  // Fetch exercises dataset
  useEffect(() => {
    let isMounted = true;
    const fetchDataset = async () => {
      try {
        const res = await fetch('/assets/exercises/exercises.json');
        if (!res.ok) throw new Error('Failed to load exercises');
        const data = (await res.json()) as ExerciseItem[];
        if (isMounted) setExercises(data);
      } catch (e) {
        console.error('Could not load exercises dataset', e);
      } finally {
        if (isMounted) setLoadingExercises(false);
      }
    };
    fetchDataset();
    return () => {
      isMounted = false;
    };
  }, []);

  // Strict role guarding: Admins always route to /manage, Trainers always route to /dashboard
  if (user?.role === 'admin') return <Navigate to="/manage" replace />;
  if (user?.role === 'trainer') return <Navigate to="/dashboard" replace />;

  // Multi-user isolated storage keys
  const userKey = resolveUserStorageKey(user);
  const planStorageKey = `dgym_user_plan_${userKey}`;
  const routinesStorageKey = `dgym_user_routines_${userKey}`;

  // Membership status check
  const isStaff = user?.role === 'staff';
  const isVerifiedMember =
    isStaff || Boolean(user?.has_active_membership) || user?.membership_status === 'active';

  return (
    <YourPlanWorkspace
      key={`${planStorageKey}:${isVerifiedMember}:${location.key}`}
      userFullName={user?.full_name}
      isVerifiedMember={isVerifiedMember}
      planStorageKey={planStorageKey}
      routinesStorageKey={routinesStorageKey}
      exercises={exercises}
      loadingExercises={loadingExercises}
    />
  );
}

interface YourPlanWorkspaceProps {
  userFullName?: string | null;
  isVerifiedMember: boolean;
  planStorageKey: string;
  routinesStorageKey: string;
  exercises: ExerciseItem[];
  loadingExercises: boolean;
}

function YourPlanWorkspace({
  userFullName,
  isVerifiedMember,
  planStorageKey,
  routinesStorageKey,
  exercises,
  loadingExercises,
}: YourPlanWorkspaceProps) {
  const navigate = useNavigate();

  const [initial] = useState<InitialHydratedPlanState>(() =>
    readHydratedPlanState(planStorageKey, routinesStorageKey, isVerifiedMember)
  );

  // Wizard state: 1 to 7 (Data inputs), 8 (Tailoring Animation), 9 (Custom Setup Bento)
  const [wizardStep, setWizardStep] = useState<number>(initial.wizardStep);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(initial.isWizardOpen);
  const [showMembershipModal, setShowMembershipModal] = useState<boolean>(initial.showMembershipModal);

  // Form inputs & Saved Active Plan
  const [draft, setDraft] = useState<PlanDraft>(initial.draft);
  const [userPlan, setUserPlan] = useState<UserPlanData | null>(initial.userPlan);

  // User-customized daily workout routines: Record<dayNumber, RoutineExercise[]>
  const [customRoutines, setCustomRoutines] = useState<Record<number, RoutineExercise[]> | null>(
    initial.savedRoutines
  );

  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewExercise, setPreviewExercise] = useState<ExerciseItem | null>(null);
  const [addingExerciseToRoutine, setAddingExerciseToRoutine] = useState<ExerciseItem | null>(null);
  const [isStartingNow, setIsStartingNow] = useState<boolean>(false);
  const [addedToastMessage, setAddedToastMessage] = useState<string | null>(null);

  // Active Tab in Plan View ('workout' | 'nutrition' | 'library')
  const [activePlanTab, setActivePlanTab] = useState<PlanTabId>('workout');

  const patchDraft = (patch: Partial<PlanDraft>) =>
    setDraft((prev) => ({ ...prev, ...patch }));

  // Calculate Metrics: Age, BMI, Estimated 1RM, Calorie Target
  const calculatedMetrics = useMemo(() => calculatePlanMetrics(draft), [draft]);

  // Filter 7-day personalized workout split based on user plan focus
  const weeklyWorkoutSplit = useMemo(
    () => buildWeeklyWorkoutSplit(draft.selectedFocus, draft.frequency),
    [draft.selectedFocus, draft.frequency]
  );

  // Seed default daily routines when exercises are loaded if not customized yet
  const defaultRoutines = useMemo(
    () => buildInitialDailyRoutines(exercises, weeklyWorkoutSplit),
    [exercises, weeklyWorkoutSplit]
  );

  const dailyRoutines =
    customRoutines && Object.keys(customRoutines).length > 0 ? customRoutines : defaultRoutines;

  // Save initial defaults to user's storage when not customized yet
  useEffect(() => {
    if (customRoutines && Object.keys(customRoutines).length > 0) return;
    if (Object.keys(defaultRoutines).length === 0) return;
    try {
      localStorage.setItem(routinesStorageKey, JSON.stringify(defaultRoutines));
    } catch (e) {
      console.error(e);
    }
  }, [customRoutines, defaultRoutines, routinesStorageKey]);

  // Toggle body focus area
  const handleToggleFocus = (part: FocusArea) => {
    setDraft((prev) => {
      if (part === 'full body') {
        return {
          ...prev,
          selectedFocus: prev.selectedFocus.includes('full body') ? ['chest', 'shoulder'] : ['full body'],
        };
      }
      const filtered = prev.selectedFocus.filter((p) => p !== 'full body');
      if (filtered.includes(part)) {
        const next = filtered.filter((p) => p !== part);
        return { ...prev, selectedFocus: next.length > 0 ? next : ['chest'] };
      }
      return { ...prev, selectedFocus: [...filtered, part] };
    });
  };

  // Convert weight
  const displayWeight = draft.weightUnit === 'kg' ? draft.weightKg : Math.round(draft.weightKg * 2.20462);
  const handleWeightChange = (newVal: number) => {
    patchDraft({ weightKg: draft.weightUnit === 'kg' ? newVal : Math.round(newVal / 2.20462) });
  };

  // Persist personalized plan setup to user-specific localStorage
  const persistPlanData = (): UserPlanData => {
    const newPlan: UserPlanData = {
      birthDate: { day: draft.birthDay, month: draft.birthMonth, year: draft.birthYear },
      weightUnit: draft.weightUnit,
      weight: draft.weightKg,
      heightUnit: draft.heightUnit,
      height: draft.heightCm,
      goal: draft.goal,
      experience: draft.experience,
      focusAreas: draft.selectedFocus,
      frequency: draft.frequency,
      createdAt: new Date().toISOString(),
    };
    setUserPlan(newPlan);
    try {
      localStorage.setItem(planStorageKey, JSON.stringify(newPlan));
    } catch (err) {
      console.error('Failed to save user plan', err);
    }
    return newPlan;
  };

  // Guard Start Now: Registered users without active membership cannot proceed into dashboard
  const handleStartNowClick = async () => {
    // Always save the user's completed Personalization so they never have to repeat Steps 1-7
    persistPlanData();
    if (!isVerifiedMember) {
      setIsWizardOpen(false);
      setShowMembershipModal(true);
      return;
    }
    setIsStartingNow(true);
    await new Promise((resolve) => setTimeout(resolve, 850));
    persistPlanData();
    setIsWizardOpen(false);
    setIsStartingNow(false);
  };

  // Close floating Personalization / Membership Required modals
  const handleCloseFloatingPrompt = () => {
    setIsWizardOpen(false);
    setShowMembershipModal(false);
    if (!isVerifiedMember || !userPlan) navigate('/dashboard');
  };

  // Helper to persist daily routines updates
  const saveDailyRoutines = (updated: Record<number, RoutineExercise[]>) => {
    setCustomRoutines(updated);
    try {
      localStorage.setItem(routinesStorageKey, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save daily routines to localStorage', err);
    }
  };

  // Toggle Done state for an exercise card in a scheduled workout day
  const handleToggleDone = (dayNumber: number, exerciseId: string) => {
    const updatedDay = (dailyRoutines[dayNumber] || []).map((ex) =>
      ex.id === exerciseId ? { ...ex, isDone: !ex.isDone } : ex
    );
    saveDailyRoutines({ ...dailyRoutines, [dayNumber]: updatedDay });
  };

  // Delete exercise card from a scheduled workout day routine
  const handleDeleteExercise = (dayNumber: number, exerciseId: string) => {
    const updatedDay = (dailyRoutines[dayNumber] || []).filter((ex) => ex.id !== exerciseId);
    saveDailyRoutines({ ...dailyRoutines, [dayNumber]: updatedDay });
  };

  // Add exercise card to a scheduled workout day routine (from 3D library or detail modal)
  const handleAddExerciseToDay = (dayNumber: number, ex: ExerciseItem) => {
    const targetDay = weeklyWorkoutSplit.find((d) => d.dayNumber === dayNumber);
    if (!targetDay || targetDay.isRest) {
      alert('Cannot add exercise to a rest day.');
      return;
    }

    const currentDayExercises = dailyRoutines[dayNumber] || [];
    if (currentDayExercises.some((item) => item.id === ex.id)) {
      setAddedToastMessage(`"${cleanExerciseName(ex.name)}" is already in ${targetDay.dayName}.`);
      setTimeout(() => setAddedToastMessage(null), 3000);
      return;
    }

    saveDailyRoutines({
      ...dailyRoutines,
      [dayNumber]: [...currentDayExercises, toRoutineExercise(ex)],
    });
    setAddedToastMessage(`Added "${cleanExerciseName(ex.name)}" to ${targetDay.dayName}!`);
    setTimeout(() => setAddedToastMessage(null), 3000);
  };

  const bmiStatus = getBmiStatus(calculatedMetrics.bmi);
  const bmiMarkerPct = getBmiMarkerPercent(calculatedMetrics.bmi);

  const tabItems: { id: PlanTabId; label: string; icon: typeof Dumbbell }[] = [
    { id: 'workout', label: '7-Day Workout Split', icon: Dumbbell },
    { id: 'nutrition', label: 'Personalized Meal Plan', icon: Utensils },
    { id: 'library', label: `3D Workout Demos (${exercises.length})`, icon: Search },
  ];

  const macroCards = [
    { label: 'Protein', value: `${calculatedMetrics.proteinGrams}g`, sub: 'Muscle repair', color: 'text-emerald-400' },
    { label: 'Carbs', value: `${calculatedMetrics.carbGrams}g`, sub: 'Training fuel', color: 'text-amber-400' },
    { label: 'Fats', value: `${calculatedMetrics.fatGrams}g`, sub: 'Hormone support', color: 'text-blue-400' },
  ];

  return (
    <>
      <SEO
        title="Your Plan — The DGym"
        description="Your personalized fitness program, 3D animated exercises, and macro nutrition plan."
      />

      {isVerifiedMember && userPlan ? (
        <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in text-white">
          {/* HEADER & QUICK ACTIONS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-red/10 text-red border border-red/20">
                  ATHLETE PROGRAM
                </span>
                <span className="text-xs font-mono text-white/40">
                  {userFullName ? `Prepared for ${userFullName}` : 'Customized Performance Routine'}
                </span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <span>Your Plan</span>
                <Sparkles className="w-6 h-6 text-red animate-pulse" />
              </h1>
              <p className="text-sm text-white/50 mt-1 max-w-2xl">
                {`${userPlan.goal} • ${userPlan.frequency} Days / Week • Focus on ${userPlan.focusAreas.map((f) => f.toUpperCase()).join(', ')}`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => { setWizardStep(1); setIsWizardOpen(true); }}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono font-bold uppercase tracking-wider text-white transition-all cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-red" />
                <span>Re-calibrate Plan</span>
              </button>
            </div>
          </div>

          {/* BENTO SNAPSHOT HERO CARDS (Weight Trend, BMI Gauge, Macro Targets) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1: Your Weight Projection Line */}
            <div className="rounded-2xl border border-white/10 bg-surface p-6 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
                  <Scale className="w-4 h-4 text-red" />
                  Your Weight
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {GOAL_STRATEGY_LABEL[userPlan.goal]}
                </span>
              </div>

              <div>
                <div className="flex items-baseline gap-3">
                  <span className="text-3xl font-black font-mono text-white">
                    {displayWeight} {userPlan.weightUnit}
                  </span>
                  <span className="text-xs font-mono text-white/50">
                    Target: <strong className="text-emerald-400">{calculatedMetrics.projectedW4Weight} {userPlan.weightUnit}</strong>
                  </span>
                </div>
                <p className="text-xs text-white/40 mt-1 font-mono">
                  4-Week Projected Trajectory (Healthy {userPlan.goal === 'Fat Loss' ? '-3.5 kg' : '+1.8 kg'})
                </p>
              </div>

              {/* Sloping Gradient Line Chart (Today to Week 4) */}
              <div className="pt-2">
                <div className="relative h-20 w-full flex items-end">
                  <svg viewBox="0 0 300 70" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                    <defs>
                      <linearGradient id="weightGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#ef4444" />
                        <stop offset="100%" stopColor="#10b981" />
                      </linearGradient>
                    </defs>
                    {/* Trendline */}
                    <path
                      d={userPlan.goal === 'Fat Loss' ? 'M 10 15 Q 150 35 290 55' : 'M 10 55 Q 150 35 290 15'}
                      fill="none"
                      stroke="url(#weightGrad)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {/* Today Marker */}
                    <circle cx="10" cy={userPlan.goal === 'Fat Loss' ? '15' : '55'} r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                    {/* Week 4 Marker */}
                    <circle cx="290" cy={userPlan.goal === 'Fat Loss' ? '55' : '15'} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                  </svg>
                </div>
                <div className="flex items-center justify-between text-[11px] font-mono text-white/40 border-t border-white/10 pt-2 mt-1">
                  <span className="text-red font-semibold">Today</span>
                  <span>Week 2</span>
                  <span className="text-emerald-400 font-semibold">Week 4 Goal</span>
                </div>
              </div>
            </div>

            {/* Bento Card 2: About You & BMI Gauge */}
            <div className="rounded-2xl border border-white/10 bg-surface p-6 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
                  <User className="w-4 h-4 text-red" />
                  About You
                </span>
                <span className="text-[11px] font-mono text-white/50">{calculatedMetrics.age} Years Old</span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 border-y border-white/8 text-center font-mono">
                <div>
                  <p className="text-[10px] text-white/40 uppercase">Height</p>
                  <p className="text-sm font-bold text-white mt-0.5">{draft.heightCm} cm</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase">Weight</p>
                  <p className="text-sm font-bold text-white mt-0.5">{draft.weightKg} kg</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase">Est. 1RM</p>
                  <p className="text-sm font-bold text-emerald-400 mt-0.5">{calculatedMetrics.estimatedBench1RM} kg</p>
                </div>
              </div>

              {/* BMI Gradient Line with White Circle Marker */}
              <div>
                <div className="flex items-center justify-between text-xs font-mono mb-2">
                  <span className="text-white/50">BMI Metric</span>
                  <span className="font-bold text-white">
                    {calculatedMetrics.bmi} • <span className={bmiStatus.colorClass}>{bmiStatus.label}</span>
                  </span>
                </div>

                {/* Horizontal Gradient Bar */}
                <div className="relative w-full h-3.5 rounded-full overflow-hidden bg-white/5 shadow-inner">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{ background: 'linear-gradient(to right, #3b82f6 0%, #10b981 35%, #f59e0b 70%, #ef4444 100%)' }}
                  />
                  {/* White Circle Marker positioned at percentage */}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-black shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all pointer-events-none"
                    style={{ left: `calc(${bmiMarkerPct}% - 8px)` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[10px] font-mono text-white/40 mt-1.5">
                  <span className="text-blue-400">Underweight</span>
                  <span className="text-emerald-400">Normal</span>
                  <span className="text-amber-400">Overweight</span>
                </div>
              </div>
            </div>

            {/* Bento Card 3: Daily Nutrition Blueprint */}
            <div className="rounded-2xl border border-white/10 bg-surface p-6 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
                  <Utensils className="w-4 h-4 text-red" />
                  Daily Nutrition
                </span>
                <span className="text-xs font-mono font-bold text-red">{calculatedMetrics.targetCalories} kcal / day</span>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono">
                {macroCards.map((macro) => (
                  <div key={macro.label} className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                    <p className="text-[10px] text-white/40 uppercase">{macro.label}</p>
                    <p className={`text-base font-black ${macro.color} mt-1`}>{macro.value}</p>
                    <p className="text-[9px] text-white/30">{macro.sub}</p>
                  </div>
                ))}
              </div>

              <div className="text-xs font-mono text-white/50 flex items-center justify-between border-t border-white/8 pt-3">
                <span>Meal Schedule:</span>
                <span className="text-white font-semibold">4 High-Protein Meals</span>
              </div>
            </div>
          </div>

          {/* MAIN CONTENT TABS (Workout Split | Meal Plan | Exercise Library 3D) */}
          <div className="space-y-6">
            {/* Tab Selector Buttons */}
            <div className="flex items-center gap-2 border-b border-white/10 pb-4">
              {tabItems.map((tab) => {
                const Icon = tab.icon;
                const isActive = activePlanTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActivePlanTab(tab.id)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                      isActive ? 'bg-red text-white shadow-[0_0_15px_rgba(239,68,68,0.35)]' : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* TAB 1: 7-DAY WORKOUT SPLIT */}
            {activePlanTab === 'workout' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h2 className="font-display text-xl font-black uppercase text-white">Weekly Training Blueprint</h2>
                    <p className="text-xs text-white/50 font-mono mt-0.5">
                      Click any exercise card to view the 3D animated GIF execution demo and form cues.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {weeklyWorkoutSplit.map((day) => {
                    const dayRoutine = dailyRoutines[day.dayNumber] || [];
                    return (
                      <div
                        key={day.dayNumber}
                        className={`rounded-2xl p-5 transition-all flex flex-col justify-between ${
                          day.isRest ? 'border-2 border-white/20 bg-white/[0.03] shadow-inner' : 'border border-white/10 bg-surface hover:border-red/30'
                        }`}
                      >
                        <div>
                          {/* Day Header */}
                          <div className="flex items-center justify-between pb-3 border-b border-white/8 mb-3">
                            <span className="text-xs font-mono font-bold text-white/50 uppercase">{day.dayName}</span>
                            <span
                              className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                                day.isRest ? 'bg-white/5 text-white/50 border border-white/10' : 'bg-red/10 text-red border border-red/20'
                              }`}
                            >
                              {day.intensity}
                            </span>
                          </div>

                          <h3 className="font-bold text-base text-white font-mono mb-1">{day.focusTitle}</h3>
                          <p className="text-xs text-white/40 font-mono mb-4 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            <span>{day.duration}</span>
                          </p>

                          {/* Exercises List (Customizable Routine) */}
                          {!day.isRest ? (
                            <div className="space-y-2.5">
                              {dayRoutine.length > 0 ? (
                                dayRoutine.map((ex, idx) => (
                                  <div
                                    key={ex.id}
                                    className={`group p-3 rounded-xl border transition-all flex flex-col gap-2.5 ${
                                      ex.isDone
                                        ? 'border-2 border-emerald-500 bg-emerald-500/10 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
                                        : 'border-white/10 bg-background/50 hover:bg-white/5 hover:border-white/20'
                                    }`}
                                  >
                                    {/* Upper Row: Image & Info & Delete */}
                                    <div className="flex items-start justify-between gap-3">
                                      <div
                                        onClick={() =>
                                          setPreviewExercise({
                                            id: ex.id,
                                            name: ex.name,
                                            category: ex.category,
                                            body_part: ex.body_part,
                                            equipment: ex.equipment,
                                            instructions: ex.instructions || '',
                                            instruction_steps: ex.instruction_steps || [],
                                            gif_filename: '',
                                            gif_url: ex.gif_url,
                                          })
                                        }
                                        className="flex items-center gap-3 min-w-0 cursor-pointer flex-1"
                                      >
                                        <div className="w-11 h-11 rounded-lg bg-black/60 border border-white/10 overflow-hidden shrink-0 flex items-center justify-center">
                                          <img src={ex.gif_url} alt={ex.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform" loading="lazy" />
                                        </div>
                                        <div className="min-w-0">
                                          <p className={`text-xs font-bold capitalize truncate transition-colors ${ex.isDone ? 'text-emerald-300' : 'text-white group-hover:text-red'}`}>
                                            {idx + 1}. {cleanExerciseName(ex.name)}
                                          </p>
                                          <p className="text-[10px] text-white/40 font-mono capitalize">{ex.body_part} • {ex.equipment}</p>
                                        </div>
                                      </div>

                                      {/* Delete from routine button */}
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteExercise(day.dayNumber, ex.id)}
                                        className="p-1.5 rounded-lg border border-white/5 hover:border-red/40 bg-white/5 hover:bg-red/15 text-white/40 hover:text-red transition-all cursor-pointer shrink-0"
                                        title="Delete exercise from this workout"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>

                                    {/* Bottom Row: Sets & Reps + Done Button */}
                                    <div className="flex items-center justify-between border-t border-white/5 pt-2">
                                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                        {ex.sets} Sets × {ex.reps}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleDone(day.dayNumber, ex.id)}
                                        className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                                          ex.isDone ? 'bg-emerald-500 text-black shadow-md' : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
                                        }`}
                                      >
                                        {ex.isDone ? (
                                          <>
                                            <Check className="w-3 h-3 stroke-[3]" />
                                            <span>Done</span>
                                          </>
                                        ) : (
                                          <span>Mark Done</span>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                ))
                              ) : (
                                <div className="py-6 text-center text-xs text-white/40 font-mono border border-dashed border-white/10 rounded-xl p-4 space-y-1">
                                  <p>No exercises scheduled for this day.</p>
                                  <p className="text-[10px] text-white/30">Add exercises from the 3D Workout Demos library below.</p>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="py-3 space-y-2.5">
                              <div className="flex items-center gap-2 pb-2 border-b border-white/8">
                                <Activity className="w-4 h-4 text-emerald-400" />
                                <span className="text-xs font-mono font-bold text-white uppercase">Rest &amp; Deep Muscle Recovery</span>
                              </div>
                              <div className="space-y-1.5">
                                {RECOVERY_PILLARS.map((pillar) => (
                                  <div key={pillar.title} className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                                    <span className="text-sm leading-none shrink-0 mt-0.5">{pillar.icon}</span>
                                    <div>
                                      <p className="text-[11px] font-bold text-white font-mono">{pillar.title}</p>
                                      <p className="text-[9px] text-white/50 font-mono">{pillar.subtitle}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {!day.isRest && (
                          <div className="pt-4 border-t border-white/8 mt-4 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => { setSelectedCategory(day.targetCategory); setActivePlanTab('library'); }}
                              className="flex-1 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-[11px] font-mono transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5 text-red" />
                              <span>Add from 3D Library</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: PERSONALIZED MEAL PLAN */}
            {activePlanTab === 'nutrition' && (
              <div className="space-y-6">
                <div>
                  <h2 className="font-display text-xl font-black uppercase text-white">Targeted Nutrition Blueprint</h2>
                  <p className="text-xs text-white/50 font-mono mt-0.5">
                    Calibrated to your {draft.goal} target ({calculatedMetrics.targetCalories} kcal / day).
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {MEAL_BLUEPRINT.map((meal) => (
                    <div key={meal.badge} className="rounded-2xl border border-white/10 bg-surface p-6 space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-white/8">
                        <span className={`text-xs font-mono font-bold uppercase ${meal.badgeColor}`}>{meal.badge}</span>
                        <span className="text-xs font-mono text-white/50 font-bold">{meal.calories}</span>
                      </div>
                      <h3 className="font-bold text-base text-white">{meal.title}</h3>
                      <ul className="text-xs text-white/60 space-y-2 font-mono">
                        {meal.items.map((item) => (
                          <li key={item} className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-red" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-white/70 flex justify-between">
                        <span>Protein: {meal.macros.protein}</span>
                        <span>Carbs: {meal.macros.carbs}</span>
                        <span>Fats: {meal.macros.fats}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: 3D WORKOUT DEMOS LIBRARY */}
            {activePlanTab === 'library' && (
              <ExerciseLibrarySection
                exercises={exercises}
                loadingExercises={loadingExercises}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                onPreviewExercise={setPreviewExercise}
                onPromptAddExercise={setAddingExerciseToRoutine}
              />
            )}
          </div>
        </div>
      ) : (
        <div className="min-h-[80vh]" />
      )}

      <ExerciseDetailModal
        exercise={previewExercise}
        weeklyWorkoutSplit={weeklyWorkoutSplit}
        onClose={() => setPreviewExercise(null)}
        onAddExerciseToDay={handleAddExerciseToDay}
      />

      <PlanOnboardingWizard
        open={isWizardOpen}
        wizardStep={wizardStep}
        onChangeStep={setWizardStep}
        onClose={handleCloseFloatingPrompt}
        draft={draft}
        onPatchDraft={patchDraft}
        onToggleFocus={handleToggleFocus}
        displayWeight={displayWeight}
        onChangeWeightDisplay={handleWeightChange}
        calculatedMetrics={calculatedMetrics}
        onGeneratePlan={() => { persistPlanData(); setWizardStep(8); }}
        onStartNow={handleStartNowClick}
      />

      <MembershipRequiredModal
        open={showMembershipModal}
        goal={draft.goal}
        frequency={draft.frequency}
        selectedFocus={draft.selectedFocus}
        onClose={handleCloseFloatingPrompt}
        onReviewSetup={() => {
          setShowMembershipModal(false);
          setWizardStep(9);
          setIsWizardOpen(true);
        }}
      />

      {/* TOAST NOTIFICATION FOR ADDED EXERCISES */}
      {addedToastMessage && (
        <div className="fixed bottom-6 right-6 z-[100001] flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-zinc-900 border border-emerald-500/40 text-white text-xs font-mono shadow-2xl animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{addedToastMessage}</span>
          <button
            type="button"
            onClick={() => setAddedToastMessage(null)}
            className="text-white/40 hover:text-white ml-1 cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      <AddExerciseToRoutineModal
        exercise={addingExerciseToRoutine}
        weeklyWorkoutSplit={weeklyWorkoutSplit}
        onClose={() => setAddingExerciseToRoutine(null)}
        onSelectDay={handleAddExerciseToDay}
      />

      {/* LOADING SCREEN ON "START NOW" */}
      {isStartingNow && (
        <div className="fixed inset-0 z-[100005] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <img src="/assets/logos/thedgym.png" alt="The DGym" className="mb-8 h-12 w-auto object-contain" />
          <QuarterRing className="h-14 w-14 text-red" />
          <p className="mt-6 text-sm uppercase tracking-[0.25em] font-mono text-white/80 font-bold">
            Calibrating Your Athlete Dashboard
          </p>
          <p className="mt-2 text-xs font-mono text-white/40">
            Building your 7-day personalized training blueprint...
          </p>
        </div>
      )}
    </>
  );
}

export default YourPlanPage;
