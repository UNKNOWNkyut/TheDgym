import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
import {
  Dumbbell,
  Flame,
  Trophy,
  Check,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  X,
  Sparkles,
  Scale,
  Activity,
  ArrowRight,
  RotateCcw,
  Utensils,
  Info,
  Clock,
  User,
  Trash2,
  Plus,
  Lock,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { SEO } from '@/components/ui/SEO';
import { MuscleVisualizer2D } from '@/components/plan/MuscleVisualizer2D';
import { QuarterRing } from '@/components/ui/quarter-ring';

// Type definitions
export type GoalType = 'Build Muscle' | 'Gain Strength' | 'Fat Loss';
export type ExperienceType = 'Beginner' | 'Intermediate' | 'Advanced';
export type FocusArea = 'back' | 'shoulder' | 'arm' | 'chest' | 'abs' | 'butt' | 'leg' | 'full body';

export interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions: string;
  instruction_steps: string[];
  gif_filename: string;
  gif_url: string;
}

export interface RoutineExercise {
  id: string;
  name: string;
  category: string;
  body_part: string;
  equipment: string;
  instructions?: string;
  instruction_steps?: string[];
  gif_url: string;
  sets: number;
  reps: string;
  isDone: boolean;
}

export interface UserPlanData {
  birthDate: { day: number; month: number; year: number };
  weightUnit: 'kg' | 'lbs';
  weight: number; // stored in kg internally
  heightUnit: 'cm' | 'ft';
  height: number; // stored in cm internally
  goal: GoalType;
  experience: ExperienceType;
  focusAreas: FocusArea[];
  frequency: number; // 1 to 7
  createdAt: string;
}

function cleanExerciseName(name: string): string {
  if (!name) return '';
  return name.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// DrumRollColumn: Scrollbar-free drag-and-drop roller for date picker
function DrumRollColumn<T extends number | string>({
  items,
  selectedItem,
  onSelect,
  label,
  formatItem,
}: {
  items: T[];
  selectedItem: T;
  onSelect: (item: T) => void;
  label: string;
  formatItem?: (item: T) => string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const startYRef = useRef(0);
  const startScrollTopRef = useRef(0);
  const hasMovedRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    const idx = items.indexOf(selectedItem);
    if (idx >= 0) {
      const itemHeight = 36;
      containerRef.current.scrollTop = Math.max(0, idx * itemHeight - 64);
    }
  }, [selectedItem, items]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!containerRef.current) return;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    startYRef.current = e.clientY;
    startScrollTopRef.current = containerRef.current.scrollTop;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !containerRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    if (Math.abs(deltaY) > 4) {
      hasMovedRef.current = true;
    }
    containerRef.current.scrollTop = startScrollTopRef.current - deltaY;
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="space-y-1.5 text-center flex-1">
      <label className="text-[10px] font-mono uppercase text-white/40 font-bold block">{label}</label>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="h-44 overflow-y-auto rounded-xl border border-white/10 bg-black/40 p-1 space-y-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden select-none cursor-grab active:cursor-grabbing touch-pan-y"
      >
        {items.map((item) => {
          const isSelected = item === selectedItem;
          return (
            <div
              key={String(item)}
              onClick={() => {
                if (!hasMovedRef.current) {
                  onSelect(item);
                }
              }}
              className={`py-2 text-sm font-mono rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'bg-red text-white font-bold shadow-md'
                  : 'text-white/50 hover:bg-white/5 hover:text-white'
              }`}
            >
              {formatItem ? formatItem(item) : item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const FOCUS_OPTIONS: { id: FocusArea; label: string; description: string }[] = [
  { id: 'chest', label: 'Chest', description: 'Pectorals, upper and lower chest definition' },
  { id: 'shoulder', label: 'Shoulders', description: 'Anterior, lateral, and rear deltoid width' },
  { id: 'arm', label: 'Arms', description: 'Biceps, triceps, and forearm vascularity & peak' },
  { id: 'back', label: 'Back', description: 'Lats, upper traps, and spinal erectors' },
  { id: 'abs', label: 'Abs & Core', description: 'Rectus abdominis, obliques, and core stability' },
  { id: 'butt', label: 'Glutes / Butt', description: 'Gluteus maximus and hip extension power' },
  { id: 'leg', label: 'Legs', description: 'Quadriceps, hamstrings, and calves strength' },
  { id: 'full body', label: 'Full Body', description: 'Total kinetic chain balanced symmetry' },
];

const FREQUENCY_OPTIONS = [
  { days: 1, label: '1 day / week', sub: 'Light maintenance or recovery' },
  { days: 2, label: '2 days / week', sub: 'Base conditioning split' },
  { days: 3, label: '3 days / week', sub: 'Recommended minimum for steady progress' },
  { days: 4, label: '4 days / week', sub: 'Optimal push / pull / legs / core split' },
  { days: 5, label: '5 days / week', sub: 'High volume targeted muscle focus' },
  { days: 6, label: '6 days / week', sub: 'Elite athlete athletic conditioning' },
  { days: 7, label: 'Every day', sub: 'Daily active mobility and training routine' },
];

export function YourPlanPage() {
  void React;
  const { user } = useAuth();

  // Strict role guarding: Admins always route to /manage, Trainers always route to /dashboard
  if (user?.role === 'admin') {
    return <Navigate to="/manage" replace />;
  }
  if (user?.role === 'trainer') {
    return <Navigate to="/dashboard" replace />;
  }

  // Multi-user isolated storage keys
  const userKey = user?.id
    ? `user_${user.id}`
    : user?.email
    ? `email_${user.email.toLowerCase().trim()}`
    : 'guest';
  const planStorageKey = `dgym_user_plan_${userKey}`;
  const routinesStorageKey = `dgym_user_routines_${userKey}`;

  // Membership status check
  const isStaff = user?.role === 'staff';
  const isVerifiedMember = isStaff || Boolean(user?.has_active_membership) || user?.membership_status === 'active';
  const [showMembershipModal, setShowMembershipModal] = useState<boolean>(false);

  // Wizard state: 1 to 7 (Data inputs), 8 (Tailoring Animation), 9 (Custom Setup Bento)
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [isWizardOpen, setIsWizardOpen] = useState<boolean>(false);

  // Form inputs
  const [birthDay, setBirthDay] = useState<number>(15);
  const [birthMonth, setBirthMonth] = useState<number>(6); // 1-12
  const [birthYear, setBirthYear] = useState<number>(1998);

  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>('kg');
  const [weightKg, setWeightKg] = useState<number>(72); // stored in kg

  const [heightUnit, setHeightUnit] = useState<'cm' | 'ft'>('cm');
  const [heightCm, setHeightCm] = useState<number>(175); // stored in cm

  const [goal, setGoal] = useState<GoalType>('Build Muscle');
  const [experience, setExperience] = useState<ExperienceType>('Intermediate');
  const [selectedFocus, setSelectedFocus] = useState<FocusArea[]>(['chest', 'shoulder']);
  const [frequency, setFrequency] = useState<number>(4);

  // Tailoring Animation Sub-step (1 to 4)
  const [tailorProgress, setTailorProgress] = useState<number>(0);
  const [tailorStepIndex, setTailorStepIndex] = useState<number>(0);

  // Saved Active Plan
  const [userPlan, setUserPlan] = useState<UserPlanData | null>(null);

  // User-customized daily workout routines: Record<dayNumber, RoutineExercise[]>
  const [dailyRoutines, setDailyRoutines] = useState<Record<number, RoutineExercise[]>>({});

  // Exercise Library & Selected Exercise for Modal Preview
  const [exercises, setExercises] = useState<ExerciseItem[]>([]);
  const [loadingExercises, setLoadingExercises] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [previewExercise, setPreviewExercise] = useState<ExerciseItem | null>(null);

  // 10x4 Grid (40 items/page) Pagination & Card Add Routine Dialog
  const ITEMS_PER_PAGE = 40;
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [addingExerciseToRoutine, setAddingExerciseToRoutine] = useState<ExerciseItem | null>(null);
  const [isStartingNow, setIsStartingNow] = useState<boolean>(false);
  const [addedToastMessage, setAddedToastMessage] = useState<string | null>(null);

  // Active Tab in Plan View ('workout' | 'nutrition' | 'library')
  const [activePlanTab, setActivePlanTab] = useState<'workout' | 'nutrition' | 'library'>('workout');

  // Load Saved Plan & Routines from user-specific localStorage key
  useEffect(() => {
    try {
      const saved = localStorage.getItem(planStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as UserPlanData;
        setUserPlan(parsed);
        setWeightKg(parsed.weight || 72);
        setWeightUnit(parsed.weightUnit || 'kg');
        setHeightCm(parsed.height || 175);
        setHeightUnit(parsed.heightUnit || 'cm');
        setGoal(parsed.goal || 'Build Muscle');
        setExperience(parsed.experience || 'Intermediate');
        setSelectedFocus(parsed.focusAreas || ['chest', 'shoulder']);
        setFrequency(parsed.frequency || 4);
        setBirthDay(parsed.birthDate?.day || 15);
        setBirthMonth(parsed.birthDate?.month || 6);
        setBirthYear(parsed.birthDate?.year || 1998);
        setIsWizardOpen(false);
      } else {
        // First time entering Your Plan for this user: prompt wizard automatically
        setUserPlan(null);
        setIsWizardOpen(true);
        setWizardStep(1);
      }

      // Load user-customized daily routines
      const savedRoutines = localStorage.getItem(routinesStorageKey);
      if (savedRoutines) {
        setDailyRoutines(JSON.parse(savedRoutines));
      } else {
        setDailyRoutines({});
      }
    } catch {
      setIsWizardOpen(true);
      setWizardStep(1);
    }
  }, [planStorageKey, routinesStorageKey]);

  // Fetch exercises dataset
  useEffect(() => {
    let isMounted = true;
    const fetchDataset = async () => {
      try {
        setLoadingExercises(true);
        const res = await fetch('/assets/exercises/exercises.json');
        if (!res.ok) throw new Error('Failed to load exercises');
        const data = await res.json();
        if (isMounted) {
          setExercises(data);
        }
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

  // Handle Tailoring Experience Animation
  useEffect(() => {
    if (wizardStep === 8) {
      setTailorProgress(0);
      setTailorStepIndex(0);

      const interval = setInterval(() => {
        setTailorProgress((prev) => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setWizardStep(9), 400);
            return 100;
          }
          const next = prev + 2;
          if (next > 25 && next <= 50) setTailorStepIndex(1);
          else if (next > 50 && next <= 75) setTailorStepIndex(2);
          else if (next > 75) setTailorStepIndex(3);
          return next;
        });
      }, 45);

      return () => clearInterval(interval);
    }
  }, [wizardStep]);

  // Toggle body focus area
  const handleToggleFocus = (part: FocusArea) => {
    if (part === 'full body') {
      setSelectedFocus((prev) =>
        prev.includes('full body') ? ['chest', 'shoulder'] : ['full body']
      );
      return;
    }

    setSelectedFocus((prev) => {
      const filtered = prev.filter((p) => p !== 'full body');
      if (filtered.includes(part)) {
        const next = filtered.filter((p) => p !== part);
        return next.length > 0 ? next : ['chest'];
      } else {
        return [...filtered, part];
      }
    });
  };

  // Convert weight
  const displayWeight = weightUnit === 'kg' ? weightKg : Math.round(weightKg * 2.20462);
  const handleWeightChange = (newVal: number) => {
    if (weightUnit === 'kg') {
      setWeightKg(newVal);
    } else {
      setWeightKg(Math.round(newVal / 2.20462));
    }
  };

  // Convert height
  const displayHeightCm = heightCm;
  const feetTotal = heightCm / 30.48;
  const feet = Math.floor(feetTotal);
  const inches = Math.round((feetTotal - feet) * 12);
  const handleHeightChange = (newVal: number) => {
    setHeightCm(newVal);
  };

  // Calculate Metrics: Age, BMI, Estimated 1RM, Calorie Target
  const calculatedMetrics = useMemo(() => {
    const today = new Date();
    const age = today.getFullYear() - birthYear;
    const heightInMeters = heightCm / 100;
    const bmi = parseFloat((weightKg / (heightInMeters * heightInMeters)).toFixed(1));

    // Realistic estimated 1RM Bench/Squat based on bodyweight, experience & goal
    const expMultiplier = experience === 'Beginner' ? 0.85 : experience === 'Intermediate' ? 1.25 : 1.6;
    const estimatedBench1RM = Math.round(weightKg * expMultiplier);
    const estimatedSquat1RM = Math.round(weightKg * (expMultiplier * 1.35));

    // Projected 4-Week Weight Trend
    const targetDelta = goal === 'Fat Loss' ? -3.5 : goal === 'Build Muscle' ? 1.8 : 0.4;
    const projectedW4Weight = parseFloat((weightKg + targetDelta).toFixed(1));

    // Daily Macro Estimate (Mifflin-St Jeor Formula approx)
    const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
    const tdeeFactor = frequency <= 2 ? 1.3 : frequency <= 4 ? 1.5 : 1.7;
    let targetCalories = Math.round(bmr * tdeeFactor);
    if (goal === 'Fat Loss') targetCalories -= 450;
    if (goal === 'Build Muscle') targetCalories += 350;

    const proteinGrams = Math.round(weightKg * 2.2); // ~2.2g per kg
    const fatGrams = Math.round((targetCalories * 0.25) / 9);
    const carbGrams = Math.round((targetCalories - (proteinGrams * 4 + fatGrams * 9)) / 4);

    return {
      age,
      bmi,
      estimatedBench1RM,
      estimatedSquat1RM,
      projectedW4Weight,
      targetCalories,
      proteinGrams,
      fatGrams,
      carbGrams,
    };
  }, [birthYear, weightKg, heightCm, goal, experience, frequency]);

  // Finalize Wizard & Save Plan (User-isolated)
  const handleCompleteSetup = () => {
    const newPlan: UserPlanData = {
      birthDate: { day: birthDay, month: birthMonth, year: birthYear },
      weightUnit,
      weight: weightKg,
      heightUnit,
      height: heightCm,
      goal,
      experience,
      focusAreas: selectedFocus,
      frequency,
      createdAt: new Date().toISOString(),
    };
    setUserPlan(newPlan);
    try {
      localStorage.setItem(planStorageKey, JSON.stringify(newPlan));
    } catch (err) {
      console.error('Failed to save user plan', err);
    }
    setIsWizardOpen(false);
  };

  // Guard Start Now: Registered users without active membership cannot proceed into dashboard
  const handleStartNowClick = async () => {
    if (!isVerifiedMember) {
      setShowMembershipModal(true);
      return;
    }
    setIsStartingNow(true);
    await new Promise((resolve) => setTimeout(resolve, 850));
    handleCompleteSetup();
    setIsStartingNow(false);
  };

  // Filter exercises for library tab with precise body part matching & search anti-bleed
  const filteredExercises = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return exercises.filter((ex) => {
      const exName = ex.name.toLowerCase();
      const exBodyPart = ex.body_part.toLowerCase();
      const exCat = ex.category.toLowerCase();
      const exEquip = ex.equipment.toLowerCase();

      // 1. Category Pill Filter
      let matchesCat = true;
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'arm' || selectedCategory === 'upper arms') {
          matchesCat =
            exBodyPart === 'upper arms' ||
            exBodyPart === 'lower arms' ||
            exCat === 'upper arms' ||
            exCat === 'lower arms';
        } else {
          matchesCat = exBodyPart.includes(selectedCategory) || exCat.includes(selectedCategory);
        }
      }
      if (!matchesCat) return false;

      // 2. Search Query Filter with Muscle Anti-Bleed Prevention
      if (q === '') return true;

      // Anti-bleed: When searching "chest", prevent upper legs exercises
      // (like "barbell front chest squat" or "hug keens to chest") and waist exercises ("sit-up with arms on chest")
      if (q.includes('chest') && !q.includes('squat') && !q.includes('leg') && !q.includes('waist')) {
        if (exBodyPart === 'upper legs' || exBodyPart === 'lower legs' || exBodyPart === 'waist') {
          return false;
        }
      }

      // Anti-bleed: When searching "arm" or "bicep", prevent leg exercises
      if ((q.includes('arm') || q.includes('bicep') || q.includes('tricep')) && !q.includes('leg')) {
        if (exBodyPart === 'upper legs' || exBodyPart === 'lower legs') {
          return false;
        }
      }

      const matchesSearch =
        exName.includes(q) ||
        exBodyPart.includes(q) ||
        exCat.includes(q) ||
        exEquip.includes(q);

      return matchesSearch;
    });
  }, [exercises, searchQuery, selectedCategory]);

  // Reset page to 1 whenever search query or category filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory]);

  // Total pages & paginated items for 10x4 grid (40 items/page)
  const totalPages = Math.max(1, Math.ceil(filteredExercises.length / ITEMS_PER_PAGE));
  const paginatedExercises = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredExercises.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredExercises, currentPage]);

  // Filter 7-day personalized workout split based on user plan focus
  const weeklyWorkoutSplit = useMemo(() => {
    const isFullBody = selectedFocus.includes('full body');
    const firstFocus = selectedFocus[0] || 'chest';
    const secondFocus = selectedFocus[1] || 'back';

    const getTargetCat = (focus: FocusArea) => {
      if (focus === 'arm') return 'upper arms';
      if (focus === 'shoulder') return 'shoulders';
      if (focus === 'leg') return 'upper legs';
      if (focus === 'abs') return 'waist';
      return focus;
    };

    const days = [
      {
        dayNumber: 1,
        dayName: 'Day 1 • Monday',
        focusTitle: isFullBody ? 'Full Body Hypertrophy' : `${firstFocus.toUpperCase()} Power & Definition`,
        targetCategory: isFullBody ? 'chest' : getTargetCat(firstFocus),
        duration: '50-60 min',
        intensity: 'High Volume',
        isRest: false,
      },
      {
        dayNumber: 2,
        dayName: 'Day 2 • Tuesday',
        focusTitle: frequency >= 3
          ? isFullBody ? 'Lower Body & Core Drive' : `${secondFocus.toUpperCase()} Strength & Pull`
          : 'Rest & Deep Muscle Recovery',
        targetCategory: isFullBody ? 'upper legs' : getTargetCat(secondFocus),
        duration: frequency >= 3 ? '45-55 min' : 'Active Rest',
        intensity: frequency >= 3 ? 'Moderate-Heavy' : 'Recovery',
        isRest: frequency < 3,
      },
      {
        dayNumber: 3,
        dayName: 'Day 3 • Wednesday',
        focusTitle: frequency >= 4
          ? 'Cardio Engine & Functional Core'
          : 'Mobility, Foam Rolling & Walk',
        targetCategory: 'waist',
        duration: frequency >= 4 ? '40-50 min' : 'Active Rest',
        intensity: 'Metabolic Pace',
        isRest: frequency < 4,
      },
      {
        dayNumber: 4,
        dayName: 'Day 4 • Thursday',
        focusTitle: frequency >= 4
          ? `${firstFocus.toUpperCase()} Compound Overload`
          : 'Mid-Week Rest',
        targetCategory: getTargetCat(firstFocus),
        duration: frequency >= 4 ? '50-60 min' : 'Rest Day',
        intensity: 'Progressive Overload',
        isRest: frequency < 4,
      },
      {
        dayNumber: 5,
        dayName: 'Day 5 • Friday',
        focusTitle: frequency >= 5
          ? 'Legs & Glutes Power Station'
          : frequency === 3
            ? 'Full Body Functional Blitz'
            : 'Rest Day',
        targetCategory: 'upper legs',
        duration: '55 min',
        intensity: 'Heavy Compound',
        isRest: frequency < 3 || (frequency === 4 && frequency < 5),
      },
      {
        dayNumber: 6,
        dayName: 'Day 6 • Saturday',
        focusTitle: frequency >= 6
          ? 'Shoulders, Arms & Weak Point Pump'
          : 'Weekend Active Recovery',
        targetCategory: 'shoulders',
        duration: frequency >= 6 ? '45 min' : 'Active Recovery',
        intensity: 'Hypertrophy Burnout',
        isRest: frequency < 6,
      },
      {
        dayNumber: 7,
        dayName: 'Day 7 • Sunday',
        focusTitle: frequency === 7 ? 'Full Body Athletic Mobility & Flow' : 'Full Rest & Meal Prep Sunday',
        targetCategory: 'waist',
        duration: frequency === 7 ? '40 min' : 'Full Rest',
        intensity: 'Restorative',
        isRest: frequency < 7,
      },
    ];

    return days;
  }, [selectedFocus, frequency]);

  // Pick sample exercises from loaded dataset for day's split
  const getDayExercises = (cat: string) => {
    if (!exercises || exercises.length === 0) return [];
    const normalized = cat.toLowerCase();
    const matching = exercises.filter(
      (e) => e.body_part.toLowerCase().includes(normalized) || e.category.toLowerCase().includes(normalized)
    );
    return matching.slice(0, 4);
  };

  // Seed default daily routines when exercises are loaded if not customized yet
  useEffect(() => {
    if (exercises.length === 0) return;
    setDailyRoutines((prev) => {
      // Check if already populated for this user
      if (Object.keys(prev).length > 0) return prev;

      const initial: Record<number, RoutineExercise[]> = {};
      weeklyWorkoutSplit.forEach((day) => {
        if (!day.isRest) {
          const sample = getDayExercises(day.targetCategory);
          initial[day.dayNumber] = sample.map((ex) => ({
            id: ex.id,
            name: ex.name,
            category: ex.category,
            body_part: ex.body_part,
            equipment: ex.equipment,
            instructions: ex.instructions,
            instruction_steps: ex.instruction_steps,
            gif_url: ex.gif_url,
            sets: 4,
            reps: '10-12',
            isDone: false,
          }));
        }
      });

      // Save initial defaults to user's storage
      try {
        localStorage.setItem(routinesStorageKey, JSON.stringify(initial));
      } catch (e) {
        console.error(e);
      }

      return initial;
    });
  }, [exercises, weeklyWorkoutSplit, routinesStorageKey]);

  // Helper to persist daily routines updates
  const saveDailyRoutines = (updated: Record<number, RoutineExercise[]>) => {
    setDailyRoutines(updated);
    try {
      localStorage.setItem(routinesStorageKey, JSON.stringify(updated));
    } catch (err) {
      console.error('Failed to save daily routines to localStorage', err);
    }
  };

  // Toggle Done state for an exercise card in a scheduled workout day
  const handleToggleDone = (dayNumber: number, exerciseId: string) => {
    const dayExercises = dailyRoutines[dayNumber] || [];
    const updatedDay = dayExercises.map((ex) =>
      ex.id === exerciseId ? { ...ex, isDone: !ex.isDone } : ex
    );
    const updatedAll = { ...dailyRoutines, [dayNumber]: updatedDay };
    saveDailyRoutines(updatedAll);
  };

  // Delete exercise card from a scheduled workout day routine
  const handleDeleteExercise = (dayNumber: number, exerciseId: string) => {
    const dayExercises = dailyRoutines[dayNumber] || [];
    const updatedDay = dayExercises.filter((ex) => ex.id !== exerciseId);
    const updatedAll = { ...dailyRoutines, [dayNumber]: updatedDay };
    saveDailyRoutines(updatedAll);
  };

  // Add exercise card to a scheduled workout day routine (from 3D library or detail modal)
  const handleAddExerciseToDay = (dayNumber: number, ex: ExerciseItem) => {
    const targetDay = weeklyWorkoutSplit.find((d) => d.dayNumber === dayNumber);
    if (!targetDay || targetDay.isRest) {
      alert('Cannot add exercise to a rest day.');
      return;
    }

    const currentDayExercises = dailyRoutines[dayNumber] || [];
    // If already in that day, notify user
    if (currentDayExercises.some((item) => item.id === ex.id)) {
      setAddedToastMessage(`"${cleanExerciseName(ex.name)}" is already in ${targetDay.dayName}.`);
      setTimeout(() => setAddedToastMessage(null), 3000);
      return;
    }

    const newRoutineItem: RoutineExercise = {
      id: ex.id,
      name: ex.name,
      category: ex.category,
      body_part: ex.body_part,
      equipment: ex.equipment,
      instructions: ex.instructions,
      instruction_steps: ex.instruction_steps,
      gif_url: ex.gif_url,
      sets: 4,
      reps: '10-12',
      isDone: false,
    };

    const updatedAll = {
      ...dailyRoutines,
      [dayNumber]: [...currentDayExercises, newRoutineItem],
    };
    saveDailyRoutines(updatedAll);

    setAddedToastMessage(`Added "${cleanExerciseName(ex.name)}" to ${targetDay.dayName}!`);
    setTimeout(() => setAddedToastMessage(null), 3000);
  };

  return (
    <>
      <SEO
        title="Your Plan — The DGym"
        description="Your personalized fitness program, 3D animated exercises, and macro nutrition plan."
      />

      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-fade-in text-white">
        {/* =========================================================================
            HEADER & QUICK ACTIONS
        ========================================================================= */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-widest uppercase bg-red/10 text-red border border-red/20">
                ATHLETE PROGRAM
              </span>
              <span className="text-xs font-mono text-white/40">
                {user?.full_name ? `Prepared for ${user.full_name}` : 'Customized Performance Routine'}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
              <span>Your Plan</span>
              <Sparkles className="w-6 h-6 text-red animate-pulse" />
            </h1>
            <p className="text-sm text-white/50 mt-1 max-w-2xl">
              {userPlan
                ? `${userPlan.goal} • ${userPlan.frequency} Days / Week • Focus on ${userPlan.focusAreas.map(f => f.toUpperCase()).join(', ')}`
                : 'Complete the athlete onboarding prompt to generate your custom weekly split and meal blueprint.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setWizardStep(1);
                setIsWizardOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-xs font-mono font-bold uppercase tracking-wider text-white transition-all cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-red" />
              <span>{userPlan ? 'Re-calibrate Plan' : 'Setup Plan'}</span>
            </button>
          </div>
        </div>

        {/* =========================================================================
            BENTO SNAPSHOT HERO CARDS (Weight Trend, BMI Gauge, Macro Targets)
        ========================================================================= */}
        {userPlan && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Bento Card 1: Your Weight Projection Line */}
            <div className="rounded-2xl border border-white/10 bg-surface p-6 flex flex-col justify-between space-y-4 shadow-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono uppercase tracking-widest text-white/40 font-bold flex items-center gap-2">
                  <Scale className="w-4 h-4 text-red" />
                  Your Weight
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {userPlan.goal === 'Fat Loss' ? 'Optimal Cut' : userPlan.goal === 'Build Muscle' ? 'Lean Bulk' : 'Strength Gain'}
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
                      d={
                        userPlan.goal === 'Fat Loss'
                          ? "M 10 15 Q 150 35 290 55"
                          : "M 10 55 Q 150 35 290 15"
                      }
                      fill="none"
                      stroke="url(#weightGrad)"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {/* Today Marker */}
                    <circle cx="10" cy={userPlan.goal === 'Fat Loss' ? "15" : "55"} r="5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                    {/* Week 4 Marker */}
                    <circle cx="290" cy={userPlan.goal === 'Fat Loss' ? "55" : "15"} r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
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
                <span className="text-[11px] font-mono text-white/50">
                  {calculatedMetrics.age} Years Old
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 py-1 border-y border-white/8 text-center font-mono">
                <div>
                  <p className="text-[10px] text-white/40 uppercase">Height</p>
                  <p className="text-sm font-bold text-white mt-0.5">{heightCm} cm</p>
                </div>
                <div>
                  <p className="text-[10px] text-white/40 uppercase">Weight</p>
                  <p className="text-sm font-bold text-white mt-0.5">{weightKg} kg</p>
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
                    {calculatedMetrics.bmi} •{' '}
                    <span
                      className={
                        calculatedMetrics.bmi < 18.5
                          ? 'text-blue-400'
                          : calculatedMetrics.bmi <= 24.9
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {calculatedMetrics.bmi < 18.5
                        ? 'Underweight'
                        : calculatedMetrics.bmi <= 24.9
                        ? 'Normal Range'
                        : 'Overweight'}
                    </span>
                  </span>
                </div>

                {/* Horizontal Gradient Bar */}
                <div className="relative w-full h-3.5 rounded-full overflow-hidden bg-white/5 shadow-inner">
                  <div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background:
                        'linear-gradient(to right, #3b82f6 0%, #10b981 35%, #f59e0b 70%, #ef4444 100%)',
                    }}
                  />
                  {/* White Circle Marker positioned at percentage */}
                  {(() => {
                    // Clamped between 15 and 35 BMI range mapped to 0-100%
                    const pct = Math.min(
                      96,
                      Math.max(4, ((calculatedMetrics.bmi - 15) / (35 - 15)) * 100)
                    );
                    return (
                      <div
                        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-black shadow-[0_0_8px_rgba(255,255,255,0.8)] transition-all pointer-events-none"
                        style={{ left: `calc(${pct}% - 8px)` }}
                      />
                    );
                  })()}
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
                <span className="text-xs font-mono font-bold text-red">
                  {calculatedMetrics.targetCalories} kcal / day
                </span>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono">
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                  <p className="text-[10px] text-white/40 uppercase">Protein</p>
                  <p className="text-base font-black text-emerald-400 mt-1">{calculatedMetrics.proteinGrams}g</p>
                  <p className="text-[9px] text-white/30">Muscle repair</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                  <p className="text-[10px] text-white/40 uppercase">Carbs</p>
                  <p className="text-base font-black text-amber-400 mt-1">{calculatedMetrics.carbGrams}g</p>
                  <p className="text-[9px] text-white/30">Training fuel</p>
                </div>
                <div className="p-3 rounded-xl bg-white/5 border border-white/5 text-center">
                  <p className="text-[10px] text-white/40 uppercase">Fats</p>
                  <p className="text-base font-black text-blue-400 mt-1">{calculatedMetrics.fatGrams}g</p>
                  <p className="text-[9px] text-white/30">Hormone support</p>
                </div>
              </div>

              <div className="text-xs font-mono text-white/50 flex items-center justify-between border-t border-white/8 pt-3">
                <span>Meal Schedule:</span>
                <span className="text-white font-semibold">4 High-Protein Meals</span>
              </div>
            </div>
          </div>
        )}

        {/* =========================================================================
            MAIN CONTENT TABS (Workout Split | Meal Plan | Exercise Library 3D)
        ========================================================================= */}
        <div className="space-y-6">
          {/* Tab Selector Buttons */}
          <div className="flex items-center gap-2 border-b border-white/10 pb-4">
            <button
              type="button"
              onClick={() => setActivePlanTab('workout')}
              className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activePlanTab === 'workout'
                  ? 'bg-red text-white shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Dumbbell className="w-4 h-4" />
              <span>7-Day Workout Split</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePlanTab('nutrition')}
              className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activePlanTab === 'nutrition'
                  ? 'bg-red text-white shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Utensils className="w-4 h-4" />
              <span>Personalized Meal Plan</span>
            </button>

            <button
              type="button"
              onClick={() => setActivePlanTab('library')}
              className={`px-5 py-2.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 ${
                activePlanTab === 'library'
                  ? 'bg-red text-white shadow-[0_0_15px_rgba(239,68,68,0.35)]'
                  : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Search className="w-4 h-4" />
              <span>3D Workout Demos ({exercises.length})</span>
            </button>
          </div>

          {/* TAB 1: 7-DAY WORKOUT SPLIT */}
          {activePlanTab === 'workout' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-xl font-black uppercase text-white">
                    Weekly Training Blueprint
                  </h2>
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
                        day.isRest
                          ? 'border-2 border-white/20 bg-white/[0.03] shadow-inner'
                          : 'border border-white/10 bg-surface hover:border-red/30'
                      }`}
                    >
                      <div>
                        {/* Day Header */}
                        <div className="flex items-center justify-between pb-3 border-b border-white/8 mb-3">
                          <span className="text-xs font-mono font-bold text-white/50 uppercase">
                            {day.dayName}
                          </span>
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold uppercase ${
                              day.isRest
                                ? 'bg-white/5 text-white/50 border border-white/10'
                                : 'bg-red/10 text-red border border-red/20'
                            }`}
                          >
                            {day.intensity}
                          </span>
                        </div>

                        <h3 className="font-bold text-base text-white font-mono mb-1">
                          {day.focusTitle}
                        </h3>
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
                                        <img
                                          src={ex.gif_url}
                                          alt={ex.name}
                                          className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                                          loading="lazy"
                                        />
                                      </div>
                                      <div className="min-w-0">
                                        <p
                                          className={`text-xs font-bold capitalize truncate transition-colors ${
                                            ex.isDone ? 'text-emerald-300' : 'text-white group-hover:text-red'
                                          }`}
                                        >
                                          {idx + 1}. {cleanExerciseName(ex.name)}
                                        </p>
                                        <p className="text-[10px] text-white/40 font-mono capitalize">
                                          {ex.body_part} • {ex.equipment}
                                        </p>
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
                                    <div className="flex items-center gap-1.5">
                                      <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">
                                        {ex.sets} Sets × {ex.reps}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => handleToggleDone(day.dayNumber, ex.id)}
                                      className={`px-2.5 py-1 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer ${
                                        ex.isDone
                                          ? 'bg-emerald-500 text-black shadow-md'
                                          : 'bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10'
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
                                <p className="text-[10px] text-white/30">
                                  Add exercises from the 3D Workout Demos library below.
                                </p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="py-3 space-y-2.5">
                            <div className="flex items-center gap-2 pb-2 border-b border-white/8">
                              <Activity className="w-4 h-4 text-emerald-400" />
                              <span className="text-xs font-mono font-bold text-white uppercase">
                                Rest &amp; Deep Muscle Recovery
                              </span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                                <span className="text-sm leading-none shrink-0 mt-0.5">💧</span>
                                <div>
                                  <p className="text-[11px] font-bold text-white font-mono">Hydration Focus</p>
                                  <p className="text-[9px] text-white/50 font-mono">Electrolyte balance &amp; water intake</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                                <span className="text-sm leading-none shrink-0 mt-0.5">🧘</span>
                                <div>
                                  <p className="text-[11px] font-bold text-white font-mono">Stretching &amp; Mobility</p>
                                  <p className="text-[9px] text-white/50 font-mono">Foam rolling &amp; mobility flow</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                                <span className="text-sm leading-none shrink-0 mt-0.5">😴</span>
                                <div>
                                  <p className="text-[11px] font-bold text-white font-mono">8 Hours Deep Sleep</p>
                                  <p className="text-[9px] text-white/50 font-mono">Physical &amp; nervous system repair</p>
                                </div>
                              </div>
                              <div className="flex items-start gap-2 p-2 rounded-xl bg-white/[0.02] border border-white/5">
                                <span className="text-sm leading-none shrink-0 mt-0.5">🛡️</span>
                                <div>
                                  <p className="text-[11px] font-bold text-white font-mono">Non-Workout Day</p>
                                  <p className="text-[9px] text-white/50 font-mono">Deep recovery for muscle growth</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      {!day.isRest && (
                        <div className="pt-4 border-t border-white/8 mt-4 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCategory(day.targetCategory);
                              setActivePlanTab('library');
                            }}
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
                <h2 className="font-display text-xl font-black uppercase text-white">
                  Targeted Nutrition Blueprint
                </h2>
                <p className="text-xs text-white/50 font-mono mt-0.5">
                  Calibrated to your {goal} target ({calculatedMetrics.targetCalories} kcal / day).
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Meal 1 */}
                <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/8">
                    <span className="text-xs font-mono font-bold uppercase text-amber-400">
                      Meal 1 • Breakfast Power
                    </span>
                    <span className="text-xs font-mono text-white/50 font-bold">~520 kcal</span>
                  </div>
                  <h3 className="font-bold text-base text-white">Eggs, Oatmeal &amp; Fresh Banana</h3>
                  <ul className="text-xs text-white/60 space-y-2 font-mono">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>3 Whole Eggs scrambled with spinach &amp; tomato</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>1 Cup Rolled Oats with 1 scoop Whey Protein or chia seeds</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>1 Medium Banana for immediate glycogen support</span>
                    </li>
                  </ul>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-white/70 flex justify-between">
                    <span>Protein: 38g</span>
                    <span>Carbs: 58g</span>
                    <span>Fats: 16g</span>
                  </div>
                </div>

                {/* Meal 2 */}
                <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/8">
                    <span className="text-xs font-mono font-bold uppercase text-emerald-400">
                      Meal 2 • High-Performance Lunch
                    </span>
                    <span className="text-xs font-mono text-white/50 font-bold">~640 kcal</span>
                  </div>
                  <h3 className="font-bold text-base text-white">Grilled Chicken Breast &amp; Brown Rice</h3>
                  <ul className="text-xs text-white/60 space-y-2 font-mono">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>200g Grilled lean chicken breast with garlic &amp; calamansi</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>1.5 Cups Steamed Brown Rice or Sweet Potato (kamote)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>Steamed broccoli or green beans tossed in 1 tsp olive oil</span>
                    </li>
                  </ul>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-white/70 flex justify-between">
                    <span>Protein: 52g</span>
                    <span>Carbs: 65g</span>
                    <span>Fats: 14g</span>
                  </div>
                </div>

                {/* Meal 3 */}
                <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/8">
                    <span className="text-xs font-mono font-bold uppercase text-blue-400">
                      Meal 3 • Pre / Post Training Fuel
                    </span>
                    <span className="text-xs font-mono text-white/50 font-bold">~380 kcal</span>
                  </div>
                  <h3 className="font-bold text-base text-white">Greek Yogurt &amp; Roasted Almonds</h3>
                  <ul className="text-xs text-white/60 space-y-2 font-mono">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>200g Plain low-fat Greek yogurt with raw honey</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>15-20g Whole roasted almonds or peanut butter</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>Electrolyte water or 500ml fresh hydration</span>
                    </li>
                  </ul>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-white/70 flex justify-between">
                    <span>Protein: 28g</span>
                    <span>Carbs: 32g</span>
                    <span>Fats: 12g</span>
                  </div>
                </div>

                {/* Meal 4 */}
                <div className="rounded-2xl border border-white/10 bg-surface p-6 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-white/8">
                    <span className="text-xs font-mono font-bold uppercase text-purple-400">
                      Meal 4 • Muscle Recovery Dinner
                    </span>
                    <span className="text-xs font-mono text-white/50 font-bold">~560 kcal</span>
                  </div>
                  <h3 className="font-bold text-base text-white">Pan-Seared Fish Fillet &amp; Mixed Greens</h3>
                  <ul className="text-xs text-white/60 space-y-2 font-mono">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>200g Tilapia, Bangus belly, or Salmon fillet</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>1 Cup Steamed corn or quinoa</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-red" />
                      <span>Generous cucumber, cabbage, and avocado salad</span>
                    </li>
                  </ul>
                  <div className="p-2.5 rounded-lg bg-white/5 border border-white/5 text-[11px] font-mono text-white/70 flex justify-between">
                    <span>Protein: 44g</span>
                    <span>Carbs: 45g</span>
                    <span>Fats: 18g</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: 3D WORKOUT DEMOS LIBRARY */}
          {activePlanTab === 'library' && (
            <div className="space-y-6">
              {/* Search & Category Filter */}
              <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="w-4 h-4 text-white/40 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by exercise name, body part, equipment..."
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-white/10 bg-surface text-sm text-white placeholder-white/30 outline-none focus:border-red transition-colors"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Category Pills */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
                  {[
                    { id: 'all', label: 'All' },
                    { id: 'chest', label: 'Chest' },
                    { id: 'back', label: 'Back' },
                    { id: 'shoulders', label: 'Shoulders' },
                    { id: 'waist', label: 'Abs / Core' },
                    { id: 'upper legs', label: 'Quads & Legs' },
                    { id: 'arm', label: 'Arms' },
                    { id: 'cardio', label: 'Cardio' },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium whitespace-nowrap transition-colors cursor-pointer ${
                        selectedCategory === cat.id
                          ? 'bg-red text-white'
                          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Grid of 3D Exercise Cards (10 Horizontal x 4 Vertical = 40 Per Page) */}
              {loadingExercises ? (
                <div className="py-20 text-center font-mono text-white/40 space-y-3">
                  <div className="w-8 h-8 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto" />
                  <p>Loading 3D animated exercises...</p>
                </div>
              ) : filteredExercises.length === 0 ? (
                <div className="py-16 text-center rounded-2xl border border-dashed border-white/10 p-8 space-y-2">
                  <Dumbbell className="w-8 h-8 text-white/20 mx-auto" />
                  <p className="text-sm text-white/60 font-mono">No matching exercises found.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setSelectedCategory('all');
                    }}
                    className="text-xs text-red hover:underline font-mono"
                  >
                    Clear search filters
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* 10 horizontal x 4 vertical layout */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 gap-2.5">
                    {paginatedExercises.map((ex) => (
                      <div
                        key={ex.id}
                        className="group rounded-xl border border-white/10 bg-surface overflow-hidden hover:border-red/40 hover:bg-surface-2 transition-all flex flex-col justify-between shadow-md relative"
                      >
                        {/* GIF Container (Click to Preview Modal) */}
                        <div
                          onClick={() => setPreviewExercise(ex)}
                          className="aspect-square w-full bg-black/70 relative overflow-hidden flex items-center justify-center p-1.5 cursor-pointer"
                        >
                          <img
                            src={ex.gif_url}
                            alt={ex.name}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                            loading="lazy"
                          />
                          <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-mono uppercase font-bold bg-black/85 text-white/80 border border-white/10">
                            {ex.body_part}
                          </span>
                        </div>

                        {/* Info & Add Action */}
                        <div className="p-2 space-y-1.5 flex flex-col justify-between flex-1">
                          <div
                            onClick={() => setPreviewExercise(ex)}
                            className="cursor-pointer"
                          >
                            <h4
                              className="font-bold text-[11px] text-white capitalize truncate group-hover:text-red transition-colors leading-tight"
                              title={ex.name}
                            >
                              {cleanExerciseName(ex.name)}
                            </h4>
                            <p className="text-[9px] text-white/40 font-mono capitalize truncate mt-0.5">
                              {ex.equipment}
                            </p>
                          </div>

                          {/* Quick Add to Routine Day */}
                          <div className="pt-1 border-t border-white/5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddingExerciseToRoutine(ex);
                              }}
                              className="w-full py-1 px-1.5 rounded-lg bg-red/10 hover:bg-red/20 text-red border border-red/20 hover:border-red/40 text-[10px] font-mono font-bold uppercase transition-all flex items-center justify-center gap-1 cursor-pointer"
                              title="Add to a scheduled workout day"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Pagination Controls */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-white/10 font-mono text-xs">
                    <span className="text-white/40">
                      Showing{' '}
                      <strong className="text-white">
                        {(currentPage - 1) * ITEMS_PER_PAGE + 1}
                      </strong>{' '}
                      –{' '}
                      <strong className="text-white">
                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredExercises.length)}
                      </strong>{' '}
                      of{' '}
                      <strong className="text-white">
                        {filteredExercises.length.toLocaleString()}
                      </strong>{' '}
                      Exercises (Page {currentPage} of {totalPages})
                    </span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        First
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                        <span>Prev</span>
                      </button>

                      {/* Visible Page Indicator */}
                      <span className="px-3 py-1.5 rounded-lg bg-red/15 border border-red/30 text-red font-bold">
                        {currentPage} / {totalPages}
                      </span>

                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1"
                      >
                        <span>Next</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                      >
                        Last
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* =========================================================================
          EXERCISE DETAIL MODAL WITH 3D GIF & ENGLISH INSTRUCTIONS
      ========================================================================= */}
      {previewExercise && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setPreviewExercise(null)}
        >
          <div
            className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#111114] p-6 shadow-2xl space-y-5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-red font-bold">
                  {previewExercise.body_part} • {previewExercise.equipment}
                </span>
                <h3 className="text-xl font-bold text-white capitalize mt-0.5">
                  {cleanExerciseName(previewExercise.name)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewExercise(null)}
                className="p-1.5 rounded-xl border border-white/10 hover:bg-white/10 text-white/50 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* 3D Animated GIF Showcase */}
            <div className="w-full aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center p-3 relative shadow-inner">
              <img
                src={previewExercise.gif_url}
                alt={previewExercise.name}
                className="w-full h-full object-contain"
              />
            </div>

            {/* English Step-by-Step Instructions */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-mono font-bold tracking-wider text-white/50 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-red" />
                Execution Instructions
              </h4>

              {previewExercise.instruction_steps && previewExercise.instruction_steps.length > 0 ? (
                <ol className="space-y-2.5 text-xs text-white/80 leading-relaxed font-sans">
                  {previewExercise.instruction_steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-2.5 p-2 rounded-lg bg-white/[0.02] border border-white/5">
                      <span className="w-5 h-5 rounded-full bg-red/10 text-red font-mono font-bold text-[10px] flex items-center justify-center shrink-0 mt-0.5">
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-xs text-white/70 leading-relaxed">
                  {previewExercise.instructions}
                </p>
              )}
            </div>

            {/* Modal Footer with Add to Routine Selector placed full width, label on top, NO Close Demo button */}
            <div className="pt-4 border-t border-white/10 space-y-2">
              <label className="text-xs font-mono font-bold uppercase tracking-wider text-white/60 block">
                Add to Routine:
              </label>
              <select
                onChange={(e) => {
                  const dayNum = parseInt(e.target.value, 10);
                  if (!isNaN(dayNum)) {
                    handleAddExerciseToDay(dayNum, previewExercise);
                    e.target.value = '';
                  }
                }}
                defaultValue=""
                className="w-full bg-white/5 border border-white/15 rounded-xl px-4 py-3 text-xs font-mono text-white outline-none focus:border-red transition-colors cursor-pointer"
              >
                <option value="" disabled className="bg-[#111114]">
                  Choose Scheduled Day...
                </option>
                {weeklyWorkoutSplit
                  .filter((d) => !d.isRest)
                  .map((d) => (
                    <option key={d.dayNumber} value={d.dayNumber} className="bg-[#111114] text-white">
                      {d.dayName} ({d.focusTitle})
                    </option>
                  ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          PLAN ONBOARDING WIZARD MODAL (8 STEPS + BENTO SETUP SCREEN)
      ========================================================================= */}
      {isWizardOpen && (
        <div
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => {
            if (userPlan) setIsWizardOpen(false);
          }}
        >
          <div
            className="w-full max-w-xl max-h-[92vh] overflow-y-auto rounded-3xl border border-white/15 bg-[#0f0f13] p-6 sm:p-8 shadow-2xl space-y-6 relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top Bar with Step Indicator */}
            {wizardStep <= 7 && (
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-red uppercase">
                    Step {wizardStep} of 7
                  </span>
                  <span className="text-white/20">|</span>
                  <span className="text-xs font-mono text-white/40">Personalization</span>
                </div>

                {userPlan && (
                  <button
                    type="button"
                    onClick={() => setIsWizardOpen(false)}
                    className="text-white/40 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 1: BIRTHDAY PICKER (Scroll / Roller Style)
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 1 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                    What is your birthday?
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-1">
                    Used to calculate basal metabolic rate (BMR) and recommended recovery windows.
                  </p>
                </div>

                {/* Roller / Scroll Style Date Selector */}
                <div className="p-6 rounded-2xl border border-white/10 bg-surface space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <DrumRollColumn
                      label="Day"
                      items={Array.from({ length: 31 }, (_, i) => i + 1)}
                      selectedItem={birthDay}
                      onSelect={setBirthDay}
                    />
                    <DrumRollColumn
                      label="Month"
                      items={Array.from({ length: 12 }, (_, i) => i + 1)}
                      selectedItem={birthMonth}
                      onSelect={setBirthMonth}
                      formatItem={(m) => MONTH_NAMES[m - 1].slice(0, 3)}
                    />
                    <DrumRollColumn
                      label="Year"
                      items={Array.from({ length: 65 }, (_, i) => 2012 - i)}
                      selectedItem={birthYear}
                      onSelect={setBirthYear}
                    />
                  </div>

                  {/* Selected Preview Line */}
                  <div className="text-center font-mono text-xs text-white/60 pt-2 border-t border-white/5">
                    Selected: <strong className="text-white">{MONTH_NAMES[birthMonth - 1]} {birthDay}, {birthYear}</strong>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shadow-lg"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 2: WEIGHT PICKER (Toggle KG/LBS + Horizontal Scroll Slider)
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 2 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                    What is your weight?
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-1">
                    Select your current bodyweight to customize strength standards and macros.
                  </p>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-surface space-y-6 text-center">
                  {/* KG vs LBS Toggle (Selected is RED) */}
                  <div className="inline-flex p-1 rounded-xl bg-black/40 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setWeightUnit('kg')}
                      className={`px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                        weightUnit === 'kg'
                          ? 'bg-red text-white shadow-md'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Kilograms (kg)
                    </button>
                    <button
                      type="button"
                      onClick={() => setWeightUnit('lbs')}
                      className={`px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                        weightUnit === 'lbs'
                          ? 'bg-red text-white shadow-md'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Pounds (lbs)
                    </button>
                  </div>

                  {/* Huge Number Display */}
                  <div className="py-2">
                    <span className="text-5xl font-black font-mono text-white tracking-tight">
                      {displayWeight}
                    </span>
                    <span className="text-lg font-mono text-red font-bold ml-2">
                      {weightUnit}
                    </span>
                  </div>

                  {/* Horizontal Scroll Slider */}
                  <div className="space-y-2 px-4">
                    <input
                      type="range"
                      min={weightUnit === 'kg' ? 40 : 88}
                      max={weightUnit === 'kg' ? 160 : 350}
                      step={1}
                      value={displayWeight}
                      onChange={(e) => handleWeightChange(Number(e.target.value))}
                      className="w-full h-2 rounded-lg bg-white/10 accent-red cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-white/30">
                      <span>{weightUnit === 'kg' ? '40 kg' : '88 lbs'}</span>
                      <span className="text-white/50">Slide Left or Right</span>
                      <span>{weightUnit === 'kg' ? '160 kg' : '350 lbs'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono font-bold uppercase transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 3: HEIGHT PICKER (Toggle CM/FT-IN + Horizontal Scroll Slider)
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 3 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                    What is your height?
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-1">
                    Used to establish your baseline BMI and leverage biomechanics.
                  </p>
                </div>

                <div className="p-6 rounded-2xl border border-white/10 bg-surface space-y-6 text-center">
                  {/* CM vs FT Toggle (Selected is RED) */}
                  <div className="inline-flex p-1 rounded-xl bg-black/40 border border-white/10">
                    <button
                      type="button"
                      onClick={() => setHeightUnit('cm')}
                      className={`px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                        heightUnit === 'cm'
                          ? 'bg-red text-white shadow-md'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Centimeters (cm)
                    </button>
                    <button
                      type="button"
                      onClick={() => setHeightUnit('ft')}
                      className={`px-5 py-2 rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                        heightUnit === 'ft'
                          ? 'bg-red text-white shadow-md'
                          : 'text-white/50 hover:text-white'
                      }`}
                    >
                      Feet &amp; Inches (ft/in)
                    </button>
                  </div>

                  {/* Huge Number Display */}
                  <div className="py-2">
                    {heightUnit === 'cm' ? (
                      <>
                        <span className="text-5xl font-black font-mono text-white tracking-tight">
                          {displayHeightCm}
                        </span>
                        <span className="text-lg font-mono text-red font-bold ml-2">cm</span>
                      </>
                    ) : (
                      <>
                        <span className="text-5xl font-black font-mono text-white tracking-tight">
                          {feet}' {inches}"
                        </span>
                        <span className="text-xs font-mono text-white/40 block mt-1">
                          ({displayHeightCm} cm)
                        </span>
                      </>
                    )}
                  </div>

                  {/* Horizontal Scroll Slider */}
                  <div className="space-y-2 px-4">
                    <input
                      type="range"
                      min={130}
                      max={220}
                      step={1}
                      value={displayHeightCm}
                      onChange={(e) => handleHeightChange(Number(e.target.value))}
                      className="w-full h-2 rounded-lg bg-white/10 accent-red cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] font-mono text-white/30">
                      <span>130 cm (4'3")</span>
                      <span className="text-white/50">Slide Left or Right</span>
                      <span>220 cm (7'3")</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono font-bold uppercase transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 4: TOP GOAL (Build Muscle, Gain Strength, Fat Loss)
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 4 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                    What is your top goal?
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-1">
                    Your workout rep ranges and caloric surplus/deficit will be tuned around this.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    {
                      id: 'Build Muscle' as GoalType,
                      title: 'Build Muscle',
                      desc: 'Hypertrophy rep ranges (8-12 reps), moderate surplus, muscle fullness.',
                      icon: Dumbbell,
                    },
                    {
                      id: 'Gain Strength' as GoalType,
                      title: 'Gain Strength',
                      desc: 'Heavy compound lifts (3-6 reps), neuromuscular power, 1RM focus.',
                      icon: Trophy,
                    },
                    {
                      id: 'Fat Loss' as GoalType,
                      title: 'Fat Loss',
                      desc: 'Caloric deficit, high-density circuits, metabolic conditioning.',
                      icon: Flame,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isSelected = goal === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => setGoal(item.id)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-4 ${
                          isSelected
                            ? 'border-red bg-red/10 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                            : 'border-white/10 bg-surface hover:border-white/20'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div
                            className={`p-3 rounded-xl border ${
                              isSelected
                                ? 'bg-red text-white border-red'
                                : 'bg-white/5 text-white/50 border-white/10'
                            }`}
                          >
                            <Icon className="w-6 h-6" />
                          </div>
                          <div>
                            <h3 className="font-bold text-base text-white">{item.title}</h3>
                            <p className="text-xs text-white/50 font-mono mt-0.5">{item.desc}</p>
                          </div>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-red bg-red text-white' : 'border-white/20'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono font-bold uppercase transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(5)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 5: TRAINING EXPERIENCE (Beginner, Intermediate, Advanced)
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 5 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                    How much training experience do you have?
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-1">
                    Dictates workout volume, exercise complexity, and recovery speed.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {[
                    { id: 'Beginner' as ExperienceType, title: 'Beginner', sub: '0-1 year' },
                    { id: 'Intermediate' as ExperienceType, title: 'Intermediate', sub: '1-3 years' },
                    { id: 'Advanced' as ExperienceType, title: 'Advanced', sub: '3+ years' },
                  ].map((lvl) => {
                    const isSelected = experience === lvl.id;
                    return (
                      <div
                        key={lvl.id}
                        onClick={() => setExperience(lvl.id)}
                        className={`p-5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-red bg-red/10 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                            : 'border-white/10 bg-surface hover:border-white/20'
                        }`}
                      >
                        <div>
                          <h3 className="font-bold text-base text-white">{lvl.title}</h3>
                          <p className="text-xs text-red font-mono font-semibold mt-0.5">{lvl.sub}</p>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-red bg-red text-white' : 'border-white/20'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(4)}
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono font-bold uppercase transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(6)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 6: FOCUS AREAS WITH REALISTIC 2D ANATOMICAL MUSCLE VISUALIZER
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 6 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                    Select the areas you want to focus on
                  </h2>
                  <p className="text-xs text-white/50 font-mono mt-1">
                    Click the muscle bellies on the anatomical athletic models or toggle the buttons below.
                  </p>
                </div>

                {/* High-Fidelity 2D Muscle Visualizer (Anterior & Posterior) */}
                <MuscleVisualizer2D
                  selectedFocus={selectedFocus}
                  onToggleFocus={handleToggleFocus}
                />

                {/* Focus Option Buttons */}
                <div className="flex flex-wrap gap-2 justify-center">
                  {FOCUS_OPTIONS.map((opt) => {
                    const isSelected = selectedFocus.includes(opt.id);
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleToggleFocus(opt.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-mono font-bold uppercase transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-red text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                            : 'bg-white/5 text-white/60 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(5)}
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono font-bold uppercase transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(7)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg"
                  >
                    <span>Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 7: WORKOUT FREQUENCY (1-7 Days / Week)
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 7 && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                    How often do you workout?
                  </h2>
                  <p className="text-xs text-red font-mono font-semibold mt-1">
                    We recommend training at least 3 days a week for better results.
                  </p>
                </div>

                <div className="space-y-2.5 max-h-[46vh] overflow-y-auto pr-1">
                  {FREQUENCY_OPTIONS.map((opt) => {
                    const isSelected = frequency === opt.days;
                    return (
                      <div
                        key={opt.days}
                        onClick={() => setFrequency(opt.days)}
                        className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'border-red bg-red/10 shadow-[0_0_15px_rgba(239,68,68,0.25)]'
                            : 'border-white/10 bg-surface hover:border-white/20'
                        }`}
                      >
                        <div>
                          <h3 className="font-bold text-sm text-white">{opt.label}</h3>
                          <p className="text-[11px] text-white/40 font-mono mt-0.5">{opt.sub}</p>
                        </div>

                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                            isSelected ? 'border-red bg-red text-white' : 'border-white/20'
                          }`}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(6)}
                    className="inline-flex items-center gap-1.5 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-xs font-mono font-bold uppercase transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(8)}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg"
                  >
                    <span>Generate My Plan</span>
                    <Sparkles className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 8: TAILORING EXPERIENCE ANIMATION SCREEN
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 8 && (
              <div className="py-10 px-4 text-center space-y-8 animate-fade-in">
                {/* Radial / Progress Visual */}
                <div className="relative w-32 h-32 mx-auto flex items-center justify-center">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#27272a"
                      strokeWidth="6"
                      fill="none"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="#ef4444"
                      strokeWidth="6"
                      strokeDasharray="264"
                      strokeDashoffset={264 - (264 * tailorProgress) / 100}
                      strokeLinecap="round"
                      fill="none"
                      className="transition-all duration-100 drop-shadow-[0_0_8px_rgba(239,68,68,0.7)]"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center font-mono">
                    <span className="text-2xl font-black text-white">{tailorProgress}%</span>
                    <span className="text-[9px] uppercase tracking-widest text-red font-bold">ANALYZING</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-black uppercase text-white tracking-tight">
                    Tailoring Experience...
                  </h2>
                  <p className="text-xs text-white/50 font-mono">
                    Synthesizing biometric parameters and building your exercise catalog.
                  </p>
                </div>

                {/* 4 Process Checklist items */}
                <div className="max-w-md mx-auto space-y-3 text-left font-mono">
                  {[
                    { label: 'Analyzing Body Data', done: tailorStepIndex >= 0 },
                    { label: 'Calculating Strength level', done: tailorStepIndex >= 1 },
                    { label: 'Selecting exercises', done: tailorStepIndex >= 2 },
                    { label: 'Getting everything ready', done: tailorStepIndex >= 3 },
                  ].map((task) => (
                    <div
                      key={task.label}
                      className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                        task.done
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-white'
                          : 'border-white/5 bg-white/[0.01] text-white/30'
                      }`}
                    >
                      <span className="text-xs">{task.label}</span>
                      {task.done ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-white/20 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─────────────────────────────────────────────────────────────────
                STEP 9: YOUR CUSTOM SETUP IS READY (BENTO STYLE + START NOW)
            ─────────────────────────────────────────────────────────────────── */}
            {wizardStep === 9 && (
              <div className="space-y-6 animate-fade-in">
                <div className="text-center space-y-1">
                  <div className="inline-flex p-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-2">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <h2 className="text-3xl font-black uppercase text-white tracking-tight">
                    Your Custom Setup is Ready!
                  </h2>
                  <p className="text-xs text-white/50 font-mono">
                    Here is your calibrated biometric assessment based on your answers.
                  </p>
                </div>

                {/* Bento Layout Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Bento Box 1: Your Weight (Downward Sloping Gradient Line) */}
                  <div className="rounded-2xl border border-white/10 bg-surface p-5 space-y-3 flex flex-col justify-between">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/40">
                        Your Weight
                      </span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                        {goal}
                      </span>
                    </div>

                    <div>
                      <p className="text-3xl font-mono font-black text-white">
                        {displayWeight} <span className="text-sm font-normal text-white/50">{weightUnit}</span>
                      </p>
                      <p className="text-[11px] font-mono text-white/40 mt-0.5">
                        Projected Week 4: <strong className="text-emerald-400">{calculatedMetrics.projectedW4Weight} {weightUnit}</strong>
                      </p>
                    </div>

                    {/* Gradient Downward Line Chart */}
                    <div className="pt-2">
                      <svg viewBox="0 0 240 50" preserveAspectRatio="none" className="w-full h-12 overflow-visible">
                        <defs>
                          <linearGradient id="modalGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#ef4444" />
                            <stop offset="100%" stopColor="#10b981" />
                          </linearGradient>
                        </defs>
                        <path
                          d="M 5 10 Q 120 25 235 42"
                          fill="none"
                          stroke="url(#modalGrad)"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                        />
                        <circle cx="5" cy="10" r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                        <circle cx="235" cy="42" r="4.5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
                      </svg>
                      <div className="flex justify-between text-[10px] font-mono text-white/40 border-t border-white/10 pt-1 mt-1">
                        <span className="text-red font-bold">Today ({displayWeight} {weightUnit})</span>
                        <span className="text-emerald-400 font-bold">Week 4 ({calculatedMetrics.projectedW4Weight} {weightUnit})</span>
                      </div>
                    </div>
                  </div>

                  {/* Bento Box 2: About You (Height, Weight, 1RM, BMI Gauge) */}
                  <div className="rounded-2xl border border-white/10 bg-surface p-5 space-y-3 flex flex-col justify-between">
                    <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/40">
                      About You
                    </span>

                    <div className="grid grid-cols-3 gap-2 font-mono text-center py-1 border-y border-white/8">
                      <div>
                        <p className="text-[9px] text-white/40 uppercase">Height</p>
                        <p className="text-xs font-bold text-white">{heightCm} cm</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/40 uppercase">Weight</p>
                        <p className="text-xs font-bold text-white">{weightKg} kg</p>
                      </div>
                      <div>
                        <p className="text-[9px] text-white/40 uppercase">1RM</p>
                        <p className="text-xs font-bold text-emerald-400">{calculatedMetrics.estimatedBench1RM} kg</p>
                      </div>
                    </div>

                    {/* BMI Gradient Line with White Circle Marker */}
                    <div>
                      <div className="flex justify-between text-[11px] font-mono mb-1.5">
                        <span className="text-white/40">Total BMI</span>
                        <span className="font-bold text-white">{calculatedMetrics.bmi}</span>
                      </div>

                      <div className="relative w-full h-3 rounded-full overflow-hidden">
                        <div
                          className="absolute inset-0 rounded-full"
                          style={{
                            background:
                              'linear-gradient(to right, #3b82f6 0%, #10b981 35%, #f59e0b 70%, #ef4444 100%)',
                          }}
                        />
                        {(() => {
                          const pct = Math.min(
                            96,
                            Math.max(4, ((calculatedMetrics.bmi - 15) / (35 - 15)) * 100)
                          );
                          return (
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-black shadow-[0_0_6px_rgba(255,255,255,0.9)]"
                              style={{ left: `calc(${pct}% - 7px)` }}
                            />
                          );
                        })()}
                      </div>

                      <div className="flex justify-between text-[9px] font-mono text-white/40 mt-1">
                        <span>Underweight</span>
                        <span className="text-emerald-400 font-semibold">Normal</span>
                        <span>Overweight</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Start Now Button (Guarded for Active Members) */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleStartNowClick}
                    className="w-full py-3.5 rounded-2xl bg-red hover:bg-red-hover text-white text-sm font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_20px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Start Now</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          MEMBERSHIP PLAN REQUIRED MODAL (FOR REGISTERED USERS ON "START NOW")
      ========================================================================= */}
      {showMembershipModal && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-fade-in"
          onClick={() => setShowMembershipModal(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-red/40 bg-[#121216] p-6 sm:p-7 shadow-2xl space-y-5 text-center relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 rounded-2xl bg-red/10 border border-red/30 text-red flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(239,68,68,0.25)]">
              <Lock className="w-8 h-8" />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-mono uppercase tracking-widest text-red font-bold">
                Membership Plan Required
              </span>
              <h3 className="text-xl font-black uppercase text-white tracking-tight">
                Unlock Your Plan
              </h3>
              <p className="text-xs text-white/60 font-sans leading-relaxed">
                Kailangan mo munang mag-avail ng membership plan bago makapag-proceed sa Your Plan interactive dashboard, customizable weekly blueprint, at workout execution tracking.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 text-left font-mono text-xs space-y-1.5">
              <div className="flex items-center justify-between text-white/50 text-[10px] uppercase">
                <span>Personalized Setup:</span>
                <span className="text-emerald-400 font-bold">Generated</span>
              </div>
              <p className="text-white font-bold text-sm">
                {goal} • {frequency} Days / Week
              </p>
              <p className="text-[11px] text-white/40">
                Focus Areas: <span className="text-white capitalize">{selectedFocus.join(', ')}</span>
              </p>
            </div>

            <div className="flex flex-col gap-2.5 pt-2">
              <Link
                to="/membership"
                className="w-full py-3.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-[0_0_18px_rgba(239,68,68,0.4)] flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Avail Membership Plan</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={() => setShowMembershipModal(false)}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-xs font-mono transition-colors cursor-pointer"
              >
                Review Calculated Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TOAST NOTIFICATION FOR ADDED EXERCISES
      ========================================================================= */}
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

      {/* =========================================================================
          ADD EXERCISE TO ROUTINE MODAL (Clean, page-level overlay without clipping)
      ========================================================================= */}
      {addingExerciseToRoutine && (
        <div
          className="fixed inset-0 z-[100000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in"
          onClick={() => setAddingExerciseToRoutine(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-white/15 bg-[#141418] p-5 shadow-2xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between pb-3 border-b border-white/10">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-red font-bold">
                  Add to Routine
                </span>
                <h4 className="font-bold text-sm text-white capitalize mt-0.5">
                  {cleanExerciseName(addingExerciseToRoutine.name)}
                </h4>
                <p className="text-[10px] text-white/40 font-mono capitalize">
                  {addingExerciseToRoutine.body_part} • {addingExerciseToRoutine.equipment}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAddingExerciseToRoutine(null)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] uppercase font-mono tracking-wider text-white/50 font-bold block mb-1">
                Select Scheduled Workout Day:
              </span>
              {weeklyWorkoutSplit
                .filter((d) => !d.isRest)
                .map((d) => (
                  <button
                    key={d.dayNumber}
                    type="button"
                    onClick={() => {
                      handleAddExerciseToDay(d.dayNumber, addingExerciseToRoutine);
                      setAddingExerciseToRoutine(null);
                    }}
                    className="w-full p-2.5 rounded-xl border border-white/8 bg-white/5 hover:bg-red/15 hover:border-red/40 text-left text-xs font-mono text-white/80 hover:text-white transition-all flex items-center justify-between group cursor-pointer"
                  >
                    <span className="font-semibold text-white group-hover:text-red">{d.dayName}</span>
                    <span className="text-[10px] text-white/40 group-hover:text-white">{d.focusTitle}</span>
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          LOADING SCREEN ON "START NOW"
      ========================================================================= */}
      {isStartingNow && (
        <div className="fixed inset-0 z-[100005] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md animate-fade-in">
          <img
            src="/assets/logos/thedgym.png"
            alt="The DGym"
            className="mb-8 h-12 w-auto object-contain"
          />
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
