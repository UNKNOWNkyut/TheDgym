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

export interface PlanDraft {
  birthDay: number;
  birthMonth: number; // 1-12
  birthYear: number;
  weightUnit: 'kg' | 'lbs';
  weightKg: number; // stored in kg
  heightUnit: 'cm' | 'ft';
  heightCm: number; // stored in cm
  goal: GoalType;
  experience: ExperienceType;
  selectedFocus: FocusArea[];
  frequency: number;
}

export interface CalculatedPlanMetrics {
  age: number;
  bmi: number;
  estimatedBench1RM: number;
  estimatedSquat1RM: number;
  projectedW4Weight: number;
  targetCalories: number;
  proteinGrams: number;
  fatGrams: number;
  carbGrams: number;
}

export interface WorkoutSplitDay {
  dayNumber: number;
  dayName: string;
  focusTitle: string;
  targetCategory: string;
  duration: string;
  intensity: string;
  isRest: boolean;
}

const CURRENT_YEAR = new Date().getFullYear();

export const ITEMS_PER_PAGE = 40;

export const DEFAULT_PLAN_DRAFT: PlanDraft = {
  birthDay: 15,
  birthMonth: 6,
  birthYear: 1998,
  weightUnit: 'kg',
  weightKg: 72,
  heightUnit: 'cm',
  heightCm: 175,
  goal: 'Build Muscle',
  experience: 'Intermediate',
  selectedFocus: ['chest', 'shoulder'],
  frequency: 4,
};

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const FOCUS_OPTIONS: { id: FocusArea; label: string; description: string }[] = [
  { id: 'chest', label: 'Chest', description: 'Pectorals, upper and lower chest definition' },
  { id: 'shoulder', label: 'Shoulders', description: 'Anterior, lateral, and rear deltoid width' },
  { id: 'arm', label: 'Arms', description: 'Biceps, triceps, and forearm vascularity & peak' },
  { id: 'back', label: 'Back', description: 'Lats, upper traps, and spinal erectors' },
  { id: 'abs', label: 'Abs & Core', description: 'Rectus abdominis, obliques, and core stability' },
  { id: 'butt', label: 'Glutes / Butt', description: 'Gluteus maximus and hip extension power' },
  { id: 'leg', label: 'Legs', description: 'Quadriceps, hamstrings, and calves strength' },
  { id: 'full body', label: 'Full Body', description: 'Total kinetic chain balanced symmetry' },
];

export const FREQUENCY_OPTIONS = [
  { days: 1, label: '1 day / week', sub: 'Light maintenance or recovery' },
  { days: 2, label: '2 days / week', sub: 'Base conditioning split' },
  { days: 3, label: '3 days / week', sub: 'Recommended minimum for steady progress' },
  { days: 4, label: '4 days / week', sub: 'Optimal push / pull / legs / core split' },
  { days: 5, label: '5 days / week', sub: 'High volume targeted muscle focus' },
  { days: 6, label: '6 days / week', sub: 'Elite athlete athletic conditioning' },
  { days: 7, label: 'Every day', sub: 'Daily active mobility and training routine' },
];

export const LIBRARY_CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'waist', label: 'Abs / Core' },
  { id: 'upper legs', label: 'Quads & Legs' },
  { id: 'arm', label: 'Arms' },
  { id: 'cardio', label: 'Cardio' },
];

export const RECOVERY_PILLARS = [
  { icon: '💧', title: 'Hydration Focus', subtitle: 'Electrolyte balance & water intake' },
  { icon: '🧘', title: 'Stretching & Mobility', subtitle: 'Foam rolling & mobility flow' },
  { icon: '😴', title: '8 Hours Deep Sleep', subtitle: 'Physical & nervous system repair' },
  { icon: '🛡️', title: 'Non-Workout Day', subtitle: 'Deep recovery for muscle growth' },
];

export const MEAL_BLUEPRINT = [
  {
    badge: 'Meal 1 • Breakfast Power',
    badgeColor: 'text-amber-400',
    calories: '~520 kcal',
    title: 'Eggs, Oatmeal & Fresh Banana',
    items: [
      '3 Whole Eggs scrambled with spinach & tomato',
      '1 Cup Rolled Oats with 1 scoop Whey Protein or chia seeds',
      '1 Medium Banana for immediate glycogen support',
    ],
    macros: { protein: '38g', carbs: '58g', fats: '16g' },
  },
  {
    badge: 'Meal 2 • High-Performance Lunch',
    badgeColor: 'text-emerald-400',
    calories: '~640 kcal',
    title: 'Grilled Chicken Breast & Brown Rice',
    items: [
      '200g Grilled lean chicken breast with garlic & calamansi',
      '1.5 Cups Steamed Brown Rice or Sweet Potato (kamote)',
      'Steamed broccoli or green beans tossed in 1 tsp olive oil',
    ],
    macros: { protein: '52g', carbs: '65g', fats: '14g' },
  },
  {
    badge: 'Meal 3 • Pre / Post Training Fuel',
    badgeColor: 'text-blue-400',
    calories: '~380 kcal',
    title: 'Greek Yogurt & Roasted Almonds',
    items: [
      '200g Plain low-fat Greek yogurt with raw honey',
      '15-20g Whole roasted almonds or peanut butter',
      'Electrolyte water or 500ml fresh hydration',
    ],
    macros: { protein: '28g', carbs: '32g', fats: '12g' },
  },
  {
    badge: 'Meal 4 • Muscle Recovery Dinner',
    badgeColor: 'text-purple-400',
    calories: '~560 kcal',
    title: 'Pan-Seared Fish Fillet & Mixed Greens',
    items: [
      '200g Tilapia, Bangus belly, or Salmon fillet',
      '1 Cup Steamed corn or quinoa',
      'Generous cucumber, cabbage, and avocado salad',
    ],
    macros: { protein: '44g', carbs: '45g', fats: '18g' },
  },
];

const EXPERIENCE_MULTIPLIER: Record<ExperienceType, number> = {
  Beginner: 0.85,
  Intermediate: 1.25,
  Advanced: 1.6,
};

const GOAL_WEIGHT_DELTA: Record<GoalType, number> = {
  'Fat Loss': -3.5,
  'Build Muscle': 1.8,
  'Gain Strength': 0.4,
};

export const GOAL_STRATEGY_LABEL: Record<GoalType, string> = {
  'Fat Loss': 'Optimal Cut',
  'Build Muscle': 'Lean Bulk',
  'Gain Strength': 'Strength Gain',
};

export function cleanExerciseName(name: string): string {
  if (!name) return '';
  return name.replace(/[^\x20-\x7E]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Multi-user isolated storage keys
export function resolveUserStorageKey(user?: { id?: number | string | null; email?: string | null } | null): string {
  if (user?.id) return `user_${user.id}`;
  if (user?.email) return `email_${user.email.toLowerCase().trim()}`;
  return 'guest';
}

export function draftFromSavedPlan(parsed: UserPlanData): PlanDraft {
  return {
    birthDay: parsed.birthDate?.day || 15,
    birthMonth: parsed.birthDate?.month || 6,
    birthYear: parsed.birthDate?.year || 1998,
    weightUnit: parsed.weightUnit || 'kg',
    weightKg: parsed.weight || 72,
    heightUnit: parsed.heightUnit || 'cm',
    heightCm: parsed.height || 175,
    goal: parsed.goal || 'Build Muscle',
    experience: parsed.experience || 'Intermediate',
    selectedFocus: parsed.focusAreas || ['chest', 'shoulder'],
    frequency: parsed.frequency || 4,
  };
}

export function getBmiStatus(bmi: number): { label: string; colorClass: string } {
  if (bmi < 18.5) return { label: 'Underweight', colorClass: 'text-blue-400' };
  if (bmi <= 24.9) return { label: 'Normal Range', colorClass: 'text-emerald-400' };
  return { label: 'Overweight', colorClass: 'text-amber-400' };
}

// Clamped between 15 and 35 BMI range mapped to 0-100%
export function getBmiMarkerPercent(bmi: number): number {
  return Math.min(96, Math.max(4, ((bmi - 15) / (35 - 15)) * 100));
}

export function toRoutineExercise(ex: ExerciseItem): RoutineExercise {
  return {
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
}

// Pick sample exercises from loaded dataset for day's split
export function buildInitialDailyRoutines(
  exercises: ExerciseItem[],
  weeklyWorkoutSplit: WorkoutSplitDay[]
): Record<number, RoutineExercise[]> {
  if (exercises.length === 0) return {};
  const initial: Record<number, RoutineExercise[]> = {};
  weeklyWorkoutSplit.forEach((day) => {
    if (!day.isRest) {
      const normalized = day.targetCategory.toLowerCase();
      const sample = exercises
        .filter(
          (e) =>
            e.body_part.toLowerCase().includes(normalized) ||
            e.category.toLowerCase().includes(normalized)
        )
        .slice(0, 4);
      initial[day.dayNumber] = sample.map(toRoutineExercise);
    }
  });
  return initial;
}

// Calculate Metrics: Age, BMI, Estimated 1RM, Calorie Target
export function calculatePlanMetrics(draft: PlanDraft): CalculatedPlanMetrics {
  const { birthYear, weightKg, heightCm, goal, experience, frequency } = draft;
  const age = CURRENT_YEAR - birthYear;
  const heightInMeters = heightCm / 100;
  const bmi = parseFloat((weightKg / (heightInMeters * heightInMeters)).toFixed(1));

  // Realistic estimated 1RM Bench/Squat based on bodyweight, experience & goal
  const expMultiplier = EXPERIENCE_MULTIPLIER[experience];
  const estimatedBench1RM = Math.round(weightKg * expMultiplier);
  const estimatedSquat1RM = Math.round(weightKg * (expMultiplier * 1.35));

  // Projected 4-Week Weight Trend
  const targetDelta = GOAL_WEIGHT_DELTA[goal];
  const projectedW4Weight = parseFloat((weightKg + targetDelta).toFixed(1));

  // Daily Macro Estimate (Mifflin-St Jeor Formula approx)
  const bmr = 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  let tdeeFactor = 1.7;
  if (frequency <= 2) tdeeFactor = 1.3;
  else if (frequency <= 4) tdeeFactor = 1.5;

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
}

// Filter exercises for library tab with precise body part matching & search anti-bleed
export function filterLibraryExercises(
  exercises: ExerciseItem[],
  searchQuery: string,
  selectedCategory: string
): ExerciseItem[] {
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

    return exName.includes(q) || exBodyPart.includes(q) || exCat.includes(q) || exEquip.includes(q);
  });
}

function getTargetCategory(focus: FocusArea): string {
  switch (focus) {
    case 'arm': return 'upper arms';
    case 'shoulder': return 'shoulders';
    case 'leg': return 'upper legs';
    case 'abs': return 'waist';
    default: return focus;
  }
}

// Filter 7-day personalized workout split based on user plan focus
export function buildWeeklyWorkoutSplit(selectedFocus: FocusArea[], frequency: number): WorkoutSplitDay[] {
  const isFullBody = selectedFocus.includes('full body');
  const firstFocus = selectedFocus[0] || 'chest';
  const secondFocus = selectedFocus[1] || 'back';

  let day2Title = 'Rest & Deep Muscle Recovery';
  if (frequency >= 3) {
    day2Title = isFullBody ? 'Lower Body & Core Drive' : `${secondFocus.toUpperCase()} Strength & Pull`;
  }

  let day5Title = 'Rest Day';
  if (frequency >= 5) day5Title = 'Legs & Glutes Power Station';
  else if (frequency === 3) day5Title = 'Full Body Functional Blitz';

  return [
    {
      dayNumber: 1,
      dayName: 'Day 1 • Monday',
      focusTitle: isFullBody ? 'Full Body Hypertrophy' : `${firstFocus.toUpperCase()} Power & Definition`,
      targetCategory: isFullBody ? 'chest' : getTargetCategory(firstFocus),
      duration: '50-60 min',
      intensity: 'High Volume',
      isRest: false,
    },
    {
      dayNumber: 2,
      dayName: 'Day 2 • Tuesday',
      focusTitle: day2Title,
      targetCategory: isFullBody ? 'upper legs' : getTargetCategory(secondFocus),
      duration: frequency >= 3 ? '45-55 min' : 'Active Rest',
      intensity: frequency >= 3 ? 'Moderate-Heavy' : 'Recovery',
      isRest: frequency < 3,
    },
    {
      dayNumber: 3,
      dayName: 'Day 3 • Wednesday',
      focusTitle: frequency >= 4 ? 'Cardio Engine & Functional Core' : 'Mobility, Foam Rolling & Walk',
      targetCategory: 'waist',
      duration: frequency >= 4 ? '40-50 min' : 'Active Rest',
      intensity: 'Metabolic Pace',
      isRest: frequency < 4,
    },
    {
      dayNumber: 4,
      dayName: 'Day 4 • Thursday',
      focusTitle: frequency >= 4 ? `${firstFocus.toUpperCase()} Compound Overload` : 'Mid-Week Rest',
      targetCategory: getTargetCategory(firstFocus),
      duration: frequency >= 4 ? '50-60 min' : 'Rest Day',
      intensity: 'Progressive Overload',
      isRest: frequency < 4,
    },
    {
      dayNumber: 5,
      dayName: 'Day 5 • Friday',
      focusTitle: day5Title,
      targetCategory: 'upper legs',
      duration: '55 min',
      intensity: 'Heavy Compound',
      isRest: frequency < 3 || frequency === 4,
    },
    {
      dayNumber: 6,
      dayName: 'Day 6 • Saturday',
      focusTitle: frequency >= 6 ? 'Shoulders, Arms & Weak Point Pump' : 'Weekend Active Recovery',
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
}
