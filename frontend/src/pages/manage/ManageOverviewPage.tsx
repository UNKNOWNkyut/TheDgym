import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { SEO } from '@/components/ui/SEO'
import { Card } from '@/components/ui/Card'
import { api } from '@/services/api'
import type { MemberStats, MembershipPlan } from '@/types/auth'

export function ManageOverviewPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<MemberStats | null>(null)
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [s, p] = await Promise.all([
          api.getMemberStats(),
          api.getPlans(),
        ])
        setStats(s)
        setPlans(p)
      } catch {
        // Non-fatal — tables might be shown as empty
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const statCards = [
    { label: 'Total Members', value: stats?.total ?? '—', color: 'text-white' },
    { label: 'Active', value: stats?.active ?? '—', color: 'text-green-400' },
    { label: 'Expired', value: stats?.expired ?? '—', color: 'text-yellow-400' },
    { label: 'Inactive / Suspended', value: ((stats?.inactive ?? 0) + (stats?.suspended ?? 0)) || '—', color: 'text-red' },
  ]

  return (
    <>
      <SEO title="Management Overview" description="The DGym admin overview panel." />

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Dashboard</p>
          <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
            Overview
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Welcome back, <span className="text-white">{user?.full_name}</span>. Here's a snapshot of The DGym operations.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {statCards.map((card) => (
            <Card key={card.label} className="p-5">
              <p className="text-xs uppercase tracking-widest text-white/40 mb-2">{card.label}</p>
              <p className={`font-display text-3xl font-black ${card.color}`}>
                {loading ? '...' : card.value}
              </p>
            </Card>
          ))}
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
          <Link
            to="/manage/members"
            className="group p-6 rounded-xl border border-white/8 bg-surface hover:border-red/30 hover:bg-surface-2 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-red/10 border border-red/20 text-red">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <svg className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white mb-1">
              Member Registry
            </h2>
            <p className="text-sm text-white/50">
              Search, register, and manage all gym members. Assign membership plans and track statuses.
            </p>
          </Link>

          <Link
            to="/manage/plans"
            className="group p-6 rounded-xl border border-white/8 bg-surface hover:border-red/30 hover:bg-surface-2 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-2 rounded-lg bg-red/10 border border-red/20 text-red">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <svg className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <h2 className="font-display text-lg font-bold uppercase tracking-wide text-white mb-1">
              Membership Plans
            </h2>
            <p className="text-sm text-white/50">
              View and manage membership tiers — Day Pass, Monthly, Quarterly, Annual, and Student plans.
            </p>
          </Link>
        </div>

        {/* Active Plans Preview */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">
              Active Plans
            </h2>
            <Link to="/manage/plans" className="text-xs text-red hover:underline">
              Manage all →
            </Link>
          </div>
          <div className="border border-white/8 rounded-xl overflow-hidden bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 border-b border-white/8 text-xs uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Duration</th>
                    <th className="py-3 px-4">Price (PHP)</th>
                    <th className="py-3 px-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-8 px-4 text-center text-white/40 text-sm">Loading plans...</td>
                    </tr>
                  ) : plans.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-8 px-4 text-center text-white/40 text-sm">No plans found.</td>
                    </tr>
                  ) : plans.map((plan) => (
                    <tr key={plan.id} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-white">{plan.name}</p>
                        <p className="text-xs text-white/40">{plan.description}</p>
                      </td>
                      <td className="py-3 px-4 text-white/60">{plan.duration_days} day{plan.duration_days !== 1 ? 's' : ''}</td>
                      <td className="py-3 px-4">
                        <span className="font-semibold text-white">₱{parseFloat(plan.price_php).toLocaleString()}</span>
                        <span className="text-xs text-yellow-400/70 ml-2">[PLACEHOLDER]</span>
                      </td>
                      <td className="py-3 px-4">
                        {plan.is_active ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-green-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                            Active
                          </span>
                        ) : (
                          <span className="text-xs text-white/30">Inactive</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-xs text-yellow-400/60 mt-2">
            ⚠ Pricing is placeholder data — update with real company pricing once gathered.
          </p>
        </div>
      </div>
    </>
  )
}
