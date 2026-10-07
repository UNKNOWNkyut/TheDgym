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
}
