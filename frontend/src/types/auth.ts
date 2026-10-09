// ─── Auth Types ──────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'staff' | 'trainer' | 'member'

export interface User {
  id: number
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

export interface LoginCredentials {
  email: string
  password: string
}

export interface RegisterCredentials {
  email: string
  password: string
  full_name: string
  phone?: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (
    credentials: LoginCredentials,
  ) => Promise<User>

  register: (
    credentials: RegisterCredentials,
  ) => Promise<User>

  logout: () => Promise<void>

  refreshUser:
    () => Promise<User | null>

  clearError: () => void
}


// ─── Gym Management Types ────────────────────────────────────────────────────

export type MemberStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'expired'

export type Gender =
  | 'male'
  | 'female'
  | 'other'
  | 'prefer_not_to_say'

export type MembershipStatus =
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'pending'

export type PaymentMethod =
  | 'cash'
  | 'gcash'
  | 'maya'
  | 'bank_transfer'
  | 'other'


export interface MembershipSummary {
  id: number
  plan_id: number
  plan_name: string | null
  start_date: string
  end_date: string
  status: MembershipStatus
  paid_amount: string | null
  payment_method: PaymentMethod | null
  payment_reference: string | null
  notes: string | null
  created_at: string
}


export interface Member {
  id: number
  member_code: string
  first_name: string
  last_name: string
  full_name: string
  email: string | null
  phone: string | null
  date_of_birth: string | null
  gender: Gender | null
  address: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  status: MemberStatus
  is_active: boolean
  notes: string | null
  joined_at: string
  created_at: string
  updated_at: string
  memberships: MembershipSummary[]
}


export interface MemberCreate {
  first_name: string
  last_name: string
  email?: string
  phone?: string
  date_of_birth?: string
  gender?: Gender
  address?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  notes?: string
}


export interface MemberUpdate extends Partial<MemberCreate> {
  status?: MemberStatus
  is_active?: boolean
}


export interface MemberStats {
  total: number
  active: number
  expired: number
  inactive: number
  suspended: number
}


export interface MembershipPlan {
  id: number
  name: string
  slug: string
  description: string | null
  duration_days: number
  price_php: string
  is_active: boolean
  sort_order: number
  created_at: string
}


export interface MembershipPlanCreate {
  name: string
  slug: string
  description?: string
  duration_days: number
  price_php: number
  is_active?: boolean
  sort_order?: number
}


export interface AssignMembershipCreate {
  member_id: number
  plan_id: number
  start_date: string
  paid_amount?: number
  payment_method?: PaymentMethod
  payment_reference?: string
  notes?: string
}


// ─── Visits, Classes & PT Types (Phase 5) ────────────────────────────────────

export type VisitType = 'walk_in' | 'class' | 'pt_session' | 'open_gym'
export type ClassType = 'barbell_club' | 'conditioning' | 'open_gym' | 'powerlifting' | 'strength' | 'hiit' | 'other'
export type ClassStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
export type PTSessionStatus = 'pending' | 'confirmed' | 'scheduled' | 'rejected' | 'completed' | 'cancelled' | 'no_show'

export interface Visit {
  id: number
  member_id: number
  member_code: string | null
  member_name: string | null
  visit_type: VisitType
  checked_in_at: string
  checked_out_at: string | null
  notes: string | null
  recorded_by_user_id: number | null
  created_at: string
}

export interface VisitCreate {
  member_id: number
  visit_type?: VisitType
  notes?: string
}

export interface ClassEnrollment {
  id: number
  member_id: number
  member_code: string | null
  member_name: string | null
  enrolled_at: string
}

export interface ClassSession {
  id: number
  name: string
  description: string | null
  coach_id: number | null
  coach_name: string | null
  class_type: ClassType
  scheduled_at: string
  duration_minutes: number
  max_capacity: number
  enrolled_count: number
  status: ClassStatus
  location: string | null
  notes: string | null
  created_at: string
  enrollments: ClassEnrollment[]
}

export interface ClassSessionCreate {
  name: string
  description?: string
  coach_id?: number
  class_type?: ClassType | string
  scheduled_at: string
  duration_minutes?: number
  max_capacity?: number
  location?: string
  notes?: string
}

export interface PTSession {
  id: number
  trainer_id: number | null
  trainer_name: string | null
  member_id: number
  member_code: string | null
  member_name: string | null
  scheduled_at: string
  duration_minutes: number
  status: PTSessionStatus
  notes: string | null
  coach_notes: string | null
  rejection_reason?: string | null
  created_at: string
  updated_at?: string
}

export interface PTSessionCreate {
  member_id: number
  trainer_id?: number
  scheduled_at: string
  duration_minutes?: number
  notes?: string
  coach_notes?: string
}

export interface PTSessionBookCreate {
  trainer_id: number
  scheduled_at: string
  duration_minutes?: number
  notes?: string
}

export interface TrainerProfile {
  id: number
  full_name: string
  email: string
  phone: string | null
  specialties: string[]
  bio: string | null
}


// ─── Finance Types ────────────────────────────────────────────────────────────

export interface ExpenseCategory {
  id: number
  name: string
  description: string | null
  is_active: boolean
  created_by_user_id: number | null
  created_at: string
  updated_at: string
}

export interface ExpenseCategoryCreate {
  name: string
  description?: string
}

export interface ExpenseCategoryUpdate {
  name?: string
  description?: string
  is_active?: boolean
}

export interface Expense {
  id: number
  category_id: number
  category_name: string
  amount: string
  expense_date: string
  description: string
  receipt_path: string | null
  recorded_by_user_id: number | null
  recorded_by_name: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface ExpenseCreate {
  category_id: number
  amount: number
  expense_date: string
  description: string
  receipt_path?: string
}

export interface ExpenseUpdate {
  category_id?: number
  amount?: number
  expense_date?: string
  description?: string
  receipt_path?: string
}

export interface ExpenseCategoryTotal {
  category_id: number
  category_name: string
  total: string
}

export interface FinanceSummary {
  year: number
  month: number | null
  membership_revenue: string
  total_expenses: string
  profit: string
  expense_count: number
  expenses_by_category: ExpenseCategoryTotal[]
}


// ─── Analytics & Churn Types (Phase 6) ──────────────────────────────────────

export interface HourlyCheckinStat {
  hour: number
  hour_label: string
  count: number
}

export interface ClassPopularityStat {
  name: string
  class_type: string
  total_enrollments: number
}

export interface AnalyticsOverview {
  total_visits_this_month: number
  attendance_growth_pct: number
  active_members_count: number
  average_dwell_minutes: number
  peak_hour: string
  hourly_distribution: HourlyCheckinStat[]
  popular_classes: ClassPopularityStat[]
}

export interface ChurnOverview {
  total_members_assessed: number
  high_risk_count: number
  medium_risk_count: number
  low_risk_count: number
  overall_retention_rate_pct: number
}

export interface AtRiskMemberItem {
  member_id: number
  member_code: string
  full_name: string
  email: string | null
  phone: string | null
  active_plan_name: string | null
  days_since_last_checkin: number
  visit_frequency_weekly: number
  churn_probability: number
  risk_tier: 'HIGH' | 'MEDIUM' | 'LOW'
  top_risk_factors: string[]
  predicted_at: string
}

export interface MemberChurnDetail {
  member_id: number
  member_code: string
  full_name: string
  email: string | null
  phone: string | null
  status: string
  churn_probability: number
  risk_tier: 'HIGH' | 'MEDIUM' | 'LOW'
  top_risk_factors: string[]
  features: Record<string, any>
  predicted_at: string
}
