import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { api } from '@/services/api'
import { QuarterRing } from '@/components/ui/quarter-ring'
import type {
  AnalyticsOverview,
  ChurnOverview,
  AtRiskMemberItem,
  MemberChurnDetail,
  RetentionStrategy,
} from '@/types/auth'

export function ManageAnalyticsPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null)
  const [churn, setChurn] = useState<ChurnOverview | null>(null)
  const [members, setMembers] = useState<AtRiskMemberItem[]>([])
  const [selectedMember, setSelectedMember] = useState<MemberChurnDetail | null>(null)

  // AI Retention Strategy State (Phase 7)
  const [strategy, setStrategy] = useState<RetentionStrategy | null>(null)
  const [isGeneratingStrategy, setIsGeneratingStrategy] = useState(false)
  const [isDispatchingOffer, setIsDispatchingOffer] = useState(false)
  const [activeModalTab, setActiveModalTab] = useState<'DIAGNOSIS' | 'RETENTION'>('DIAGNOSIS')
  const [strategyError, setStrategyError] = useState<string | null>(null)
  const [dispatchSuccess, setDispatchSuccess] = useState<string | null>(null)

  const [riskFilter, setRiskFilter] = useState<'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'>('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRetraining, setIsRetraining] = useState(false)
  const [notification, setNotification] = useState<string | null>(null)

  const [isRefreshing, setIsRefreshing] = useState(false)

  // Fetch initial data
  const loadData = async (silent = false) => {
    if (!silent) setIsLoading(true)
    else setIsRefreshing(true)
    try {
      const [analyticsData, churnData, membersData] = await Promise.all([
        api.getAnalyticsOverview(),
        api.getChurnOverview(),
        api.getChurnMembers(),
      ])
      setAnalytics(analyticsData)
      setChurn(churnData)
      setMembers(membersData)
    } catch (err) {
      console.error('Failed to load analytics data:', err)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }

  useEffect(() => {
    loadData()
    // Periodic refresh every 30 seconds for live attendance velocity and peak density
    const interval = setInterval(() => {
      loadData(true)
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  // Trigger XGBoost pipeline retraining
  const handleRetrain = async () => {
    setIsRetraining(true)
    setNotification(null)
    try {
      const res = await api.retrainChurnPipeline()
      setNotification(`Model successfully retrained. ${res.total_members_updated} member predictions updated.`)
      await loadData()
    } catch (err: any) {
      setNotification('Failed to retrain model. Please verify administrator permissions.')
    } finally {
      setIsRetraining(false)
      setTimeout(() => setNotification(null), 6000)
    }
  }

  // Open deep dive diagnosis modal with selected tab
  const handleOpenDiagnosis = async (memberId: number, initialTab: 'DIAGNOSIS' | 'RETENTION' = 'DIAGNOSIS') => {
    setActiveModalTab(initialTab)
    setStrategy(null)
    setStrategyError(null)
    setDispatchSuccess(null)
    try {
      const [detail, existingStrat] = await Promise.all([
        api.getMemberChurnDetail(memberId),
        api.getMemberRetentionStrategy(memberId).catch(() => null),
      ])
      setSelectedMember(detail)
      setStrategy(existingStrat)
    } catch (err) {
      console.error('Failed to load member diagnosis:', err)
    }
  }

  // Generate AI retention strategy
  const handleGenerateStrategy = async () => {
    if (!selectedMember) return
    setIsGeneratingStrategy(true)
    setStrategyError(null)
    setDispatchSuccess(null)
    try {
      const result = await api.generateRetentionStrategy(selectedMember.member_id)
      setStrategy(result)
      setActiveModalTab('RETENTION')
    } catch (err: any) {
      setStrategyError(err?.message || 'Failed to generate AI strategy. Please try again.')
    } finally {
      setIsGeneratingStrategy(false)
    }
  }

  // Dispatch offer directly to member
  const handleDispatchOffer = async () => {
    if (!selectedMember || !strategy) return
    setIsDispatchingOffer(true)
    setDispatchSuccess(null)
    setStrategyError(null)
    try {
      const res = await api.dispatchRetentionOffer({
        strategy_id: strategy.id,
        member_id: selectedMember.member_id,
        title: strategy.offer_title,
        message: strategy.offer_message,
        action_text: strategy.offer_action_text,
        action_url: strategy.offer_action_url,
      })
      setDispatchSuccess(res.message)
      setStrategy((prev) => (prev ? { ...prev, status: 'dispatched', dispatched_at: new Date().toISOString() } : null))
    } catch (err: any) {
      setStrategyError(err?.message || 'Failed to dispatch offer. Please check connection.')
    } finally {
      setIsDispatchingOffer(false)
    }
  }

  // GSAP Entrance Animations
  useGSAP(
    () => {
      if (!isLoading) {
        gsap.fromTo(
          '.analytics-card',
          { opacity: 0, y: 15 },
          {
            opacity: 1,
            y: 0,
            duration: 0.5,
            stagger: 0.06,
            ease: 'power2.out',
            clearProps: 'opacity,transform',
          },
        )
      }
    },
    { dependencies: [isLoading], scope: containerRef },
  )

  // Filtered roster
  const filteredMembers = members.filter((m) => {
    const matchesFilter = riskFilter === 'ALL' || m.risk_tier === riskFilter
    const q = searchQuery.toLowerCase()
    const matchesSearch =
      !q ||
      m.full_name.toLowerCase().includes(q) ||
      m.member_code.toLowerCase().includes(q) ||
      (m.email && m.email.toLowerCase().includes(q))
    return matchesFilter && matchesSearch
  })

  // Max count for hourly chart scaling
  const maxHourlyCount = Math.max(
    ...(analytics?.hourly_distribution.map((h) => h.count) || [1]),
    1,
  )

  const retentionPct = churn?.overall_retention_rate_pct ?? 0
  const isHealthy = retentionPct >= 75
  const isWarning = retentionPct >= 50 && retentionPct < 75
  const retentionStatusLabel = isHealthy ? 'Healthy' : isWarning ? 'Moderate' : 'Attention Needed'
  const retentionStatusColor = isHealthy ? 'text-emerald-400' : isWarning ? 'text-amber-400' : 'text-red-400'
  const retentionDotColor = isHealthy ? 'bg-emerald-400' : isWarning ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div ref={containerRef} className="space-y-8 py-4">
      {/* ─── Header & Model Action ────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <span className="text-xs uppercase tracking-widest text-red-500 font-mono font-semibold">
            Machine Learning & Gym Intelligence
          </span>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white mt-1">
            Retention & Analytics
          </h1>
          <p className="text-sm text-white/50 max-w-2xl mt-1">
            Real-time facility attendance velocity, peak dwell monitoring, and predictive XGBoost member churn classification.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData(false)}
            disabled={isLoading || isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-white/20 bg-white/5 hover:bg-white/10 text-white text-xs uppercase tracking-widest font-mono font-semibold transition-all disabled:opacity-50"
            title="Update real-time dwell, peak density, and check-ins"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-emerald-400' : 'text-white/60'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            {isRefreshing ? 'Refreshing...' : 'Live Refresh'}
          </button>

          <button
            onClick={handleRetrain}
            disabled={isRetraining}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-300 text-xs uppercase tracking-widest font-mono font-semibold transition-all disabled:opacity-50"
          >
            <svg
              className={`w-3.5 h-3.5 ${isRetraining ? 'animate-spin text-red-500' : 'text-red-400'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
            {isRetraining ? 'Retraining Model...' : 'Retrain ML Model'}
          </button>
        </div>
      </div>

      {notification && (
        <div className="p-3.5 rounded-lg border border-red-500/30 bg-red-500/10 text-red-200 text-xs font-mono flex items-center justify-between">
          <span>{notification}</span>
          <button onClick={() => setNotification(null)} className="text-white/60 hover:text-white">
            &times;
          </button>
        </div>
      )}

      {/* ─── Top Executive KPIs ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Retention Health Rate */}
        <div className="analytics-card p-5 rounded-xl border border-white/10 bg-[#0c0c0e] hover:border-white/20 transition-all">
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-mono">
            Overall Retention Rate
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-white font-mono">
              {churn?.overall_retention_rate_pct ?? '--'}%
            </span>
            <span className={`text-xs font-mono font-medium flex items-center gap-1.5 ${retentionStatusColor}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full ${retentionDotColor} ${!isHealthy ? 'animate-pulse' : ''}`} />
              {retentionStatusLabel}
            </span>
          </div>
          <span className="text-xs text-white/40 block mt-2">
            Based on {churn?.total_members_assessed ?? 0} active & historical profiles
          </span>
        </div>

        {/* KPI 2: At-Risk Attention Alert */}
        <div className="analytics-card p-5 rounded-xl border border-red-500/20 bg-[#120a0a] hover:border-red-500/40 transition-all">
          <span className="text-[11px] uppercase tracking-widest text-red-400/80 font-mono">
            High Churn Risk
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-red-400 font-mono">
              {churn?.high_risk_count ?? '--'}
            </span>
            <span className="text-xs text-red-400/80 font-mono">
              Athletes
            </span>
          </div>
          <span className="text-xs text-white/40 block mt-2">
            Predicted probability &gt; 70% of dropping out
          </span>
        </div>

        {/* KPI 3: Average Dwell Duration */}
        <div className="analytics-card p-5 rounded-xl border border-white/10 bg-[#0c0c0e] hover:border-white/20 transition-all">
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-mono">
            Avg Session Dwell Time
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-3xl font-black text-white font-mono">
              {analytics?.average_dwell_minutes ?? '--'}
            </span>
            <span className="text-xs text-white/60 font-mono">
              Minutes
            </span>
          </div>
          <span className="text-xs text-white/40 block mt-2">
            Physical check-in to checkout duration
          </span>
        </div>

        {/* KPI 4: Peak Hours */}
        <div className="analytics-card p-5 rounded-xl border border-white/10 bg-[#0c0c0e] hover:border-white/20 transition-all">
          <span className="text-[11px] uppercase tracking-widest text-white/40 font-mono">
            Peak Facility Density
          </span>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-amber-400 font-mono">
              {analytics?.peak_hour ?? '6:00 PM'}
            </span>
          </div>
          <span className="text-xs text-white/40 block mt-2">
            Monthly visits: {analytics?.total_visits_this_month ?? 0} ({analytics?.attendance_growth_pct ?? 0}% growth)
          </span>
        </div>
      </div>

      {/* ─── Visual Graphs: Peak Density & Risk Breakdown ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Hourly Check-In Density Bar Chart */}
        <div className="analytics-card lg:col-span-2 p-6 rounded-xl border border-white/10 bg-[#0c0c0e] flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/5 pb-4 mb-4">
            <div>
              <span className="text-[11px] uppercase tracking-widest text-white/40 font-mono">
                Facility Traffic Pattern
              </span>
              <h3 className="text-base font-bold text-white uppercase tracking-tight mt-0.5">
                Hourly Check-in Distribution (6 AM – 9 PM)
              </h3>
            </div>
            <span className="text-xs text-white/40 font-mono">
              Peak: <strong className="text-white">{analytics?.peak_hour}</strong>
            </span>
          </div>

          {/* Bar Chart Container */}
          <div className="h-48 w-full pt-4 flex flex-col justify-end">
            <div className="h-36 w-full flex items-end gap-1.5 sm:gap-2">
              {analytics?.hourly_distribution.map((item) => {
                const heightPct = item.count > 0
                  ? Math.max(12, Math.round((item.count / maxHourlyCount) * 100))
                  : 4
                const isPeak = item.count === maxHourlyCount && item.count > 0
                return (
                  <div
                    key={item.hour}
                    className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                  >
                    {/* Tooltip */}
                    <div className="opacity-0 group-hover:opacity-100 transition-all duration-150 absolute -top-8 bg-zinc-900 border border-white/20 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow-lg pointer-events-none z-20 whitespace-nowrap">
                      <span className="text-white/60">{item.hour_label}:</span> <strong className="text-red-400">{item.count}</strong> check-in{item.count !== 1 ? 's' : ''}
                    </div>

                    {/* Bar */}
                    <div
                      style={{ height: `${heightPct}%` }}
                      className={`w-full rounded-t transition-all duration-300 ${
                        isPeak
                          ? 'bg-red-500 shadow-[0_0_14px_rgba(239,68,68,0.7)]'
                          : item.count > 0
                          ? 'bg-white/25 group-hover:bg-red-500/80'
                          : 'bg-white/5 group-hover:bg-white/10'
                      }`}
                    />
                  </div>
                )
              })}
            </div>

            {/* X-Axis Labels */}
            <div className="w-full flex items-center gap-1.5 sm:gap-2 mt-2 pt-2 border-t border-white/5">
              {analytics?.hourly_distribution.map((item) => (
                <div key={item.hour} className="flex-1 text-center">
                  <span className="text-[10px] font-mono text-white/40 block truncate">
                    {item.hour % 2 === 0 ? item.hour_label.replace(' ', '') : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Churn Risk Ratio Breakdown Card */}
        <div className="analytics-card p-6 rounded-xl border border-white/10 bg-[#0c0c0e] flex flex-col justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-widest text-white/40 font-mono">
              XGBoost Classification
            </span>
            <h3 className="text-base font-bold text-white uppercase tracking-tight mt-0.5">
              Member Risk Distribution
            </h3>
            <p className="text-xs text-white/40 mt-1">
              Active members segmented by churn vulnerability index.
            </p>
          </div>

          <div className="space-y-4 my-6">
            {/* Low Risk */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-emerald-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Low Risk (&le; 40%)
                </span>
                <span className="text-white font-bold">{churn?.low_risk_count ?? 0}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  style={{
                    width: `${
                      churn?.total_members_assessed
                        ? (churn.low_risk_count / churn.total_members_assessed) * 100
                        : 0
                    }%`,
                  }}
                  className="h-full bg-emerald-500 rounded-full"
                />
              </div>
            </div>

            {/* Medium Risk */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-amber-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Medium Risk (40%–70%)
                </span>
                <span className="text-white font-bold">{churn?.medium_risk_count ?? 0}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  style={{
                    width: `${
                      churn?.total_members_assessed
                        ? (churn.medium_risk_count / churn.total_members_assessed) * 100
                        : 0
                    }%`,
                  }}
                  className="h-full bg-amber-500 rounded-full"
                />
              </div>
            </div>

            {/* High Risk */}
            <div>
              <div className="flex justify-between text-xs font-mono mb-1.5">
                <span className="text-red-400 font-semibold flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-red-400" />
                  High Risk (&gt; 70%)
                </span>
                <span className="text-white font-bold">{churn?.high_risk_count ?? 0}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
                <div
                  style={{
                    width: `${
                      churn?.total_members_assessed
                        ? (churn.high_risk_count / churn.total_members_assessed) * 100
                        : 0
                    }%`,
                  }}
                  className="h-full bg-red-500 rounded-full"
                />
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/5 text-[11px] text-white/40 font-mono flex justify-between">
            <span>Model: <strong>XGBoost v1.0</strong></span>
            <span>Eval: <strong>LogLoss</strong></span>
          </div>
        </div>
      </div>

      {/* ─── At-Risk Member Roster Section ─────────────────────────────────── */}
      <div className="analytics-card space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-widest text-white/40 font-mono">
              Actionable Intelligence
            </span>
            <h2 className="text-xl font-bold uppercase tracking-tight text-white mt-0.5">
              Member Churn Risk Roster
            </h2>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Risk Tier Tabs */}
            <div className="flex rounded-lg border border-white/10 bg-white/5 p-1 text-xs font-mono">
              {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((tier) => (
                <button
                  key={tier}
                  onClick={() => setRiskFilter(tier)}
                  className={`px-3 py-1 rounded-md transition-all ${
                    riskFilter === tier
                      ? 'bg-white text-black font-semibold'
                      : 'text-white/50 hover:text-white'
                  }`}
                >
                  {tier}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="Search athlete or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 px-3 py-1.5 pl-8 rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30 text-xs focus:outline-none focus:border-white/30 font-mono"
              />
              <svg
                className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-2.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>

        {/* Table Container */}
        <div className="rounded-xl border border-white/10 bg-[#0c0c0e] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-white/40 uppercase font-mono tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Athlete</th>
                  <th className="py-3 px-4 font-semibold">Plan</th>
                  <th className="py-3 px-4 font-semibold">Recency</th>
                  <th className="py-3 px-4 font-semibold">Velocity</th>
                  <th className="py-3 px-4 font-semibold">Risk Probability</th>
                  <th className="py-3 px-4 font-semibold">Risk Tier</th>
                  <th className="py-3 px-4 font-semibold">Key Contributing Signals</th>
                  <th className="py-3 px-4 font-semibold text-right">Diagnosis</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-white/40 font-mono">
                      Evaluating XGBoost inference vectors...
                    </td>
                  </tr>
                ) : filteredMembers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-white/40 font-mono">
                      No members matched current filter criteria.
                    </td>
                  </tr>
                ) : (
                  filteredMembers.map((m) => {
                    const pct = Math.round(m.churn_probability * 100)
                    return (
                      <tr key={m.member_id} className="hover:bg-white/[0.02] transition-colors">
                        {/* Athlete */}
                        <td className="py-3.5 px-4 font-medium text-white">
                          <div className="flex flex-col">
                            <span className="font-semibold text-white/90">{m.full_name}</span>
                            <span className="font-mono text-[10px] text-white/40">{m.member_code}</span>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-3.5 px-4 text-white/70">
                          {m.active_plan_name ? (
                            <span className="px-2 py-0.5 rounded bg-white/5 border border-white/10 text-[10px] font-mono text-white/80">
                              {m.active_plan_name}
                            </span>
                          ) : (
                            <span className="text-white/30 text-[11px] font-mono">No Active Plan</span>
                          )}
                        </td>

                        {/* Recency */}
                        <td className="py-3.5 px-4 font-mono text-white/70">
                          {m.days_since_last_checkin === 0 ? (
                            <span className="text-emerald-400">Today</span>
                          ) : (
                            <span>{m.days_since_last_checkin}d ago</span>
                          )}
                        </td>

                        {/* Weekly Frequency */}
                        <td className="py-3.5 px-4 font-mono text-white/70">
                          {m.visit_frequency_weekly}x/wk
                        </td>

                        {/* Probability Bar */}
                        <td className="py-3.5 px-4 font-mono">
                          <div className="w-28 space-y-1">
                            <div className="flex justify-between text-[10px]">
                              <span className={pct >= 70 ? 'text-red-400 font-bold' : pct >= 40 ? 'text-amber-400 font-bold' : 'text-emerald-400'}>
                                {pct}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                              <div
                                style={{ width: `${pct}%` }}
                                className={`h-full rounded-full ${
                                  pct >= 70
                                    ? 'bg-red-500'
                                    : pct >= 40
                                    ? 'bg-amber-400'
                                    : 'bg-emerald-500'
                                }`}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Tier Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                              m.risk_tier === 'HIGH'
                                ? 'bg-red-500/15 text-red-400 border border-red-500/30'
                                : m.risk_tier === 'MEDIUM'
                                ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {m.risk_tier}
                          </span>
                        </td>

                        {/* Risk Factors */}
                        <td className="py-3.5 px-4 max-w-sm">
                          <div className="flex flex-col gap-1">
                            {m.top_risk_factors.slice(0, 2).map((factor, idx) => (
                              <div
                                key={idx}
                                className="inline-flex items-center gap-1.5 text-[11px] text-white/60 font-mono"
                                title={factor}
                              >
                                <span
                                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                    m.risk_tier === 'HIGH'
                                      ? 'bg-red-400'
                                      : m.risk_tier === 'MEDIUM'
                                      ? 'bg-amber-400'
                                      : 'bg-emerald-400'
                                  }`}
                                />
                                <span className="truncate max-w-[280px]">{factor}</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenDiagnosis(m.member_id, 'RETENTION')}
                              className="px-2.5 py-1 rounded-lg border border-red/30 bg-red/10 hover:bg-red/20 text-red text-[11px] font-mono transition-all font-semibold flex items-center gap-1 cursor-pointer"
                              title="Open AI Retention Playbook & Offers"
                            >
                              <span>AI Strategy</span>
                              <span>&rarr;</span>
                            </button>
                            <button
                              onClick={() => handleOpenDiagnosis(m.member_id, 'DIAGNOSIS')}
                              className="px-2 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/15 text-white/70 hover:text-white text-[11px] font-mono transition-all cursor-pointer"
                              title="View ML risk signals and feature vector"
                            >
                              Signals
                            </button>
                          </div>
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

      {/* ─── Member Diagnosis & AI Retention Modal ────────────────────────────── */}
      {selectedMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-2xl rounded-2xl border border-white/15 bg-[#121215] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex justify-between items-start border-b border-white/10 pb-4">
              <div>
                <span className="text-[10px] uppercase font-mono tracking-widest text-red-500 font-semibold">
                  Member Retention & Intelligence Hub
                </span>
                <h3 className="text-xl font-black text-white uppercase tracking-tight mt-0.5">
                  {selectedMember.full_name}
                </h3>
                <span className="text-xs text-white/40 font-mono">
                  {selectedMember.member_code} &bull; Status: {selectedMember.status}
                </span>
              </div>
              <button
                onClick={() => setSelectedMember(null)}
                className="text-white/40 hover:text-white text-xl leading-none cursor-pointer"
              >
                &times;
              </button>
            </div>

            {/* Modal Navigation Tabs */}
            <div className="flex items-center gap-2 border-b border-white/8 pb-3 text-xs font-mono">
              <button
                type="button"
                onClick={() => setActiveModalTab('RETENTION')}
                className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 cursor-pointer ${
                  activeModalTab === 'RETENTION'
                    ? 'border-red/40 bg-red/15 text-red font-semibold shadow-[0_0_15px_rgba(229,32,26,0.2)]'
                    : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                <span>🤖 AI Retention Strategy & Offer</span>
                {strategy && (
                  <span className="w-2 h-2 rounded-full bg-red animate-pulse" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveModalTab('DIAGNOSIS')}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                  activeModalTab === 'DIAGNOSIS'
                    ? 'border-white/30 bg-white/10 text-white font-semibold'
                    : 'border-white/10 bg-white/5 text-white/60 hover:text-white'
                }`}
              >
                📊 Risk Signals & Feature Vector
              </button>
            </div>

            {/* Notifications / Alerts */}
            {dispatchSuccess && (
              <div className="p-3 rounded-xl border border-green-500/30 bg-green-500/10 text-green-400 text-xs font-mono flex items-center gap-2 animate-fade-in">
                <span>✓</span>
                <span>{dispatchSuccess}</span>
              </div>
            )}

            {strategyError && (
              <div className="p-3 rounded-xl border border-red/30 bg-red/10 text-red text-xs font-mono flex items-center gap-2 animate-fade-in">
                <span>✕</span>
                <span>{strategyError}</span>
              </div>
            )}

            {/* ─── TAB 1: AI RETENTION STRATEGY & OFFER ──────────────────────────── */}
            {activeModalTab === 'RETENTION' && (
              <div className="space-y-4">
                {isGeneratingStrategy ? (
                  <div className="py-12 flex flex-col items-center justify-center space-y-3">
                    <QuarterRing className="size-8 text-red" />
                    <p className="text-xs uppercase tracking-widest text-white/70 font-mono">
                      Generating AI Retention Playbook...
                    </p>
                    <p className="text-[11px] text-white/40 font-mono">
                      Synthesizing attendance velocity and churn signals
                    </p>
                  </div>
                ) : !strategy ? (
                  <div className="p-8 rounded-2xl border border-white/10 bg-white/[0.02] text-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-red/10 border border-red/20 mx-auto flex items-center justify-center text-xl">
                      🤖
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-white uppercase tracking-tight">
                        AI Retention Playbook Ready
                      </h4>
                      <p className="text-xs text-white/50 max-w-md mx-auto mt-1 leading-relaxed">
                        Generate a tailored re-engagement strategy and customized promo offer for {selectedMember.full_name} based on their {selectedMember.risk_tier} churn risk signals.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleGenerateStrategy}
                      className="px-4 py-2 rounded-lg bg-red hover:bg-red-hover text-white text-xs font-semibold uppercase tracking-wider font-mono transition-all shadow-[0_0_20px_rgba(229,32,26,0.3)] cursor-pointer"
                    >
                      Generate AI Retention Strategy &rarr;
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4 animate-fade-in">
                    {/* Strategy Header */}
                    <div className="p-4 rounded-xl border border-white/10 bg-white/[0.03] space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-white/40">
                          AI Retention Playbook
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase ${
                              strategy.urgency === 'CRITICAL'
                                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                                : strategy.urgency === 'HIGH'
                                ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            }`}
                          >
                            {strategy.urgency} URGENCY
                          </span>
                          {strategy.status === 'dispatched' && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                              DISPATCHED
                            </span>
                          )}
                        </div>
                      </div>

                      <h4 className="text-base font-bold text-white">
                        {strategy.strategy_title}
                      </h4>

                      <p className="text-xs text-white/70 leading-relaxed">
                        {strategy.diagnosis_summary}
                      </p>
                    </div>

                    {/* Tactical Action Steps */}
                    <div className="p-4 rounded-xl border border-white/8 bg-white/[0.02] space-y-2">
                      <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block">
                        Recommended Tactical Actions (Staff & Coaches)
                      </span>
                      <ul className="space-y-1.5 text-xs text-white/80 font-mono">
                        {strategy.tactical_action_steps.map((step, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-red font-bold mt-0.5">&bull;</span>
                            <span className="leading-relaxed">{step}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Personalized Offer Preview & Dispatch */}
                    <div className="p-4 rounded-xl border border-red/30 bg-red/[0.04] space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] uppercase font-mono tracking-widest text-red font-semibold">
                          Targeted Retention Offer
                        </span>
                        <span className="text-[10px] font-mono text-white/40">
                          Destination: {strategy.offer_action_url}
                        </span>
                      </div>

                      <div>
                        <p className="text-sm font-bold text-white">
                          {strategy.offer_title}
                        </p>
                        <p className="text-xs text-white/70 mt-1 leading-relaxed">
                          "{strategy.offer_message}"
                        </p>
                      </div>

                      <div className="pt-2 flex items-center justify-between border-t border-red/20">
                        <span className="text-[11px] text-white/40 font-mono">
                          CTA Button: <strong className="text-white">{strategy.offer_action_text}</strong>
                        </span>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={handleGenerateStrategy}
                            disabled={isGeneratingStrategy}
                            className="px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-xs font-mono transition-all cursor-pointer"
                          >
                            Re-generate
                          </button>

                          <button
                            type="button"
                            onClick={handleDispatchOffer}
                            disabled={isDispatchingOffer}
                            className="px-4 py-1.5 rounded-lg bg-red hover:bg-red-hover text-white text-xs font-semibold font-mono uppercase tracking-wider transition-all shadow-[0_0_15px_rgba(229,32,26,0.3)] disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                          >
                            {isDispatchingOffer ? (
                              <span>Sending...</span>
                            ) : strategy.status === 'dispatched' ? (
                              <span>✓ Re-send Offer</span>
                            ) : (
                              <span>🚀 Dispatch Offer to Member</span>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 2: DIAGNOSTIC SIGNALS & ML VECTOR ────────────────────────── */}
            {activeModalTab === 'DIAGNOSIS' && (
              <div className="space-y-4">
                {/* Risk Tier & Score */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block">
                      XGBoost Churn Risk Tier
                    </span>
                    <span
                      className={`text-lg font-black font-mono ${
                        selectedMember.risk_tier === 'HIGH'
                          ? 'text-red-400'
                          : selectedMember.risk_tier === 'MEDIUM'
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                      }`}
                    >
                      {selectedMember.risk_tier} RISK
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block">
                      Probability
                    </span>
                    <span className="text-2xl font-black text-white font-mono">
                      {Math.round(selectedMember.churn_probability * 100)}%
                    </span>
                  </div>
                </div>

                {/* Contributing Risk Signals */}
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block mb-2">
                    Primary Contributing Signals
                  </span>
                  <ul className="space-y-1.5">
                    {selectedMember.top_risk_factors.map((f, i) => (
                      <li key={i} className="text-xs text-red-300/90 font-mono flex items-center gap-2">
                        <span className="text-red-500">&bull;</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Feature Vector Table */}
                <div>
                  <span className="text-[10px] uppercase font-mono tracking-widest text-white/40 block mb-2">
                    Feature Vector (ML Ingestion Metrics)
                  </span>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                      <span className="text-white/40 block text-[10px]">Weekly Check-ins</span>
                      <span className="text-white font-semibold">
                        {selectedMember.features.visit_frequency_weekly}x/week
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                      <span className="text-white/40 block text-[10px]">Days Inactive</span>
                      <span className="text-white font-semibold">
                        {selectedMember.features.days_since_last_checkin} days
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                      <span className="text-white/40 block text-[10px]">Visits (30 Days)</span>
                      <span className="text-white font-semibold">
                        {selectedMember.features.total_visits_30d} entries
                      </span>
                    </div>
                    <div className="p-2 rounded bg-white/[0.02] border border-white/5">
                      <span className="text-white/40 block text-[10px]">Tenure</span>
                      <span className="text-white font-semibold">
                        {selectedMember.features.membership_tenure_days} days
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveModalTab('RETENTION')
                      if (!strategy) {
                        handleGenerateStrategy()
                      }
                    }}
                    className="w-full py-2.5 rounded-xl border border-red/30 bg-red/10 hover:bg-red/20 text-red text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <span>View / Generate AI Retention Strategy</span>
                    <span>&rarr;</span>
                  </button>
                </div>
              </div>
            )}

            {/* Footer Action */}
            <div className="pt-3 border-t border-white/10 flex justify-between items-center">
              <Link
                to={`/manage/members/${selectedMember.member_id}`}
                state={{ from: 'analytics' }}
                className="text-xs text-red-400 hover:text-red-300 font-mono underline"
              >
                View Full Member Profile &rarr;
              </Link>
              <button
                onClick={() => setSelectedMember(null)}
                className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-mono transition-all cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ManageAnalyticsPage
