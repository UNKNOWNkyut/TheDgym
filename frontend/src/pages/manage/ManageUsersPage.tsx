import { useState, useEffect, useRef, useCallback, type FormEvent } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import { getInitials } from '@/utils/formatters'
import type { User, UserRole } from '@/types/auth'

gsap.registerPlugin()

type StatusFilter = '' | 'active' | 'disabled'

interface CreateUserFormState {
  email: string
  password: string
  full_name: string
  phone: string
  role: UserRole
}

interface CreateUserFieldErrors {
  full_name?: string
  email?: string
  password?: string
  phone?: string
}

const INITIAL_CREATE_FORM: CreateUserFormState = {
  email: '',
  password: '',
  full_name: '',
  phone: '',
  role: 'staff',
}

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case 'admin':
      return 'danger' as const
    case 'staff':
      return 'info' as const
    case 'trainer':
      return 'warning' as const
    default:
      return 'success' as const
  }
}

function formatUserDate(createdAt: string): string {
  const parsed = new Date(createdAt)
  if (Number.isNaN(parsed.getTime())) return '—'
  return parsed.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function filterUsers(
  users: User[],
  search: string,
  roleFilter: string,
  statusFilter: StatusFilter,
): User[] {
  const query = search.trim().toLowerCase()
  return users.filter((u) => {
    const matchesSearch =
      !query ||
      u.full_name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      u.role.toLowerCase().includes(query) ||
      Boolean(u.phone && u.phone.toLowerCase().includes(query))

    const matchesRole = !roleFilter || u.role === roleFilter
    const matchesStatus =
      !statusFilter ||
      (statusFilter === 'active' && u.is_active) ||
      (statusFilter === 'disabled' && !u.is_active)

    return matchesSearch && matchesRole && matchesStatus
  })
}

function validateCreateUserForm(form: CreateUserFormState): {
  valid: boolean
  errors: CreateUserFieldErrors
} {
  const errors: CreateUserFieldErrors = {}
  const trimmedName = form.full_name.trim()
  const trimmedEmail = form.email.trim()
  const trimmedPhone = form.phone.trim()

  if (trimmedName.length < 2) {
    errors.full_name = 'Full name must be at least 2 characters.'
  } else if (trimmedName.length > 150) {
    errors.full_name = 'Full name must be 150 characters or fewer.'
  }

  if (!trimmedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
    errors.email = 'Please enter a valid email address.'
  }

  if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  } else if (form.password.length > 128) {
    errors.password = 'Password must be 128 characters or fewer.'
  }

  if (trimmedPhone.length > 32) {
    errors.phone = 'Phone number must be 32 characters or fewer.'
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  }
}

export function ManageUsersPage() {
  const { user: currentUser } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(true)

  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [modalError, setModalError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<CreateUserFieldErrors>({})
  const [form, setForm] = useState<CreateUserFormState>(INITIAL_CREATE_FORM)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useGSAP(
    () => {
      if (!containerRef.current) return
      gsap.from(containerRef.current, {
        opacity: 0,
        y: 16,
        duration: 0.4,
        ease: 'power2.out',
      })
    },
    { scope: containerRef },
  )

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getUsers()
      if (mountedRef.current) {
        setUsers(data)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to load users.')
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [])

  useEffect(() => {
    let active = true
    api
      .getUsers()
      .then((data) => {
        if (active) {
          setUsers(data)
          setError(null)
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Failed to load users.')
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const closeAddModal = useCallback(() => {
    if (submitting) return
    setShowAddModal(false)
    setModalError(null)
    setFieldErrors({})
    setForm(INITIAL_CREATE_FORM)
  }, [submitting])

  const openAddModal = () => {
    setModalError(null)
    setFieldErrors({})
    setForm(INITIAL_CREATE_FORM)
    setShowAddModal(true)
  }

  useEffect(() => {
    if (!showAddModal) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        closeAddModal()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [showAddModal, closeAddModal])

  const filteredUsers = filterUsers(users, search, roleFilter, statusFilter)
  const activeCount = users.filter((u) => u.is_active).length
  const disabledCount = users.length - activeCount
  const teamCount = users.filter((u) => u.role !== 'member').length
  const hasActiveFilters = Boolean(search.trim() || roleFilter || statusFilter)

  const handleFieldChange = <K extends keyof CreateUserFormState>(
    field: K,
    value: CreateUserFormState[K],
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }))
    setModalError(null)
    const key: keyof CreateUserFormState = field
    if (key !== 'role') {
      setFieldErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))
    }
  }

  const handleCreateUser = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const validation = validateCreateUserForm(form)
    if (!validation.valid) {
      setFieldErrors(validation.errors)
      setModalError('Please review the highlighted fields before continuing.')
      return
    }

    setSubmitting(true)
    setModalError(null)
    setFieldErrors({})
    setSuccessMsg(null)

    try {
      const created = await api.createUser({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
      })

      if (!mountedRef.current) return
      setShowAddModal(false)
      setForm(INITIAL_CREATE_FORM)
      setSuccessMsg(`Account created for ${created.full_name} (${created.role}).`)
      await fetchUsers()
    } catch (err) {
      if (mountedRef.current) {
        setModalError(err instanceof Error ? err.message : 'Unable to create user account.')
      }
    } finally {
      if (mountedRef.current) {
        setSubmitting(false)
      }
    }
  }

  return (
    <>
      <SEO title="User Management" description="Manage user accounts and assigned roles." />

      <div ref={containerRef} className="p-6 md:p-8 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Access Control</p>
            <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Users &amp; Roles
            </h1>
            <p className="text-sm text-white/55 mt-1">
              Registered administrators, front-desk staff, fitness coaches, and member logins.
            </p>
          </div>
          {currentUser?.role === 'admin' && (
            <Button variant="primary" size="md" type="button" onClick={openAddModal}>
              + Add User
            </Button>
          )}
        </div>

        {/* Account Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="rounded-xl border border-white/10 bg-surface p-4">
            <p className="text-[11px] uppercase tracking-widest text-white/45 font-mono">
              Total Accounts
            </p>
            <p className="text-2xl font-bold text-white mt-1">{users.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface p-4">
            <p className="text-[11px] uppercase tracking-widest text-white/45 font-mono">
              Active
            </p>
            <p className="text-2xl font-bold text-green-400 mt-1">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface p-4">
            <p className="text-[11px] uppercase tracking-widest text-white/45 font-mono">
              Disabled
            </p>
            <p className="text-2xl font-bold text-white/75 mt-1">{disabledCount}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-surface p-4">
            <p className="text-[11px] uppercase tracking-widest text-white/45 font-mono">
              Staff &amp; Coaches
            </p>
            <p className="text-2xl font-bold text-white mt-1">{teamCount}</p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              aria-label="Search users by name, email, phone, or role"
              placeholder="Search users by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-red/40 transition-colors"
            />
          </div>

          <select
            aria-label="Filter users by role"
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
          >
            <option value="" className="bg-surface-2">
              All Roles
            </option>
            <option value="admin" className="bg-surface-2">
              Admin
            </option>
            <option value="staff" className="bg-surface-2">
              Staff
            </option>
            <option value="trainer" className="bg-surface-2">
              Trainer
            </option>
            <option value="member" className="bg-surface-2">
              Member
            </option>
          </select>

          <select
            aria-label="Filter users by account status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
          >
            <option value="" className="bg-surface-2">
              All Statuses
            </option>
            <option value="active" className="bg-surface-2">
              Active Only
            </option>
            <option value="disabled" className="bg-surface-2">
              Disabled Only
            </option>
          </select>
        </div>

        <div className="flex items-center justify-between text-xs text-white/45 mb-4 font-mono">
          <span>
            Showing {filteredUsers.length} of {users.length} account{users.length === 1 ? '' : 's'}
          </span>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearch('')
                setRoleFilter('')
                setStatusFilter('')
              }}
              className="text-red hover:underline cursor-pointer"
            >
              Reset filters
            </button>
          )}
        </div>

        {successMsg && (
          <div
            role="status"
            className="mb-6 p-4 rounded-xl border border-green-400/25 bg-green-400/10 text-green-400 text-sm flex items-center justify-between gap-3"
          >
            <span>{successMsg}</span>
            <button
              type="button"
              onClick={() => setSuccessMsg(null)}
              aria-label="Dismiss notification"
              className="text-green-300 hover:text-white text-xs cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 rounded-xl border border-red/30 bg-red/10 text-red-400 text-sm flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            <Button variant="secondary" size="sm" type="button" onClick={() => void fetchUsers()}>
              Retry
            </Button>
          </div>
        )}

        {/* Users Table */}
        <div className="border border-white/10 rounded-xl overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 border-b border-white/10 text-xs uppercase tracking-wider text-white/45">
                <tr>
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4">Contact</th>
                  <th className="py-3 px-4">Account Status</th>
                  <th className="py-3 px-4">Date Registered</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4">
                        <div className="h-4 bg-white/5 rounded w-36" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-white/5 rounded w-16" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-white/5 rounded w-28" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-white/5 rounded w-16" />
                      </td>
                      <td className="py-4 px-4">
                        <div className="h-4 bg-white/5 rounded w-24" />
                      </td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-white/45 text-sm">
                      {users.length === 0
                        ? 'No user accounts have been registered yet.'
                        : 'No user accounts match your current search or filters.'}
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelf = currentUser?.id === u.id
                    return (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-red/10 border border-red/20 flex items-center justify-center text-red text-xs font-bold shrink-0">
                              {getInitials(u.full_name) || '?'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-white truncate">{u.full_name}</p>
                                {isSelf && (
                                  <span className="text-[10px] uppercase tracking-wider font-mono px-1.5 py-0.5 rounded bg-white/10 text-white/70 border border-white/10">
                                    You
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-white/45 font-mono truncate">{u.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <Badge variant={getRoleBadgeVariant(u.role)}>
                            {u.role.toUpperCase()}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-white/65 text-xs font-mono">
                          {u.phone || '—'}
                        </td>
                        <td className="py-3 px-4">
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-green-400"
                                aria-hidden="true"
                              />
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs text-red-400">
                              <span
                                className="w-1.5 h-1.5 rounded-full bg-red-400"
                                aria-hidden="true"
                              />
                              Disabled
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-white/45 text-xs font-mono">
                          {formatUserDate(u.created_at)}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-modal-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) closeAddModal()
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/45">New Account</p>
                <h2
                  id="create-user-modal-title"
                  className="font-display text-xl font-bold uppercase text-white mt-0.5"
                >
                  Create User
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close create user dialog"
                disabled={submitting}
                onClick={closeAddModal}
                className="p-1.5 rounded-lg text-white/45 hover:text-white hover:bg-white/5 transition-colors cursor-pointer disabled:opacity-40"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {modalError && (
              <div
                role="alert"
                className="mb-4 p-3 rounded-lg border border-red/30 bg-red/10 text-red-400 text-xs"
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateUser} noValidate className="space-y-4">
              <Input
                id="create-user-full-name"
                label="Full Name *"
                name="full_name"
                type="text"
                maxLength={150}
                autoComplete="off"
                placeholder="e.g. Carlos Mendoza"
                error={fieldErrors.full_name}
                value={form.full_name}
                onChange={(e) => handleFieldChange('full_name', e.target.value)}
              />

              <Input
                id="create-user-email"
                label="Email Address *"
                name="email"
                type="email"
                autoComplete="off"
                placeholder="staff@example.com"
                error={fieldErrors.email}
                value={form.email}
                onChange={(e) => handleFieldChange('email', e.target.value)}
              />

              <Input
                id="create-user-password"
                label="Password *"
                name="password"
                type="password"
                maxLength={128}
                autoComplete="new-password"
                placeholder="Minimum 8 characters"
                error={fieldErrors.password}
                value={form.password}
                onChange={(e) => handleFieldChange('password', e.target.value)}
              />

              <Input
                id="create-user-phone"
                label="Phone Number"
                name="phone"
                type="tel"
                maxLength={32}
                autoComplete="off"
                placeholder="09XX XXX XXXX"
                error={fieldErrors.phone}
                value={form.phone}
                onChange={(e) => handleFieldChange('phone', e.target.value)}
              />

              <div>
                <label
                  htmlFor="create-user-role"
                  className="block text-xs uppercase tracking-widest text-white/55 mb-1.5 font-semibold"
                >
                  Role Permission *
                </label>
                <select
                  id="create-user-role"
                  value={form.role}
                  onChange={(e) => handleFieldChange('role', e.target.value as UserRole)}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
                >
                  <option value="staff" className="bg-surface-2">
                    Staff (Front Desk)
                  </option>
                  <option value="trainer" className="bg-surface-2">
                    Trainer (Coaching)
                  </option>
                  <option value="admin" className="bg-surface-2">
                    Admin (Full Control)
                  </option>
                  <option value="member" className="bg-surface-2">
                    Member (Client)
                  </option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/10">
                <Button
                  variant="ghost"
                  size="sm"
                  type="button"
                  disabled={submitting}
                  onClick={closeAddModal}
                >
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" loading={submitting}>
                  Create User
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
