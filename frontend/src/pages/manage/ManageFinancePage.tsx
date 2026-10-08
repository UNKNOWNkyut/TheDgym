import {
  useEffect,
  useState,
} from 'react'

import { Link } from 'react-router-dom'

import { SEO } from '@/components/ui/SEO'
import { Card } from '@/components/ui/Card'
import { api } from '@/services/api'

import type {
  Expense,
  FinanceSummary,
} from '@/types/auth'


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


function formatCurrency(
  value: string | number,
) {
  const amount = Number(value)

  return new Intl.NumberFormat(
    'en-PH',
    {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    },
  ).format(
    Number.isFinite(amount)
      ? amount
      : 0,
  )
}


function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    'en-PH',
    {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    },
  ).format(
    new Date(
      `${value}T00:00:00`,
    ),
  )
}


export function ManageFinancePage() {
  const now = new Date()

  const [year, setYear] = useState(
    now.getFullYear(),
  )

  const [month, setMonth] = useState(
    now.getMonth() + 1,
  )

  const [summary, setSummary] =
    useState<FinanceSummary | null>(null)

  const [recentExpenses, setRecentExpenses] =
    useState<Expense[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')


  useEffect(() => {
    const loadFinance = async () => {
      setLoading(true)
      setError('')

      try {
        const [
          financeSummary,
          expenses,
        ] = await Promise.all([
          api.getFinanceSummary(
            year,
            month,
          ),

          api.getExpenses({
            year,
            month,
            limit: 5,
          }),
        ])

        setSummary(
          financeSummary,
        )

        setRecentExpenses(
          expenses,
        )
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
  }, [
    year,
    month,
  ])


  const revenue = Number(
    summary?.membership_revenue ?? 0,
  )

  const expenses = Number(
    summary?.total_expenses ?? 0,
  )

  const profit = Number(
    summary?.profit ?? 0,
  )

  const maxCategoryValue = Math.max(
    1,
    ...(summary?.expenses_by_category.map(
      (item) => Number(item.total),
    ) ?? [1]),
  )


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
              onChange={(event) =>
                setMonth(
                  Number(
                    event.target.value,
                  ),
                )
              }
              className="rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white outline-none"
            >
              {MONTHS.map(
                (monthName, index) => (
                  <option
                    key={monthName}
                    value={index + 1}
                  >
                    {monthName}
                  </option>
                ),
              )}
            </select>

            <select
              value={year}
              onChange={(event) =>
                setYear(
                  Number(
                    event.target.value,
                  ),
                )
              }
              className="rounded-lg border border-white/10 bg-surface px-4 py-2.5 text-sm text-white outline-none"
            >
              {[
                now.getFullYear() - 2,
                now.getFullYear() - 1,
                now.getFullYear(),
                now.getFullYear() + 1,
              ].map(
                (yearOption) => (
                  <option
                    key={yearOption}
                    value={yearOption}
                  >
                    {yearOption}
                  </option>
                ),
              )}
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


        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Membership Revenue
            </p>

            <p className="font-display text-2xl md:text-3xl font-black text-green-400">
              {loading
                ? '...'
                : formatCurrency(
                    revenue,
                  )}
            </p>
          </Card>


          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Total Expenses
            </p>

            <p className="font-display text-2xl md:text-3xl font-black text-red">
              {loading
                ? '...'
                : formatCurrency(
                    expenses,
                  )}
            </p>
          </Card>


          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Profit / Loss
            </p>

            <p
              className={`font-display text-2xl md:text-3xl font-black ${
                profit >= 0
                  ? 'text-green-400'
                  : 'text-red'
              }`}
            >
              {loading
                ? '...'
                : formatCurrency(
                    profit,
                  )}
            </p>
          </Card>


          <Card className="p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Expense Records
            </p>

            <p className="font-display text-3xl font-black text-white">
              {loading
                ? '...'
                : summary?.expense_count ?? 0}
            </p>
          </Card>
        </div>


        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5 mb-10">
          <div className="lg:col-span-3 rounded-xl border border-white/8 bg-surface p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                Performance
              </p>

              <h2 className="font-display text-xl font-black uppercase text-white">
                Income vs Expenses
              </h2>
            </div>

            <div className="space-y-7">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60">
                    Membership Revenue
                  </span>

                  <span className="text-sm font-semibold text-white">
                    {formatCurrency(
                      revenue,
                    )}
                  </span>
                </div>

                <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-green-400 transition-all"
                    style={{
                      width: `${
                        Math.max(
                          revenue,
                          expenses,
                        ) > 0
                          ? (
                              revenue /
                              Math.max(
                                revenue,
                                expenses,
                              )
                            ) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>


              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60">
                    Expenses
                  </span>

                  <span className="text-sm font-semibold text-white">
                    {formatCurrency(
                      expenses,
                    )}
                  </span>
                </div>

                <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red transition-all"
                    style={{
                      width: `${
                        Math.max(
                          revenue,
                          expenses,
                        ) > 0
                          ? (
                              expenses /
                              Math.max(
                                revenue,
                                expenses,
                              )
                            ) * 100
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </div>


            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-white/8 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-widest text-white/30">
                  Income
                </p>

                <p className="mt-1 font-bold text-green-400">
                  {formatCurrency(
                    revenue,
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-white/8 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-widest text-white/30">
                  Expenses
                </p>

                <p className="mt-1 font-bold text-red">
                  {formatCurrency(
                    expenses,
                  )}
                </p>
              </div>

              <div className="rounded-lg border border-white/8 bg-background/40 p-4">
                <p className="text-xs uppercase tracking-widest text-white/30">
                  Net
                </p>

                <p
                  className={`mt-1 font-bold ${
                    profit >= 0
                      ? 'text-green-400'
                      : 'text-red'
                  }`}
                >
                  {formatCurrency(
                    profit,
                  )}
                </p>
              </div>
            </div>
          </div>


          <div className="lg:col-span-2 rounded-xl border border-white/8 bg-surface p-6">
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                Expenses
              </p>

              <h2 className="font-display text-xl font-black uppercase text-white">
                Category Breakdown
              </h2>
            </div>

            {summary &&
            summary.expenses_by_category.length > 0 ? (
              <div className="space-y-5">
                {summary.expenses_by_category.map(
                  (category) => {
                    const value = Number(
                      category.total,
                    )

                    return (
                      <div
                        key={
                          category.category_id
                        }
                      >
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span className="text-sm text-white/65 truncate">
                            {
                              category.category_name
                            }
                          </span>

                          <span className="text-xs font-semibold text-white">
                            {formatCurrency(
                              value,
                            )}
                          </span>
                        </div>

                        <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-red"
                            style={{
                              width: `${
                                (
                                  value /
                                  maxCategoryValue
                                ) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    )
                  },
                )}
              </div>
            ) : (
              <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed border-white/10">
                <p className="text-sm text-white/35">
                  No expenses recorded for this period.
                </p>
              </div>
            )}
          </div>
        </div>


        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-widest text-white/40">
                Latest
              </p>

              <h2 className="font-display text-xl font-bold uppercase tracking-wide text-white">
                Recent Expenses
              </h2>
            </div>

            <Link
              to="/manage/expenses"
              className="text-xs text-red hover:underline"
            >
              Manage all →
            </Link>
          </div>

          <div className="overflow-hidden rounded-xl border border-white/8 bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-white/8 bg-surface-2 text-xs uppercase tracking-wider text-white/40">
                  <tr>
                    <th className="px-4 py-3">
                      Date
                    </th>

                    <th className="px-4 py-3">
                      Category
                    </th>

                    <th className="px-4 py-3">
                      Description
                    </th>

                    <th className="px-4 py-3 text-right">
                      Amount
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-white/35"
                      >
                        Loading financial data...
                      </td>
                    </tr>
                  ) : recentExpenses.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-4 py-10 text-center text-white/35"
                      >
                        No expenses recorded yet.
                      </td>
                    </tr>
                  ) : (
                    recentExpenses.map(
                      (expense) => (
                        <tr
                          key={expense.id}
                          className="transition hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-4 text-white/55 whitespace-nowrap">
                            {formatDate(
                              expense.expense_date,
                            )}
                          </td>

                          <td className="px-4 py-4 text-white">
                            {expense.category_name}
                          </td>

                          <td className="px-4 py-4 text-white/55">
                            {expense.description}
                          </td>

                          <td className="px-4 py-4 text-right font-semibold text-red whitespace-nowrap">
                            {formatCurrency(
                              expense.amount,
                            )}
                          </td>
                        </tr>
                      ),
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}