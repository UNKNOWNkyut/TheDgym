import type {
  AccountProfile,
  AccountProfileUpdate,
  ChangePasswordPayload,
  MessageResponse,
  ProfilePictureResponse,
} from '@/types/account'
import type {
  AnalyticsOverview,
  AppNotification,
  AssignMembershipCreate,
  AtRiskMemberItem,
  BiometricProvidersStatus,
  CheckoutSessionResponse,
  ChurnOverview,
  ClassEnrollment,
  ClassSession,
  ClassSessionCreate,
  CreateCheckoutPayload,
  Expense,
  ExpenseCategory,
  ExpenseCategoryCreate,
  ExpenseCreate,
  ExpenseUpdate,
  FaceEnrollPayload,
  FaceVerifyPayload,
  FinanceSummary,
  KeycardStatus,
  KeycardTapLog,
  LoginChallengeResponse,
  LoginCredentials,
  Member,
  MemberChurnDetail,
  MemberCreate,
  MemberKeycard,
  MembershipPlan,
  MembershipPlanCreate,
  MembershipSummary,
  MemberStats,
  OcrScanResponse,
  PairingSessionStatus,
  PaymentVerifyResponse,
  PTSession,
  PTSessionBookCreate,
  PTSessionCreate,
  RegisterCredentials,
  RetentionStrategy,
  TapVerificationResult,
  TokenResponse,
  TrainerProfile,
  User,
  Visit,
  VisitCreate,
} from '@/types/auth'

const LEGACY_TOKEN_STORAGE_KEY = 'dgym_access_token'
const SESSION_HINT_KEY = 'dgym_session_active'
const DEFAULT_TIMEOUT_MS = 15_000
const LONG_TASK_TIMEOUT_MS = 60_000
const AUTH_EXPIRED_EVENT = 'dgym:auth-expired'

const RAW_API_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').trim().replace(/\/+$/, '')

const CREDENTIAL_AUTH_ENDPOINTS = new Set([
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/google',
  '/api/auth/logout',
  '/api/auth/face/verify',
  '/api/auth/face/enroll',
])

type RequestOptions = RequestInit & {
  timeoutMs?: number
}

// Non-sensitive boolean marker so anonymous visits skip /api/auth/me while JWT lives only in httpOnly cookie
export function hasSessionHint(): boolean {
  if (localStorage.getItem(LEGACY_TOKEN_STORAGE_KEY)) {
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY)
    localStorage.setItem(SESSION_HINT_KEY, '1')
    return true
  }
  return localStorage.getItem(SESSION_HINT_KEY) === '1'
}

function setSessionHint(): void {
  localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY)
  localStorage.setItem(SESSION_HINT_KEY, '1')
}

export function clearSessionHint(): void {
  localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY)
  localStorage.removeItem(SESSION_HINT_KEY)
}

export function onAuthExpired(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener(AUTH_EXPIRED_EVENT, listener)
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener)
}

function resolveApiUrl(endpoint: string): string {
  if (/^https?:\/\//i.test(endpoint)) return endpoint
  const normalized = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return RAW_API_BASE ? `${RAW_API_BASE}${normalized}` : normalized
}

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

function buildQuery(
  params?: Record<string, string | number | boolean | undefined | null>,
): string {
  if (!params) return ''
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, String(value))
    }
  }
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, signal: externalSignal, ...fetchOptions } = options
  const headers = new Headers(fetchOptions.headers)

  if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (!headers.has('X-Requested-With')) {
    headers.set('X-Requested-With', 'XMLHttpRequest')
  }

  const controller = new AbortController()
  let didTimeout = false
  const timerId = globalThis.setTimeout(() => {
    didTimeout = true
    controller.abort()
  }, timeoutMs)

  const handleExternalAbort = () => controller.abort()
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', handleExternalAbort, { once: true })
    }
  }

  let response: Response
  try {
    response = await fetch(resolveApiUrl(endpoint), {
      ...fetchOptions,
      headers,
      signal: controller.signal,
      credentials: 'include',
    })
  } catch (err: unknown) {
    if (didTimeout) {
      throw new ApiError('Request timed out. Please try again.', 408)
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw err
    }
    throw new ApiError(
      'Unable to connect to the server. Please ensure the backend is running.',
      0,
    )
  } finally {
    globalThis.clearTimeout(timerId)
    externalSignal?.removeEventListener('abort', handleExternalAbort)
  }

  if (response.status === 204) {
    return undefined as unknown as T
  }

  let data: unknown = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    const endpointPath = endpoint.split('?')[0]
    if (response.status === 401 && !CREDENTIAL_AUTH_ENDPOINTS.has(endpointPath)) {
      clearSessionHint()
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT))
      }
    }

    let message =
      response.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'An unexpected error occurred'
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? (data as { detail?: unknown }).detail
        : undefined

    if (typeof detail === 'string') {
      message = detail
    } else if (Array.isArray(detail)) {
      message = detail
        .map((err) =>
          err && typeof err === 'object' && 'msg' in err && (err as { msg?: unknown }).msg
            ? String((err as { msg: unknown }).msg)
            : JSON.stringify(err),
        )
        .join(', ')
    } else if (response.status === 502 || response.status === 503 || response.status === 504) {
      message = 'Backend server is temporarily unreachable. Please ensure port 8000 is active.'
    }

    throw new ApiError(message, response.status)
  }

  return data as T
}

export const api = {
  // ─── Authentication ───────────────────────────────────────────────────────

  async login(credentials: LoginCredentials): Promise<LoginChallengeResponse> {
    return request<LoginChallengeResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
  },

  async loginWithGoogle(credential: string): Promise<LoginChallengeResponse> {
    return request<LoginChallengeResponse>('/api/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    })
  },

  async getBiometricProviders(): Promise<BiometricProvidersStatus> {
    return request<BiometricProvidersStatus>('/api/auth/biometrics/providers')
  },

  async ocrScanId(imageBase64: string): Promise<OcrScanResponse> {
    return request<OcrScanResponse>('/api/auth/biometrics/ocr', {
      method: 'POST',
      body: JSON.stringify({ image_base64: imageBase64 }),
    })
  },

  async verifyFace(payload: FaceVerifyPayload): Promise<TokenResponse> {
    const data = await request<TokenResponse>('/api/auth/face/verify', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setSessionHint()
    return data
  },

  async enrollFace(payload: FaceEnrollPayload): Promise<TokenResponse> {
    const data = await request<TokenResponse>('/api/auth/face/enroll', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    setSessionHint()
    return data
  },

  async register(credentials: RegisterCredentials): Promise<TokenResponse> {
    const data = await request<TokenResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    setSessionHint()
    return data
  },

  async availPlan(planSlug: string): Promise<User> {
    return request<User>('/api/auth/avail-plan', {
      method: 'POST',
      body: JSON.stringify({ plan_slug: planSlug }),
    })
  },

  async logout(): Promise<void> {
    try {
      await request<void>('/api/auth/logout', { method: 'POST' })
    } finally {
      clearSessionHint()
    }
  },

  async getMe(): Promise<User> {
    return request<User>('/api/auth/me')
  },

  async getUsers(): Promise<User[]> {
    return request<User[]>('/api/users')
  },

  async createUser(data: {
    email: string
    password: string
    full_name: string
    phone?: string
    role: string
  }): Promise<User> {
    return request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // ─── Account Profile & Security ──────────────────────────────────────────

  async getProfile(): Promise<AccountProfile> {
    return request<AccountProfile>('/api/account/profile')
  },

  async updateProfile(data: AccountProfileUpdate): Promise<AccountProfile> {
    return request<AccountProfile>('/api/account/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async uploadProfilePicture(file: File): Promise<ProfilePictureResponse> {
    const formData = new FormData()
    formData.append('file', file)
    return request<ProfilePictureResponse>('/api/account/profile-picture', {
      method: 'POST',
      body: formData,
    })
  },

  async removeProfilePicture(): Promise<ProfilePictureResponse> {
    return request<ProfilePictureResponse>('/api/account/profile-picture', {
      method: 'DELETE',
    })
  },

  async changePassword(data: ChangePasswordPayload): Promise<MessageResponse> {
    return request<MessageResponse>('/api/account/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // ─── Members ─────────────────────────────────────────────────────────────

  async getMembers(params?: {
    search?: string
    status?: string
    skip?: number
    limit?: number
  }): Promise<Member[]> {
    return request<Member[]>(`/api/members${buildQuery(params)}`)
  },

  async getMemberStats(): Promise<MemberStats> {
    return request<MemberStats>('/api/members/stats')
  },

  async getMember(id: number): Promise<Member> {
    return request<Member>(`/api/members/${id}`)
  },

  async createMember(data: MemberCreate): Promise<Member> {
    return request<Member>('/api/members', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async deactivateMember(id: number): Promise<void> {
    return request<void>(`/api/members/${id}`, { method: 'DELETE' })
  },

  async deleteMember(id: number): Promise<void> {
    return request<void>(`/api/members/${id}/permanent`, { method: 'DELETE' })
  },

  async reactivateMember(id: number): Promise<Member> {
    return request<Member>(`/api/members/${id}/reactivate`, { method: 'POST' })
  },

  // ─── Membership Plans ────────────────────────────────────────────────────

  async getPlans(): Promise<MembershipPlan[]> {
    return request<MembershipPlan[]>('/api/plans')
  },

  async createPlan(data: MembershipPlanCreate): Promise<MembershipPlan> {
    return request<MembershipPlan>('/api/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updatePlan(id: number, data: Partial<MembershipPlanCreate>): Promise<MembershipPlan> {
    return request<MembershipPlan>(`/api/plans/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async deactivatePlan(id: number): Promise<void> {
    return request<void>(`/api/plans/${id}`, { method: 'DELETE' })
  },

  // ─── Membership Assignments ──────────────────────────────────────────────

  async assignMembership(data: AssignMembershipCreate): Promise<MembershipSummary> {
    return request<MembershipSummary>('/api/memberships', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  // ─── Visits ────────────────────────────────────────────────────────────────

  async checkInMember(data: VisitCreate): Promise<Visit> {
    return request<Visit>('/api/visits', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async checkOutVisit(visitId: number): Promise<Visit> {
    return request<Visit>(`/api/visits/${visitId}/checkout`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
  },

  async getVisits(params?: {
    member_id?: number
    date_from?: string
    date_to?: string
    skip?: number
    limit?: number
  }): Promise<Visit[]> {
    return request<Visit[]>(`/api/visits${buildQuery(params)}`)
  },

  // ─── Class Sessions ─────────────────────────────────────────────────────────

  async getClassSessions(params?: {
    status?: string
    class_type?: string
    skip?: number
    limit?: number
  }): Promise<ClassSession[]> {
    return request<ClassSession[]>(`/api/classes${buildQuery(params)}`)
  },

  async createClassSession(data: ClassSessionCreate): Promise<ClassSession> {
    return request<ClassSession>('/api/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateClassSession(
    id: number,
    data: Partial<ClassSessionCreate> & { status?: string },
  ): Promise<ClassSession> {
    return request<ClassSession>(`/api/classes/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async enrollMember(sessionId: number, memberId: number): Promise<void> {
    return request<void>(`/api/classes/${sessionId}/enroll`, {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId }),
    })
  },

  async unenrollMember(sessionId: number, memberId: number): Promise<void> {
    return request<void>(`/api/classes/${sessionId}/enroll/${memberId}`, {
      method: 'DELETE',
    })
  },

  async enrollSelfClass(sessionId: number, notes?: string): Promise<ClassEnrollment> {
    return request<ClassEnrollment>(`/api/classes/${sessionId}/enroll/self`, {
      method: 'POST',
      body: JSON.stringify(notes !== undefined ? { notes } : {}),
    })
  },

  async unenrollSelfClass(sessionId: number): Promise<void> {
    return request<void>(`/api/classes/${sessionId}/enroll/self`, {
      method: 'DELETE',
    })
  },

  // ─── PT Sessions ─────────────────────────────────────────────────────────────

  async getPTSessions(params?: {
    trainer_id?: number
    member_id?: number
    status?: string
    skip?: number
    limit?: number
  }): Promise<PTSession[]> {
    return request<PTSession[]>(`/api/pt-sessions${buildQuery(params)}`)
  },

  async createPTSession(data: PTSessionCreate): Promise<PTSession> {
    return request<PTSession>('/api/pt-sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updatePTSession(
    id: number,
    data: Partial<PTSessionCreate> & { status?: string },
  ): Promise<PTSession> {
    return request<PTSession>(`/api/pt-sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async getAvailableTrainers(): Promise<TrainerProfile[]> {
    return request<TrainerProfile[]>('/api/pt-sessions/trainers')
  },

  async bookPTSession(data: PTSessionBookCreate): Promise<PTSession> {
    return request<PTSession>('/api/pt-sessions/book', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async getMyBookings(): Promise<PTSession[]> {
    return request<PTSession[]>('/api/pt-sessions/my-bookings')
  },

  async approvePTSession(sessionId: number, coachNotes?: string): Promise<PTSession> {
    return request<PTSession>(`/api/pt-sessions/${sessionId}/approve`, {
      method: 'PATCH',
      body: JSON.stringify({ coach_notes: coachNotes }),
    })
  },

  async rejectPTSession(sessionId: number, reason?: string): Promise<PTSession> {
    return request<PTSession>(`/api/pt-sessions/${sessionId}/reject`, {
      method: 'PATCH',
      body: JSON.stringify({ reason }),
    })
  },

  async cancelPTSession(sessionId: number): Promise<PTSession> {
    return request<PTSession>(`/api/pt-sessions/${sessionId}/cancel`, {
      method: 'PATCH',
      body: JSON.stringify({}),
    })
  },

  // ─── Finance: Categories ─────────────────────────────────────────────────

  async getExpenseCategories(includeInactive = false): Promise<ExpenseCategory[]> {
    return request<ExpenseCategory[]>(
      `/api/finance/categories${buildQuery({ include_inactive: includeInactive })}`,
    )
  },

  async createExpenseCategory(data: ExpenseCategoryCreate): Promise<ExpenseCategory> {
    return request<ExpenseCategory>('/api/finance/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async deactivateExpenseCategory(id: number): Promise<void> {
    return request<void>(`/api/finance/categories/${id}`, { method: 'DELETE' })
  },

  // ─── Finance: Expenses ───────────────────────────────────────────────────

  async getExpenses(params?: {
    search?: string
    category_id?: number
    year?: number
    month?: number
    include_archived?: boolean
    skip?: number
    limit?: number
  }): Promise<Expense[]> {
    return request<Expense[]>(`/api/finance/expenses${buildQuery(params)}`)
  },

  async createExpense(data: ExpenseCreate): Promise<Expense> {
    return request<Expense>('/api/finance/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateExpense(id: number, data: ExpenseUpdate): Promise<Expense> {
    return request<Expense>(`/api/finance/expenses/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async archiveExpense(id: number): Promise<void> {
    return request<void>(`/api/finance/expenses/${id}`, { method: 'DELETE' })
  },

  // ─── Finance Summary ─────────────────────────────────────────────────────

  async getFinanceSummary(year: number, month?: number): Promise<FinanceSummary> {
    return request<FinanceSummary>(`/api/finance/summary${buildQuery({ year, month })}`)
  },

  async getAnnualFinanceSummary(year: number): Promise<{
    month: number
    month_name: string
    revenue: number
    expenses: number
    net_income: number
  }[]> {
    return request(`/api/finance/annual${buildQuery({ year })}`)
  },

  // ─── Analytics & Churn Prediction (Phase 6) ──────────────────────────────

  async getAnalyticsOverview(): Promise<AnalyticsOverview> {
    return request<AnalyticsOverview>('/api/analytics/overview')
  },

  async getChurnOverview(): Promise<ChurnOverview> {
    return request<ChurnOverview>('/api/churn/overview')
  },

  async getChurnMembers(params?: {
    risk_tier?: string
    search?: string
    skip?: number
    limit?: number
  }): Promise<AtRiskMemberItem[]> {
    return request<AtRiskMemberItem[]>(`/api/churn/members${buildQuery(params)}`)
  },

  async getMemberChurnDetail(memberId: number): Promise<MemberChurnDetail> {
    return request<MemberChurnDetail>(`/api/churn/member/${memberId}`)
  },

  async retrainChurnPipeline(): Promise<{
    status: string
    message: string
    model_accuracy: number
    total_members_updated: number
  }> {
    return request('/api/churn/retrain', {
      method: 'POST',
      timeoutMs: LONG_TASK_TIMEOUT_MS,
    })
  },

  // ─── AI Retention Strategies & Notifications (Phase 7) ───────────────────

  async generateRetentionStrategy(memberId: number): Promise<RetentionStrategy> {
    return request<RetentionStrategy>(`/api/retention/generate/${memberId}`, {
      method: 'POST',
      timeoutMs: LONG_TASK_TIMEOUT_MS,
    })
  },

  async getMemberRetentionStrategy(memberId: number): Promise<RetentionStrategy | null> {
    return request<RetentionStrategy | null>(`/api/retention/member/${memberId}`)
  },

  async dispatchRetentionOffer(payload: {
    strategy_id?: number
    member_id: number
    title: string
    message: string
    action_text?: string
    action_url?: string
  }): Promise<{
    status: string
    message: string
    notification_id: number
    recipient_name: string
    sms_status?: string | null
    sms_reason?: string | null
  }> {
    return request('/api/retention/dispatch-offer', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  async getMyNotifications(): Promise<AppNotification[]> {
    return request<AppNotification[]>('/api/notifications')
  },

  async markNotificationRead(
    notificationId: number,
  ): Promise<{ status: string; id: number; is_read: boolean }> {
    return request(`/api/notifications/${notificationId}/read`, { method: 'PATCH' })
  },

  async markAllNotificationsRead(): Promise<{ status: string; updated_count: number }> {
    return request('/api/notifications/read-all', { method: 'POST' })
  },

  async deleteNotification(notificationId: number): Promise<{ status: string; id: number }> {
    return request(`/api/notifications/${notificationId}`, { method: 'DELETE' })
  },

  async clearAllNotifications(): Promise<{ status: string; deleted_count: number }> {
    return request('/api/notifications/clear-all', { method: 'DELETE' })
  },

  // ─── SMS Integration (TextBee Gateway) ─────────────────────────────────

  async getSmsStatus(): Promise<{
    configured: boolean
    provider?: string
    status?: string
    device_id?: string
    brand?: string
    model?: string
    battery?: number
    device_count?: number
    message?: string
  }> {
    return request('/api/notifications/sms/status')
  },

  async sendTestSms(
    phone: string,
    message: string
  ): Promise<{ status: string; data?: unknown; message?: string }> {
    return request('/api/notifications/sms/send-test', {
      method: 'POST',
      body: JSON.stringify({ phone, message }),
    })
  },

  // ─── Smart Keycard Access Control ────────────────────────────────────────

  async verifyKeycardTap(cardUid: string, scannerId?: number): Promise<TapVerificationResult> {
    return request<TapVerificationResult>('/api/access/tap', {
      method: 'POST',
      body: JSON.stringify({
        card_uid: cardUid,
        ...(scannerId ? { scanner_id: scannerId } : {}),
      }),
    })
  },

  async getKeycardTapLogs(params?: {
    granted_only?: boolean
    limit?: number
  }): Promise<KeycardTapLog[]> {
    return request<KeycardTapLog[]>(`/api/access/logs${buildQuery(params)}`)
  },

  async getMemberKeycards(memberId: number): Promise<MemberKeycard[]> {
    return request<MemberKeycard[]>(`/api/members/${memberId}/keycards`)
  },

  async pairMemberKeycard(
    memberId: number,
    data: { card_uid: string; card_label?: string },
  ): Promise<MemberKeycard> {
    return request<MemberKeycard>(`/api/members/${memberId}/keycards`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateKeycardStatus(
    keycardId: number,
    data: { status: KeycardStatus; reason?: string },
  ): Promise<MemberKeycard> {
    return request<MemberKeycard>(`/api/keycards/${keycardId}/status`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async getPairingSession(): Promise<PairingSessionStatus> {
    return request<PairingSessionStatus>('/api/access/pairing-session')
  },

  async startPairingSession(
    memberId: number,
    cardLabel = 'NFC Smart Keycard',
  ): Promise<PairingSessionStatus> {
    return request<PairingSessionStatus>('/api/access/pairing-session', {
      method: 'POST',
      body: JSON.stringify({ member_id: memberId, card_label: cardLabel }),
    })
  },

  async cancelPairingSession(): Promise<PairingSessionStatus> {
    return request<PairingSessionStatus>('/api/access/pairing-session', {
      method: 'DELETE',
    })
  },

  getAccessLiveFeedWsUrl(): string {
    const fallbackProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    if (RAW_API_BASE) {
      try {
        const parsed = new URL(RAW_API_BASE)
        const wsProtocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:'
        const basePath = parsed.pathname.replace(/\/+$/, '')
        return `${wsProtocol}//${parsed.host}${basePath}/api/access/ws/live-feed`
      } catch {
        const relativePrefix = RAW_API_BASE.startsWith('/') ? RAW_API_BASE : `/${RAW_API_BASE}`
        return `${fallbackProtocol}//${window.location.host}${relativePrefix}/api/access/ws/live-feed`
      }
    }
    return `${fallbackProtocol}//${window.location.host}/api/access/ws/live-feed`
  },

  async createPaymentCheckout(
    data: CreateCheckoutPayload,
  ): Promise<CheckoutSessionResponse> {
    return request<CheckoutSessionResponse>('/api/payments/create-checkout', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async verifyPayment(invoiceId: string): Promise<PaymentVerifyResponse> {
    return request<PaymentVerifyResponse>(`/api/payments/verify/${encodeURIComponent(invoiceId)}`)
  },

  async getPaymentGatewayStatus(): Promise<{
    provider: string
    configured: boolean
    is_test_mode: boolean
    supported_channels: string[]
  }> {
    return request('/api/payments/status')
  },
}
