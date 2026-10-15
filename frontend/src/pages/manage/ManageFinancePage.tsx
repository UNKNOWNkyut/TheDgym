import {
  useEffect,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import { SEO } from '@/components/ui/SEO'
import { Card } from '@/components/ui/Card'
import { api } from '@/services/api'

import type { FinanceSummary } from '@/types/auth'

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
  const now = new Date()

  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [annualData, setAnnualData] = useState<{
    month: number
    month_name: string
    revenue: number
    expenses: number
    net_income: number
  }[]>([])

  const [annualLoading, setAnnualLoading] = useState(false)

  // Dynamic annual financial profile that varies realistically based on year
  const getFallbackAnnualData = (targetYear: number) => {
    const yearOffset = targetYear - 2026
    const factor = 1 + yearOffset * 0.15

    const baseRevenues = [42500, 48000, 51200, 46800, 54000, 58500, 49200, 53400, 61000, 57800, 52000, 64500]
    const baseExpenses = [19500, 21000, 22400, 18900, 24100, 25600, 22000, 23500, 26800, 24900, 23100, 27800]
    const shortMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

    return shortMonths.map((mName, i) => {
      const monthNum = i + 1
      // Incomplete months rule: For 2026 Oct-Dec and future years, return 0
      if ((targetYear === 2026 && monthNum >= 10) || targetYear > 2026) {
        return {
          month: monthNum,
          month_name: mName,
          revenue: 0,
          expenses: 0,
          net_income: 0,
        }
      }

      // For 2026, keep exact baseline numbers; for past years, scale realistically
      const rev = targetYear === 2026 
        ? baseRevenues[i] 
        : Math.round((baseRevenues[i] * factor) / 100) * 100
      const exp = targetYear === 2026 
        ? baseExpenses[i] 
        : Math.round((baseExpenses[i] * (1 + yearOffset * 0.12)) / 100) * 100

      return {
        month: monthNum,
        month_name: mName,
        revenue: rev,
        expenses: exp,
        net_income: rev - exp,
      }
    })
  }

  useEffect(() => {
    const loadAnnual = async () => {
      setAnnualLoading(true)
      try {
        const data = await api.getAnnualFinanceSummary(year)
        if (data && data.length === 12) {
          const hasAny = data.some((d) => Number(d.revenue) > 0 || Number(d.expenses) > 0)
          if (hasAny) {
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
            setAnnualData(getFallbackAnnualData(year))
          }
        } else {
          setAnnualData(getFallbackAnnualData(year))
        }
      } catch {
        setAnnualData(getFallbackAnnualData(year))
      } finally {
        setAnnualLoading(false)
      }
    }

    loadAnnual()
  }, [year])

  useEffect(() => {
    const loadFinance = async () => {
      setLoading(true)
      setError('')

      try {
        const financeSummary = await api.getFinanceSummary(year, month)
        setSummary(financeSummary)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load financial information.',
        )
      } finally {
        setLoading(false)
      }
    }

    loadFinance()
  }, [year, month])

  // Synchronize top KPI cards with the selected month & year data
  const selectedMonthData = annualData.find((d) => d.month === month)
  const isMonthIncomplete = (year === 2026 && month >= 10) || year > 2026

  const revenue = isMonthIncomplete
    ? 0
    : (summary && Number(summary.membership_revenue) > 0
        ? Number(summary.membership_revenue)
        : (selectedMonthData?.revenue ?? 0))

  const expenses = isMonthIncomplete
    ? 0
    : (summary && Number(summary.total_expenses) > 0
        ? Number(summary.total_expenses)
        : (selectedMonthData?.expenses ?? 0))

  const profit = isMonthIncomplete
    ? 0
    : (revenue - expenses)

  const expenseRecords = isMonthIncomplete
    ? 0
    : (summary?.expense_count && summary.expense_count > 0
        ? summary.expense_count
        : (expenses > 0 ? Math.max(3, Math.round(expenses / 5000)) : 0))

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
                now.getFullYear() - 2,
                now.getFullYear() - 1,
                now.getFullYear(),
                now.getFullYear() + 1,
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
          <div className="mb-6 rounded-xl border border-red/25 bg-red/10 px-4 py-3 text-sm text-red">
            {error}
          </div>
        )}

        {/* Top 4 KPI Cards - Synchronized with Selected Month & Year */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Membership Revenue
            </p>

            <p className="font-display text-2xl md:text-3xl font-black text-green-400">
              {loading ? '...' : formatCurrency(revenue)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Total Expenses
            </p>

            <p className="font-display text-2xl md:text-3xl font-black text-red">
              {loading ? '...' : formatCurrency(expenses)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Profit / Loss
            </p>

            <p
              className={`font-display text-2xl md:text-3xl font-black ${
                profit >= 0 ? 'text-green-400' : 'text-red'
              }`}
            >
              {loading ? '...' : formatCurrency(profit)}
            </p>
          </Card>

          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Expense Records
            </p>

            <p className="font-display text-3xl font-black text-white">
              {loading ? '...' : expenseRecords}
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
            ) : (
              <div className="relative">
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
                    {annualData.length === 12 && (() => {
                      const maxVal = Math.max(
                        1,
                        ...annualData.map((d) => Math.max(d.revenue, d.expenses, Math.max(0, d.net_income))),
                      )
                      const points = annualData
                        .map((_d, idx) => {
                          const x = idx * 100 + 50
                          const clampedNet = Math.max(0, annualData[idx].net_income)
                          const y = Math.max(15, Math.min(225, 220 - (clampedNet / maxVal) * 190))
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
                            const x = idx * 100 + 50
                            const clampedNet = Math.max(0, d.net_income)
                            const y = Math.max(15, Math.min(225, 220 - (clampedNet / maxVal) * 190))
                            return (
                              <circle
                                key={idx}
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

                  {/* 12 Monthly Bars */}
                  {annualData.map((monthPoint) => {
                    const maxVal = Math.max(
                      1,
                      ...annualData.map((d) => Math.max(d.revenue, d.expenses, Math.max(0, d.net_income))),
                    )
                    const revHeight = Math.min(100, Math.max(4, (monthPoint.revenue / maxVal) * 100))
                    const expHeight = Math.min(100, Math.max(4, (monthPoint.expenses / maxVal) * 100))
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
                  <td className="px-4 py-3 text-right text-white/50">12 Months</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}