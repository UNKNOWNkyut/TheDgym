import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Card } from '@/components/ui/Card'
import type { MemberStats } from '@/types/auth'

gsap.registerPlugin(ScrollTrigger)

interface OverviewKpiGridProps {
  stats: MemberStats | null
  loading: boolean
  showFinancials: boolean
}

interface KpiItem {
  id: string
  label: string
  value: string | number
  sublabel: string
  accentClass: string
  href?: string
}

function formatPhp(value: string | number | null | undefined): string {
  const numeric = Number(value ?? 0)
  const safeAmount = Number.isFinite(numeric) ? numeric : 0
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(safeAmount)
}

function resolveProfitPresentation(rawProfit: string | null | undefined): {
  formatted: string
  statusLabel: string
  accentClass: string
} {
  const numeric = Number(rawProfit ?? 0)
  const safeProfit = Number.isFinite(numeric) ? numeric : 0

  if (safeProfit > 0) {
    return {
      formatted: `+${formatPhp(safeProfit)}`,
      statusLabel: 'Net Profit',
      accentClass: 'text-green-400',
    }
  }
  if (safeProfit < 0) {
    return {
      formatted: `-${formatPhp(Math.abs(safeProfit))}`,
      statusLabel: 'Net Loss',
      accentClass: 'text-red',
    }
  }
  return {
    formatted: formatPhp(0),
    statusLabel: 'Break-Even',
    accentClass: 'text-white/80',
  }
}

export function OverviewKpiGrid({ stats, loading, showFinancials }: OverviewKpiGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (loading || !containerRef.current) return
      const cards = containerRef.current.querySelectorAll('.kpi-card')
      if (!cards.length) return
      gsap.fromTo(
        cards,
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.45,
          stagger: 0.04,
          ease: 'power2.out',
        }
      )
    },
    { scope: containerRef, dependencies: [loading, showFinancials] }
  )

  const periodLabel = stats?.period_label ?? 'This Month'
  const inactiveOrSuspended = (stats?.inactive ?? 0) + (stats?.suspended ?? 0)
  const upcomingCount = stats?.upcoming_expirations_7d ?? 0
  const upcomingAccent = upcomingCount > 0 ? 'text-yellow-400' : 'text-white'

  const operationalKpis: KpiItem[] = [
    {
      id: 'active-members',
      label: 'Active Members',
      value: stats?.active ?? '—',
      sublabel: `${stats?.total ?? 0} total registered`,
      accentClass: 'text-green-400',
      href: '/manage/members',
    },
    {
      id: 'expired-memberships',
      label: 'Expired Memberships',
      value: stats?.expired ?? '—',
      sublabel: `${inactiveOrSuspended} inactive / suspended`,
      accentClass: 'text-yellow-400',
      href: '/manage/members',
    },
    {
      id: 'new-members',
      label: 'New Members',
      value: stats?.new_members_this_month ?? '—',
      sublabel: `Joined in ${periodLabel}`,
      accentClass: 'text-white',
      href: '/manage/members',
    },
    {
      id: 'membership-renewals',
      label: 'Membership Renewals',
      value: stats?.renewals_this_month ?? '—',
      sublabel: `${stats?.renewals_all_time ?? 0} all-time renewals`,
      accentClass: 'text-white',
      href: '/manage/members',
    },
    {
      id: 'upcoming-expirations',
      label: 'Upcoming Expirations',
      value: stats ? upcomingCount : '—',
      sublabel: 'Expiring within 7 days',
      accentClass: upcomingAccent,
      href: '/manage/analytics',
    },
  ]

  const profitMeta = resolveProfitPresentation(stats?.profit_loss)

  const financialKpis: KpiItem[] = [
    {
      id: 'payments',
      label: 'Payments',
      value: stats?.payments_this_month ?? '—',
      sublabel: `Verified paid in ${periodLabel}`,
      accentClass: 'text-white',
      href: '/manage/finance',
    },
    {
      id: 'monthly-income',
      label: 'Monthly Income',
      value: stats?.monthly_income != null ? formatPhp(stats.monthly_income) : '—',
      sublabel: `${periodLabel} membership revenue`,
      accentClass: 'text-green-400',
      href: '/manage/finance',
    },
    {
      id: 'monthly-expenses',
      label: 'Monthly Expenses',
      value: stats?.monthly_expenses != null ? formatPhp(stats.monthly_expenses) : '—',
      sublabel: `${periodLabel} operating expenses`,
      accentClass: 'text-white/90',
      href: '/manage/finance',
    },
    {
      id: 'profit-loss',
      label: 'Profit / Loss',
      value: stats?.profit_loss != null ? profitMeta.formatted : '—',
      sublabel: `${profitMeta.statusLabel} • ${periodLabel}`,
      accentClass: profitMeta.accentClass,
      href: '/manage/finance',
    },
  ]

  const renderCard = (item: KpiItem) => {
    const body = (
      <Card className="kpi-card p-5 h-full border border-white/10 hover:border-white/25 transition-colors flex flex-col justify-between">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs uppercase tracking-widest text-white/40">{item.label}</p>
          {item.href && (
            <span className="text-[11px] text-white/25 group-hover:text-white/60 transition-colors">
              ↗
            </span>
          )}
        </div>
        <div>
          <p className={`font-display text-2xl md:text-3xl font-black tracking-tight ${item.accentClass}`}>
            {loading ? '...' : item.value}
          </p>
          <p className="text-xs font-light tracking-wide text-white/40 mt-2">{item.sublabel}</p>
        </div>
      </Card>
    )

    if (!item.href) {
      return <div key={item.id}>{body}</div>
    }

    return (
      <Link key={item.id} to={item.href} className="group block h-full">
        {body}
      </Link>
    )
  }

  return (
    <div ref={containerRef} className="space-y-8 mb-10">
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs uppercase tracking-widest text-white/40">
            Membership & Retention KPIs
          </p>
          <span className="text-xs font-mono text-white/30">{periodLabel} (PHT)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {operationalKpis.map(renderCard)}
        </div>
      </div>

      {showFinancials && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs uppercase tracking-widest text-white/40">
              Financial Performance KPIs
            </p>
            <Link
              to="/manage/finance"
              className="text-xs uppercase tracking-widest text-white/40 hover:text-white transition-colors"
            >
              Open Ledger →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {financialKpis.map(renderCard)}
          </div>
        </div>
      )}
    </div>
  )
}
