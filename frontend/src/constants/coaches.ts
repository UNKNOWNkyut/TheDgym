export interface OfficialCoachProfile {
  name: string
  role: string
  primaryFocus: string
  specialties: readonly string[]
  bio: string
}

export interface OfficialPTPackage {
  id: string
  name: string
  sessionsCount: number
  durationMinutes: number
  durationLabel: string
  price: number
  priceFormatted: string
  coachesLabel: string
  description: string
}

export interface OfficialGroupClassInfo {
  name: string
  classType: 'tabata' | 'hiit'
  category: string
  coachName: string
  scheduleDays: string
  scheduleTime: string
  rateLabel: string
  level: string
  description: string
}

/**
 * Verified coaches, 12-session PT packages, and free 6:00 PM group classes
 * sourced from TDGGYM-QUESTIONNAIRES-1 (The DGym Rosario, Batangas).
 */
export const OFFICIAL_COACHES: readonly OfficialCoachProfile[] = [
  {
    name: 'Coach Ivan',
    role: 'Personal Trainer',
    primaryFocus: 'Muscle Gain',
    specialties: ['Muscle Gain', 'Hypertrophy Programming', 'Strength Progression'],
    bio: 'Dedicated 1-on-1 Personal Trainer focused on structured muscle gain, progressive overload, and biomechanically sound lifting technique.',
  },
  {
    name: 'Coach Marta',
    role: 'Personal Trainer & Group Instructor',
    primaryFocus: 'Muscle Gain • TABATA (6:00 PM)',
    specialties: ['Muscle Gain', 'TABATA (6:00 PM)', 'Body Recomposition'],
    bio: 'Certified Personal Trainer for individualized muscle gain blocks and lead coach for our free 6:00 PM TABATA conditioning sessions.',
  },
  {
    name: 'Coach Kresler',
    role: 'Personal Trainer & Boxing Coach',
    primaryFocus: 'Boxing • HIIT (6:00 PM)',
    specialties: ['Boxing (1.5 HR)', 'Cardio Boxing', 'HIIT (6:00 PM)'],
    bio: 'Boxing and metabolic conditioning specialist leading 1.5-hour Boxing and Cardio Boxing packages plus our free 6:00 PM HIIT classes.',
  },
]

export const OFFICIAL_PT_PACKAGES: readonly OfficialPTPackage[] = [
  {
    id: 'muscle-gain-12',
    name: '12 Sessions — Muscle Gain',
    sessionsCount: 12,
    durationMinutes: 60,
    durationLabel: '60 mins / session',
    price: 8000,
    priceFormatted: '₱8,000',
    coachesLabel: 'Coach Ivan • Coach Marta',
    description:
      '12 structured 1-on-1 hypertrophy and progressive strength sessions tailored to your physique and strength targets.',
  },
  {
    id: 'boxing-12-90m',
    name: '12 Sessions — Boxing (1.5 HR)',
    sessionsCount: 12,
    durationMinutes: 90,
    durationLabel: '1.5 hours (90 mins) / session',
    price: 8000,
    priceFormatted: '₱8,000',
    coachesLabel: 'Coach Kresler',
    description:
      '12 full 90-minute boxing sessions covering technical pad work, defensive mechanics, footwork, and fight conditioning.',
  },
  {
    id: 'cardio-boxing-12',
    name: '12 Sessions — Cardio Boxing',
    sessionsCount: 12,
    durationMinutes: 60,
    durationLabel: '60 mins / session',
    price: 4000,
    priceFormatted: '₱4,000',
    coachesLabel: 'Coach Kresler',
    description:
      '12 high-energy cardio boxing sessions engineered for fat loss, stamina, agility, and full-body stress relief.',
  },
]

export const OFFICIAL_GROUP_CLASSES: readonly OfficialGroupClassInfo[] = [
  {
    name: 'TABATA',
    classType: 'tabata',
    category: 'Interval Conditioning',
    coachName: 'Coach Marta',
    scheduleDays: 'Daily Evening Schedule',
    scheduleTime: 'Every 6:00 PM',
    rateLabel: '₱0 — Free w/ Membership',
    level: 'All Levels',
    description:
      'High-intensity Tabata intervals led by Coach Marta to boost metabolic rate, cardiovascular endurance, and athletic work capacity.',
  },
  {
    name: 'HIIT',
    classType: 'hiit',
    category: 'High-Intensity Interval Training',
    coachName: 'Coach Kresler',
    scheduleDays: 'Daily Evening Schedule',
    scheduleTime: 'Every 6:00 PM',
    rateLabel: '₱0 — Free w/ Membership',
    level: 'All Levels',
    description:
      'Explosive full-body conditioning circuits led by Coach Kresler combining athletic movement, core work, and stamina intervals.',
  },
]

export const CLASS_TYPE_LABELS: Record<string, string> = {
  tabata: 'TABATA',
  hiit: 'HIIT',
  barbell_club: 'Barbell Club',
  conditioning: 'Conditioning',
  open_gym: 'Open Gym',
  powerlifting: 'Powerlifting',
  strength: 'Strength',
  other: 'Other',
}
