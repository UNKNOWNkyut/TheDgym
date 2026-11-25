import { useCallback, useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { AddExpenseModal } from '@/components/manage/AddExpenseModal'
import { api } from '@/services/api'
import { formatCurrency } from '@/utils/formatters'
import type { Expense } from '@/types/auth'

const MONTHS = [
  { value: '', label: 'All months' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const shortDateFormatter = new Intl.DateTimeFormat('en-PH', {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
})

function formatDate(value: string) {
  return shortDateFormatter.format(new Date(`${value}T00:00:00`))
}

function getExpenseDisplayName(expense: Expense) {
  return expense.name || expense.category_name || expense.description || 'this expense'
}

export function ManageExpensesPage() {
  const [currentYear] = useState(() => new Date().getFullYear())

  const [expenses, setExpenses] = useState<Expense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [monthFilter, setMonthFilter] = useState('')
  const [yearFilter, setYearFilter] = useState(String(currentYear))
  const [showExpenseModal, setShowExpenseModal] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Expense | null>(null)
  const [deleting, setDeleting] = useState(false)

  const loadExpenses = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.getExpenses({
        search: search.trim() || undefined,
        year: yearFilter ? Number(yearFilter) : undefined,
        month: monthFilter ? Number(monthFilter) : undefined,
        limit: 500,
      })
      setExpenses(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load expenses.')
    } finally {
      setLoading(false)
    }
  }, [search, monthFilter, yearFilter])

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      loadExpenses()
    }, 250)
    return () => {
      window.clearTimeout(timeout)
    }
  }, [loadExpenses])

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    setError('')
    try {
      await api.deleteExpense(deleteTarget.id)
      setDeleteTarget(null)
      await loadExpenses()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete expense.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  // For 2026 all-months view, only compute completed months (Jan - Sep)
  const is2026AllMonths = yearFilter === '2026' && monthFilter === ''
  const countedExpenses = is2026AllMonths
    ? expenses.filter((e) => new Date(`${e.expense_date}T00:00:00`).getMonth() + 1 < 10)
    : expenses
  const visibleTotal = countedExpenses.reduce((sum, expense) => sum + Number(expense.amount), 0)

  return (
    <>
      <SEO title="Expenses" description="Manage The DGym expenses." />

      <AddExpenseModal
        open={showExpenseModal}
        expense={editingExpense}
        onClose={() => {
          setShowExpenseModal(false)
          setEditingExpense(null)
        }}
        onSaved={async () => {
          await loadExpenses()
        }}
      />

      {deleteTarget && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-expense-title"
        >
          <button
            type="button"
            aria-label="Close delete confirmation"
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteTarget(null)}
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-surface p-6 shadow-2xl">
            <p
              id="delete-expense-title"
              className="text-sm text-white/90 leading-relaxed"
            >
              Are you sure you want to delete{' '}
              <span className="font-semibold text-white">
                {getExpenseDisplayName(deleteTarget)}
              </span>
              ?
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setDeleteTarget(null)}
                className="bg-transparent border-0 px-4 py-2 text-sm font-medium text-zinc-400 transition hover:text-white disabled:opacity-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleConfirmDelete}
                className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white transition disabled:opacity-50 cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Yes'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-5 mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Finance</p>
            <h1 className="font-display text-3xl md:text-4xl font-black uppercase tracking-tight text-white">
              Expenses
            </h1>
            <p className="text-sm text-white/50 mt-1">
              Record and monitor The DGym operating expenses.
            </p>
          </div>

          <Button
            onClick={() => {
              setEditingExpense(null)
              setShowExpenseModal(true)
            }}
          >
            + Add Expense
          </Button>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red/25 bg-red/10 px-4 py-3 text-sm text-red">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 mb-8">
          <div className="lg:col-span-2 rounded-xl border border-white/8 bg-surface p-5">
            <div className="mb-5">
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1">Filters</p>
              <h2 className="font-display text-lg font-bold uppercase text-white">
                Expense History
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search expenses..."
                className="rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
              />

              <select
                value={monthFilter}
                onChange={(event) => setMonthFilter(event.target.value)}
                className="rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white outline-none focus:border-white/30"
              >
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <select
                value={yearFilter}
                onChange={(event) => {
                  setYearFilter(event.target.value)
                  if (!event.target.value) {
                    setMonthFilter('')
                  }
                }}
                className="rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="">All years</option>
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="rounded-xl border border-white/8 bg-surface p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              {is2026AllMonths ? 'Completed Total (Jan – Sep 2026)' : 'Filtered Total'}
            </p>
            <p className="font-display text-3xl font-black text-red">
              {formatCurrency(visibleTotal)}
            </p>
            <p className="text-xs text-white/35 mt-2">
              {is2026AllMonths
                ? `${countedExpenses.length} completed records (Oct–Dec incomplete)`
                : `${expenses.length} expense record${expenses.length === 1 ? '' : 's'}`}
            </p>
          </div>
        </div>

        <div className="mb-10 overflow-hidden rounded-xl border border-white/8 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead className="border-b border-white/8 bg-surface-2 text-xs uppercase tracking-wider text-white/40">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Expense</th>
                  <th className="px-4 py-3">Recorded By</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-white/35">
                      Loading expenses...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-20 text-center align-middle">
                      <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                        <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-3 text-white/30">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                          </svg>
                        </div>
                        <p className="text-base font-semibold text-white/70">No expenses found.</p>
                        <p className="mt-1 text-xs text-white/40">
                          Add an expense or change your filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  expenses.map((expense) => {
                    const displayName = getExpenseDisplayName(expense)
                    const showDescription =
                      expense.description && expense.description !== displayName

                    return (
                      <tr key={expense.id} className="transition hover:bg-white/[0.02]">
                        <td className="px-4 py-4 whitespace-nowrap text-white/55">
                          {formatDate(expense.expense_date)}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-white">{displayName}</p>
                          {showDescription && (
                            <p className="mt-0.5 max-w-sm text-xs text-white/50">
                              {expense.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-white/45">
                          {expense.recorded_by_name ?? 'Unknown'}
                        </td>
                        <td className="px-4 py-4 text-right font-semibold text-white whitespace-nowrap">
                          {formatCurrency(expense.amount)}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingExpense(expense)
                                setShowExpenseModal(true)
                              }}
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white cursor-pointer"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteTarget(expense)}
                              title="Delete expense"
                              aria-label="Delete expense"
                              className="rounded-md p-1.5 text-zinc-400 transition hover:bg-red/10 hover:text-red cursor-pointer"
                            >
                              <Trash2 className="h-4 w-4" />
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
    </>
  )
}
