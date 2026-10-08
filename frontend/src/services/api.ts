import type {
  LoginCredentials,
  RegisterCredentials,
  TokenResponse,
  User,
  Member,
  MemberCreate,
  MemberUpdate,
  MemberStats,
  MembershipPlan,
  MembershipPlanCreate,
  AssignMembershipCreate,
  MembershipSummary,
  Visit,
  VisitCreate,
  ClassSession,
  ClassSessionCreate,
  PTSession,
  PTSessionCreate,
  PTSessionBookCreate,
  TrainerProfile,
} from '@/types/auth'

const TOKEN_STORAGE_KEY = 'dgym_access_token'

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY)
}

export function setStoredToken(token: string): void {
  localStorage.setItem(TOKEN_STORAGE_KEY, token)
}

export function clearStoredToken(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
}

class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include', // Include httpOnly cookies
  })

  if (!response.ok) {
    let errorMessage = 'An error occurred. Please try again.'
    try {
      const data = await response.json()
      if (typeof data.detail === 'string') {
        errorMessage = data.detail
      } else if (Array.isArray(data.detail)) {
        errorMessage = data.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(', ')
      }
    } catch {
      errorMessage = response.statusText || errorMessage
    }
    throw new ApiError(errorMessage, response.status)
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export const api = {
  // ─── Auth ──────────────────────────────────────────────────────────────────
  async login(credentials: LoginCredentials): Promise<TokenResponse> {
    const data = await request<TokenResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    if (data.access_token) {
      setStoredToken(data.access_token)
    }
    return data
  },

  async register(credentials: RegisterCredentials): Promise<TokenResponse> {
    const data = await request<TokenResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    if (data.access_token) {
      setStoredToken(data.access_token)
    }
    return data
  },

  async logout(): Promise<void> {
    try {
      await request('/api/auth/logout', { method: 'POST' })
    } catch {
      // Continue client cleanup even if network fails
    } finally {
      clearStoredToken()
    }
  },

  async getMe(): Promise<User> {
    return request<User>('/api/auth/me')
  },

  async getUsers(): Promise<User[]> {
    return request<User[]>('/api/users')
  },

  // ─── Members ───────────────────────────────────────────────────────────────
  async getMembers(params?: {
    search?: string
    status?: string
    skip?: number
    limit?: number
  }): Promise<Member[]> {
    const query = new URLSearchParams()
    if (params?.search) query.set('search', params.search)
    if (params?.status) query.set('status', params.status)
    if (params?.skip !== undefined) query.set('skip', String(params.skip))
    if (params?.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    return request<Member[]>(`/api/members${qs ? `?${qs}` : ''}`)
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

  async updateMember(id: number, data: MemberUpdate): Promise<Member> {
    return request<Member>(`/api/members/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  async deactivateMember(id: number): Promise<void> {
    return request<void>(`/api/members/${id}`, { method: 'DELETE' })
  },

  // ─── Membership Plans ──────────────────────────────────────────────────────
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

  // ─── Membership Assignments ─────────────────────────────────────────────────
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
    const query = new URLSearchParams()
    if (params?.member_id !== undefined) query.set('member_id', String(params.member_id))
    if (params?.date_from) query.set('date_from', params.date_from)
    if (params?.date_to) query.set('date_to', params.date_to)
    if (params?.skip !== undefined) query.set('skip', String(params.skip))
    if (params?.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    return request<Visit[]>(`/api/visits${qs ? `?${qs}` : ''}`)
  },

  async getMemberVisits(memberId: number): Promise<Visit[]> {
    return request<Visit[]>(`/api/visits/member/${memberId}`)
  },

  // ─── Class Sessions ─────────────────────────────────────────────────────────
  async getClassSessions(params?: {
    status?: string
    class_type?: string
    skip?: number
    limit?: number
  }): Promise<ClassSession[]> {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.class_type) query.set('class_type', params.class_type)
    if (params?.skip !== undefined) query.set('skip', String(params.skip))
    if (params?.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    return request<ClassSession[]>(`/api/classes${qs ? `?${qs}` : ''}`)
  },

  async createClassSession(data: ClassSessionCreate): Promise<ClassSession> {
    return request<ClassSession>('/api/classes', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updateClassSession(id: number, data: Partial<ClassSessionCreate> & { status?: string }): Promise<ClassSession> {
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

  // ─── PT Sessions ─────────────────────────────────────────────────────────────
  async getPTSessions(params?: {
    trainer_id?: number
    member_id?: number
    status?: string
    skip?: number
    limit?: number
  }): Promise<PTSession[]> {
    const query = new URLSearchParams()
    if (params?.trainer_id !== undefined) query.set('trainer_id', String(params.trainer_id))
    if (params?.member_id !== undefined) query.set('member_id', String(params.member_id))
    if (params?.status) query.set('status', params.status)
    if (params?.skip !== undefined) query.set('skip', String(params.skip))
    if (params?.limit !== undefined) query.set('limit', String(params.limit))
    const qs = query.toString()
    return request<PTSession[]>(`/api/pt-sessions${qs ? `?${qs}` : ''}`)
  },

  async createPTSession(data: PTSessionCreate): Promise<PTSession> {
    return request<PTSession>('/api/pt-sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  async updatePTSession(id: number, data: Partial<PTSessionCreate> & { status?: string }): Promise<PTSession> {
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
}

