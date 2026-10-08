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
  ExpenseCategory,
  ExpenseCategoryCreate,
  ExpenseCategoryUpdate,
  Expense,
  ExpenseCreate,
  ExpenseUpdate,
  FinanceSummary,
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


async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getStoredToken()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (!response.ok) {
    let errorMessage = 'An error occurred. Please try again.'

    try {
      const data = await response.json()

      if (typeof data.detail === 'string') {
        errorMessage = data.detail
      } else if (Array.isArray(data.detail)) {
        errorMessage = data.detail
          .map((item: { msg?: string }) => item.msg)
          .filter(Boolean)
          .join(', ')
      }
    } catch {
      errorMessage = response.statusText || errorMessage
    }

    throw new ApiError(
      errorMessage,
      response.status,
    )
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}


export const api = {
  // ─── Auth ────────────────────────────────────────────────────────────────

  async login(
    credentials: LoginCredentials,
  ): Promise<TokenResponse> {
    const data = await request<TokenResponse>(
      '/api/auth/login',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
    )

    if (data.access_token) {
      setStoredToken(data.access_token)
    }

    return data
  },


  async register(
    credentials: RegisterCredentials,
  ): Promise<TokenResponse> {
    const data = await request<TokenResponse>(
      '/api/auth/register',
      {
        method: 'POST',
        body: JSON.stringify(credentials),
      },
    )

    if (data.access_token) {
      setStoredToken(data.access_token)
    }

    return data
  },


  async logout(): Promise<void> {
    try {
      await request(
        '/api/auth/logout',
        {
          method: 'POST',
        },
      )
    } catch {
      // Continue local cleanup if network request fails.
    } finally {
      clearStoredToken()
    }
  },


  async getMe(): Promise<User> {
    return request<User>(
      '/api/auth/me',
    )
  },


  async getUsers(): Promise<User[]> {
    return request<User[]>(
      '/api/users',
    )
  },


  // ─── Members ─────────────────────────────────────────────────────────────

  async getMembers(params?: {
    search?: string
    status?: string
    skip?: number
    limit?: number
  }): Promise<Member[]> {
    const query = new URLSearchParams()

    if (params?.search) {
      query.set(
        'search',
        params.search,
      )
    }

    if (params?.status) {
      query.set(
        'status',
        params.status,
      )
    }

    if (params?.skip !== undefined) {
      query.set(
        'skip',
        String(params.skip),
      )
    }

    if (params?.limit !== undefined) {
      query.set(
        'limit',
        String(params.limit),
      )
    }

    const qs = query.toString()

    return request<Member[]>(
      `/api/members${qs ? `?${qs}` : ''}`,
    )
  },


  async getMemberStats(): Promise<MemberStats> {
    return request<MemberStats>(
      '/api/members/stats',
    )
  },


  async getMember(id: number): Promise<Member> {
    return request<Member>(
      `/api/members/${id}`,
    )
  },


  async createMember(
    data: MemberCreate,
  ): Promise<Member> {
    return request<Member>(
      '/api/members',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    )
  },


  async updateMember(
    id: number,
    data: MemberUpdate,
  ): Promise<Member> {
    return request<Member>(
      `/api/members/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    )
  },


  async deactivateMember(
    id: number,
  ): Promise<void> {
    return request<void>(
      `/api/members/${id}`,
      {
        method: 'DELETE',
      },
    )
  },


  // ─── Membership Plans ────────────────────────────────────────────────────

  async getPlans(): Promise<MembershipPlan[]> {
    return request<MembershipPlan[]>(
      '/api/plans',
    )
  },


  async createPlan(
    data: MembershipPlanCreate,
  ): Promise<MembershipPlan> {
    return request<MembershipPlan>(
      '/api/plans',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    )
  },


  async updatePlan(
    id: number,
    data: Partial<MembershipPlanCreate>,
  ): Promise<MembershipPlan> {
    return request<MembershipPlan>(
      `/api/plans/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    )
  },


  async deactivatePlan(
    id: number,
  ): Promise<void> {
    return request<void>(
      `/api/plans/${id}`,
      {
        method: 'DELETE',
      },
    )
  },


  // ─── Membership Assignments ──────────────────────────────────────────────

  async assignMembership(
    data: AssignMembershipCreate,
  ): Promise<MembershipSummary> {
    return request<MembershipSummary>(
      '/api/memberships',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    )
  },


  // ─── Finance: Categories ─────────────────────────────────────────────────

  async getExpenseCategories(
    includeInactive = false,
  ): Promise<ExpenseCategory[]> {
    const query = new URLSearchParams()

    query.set(
      'include_inactive',
      String(includeInactive),
    )

    return request<ExpenseCategory[]>(
      `/api/finance/categories?${query.toString()}`,
    )
  },


  async createExpenseCategory(
    data: ExpenseCategoryCreate,
  ): Promise<ExpenseCategory> {
    return request<ExpenseCategory>(
      '/api/finance/categories',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    )
  },


  async updateExpenseCategory(
    id: number,
    data: ExpenseCategoryUpdate,
  ): Promise<ExpenseCategory> {
    return request<ExpenseCategory>(
      `/api/finance/categories/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    )
  },


  async deactivateExpenseCategory(
    id: number,
  ): Promise<void> {
    return request<void>(
      `/api/finance/categories/${id}`,
      {
        method: 'DELETE',
      },
    )
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
    const query = new URLSearchParams()

    if (params?.search) {
      query.set(
        'search',
        params.search,
      )
    }

    if (params?.category_id !== undefined) {
      query.set(
        'category_id',
        String(params.category_id),
      )
    }

    if (params?.year !== undefined) {
      query.set(
        'year',
        String(params.year),
      )
    }

    if (params?.month !== undefined) {
      query.set(
        'month',
        String(params.month),
      )
    }

    if (params?.include_archived !== undefined) {
      query.set(
        'include_archived',
        String(params.include_archived),
      )
    }

    if (params?.skip !== undefined) {
      query.set(
        'skip',
        String(params.skip),
      )
    }

    if (params?.limit !== undefined) {
      query.set(
        'limit',
        String(params.limit),
      )
    }

    const qs = query.toString()

    return request<Expense[]>(
      `/api/finance/expenses${qs ? `?${qs}` : ''}`,
    )
  },


  async getExpense(
    id: number,
  ): Promise<Expense> {
    return request<Expense>(
      `/api/finance/expenses/${id}`,
    )
  },


  async createExpense(
    data: ExpenseCreate,
  ): Promise<Expense> {
    return request<Expense>(
      '/api/finance/expenses',
      {
        method: 'POST',
        body: JSON.stringify(data),
      },
    )
  },


  async updateExpense(
    id: number,
    data: ExpenseUpdate,
  ): Promise<Expense> {
    return request<Expense>(
      `/api/finance/expenses/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(data),
      },
    )
  },


  async archiveExpense(
    id: number,
  ): Promise<void> {
    return request<void>(
      `/api/finance/expenses/${id}`,
      {
        method: 'DELETE',
      },
    )
  },


  // ─── Finance Summary ─────────────────────────────────────────────────────

  async getFinanceSummary(
    year: number,
    month?: number,
  ): Promise<FinanceSummary> {
    const query = new URLSearchParams()

    query.set(
      'year',
      String(year),
    )

    if (month !== undefined) {
      query.set(
        'month',
        String(month),
      )
    }

    return request<FinanceSummary>(
      `/api/finance/summary?${query.toString()}`,
    )
  },
}