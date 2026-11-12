import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import { SEO } from '@/components/ui/SEO'
import { Card } from '@/components/ui/Card'
import { api } from '@/services/api'

import type { FinanceSummary } from '@/types/auth'

interface AnnualMonthPoint {
  month: number
  month_name: string
  revenue: number
  expenses: number
  net_income: number
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function formatCurrency(value: string | number) {
  const amount = Number(value)

  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    minimumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)
}

export function ManageFinancePage() {
  const [initialYear] = useState(() => new Date().getFullYear())

  const [year, setYear] = useState(initialYear)
  const [month, setMonth] = useState(() => new Date().getMonth() + 1)
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [annualData, setAnnualData] = useState<AnnualMonthPoint[]>([])
  const [annualLoading, setAnnualLoading] = useState(false)
  const [annualError, setAnnualError] = useState('')
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false

    const loadAnnual = async () => {
      setAnnualLoading(true)
      setAnnualError('')
      try {
        const data = await api.getAnnualFinanceSummary(year)
        if (cancelled) return

        if (Array.isArray(data) && data.length > 0) {
          setAnnualData(
            data.map((d) => ({
              month: d.month,
              month_name: d.month_name,
              revenue: Number(d.revenue || 0),
              expenses: Number(d.expenses || 0),
              net_income: Number(d.net_income || 0),
            })),
          )
        } else {
          setAnnualData([])
          setAnnualError('Annual financial summary returned no monthly data.')
        }
      } catch (err) {
        if (cancelled) return
        setAnnualData([])
        setAnnualError(
          err instanceof Error
            ? err.message
            : 'Unable to load annual finance summary.',
        )
      } finally {
        if (!cancelled) {
          setAnnualLoading(false)
        }
      }
    }

    loadAnnual()
    return () => {
      cancelled = true
    }
  }, [year, reloadTick])

  useEffect(() => {
    let cancelled = false

    const loadFinance = async () => {
      setLoading(true)
      setError('')
      setSummary(null)

      try {
        const financeSummary = await api.getFinanceSummary(year, month)
        if (!cancelled) {
          setSummary(financeSummary)
        }
      } catch (err) {
        if (!cancelled) {
          setSummary(null)
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to load financial information.',
          )
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadFinance()
    return () => {
      cancelled = true
    }
  }, [year, month, reloadTick])

  const maxAnnualValue = useMemo(
    () =>
      Math.max(
        1,
        ...annualData.map((d) => Math.max(d.revenue, d.expenses, Math.max(0, d.net_income))),
      ),
    [annualData],
  )

  const hasAnnualActivity = useMemo(
    () => annualData.some((d) => d.revenue !== 0 || d.expenses !== 0 || d.net_income !== 0),
    [annualData],
  )

  const revenue = summary ? Number(summary.membership_revenue || 0) : 0
  const expenses = summary ? Number(summary.total_expenses || 0) : 0
  const profit = summary ? Number(summary.profit ?? revenue - expenses) : 0
  const expenseRecords = summary?.expense_count ?? 0

  return (
    <>
      <SEO
        title="Finance"
        description="The DGym financial overview."
      />

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-5 mb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
              Finance
            </p>

            <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Financial Overview
            </h1>

            <p className="text-sm text-white/50 mt-1">
              Monitor gym revenue, expenses, and profit.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <select
              value={month}
              onChange={(event) => setMonth(Number(event.target.value))}
              className="rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white outline-none cursor-pointer hover:border-white/20 transition-colors"
            >
              {MONTHS.map((monthName, index) => (
                <option
                  key={monthName}
                  value={index + 1}
                >
                  {monthName}
                </option>
              ))}
            </select>

            <select
              value={year}
              onChange={(event) => setYear(Number(event.target.value))}
              className="rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white outline-none cursor-pointer hover:border-white/20 transition-colors"
            >
              {[
                initialYear - 2,
                initialYear - 1,
                initialYear,
                initialYear + 1,
              ].map((yearOption) => (
                <option
                  key={yearOption}
                  value={yearOption}
                >
                  {yearOption}
                </option>
              ))}
            </select>

            <Link
              to="/manage/expenses"
              className="inline-flex items-center justify-center rounded-lg bg-red px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-hover"
            >
              Manage Expenses
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-red/25 bg-red/10 px-4 py-3 text-sm text-red">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setReloadTick((prev) => prev + 1)}
              className="rounded-lg border border-red/30 px-3 py-1 text-xs font-semibold text-red transition hover:bg-red/20 cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Top 4 KPI Cards - Synchronized with Selected Month & Year */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Membership Revenue
            </p>

            <p className="font-display text-2xl md:text-3xl font-black text-green-400">
              {loading ? '...' : error ? '—' : formatCurrency(revenue)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Total Expenses
            </p>

            <p className="font-display text-2xl md:text-3xl font-black text-red">
              {loading ? '...' : error ? '—' : formatCurrency(expenses)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Profit / Loss
            </p>

            <p
              className={`font-display text-2xl md:text-3xl font-black ${
                error ? 'text-white/40' : profit >= 0 ? 'text-green-400' : 'text-red'
              }`}
            >
              {loading ? '...' : error ? '—' : formatCurrency(profit)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Expense Records
            </p>

            <p className="font-display text-3xl font-black text-white">
              {loading ? '...' : error ? '—' : expenseRecords}
            </p>
          </Card>
        </div>

        {/* 12-Month Financial Performance Graph & Table */}
        <div className="mb-10 rounded-xl border border-white/8 bg-surface p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/8">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                Annual Performance Tracking ({year})
              </p>
              <h2 className="font-display text-xl font-black uppercase text-white">
                Revenue, Expenses &amp; Net Income (Monthly)
              </h2>
            </div>

            {/* Clean Visual Legend (Removed parenthetical annotations per requirement) */}
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-sm bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                <span className="text-white/80 font-medium">Revenue</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-sm bg-red shadow-[0_0_8px_rgba(239,68,68,0.5)]" />
                <span className="text-white/80 font-medium">Expenses</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-4 h-1 bg-emerald-400 rounded-full relative flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 absolute" />
                </span>
                <span className="text-emerald-400 font-semibold">Net Income</span>
              </div>
            </div>
          </div>

          {/* Visual Chart Area */}
          <div className="mt-8 mb-6">
            {annualLoading ? (
              <div className="h-64 flex items-center justify-center text-white/40 text-sm">
                Loading 12-month annual finance data...
              </div>
            ) : annualError ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3 rounded-lg border border-red/25 bg-red/10 px-4 text-center text-sm text-red">
                <p>{annualError}</p>
                <button
                  type="button"
                  onClick={() => setReloadTick((prev) => prev + 1)}
                  className="rounded-lg border border-red/30 px-3 py-1.5 text-xs font-semibold text-red transition hover:bg-red/20 cursor-pointer"
                >
                  Retry Annual Report
                </button>
              </div>
            ) : annualData.length === 0 ? (
              <div className="h-64 flex items-center justify-center rounded-lg border border-white/10 bg-black/20 px-4 text-center text-sm text-white/50">
                No annual financial records available for {year}.
              </div>
            ) : (
              <div className="relative">
                {!hasAnnualActivity && (
                  <p className="mb-3 text-xs font-mono text-white/50">
                    No recorded membership revenue or expenses yet for {year}. Showing verified ₱0.00 monthly totals.
                  </p>
                )}
                {/* SVG Trendline for Net Income overlay */}
                <div className="h-64 sm:h-72 w-full relative flex items-end justify-between px-2 sm:px-6 pt-6 pb-2 border-b border-white/10 bg-black/20 rounded-t-lg">
                  {/* Grid Lines */}
                  <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-10 px-4 py-4">
                    <div className="w-full border-b border-white" />
                    <div className="w-full border-b border-white" />
                    <div className="w-full border-b border-white" />
                    <div className="w-full border-b border-white" />
                  </div>

                  {/* SVG for Net Income Green Polyline */}
                  <svg
                    viewBox="0 0 1200 240"
                    preserveAspectRatio="none"
                    className="absolute inset-0 w-full h-full pointer-events-none z-10"
                  >
                    {annualData.length > 0 && (() => {
                      const step = 1200 / annualData.length
                      const points = annualData
                        .map((d, idx) => {
                          const x = idx * step + step / 2
                          const clampedNet = Math.max(0, d.net_income)
                          const y = Math.max(15, Math.min(225, 220 - (clampedNet / maxAnnualValue) * 190))
                          return `${x},${y}`
                        })
                        .join(' ')

                      return (
                        <>
                          <polyline
                            fill="none"
                            stroke="#10b981"
                            strokeWidth="3.5"
                            points={points}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="drop-shadow-[0_0_8px_rgba(16,185,129,0.7)]"
                          />
                          {annualData.map((d, idx) => {
                            const x = idx * step + step / 2
                            const clampedNet = Math.max(0, d.net_income)
                            const y = Math.max(15, Math.min(225, 220 - (clampedNet / maxAnnualValue) * 190))
                            return (
                              <circle
                                key={d.month}
                                cx={x}
                                cy={y}
                                r="4.5"
                                fill="#10b981"
                                stroke="#0b0b0e"
                                strokeWidth="2"
                              />
                            )
                          })}
                        </>
                      )
                    })()}
                  </svg>

                  {/* Monthly Bars */}
                  {annualData.map((monthPoint) => {
                    const revHeight =
                      monthPoint.revenue > 0
                        ? Math.min(100, Math.max(4, (monthPoint.revenue / maxAnnualValue) * 100))
                        : 0
                    const expHeight =
                      monthPoint.expenses > 0
                        ? Math.min(100, Math.max(4, (monthPoint.expenses / maxAnnualValue) * 100))
                        : 0
                    const isSelected = monthPoint.month === month

                    return (
                      <div
                        key={monthPoint.month}
                        onClick={() => setMonth(monthPoint.month)}
                        className={`flex flex-col items-center flex-1 h-full justify-end group relative z-20 cursor-pointer rounded-t transition-all ${
                          isSelected ? 'bg-white/5' : ''
                        }`}
                      >
                        {/* Tooltip */}
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity absolute -top-20 z-30 pointer-events-none bg-[#111114] border border-white/20 p-2.5 rounded-lg shadow-2xl text-[10px] font-mono whitespace-nowrap min-w-[140px]">
                          <p className="text-white font-bold text-center border-b border-white/10 pb-1 mb-1">
                            {monthPoint.month_name} {year}
                          </p>
                          <div className="flex justify-between text-blue-400 gap-2">
                            <span>Rev:</span>
                            <span className="font-semibold">{formatCurrency(monthPoint.revenue)}</span>
                          </div>
                          <div className="flex justify-between text-red gap-2">
                            <span>Exp:</span>
                            <span className="font-semibold">{formatCurrency(monthPoint.expenses)}</span>
                          </div>
                          <div className="flex justify-between text-emerald-400 gap-2 border-t border-white/10 pt-1 mt-1">
                            <span>Net:</span>
                            <span className="font-bold">{formatCurrency(monthPoint.net_income)}</span>
                          </div>
                        </div>

                        {/* Bar Group */}
                        <div className="flex items-end gap-1 sm:gap-1.5 h-full w-full justify-center px-0.5">
                          {/* Revenue Blue Bar */}
                          <div
                            style={{ height: `${revHeight}%` }}
                            className={`w-2.5 sm:w-4 rounded-t-sm transition-all shadow-[0_0_8px_rgba(59,130,246,0.25)] ${
                              isSelected ? 'bg-blue-400 ring-1 ring-blue-300' : 'bg-blue-500 hover:bg-blue-400'
                            }`}
                            title={`Revenue: ${formatCurrency(monthPoint.revenue)}`}
                          />
                          {/* Expenses Red Bar */}
                          <div
                            style={{ height: `${expHeight}%` }}
                            className={`w-2.5 sm:w-4 rounded-t-sm transition-all shadow-[0_0_8px_rgba(239,68,68,0.25)] ${
                              isSelected ? 'bg-red-hover ring-1 ring-red' : 'bg-red hover:bg-red-hover'
                            }`}
                            title={`Expenses: ${formatCurrency(monthPoint.expenses)}`}
                          />
                        </div>

                        {/* Month Label */}
                        <span
                          className={`text-[10px] sm:text-xs font-mono font-medium mt-2 transition-colors ${
                            isSelected ? 'text-white font-bold' : 'text-white/50 group-hover:text-white'
                          }`}
                        >
                          {monthPoint.month_name}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 12-Month Table Representation */}
          {!annualLoading && !annualError && annualData.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-white/8 mt-6">
              <table className="w-full text-left text-xs font-mono">
                <thead className="border-b border-white/8 bg-surface-2 uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-4 py-3">Month</th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-blue-400">● Revenue</span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-red">● Expenses</span>
                    </th>
                    <th className="px-4 py-3 text-right">
                      <span className="text-emerald-400">● Net Income</span>
                    </th>
                    <th className="px-4 py-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {annualData.map((d) => {
                    const marginPct = d.revenue > 0 ? ((d.net_income / d.revenue) * 100).toFixed(1) : '0.0'
                    const isSelected = d.month === month

                    return (
                      <tr
                        key={d.month}
                        onClick={() => setMonth(d.month)}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? 'bg-white/10' : 'hover:bg-white/[0.02]'
                        }`}
                      >
                        <td className="px-4 py-2.5 font-bold text-white flex items-center gap-2">
                          {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-red" />}
                          {d.month_name} {year}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-blue-400">
                          {formatCurrency(d.revenue)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-red">
                          {formatCurrency(d.expenses)}
                        </td>
                        <td className="px-4 py-2.5 text-right font-bold">
                          <span
                            className={
                              d.net_income >= 0
                                ? 'text-emerald-400'
                                : 'text-red'
                            }
                          >
                            {d.net_income >= 0 ? '+' : ''}
                            {formatCurrency(d.net_income)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              d.net_income >= 0
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-red/10 text-red border border-red/20'
                            }`}
                          >
                            {marginPct}%
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot className="border-t-2 border-white/10 bg-white/[0.03] font-bold">
                  <tr>
                    <td className="px-4 py-3 text-white uppercase tracking-wider">Annual Total</td>
                    <td className="px-4 py-3 text-right text-blue-400 font-extrabold">
                      {formatCurrency(annualData.reduce((acc, curr) => acc + curr.revenue, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-red font-extrabold">
                      {formatCurrency(annualData.reduce((acc, curr) => acc + curr.expenses, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-emerald-400 font-extrabold">
                      {formatCurrency(
                        annualData.reduce((acc, curr) => acc + curr.revenue, 0) -
                          annualData.reduce((acc, curr) => acc + curr.expenses, 0),
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-white/50">{annualData.length} Months</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}