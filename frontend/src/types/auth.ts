// Auth Types

export type UserRole = 'admin' | 'staff' | 'trainer' | 'member' | 'user'

export type SupportedIdType =
  | 'philsys'
  | 'drivers_license'
  | 'school_id'
  | 'umid'
  | 'passport'
  | 'postal_id'
  | 'voters_id'
  | 'other_gov_id'

export interface User {
  id: number
  email: string
  full_name: string
  phone: string | null
  role: UserRole
  is_active: boolean
  created_at: string
  has_active_membership?: boolean
  membership_status?: 'active' | 'pending' | 'inactive' | 'suspended' | 'expired' | 'none'
  plan_name?: string | null
  profile_picture_url?: string | null
  face_enrolled?: boolean
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
  plan_slug?: string
  face_descriptor: number[]
  liveness_passed: boolean
  id_type: SupportedIdType
  id_number?: string
  id_ocr_name?: string
  id_face_match_score: number
  id_image_base64?: string
  live_image_base64?: string
}

export interface TokenResponse {
  token_type: string
  user: User
}

interface LoginUserPreview {
  id: number
  email: string
  full_name: string
  role: UserRole
}

export interface LoginChallengeResponse {
  requires_face_verification: boolean
  enrollment_required: boolean
  challenge_token: string
  user: LoginUserPreview
}

export interface FaceVerifyPayload {
  challenge_token: string
  face_descriptor: number[]
  liveness_passed: boolean
  live_image_base64?: string
}

export interface FaceEnrollPayload {
  challenge_token: string
  face_descriptor: number[]
  liveness_passed: boolean
  id_type: SupportedIdType
  id_number?: string
  id_ocr_name?: string
  id_face_match_score: number
  id_image_base64?: string
  live_image_base64?: string
}

export interface OcrScanResponse {
  provider: string
  raw_text: string
  used_external_api: boolean
}

export interface BiometricProvidersStatus {
  ocr_provider: string
  face_provider: string
  ocr_api_configured: boolean
  face_api_configured: boolean
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  isLoggingOut: boolean
  error: string | null

  login: (
    credentials: LoginCredentials,
  ) => Promise<LoginChallengeResponse>

  verifyFaceLogin: (
    payload: FaceVerifyPayload,
  ) => Promise<User>

  enrollFaceAndLogin: (
    payload: FaceEnrollPayload,
  ) => Promise<User>

  register: (
    credentials: RegisterCredentials,
  ) => Promise<User>

  loginWithGoogle: (credential: string) => Promise<LoginChallengeResponse>
  availPlan: (planSlug: string) => Promise<User>
  logout: () => Promise<void>

  refreshUser:
    () => Promise<User | null>

  clearError: () => void
}


// Gym Management Types

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

type MembershipStatus =
  | 'active'
  | 'expired'
  | 'cancelled'
  | 'pending'

export type PaymentMethod =
  | 'cash'
  | 'gcash'
  | 'bank_transfer'
  | 'qr_payment'
  | 'credit_card'
  | 'debit_card'
  | 'maya'
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
  admin_viewed_at?: string | null
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


export interface MemberStats {
  total: number
  active: number
  expired: number
  inactive: number
  suspended: number
  period_year?: number
  period_month?: number
  period_label?: string
  new_members_this_month?: number
  renewals_this_month?: number
  renewals_all_time?: number
  upcoming_expirations_7d?: number
  payments_this_month?: number | null
  monthly_income?: string | null
  monthly_expenses?: string | null
  profit_loss?: string | null
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


// Visits, Classes & PT Types (Phase 5)

export type VisitType = 'walk_in' | 'class' | 'pt_session' | 'open_gym'
type ClassType = 'tabata' | 'hiit' | 'barbell_club' | 'conditioning' | 'open_gym' | 'powerlifting' | 'strength' | 'other'
type ClassStatus = 'scheduled' | 'ongoing' | 'completed' | 'cancelled'
export type PTSessionStatus = 'pending' | 'confirmed' | 'scheduled' | 'rejected' | 'completed' | 'cancelled' | 'no_show'

export interface Visit {
  id: number
  member_id: number
  member_code: string | null
  member_name: string | null
  visit_type: VisitType
  entry_method?: 'manual' | 'rfid_tap' | 'qr_scan'
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


// Finance Types

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

interface ExpenseCategoryTotal {
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


// Analytics & Churn Types (Phase 6)

interface HourlyCheckinStat {
  hour: number
  hour_label: string
  count: number
}

interface ClassPopularityStat {
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

export interface RetentionStrategy {
  id: number
  member_id: number
  risk_tier: 'HIGH' | 'MEDIUM' | 'LOW'
  churn_probability: number
  urgency: 'CRITICAL' | 'HIGH' | 'MODERATE'
  strategy_title: string
  diagnosis_summary: string
  tactical_action_steps: string[]
  offer_title: string
  offer_message: string
  offer_action_text: string
  offer_action_url: string
  status: 'generated' | 'dispatched' | 'completed'
  dispatched_at: string | null
  created_at: string
}

export interface AppNotification {
  id: number
  user_id: number | null
  member_id: number | null
  title: string
  message: string
  type:
    | 'retention'
    | 'offer'
    | 'booking'
    | 'announcement'
    | 'churn_alert'
    | 'enrollment'
    | 'registration'
    | 'pt_booking'
    | 'session_alert'
  action_text: string | null
  action_url: string | null
  is_read: boolean
  created_at: string
}


// Smart Keycard Access Control Types

export type KeycardStatus = 'active' | 'inactive' | 'lost' | 'stolen' | 'revoked'

type TapDecision =
  | 'granted_check_in'
  | 'granted_check_out'
  | 'already_checked_in'
  | 'already_checked_out'
  | 'paired_card'
  | 'denied_unregistered_card'
  | 'denied_card_lost_or_stolen'
  | 'denied_card_revoked'
  | 'denied_member_suspended'
  | 'denied_member_inactive'
  | 'denied_no_membership'
  | 'denied_membership_expired'
  | 'denied_payment_pending'
  | 'denied_cooldown_duplicate'

export interface MemberKeycard {
  id: number
  member_id: number
  card_uid_masked: string
  card_label: string
  status: KeycardStatus
  issued_at: string
  revoked_at: string | null
  revoked_reason: string | null
  last_tapped_at: string | null
  created_at: string
}

export interface TapVerificationResult {
  granted: boolean
  decision: TapDecision
  reason_message: string
  privacy_safe_message: string
  card_uid_masked: string
  member_id: number | null
  member_code: string | null
  member_name: string | null
  member_status: string | null
  plan_name: string | null
  membership_end_date: string | null
  days_remaining: number | null
  warning_banner: string | null
  visit_id: number | null
  visit_type: string | null
  checked_in_at: string | null
  checked_out_at: string | null
  latency_ms: number
  tapped_at: string
}

export interface KeycardTapLog {
  id: number
  keycard_id: number | null
  member_id: number | null
  member_code: string | null
  member_name: string | null
  scanner_name: string | null
  visit_id: number | null
  card_uid_masked: string
  decision: TapDecision
  granted: boolean
  reason_message: string
  plan_name: string | null
  days_remaining: number | null
  warning_banner: string | null
  latency_ms: number
  tapped_at: string
}

export interface PairingSessionStatus {
  active: boolean
  member_id: number | null
  member_code: string | null
  member_name: string | null
  card_label: string | null
  expires_at: string | null
}

export interface CreateCheckoutPayload {
  plan_id?: number
  plan_slug?: string
  success_url?: string
  failure_url?: string
}

export interface CheckoutSessionResponse {
  status: string
  invoice_id: string
  invoice_url: string
  external_id: string
  amount: number
  plan_name: string
  plan_price: number
}

export interface PaymentVerifyResponse {
  status: string
  invoice_id: string
  invoice_status: string
  is_paid: boolean
  amount: number
  payment_method?: string
  membership_activated: boolean
  membership_id?: number
}
