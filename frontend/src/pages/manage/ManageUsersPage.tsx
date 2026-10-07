import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import type { User, UserRole } from '@/types/auth'

gsap.registerPlugin()

function getRoleBadgeVariant(role: string) {
  switch (role) {
    case 'admin': return 'danger' as const
    case 'staff': return 'info' as const
    case 'trainer': return 'warning' as const
    default: return 'success' as const
  }
}

export function ManageUsersPage() {
  const { user: currentUser } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Form state for creating user
  const [form, setForm] = useState<{
    email: string
    password: string
    full_name: string
    phone: string
    role: UserRole
  }>({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'staff',
  })

  useGSAP(
    () => {
      gsap.from(containerRef.current, {
        opacity: 0,
        y: 16,
        duration: 0.4,
        ease: 'power2.out',
      })
    },
    { scope: containerRef }
  )

  const fetchUsers = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getUsers()
      setUsers(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !search ||
      u.full_name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.phone && u.phone.includes(search))
    const matchesRole = !roleFilter || u.role === roleFilter
    return matchesSearch && matchesRole
  })

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.email || !form.password || !form.full_name) {
      setError('Please provide email, password, and full name.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('dgym_access_token') || ''}`,
        },
        body: JSON.stringify({
          email: form.email.trim(),
          password: form.password,
          full_name: form.full_name.trim(),
          phone: form.phone.trim() || undefined,
          role: form.role,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.detail || 'Failed to create user.')
      }

      setShowAddModal(false)
      setForm({
        email: '',
        password: '',
        full_name: '',
        phone: '',
        role: 'staff',
      })
      await fetchUsers()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error creating user.')
    } finally {
      setSubmitting(false)
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
              Users & Roles
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Registered administrators, staff members, coaches, and gym client logins.
            </p>
          </div>
          {currentUser?.role === 'admin' && (
            <Button variant="primary" size="md" onClick={() => setShowAddModal(true)}>
              + Add User
            </Button>
          )}
        </div>
        {/* Notice */}
        <div className="mb-6 p-4 rounded-xl border border-yellow-400/20 bg-yellow-400/5 flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-xs text-yellow-400/90 leading-relaxed">
            <strong>Placeholder for User Management:</strong>Real official users details provided by gym management will replace them seamlessly.
          </p>
        </div>

        {/* Filter bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search users by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/40 transition-colors"
            />
          </div>

          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2.5 bg-surface border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
          >
            <option value="" className="bg-surface-2">All Roles</option>
            <option value="admin" className="bg-surface-2">Admin</option>
            <option value="staff" className="bg-surface-2">Staff</option>
            <option value="trainer" className="bg-surface-2">Trainer</option>
            <option value="member" className="bg-surface-2">Member</option>
          </select>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red/30 bg-red/10 text-red text-sm">
            {error}
          </div>
        )}

        {/* Users Table */}
        <div className="border border-white/8 rounded-xl overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 border-b border-white/8 text-xs uppercase tracking-wider text-white/40">
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
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-36" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-16" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-28" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-16" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-24" /></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-white/40 text-sm">
                      No user accounts found matching your query.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-red/10 border border-red/20 flex items-center justify-center text-red text-xs font-bold shrink-0">
                            {u.full_name.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-white">{u.full_name}</p>
                            <p className="text-xs text-white/40 font-mono">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getRoleBadgeVariant(u.role)}>
                          {u.role.toUpperCase()}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-white/60 text-xs">
                        {u.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                          {u.is_active ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-white/40 text-xs font-mono">
                        {new Date(u.created_at).toLocaleDateString(undefined, {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/8 mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/40">New Account</p>
                <h3 className="font-display text-xl font-bold uppercase text-white mt-0.5">
                  Create User
                </h3>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <Input
                label="Full Name *"
                name="full_name"
                type="text"
                placeholder="e.g. Carlos Mendoza"
                value={form.full_name}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
              />

              <Input
                label="Email Address *"
                name="email"
                type="email"
                placeholder="user@thedgym.com"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
              />

              <Input
                label="Password *"
                name="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={form.password}
                onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))}
              />

              <Input
                label="Phone Number"
                name="phone"
                type="tel"
                placeholder="09XX XXX XXXX"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
              />

              <div>
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                  Role Permission *
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as UserRole }))}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
                >
                  <option value="staff" className="bg-surface-2">Staff (Front Desk)</option>
                  <option value="trainer" className="bg-surface-2">Trainer (Coaching)</option>
                  <option value="admin" className="bg-surface-2">Admin (Full Control)</option>
                  <option value="member" className="bg-surface-2">Member (Client)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/8">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowAddModal(false)}>
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
