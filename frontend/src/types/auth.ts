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
  login: (credentials: LoginCredentials) => Promise<User>
  register: (credentials: RegisterCredentials) => Promise<User>
  logout: () => Promise<void>
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