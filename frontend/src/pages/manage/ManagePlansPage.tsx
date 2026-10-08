import { useState, useEffect, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import type { MembershipPlan, MembershipPlanCreate } from '@/types/auth'

gsap.registerPlugin()

export function ManagePlansPage() {
  const { user } = useAuth()
  const containerRef = useRef<HTMLDivElement>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [form, setForm] = useState<{
    name: string
    slug: string
    description: string
    duration_days: number
    price_php: number
    sort_order: number
    is_active: boolean
  }>({
    name: '',
    slug: '',
    description: '',
    duration_days: 30,
    price_php: 600,
    sort_order: 1,
    is_active: true,
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

  const fetchPlans = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.getPlans()
      setPlans(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlans()
  }, [])

  const handleOpenAdd = () => {
    setEditingPlan(null)
    setForm({
      name: '',
      slug: '',
      description: '',
      duration_days: 30,
      price_php: 500,
      sort_order: plans.length + 1,
      is_active: true,
    })
    setShowModal(true)
  }

  const handleOpenEdit = (p: MembershipPlan) => {
    setEditingPlan(p)
    setForm({
      name: p.name,
      slug: p.slug,
      description: p.description || '',
      duration_days: p.duration_days,
      price_php: parseFloat(p.price_php),
      sort_order: p.sort_order,
      is_active: p.is_active,
    })
    setShowModal(true)
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value
    const autoSlug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    setForm((prev) => ({
      ...prev,
      name,
      slug: editingPlan ? prev.slug : autoSlug,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name || !form.slug || form.duration_days <= 0 || form.price_php < 0) {
      setError('Please fill in all required fields properly.')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      if (editingPlan) {
        await api.updatePlan(editingPlan.id, {
          name: form.name,
          description: form.description || undefined,
          duration_days: form.duration_days,
          price_php: form.price_php,
          sort_order: form.sort_order,
          is_active: form.is_active,
        })
      } else {
        const payload: MembershipPlanCreate = {
          name: form.name,
          slug: form.slug,
          description: form.description || undefined,
          duration_days: form.duration_days,
          price_php: form.price_php,
          sort_order: form.sort_order,
          is_active: form.is_active,
        }
        await api.createPlan(payload)
      }
      setShowModal(false)
      await fetchPlans()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeactivate = async (id: number) => {
    if (!confirm('Are you sure you want to deactivate this membership plan?')) return
    try {
      await api.deactivatePlan(id)
      await fetchPlans()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to deactivate plan.')
    }
  }

  return (
    <>
      <SEO title="Membership Plans" description="Configure gym tiers and pricing." />

      <div ref={containerRef} className="p-6 md:p-8 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Configuration</p>
            <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Membership Plans
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Configure available membership tiers, duration windows, and pricing.
            </p>
          </div>
          {user?.role === 'admin' && (
            <Button variant="primary" size="md" onClick={handleOpenAdd}>
              + Create Plan
            </Button>
          )}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl border border-red/30 bg-red/10 text-red text-sm">
            {error}
          </div>
        )}

        {/* Plans Table */}
        <div className="border border-white/8 rounded-xl overflow-hidden bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-2 border-b border-white/8 text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="py-3 px-4">Order</th>
                  <th className="py-3 px-4">Plan Name</th>
                  <th className="py-3 px-4">Slug</th>
                  <th className="py-3 px-4">Duration</th>
                  <th className="py-3 px-4">Price (PHP)</th>
                  <th className="py-3 px-4">Status</th>
                  {user?.role === 'admin' && <th className="py-3 px-4 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-8" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-32" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-20" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-16" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-20" /></td>
                      <td className="py-4 px-4"><div className="h-4 bg-white/5 rounded w-16" /></td>
                      {user?.role === 'admin' && <td className="py-4 px-4" />}
                    </tr>
                  ))
                ) : plans.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-white/40 text-sm">
                      No membership plans found.
                    </td>
                  </tr>
                ) : (
                  plans.map((p) => (
                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4 font-mono text-xs text-white/40">#{p.sort_order}</td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{p.name}</p>
                        <p className="text-xs text-white/40 max-w-sm line-clamp-1">{p.description || '—'}</p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-white/50">{p.slug}</td>
                      <td className="py-3 px-4 text-white/70">
                        {p.duration_days} day{p.duration_days !== 1 ? 's' : ''}
                      </td>
                      <td className="py-3 px-4 font-medium text-white">
                        ₱{parseFloat(p.price_php).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={p.is_active ? 'success' : 'default'} dot={p.is_active}>
                          {p.is_active ? 'Active' : 'Archived'}
                        </Badge>
                      </td>
                      {user?.role === 'admin' && (
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="px-3 py-1.5 text-xs text-white/60 hover:text-white border border-white/10 hover:border-white/30 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            {p.is_active && (
                              <button
                                onClick={() => handleDeactivate(p.id)}
                                className="px-3 py-1.5 text-xs text-red/60 hover:text-red border border-red/10 hover:border-red/30 rounded-lg transition-colors"
                              >
                                Archive
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Plan Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface p-6 sm:p-8 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-white/8 mb-6">
              <div>
                <p className="text-xs uppercase tracking-widest text-white/40">Tier Configuration</p>
                <h3 className="font-display text-xl font-bold uppercase text-white mt-0.5">
                  {editingPlan ? 'Edit Membership Plan' : 'Create New Plan'}
                </h3>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Plan Name *"
                name="name"
                type="text"
                placeholder="e.g. Student Monthly"
                value={form.name}
                onChange={handleNameChange}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Slug *"
                  name="slug"
                  type="text"
                  placeholder="e.g. student-monthly"
                  value={form.slug}
                  onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value }))}
                />
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                    Duration (Days) *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={form.duration_days}
                    onChange={(e) => setForm((p) => ({ ...p, duration_days: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                    Price (PHP) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.price_php}
                    onChange={(e) => setForm((p) => ({ ...p, price_php: parseFloat(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                  Description
                </label>
                <textarea
                  rows={2}
                  placeholder="Plan features, access rules..."
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/40 transition-colors resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded bg-surface-2 border-white/20 text-red focus:ring-red"
                />
                <label htmlFor="is_active" className="text-xs text-white/80 select-none">
                  Available for selection (Active)
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/8">
                <Button variant="ghost" size="sm" type="button" onClick={() => setShowModal(false)}>
                  Cancel
                </Button>
                <Button variant="primary" size="sm" type="submit" loading={submitting}>
                  {editingPlan ? 'Save Changes' : 'Create Plan'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
