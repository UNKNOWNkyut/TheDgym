import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { AddExpenseModal } from '@/components/manage/AddExpenseModal'
import { api } from '@/services/api'

import type {
  Expense,
  ExpenseCategory,
} from '@/types/auth'


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


function formatCurrency(
  value: string | number,
) {
  return new Intl.NumberFormat(
    'en-PH',
    {
      style: 'currency',
      currency: 'PHP',
      minimumFractionDigits: 2,
    },
  ).format(
    Number(value) || 0,
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


export function ManageExpensesPage() {
  const currentYear =
    new Date().getFullYear()

  const [expenses, setExpenses] =
    useState<Expense[]>([])

  const [categories, setCategories] =
    useState<ExpenseCategory[]>([])

  const [loading, setLoading] =
    useState(true)

  const [error, setError] =
    useState('')

  const [search, setSearch] =
    useState('')

  const [categoryFilter, setCategoryFilter] =
    useState('')

  const [monthFilter, setMonthFilter] =
    useState('')

  const [yearFilter, setYearFilter] =
    useState(
      String(currentYear),
    )

  const [showExpenseModal, setShowExpenseModal] =
    useState(false)

  const [editingExpense, setEditingExpense] =
    useState<Expense | null>(null)

  const [newCategoryName, setNewCategoryName] =
    useState('')

  const [
    newCategoryDescription,
    setNewCategoryDescription,
  ] = useState('')

  const [savingCategory, setSavingCategory] =
    useState(false)


  const loadCategories =
    useCallback(async () => {
      try {
        const result =
          await api.getExpenseCategories(
            true,
          )

        setCategories(result)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load expense categories.',
        )
      }
    }, [])


  const loadExpenses =
    useCallback(async () => {
      setLoading(true)
      setError('')

      try {
        const result =
          await api.getExpenses({
            search:
              search.trim() || undefined,

            category_id:
              categoryFilter
                ? Number(
                    categoryFilter,
                  )
                : undefined,

            year:
              yearFilter
                ? Number(
                    yearFilter,
                  )
                : undefined,

            month:
              monthFilter
                ? Number(
                    monthFilter,
                  )
                : undefined,

            limit: 500,
          })

        setExpenses(result)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to load expenses.',
        )
      } finally {
        setLoading(false)
      }
    }, [
      search,
      categoryFilter,
      monthFilter,
      yearFilter,
    ])


  useEffect(() => {
    loadCategories()
  }, [
    loadCategories,
  ])


  useEffect(() => {
    const timeout = window.setTimeout(
      () => {
        loadExpenses()
      },
      250,
    )

    return () => {
      window.clearTimeout(
        timeout,
      )
    }
  }, [
    loadExpenses,
  ])


  const handleCreateCategory = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    if (!newCategoryName.trim()) {
      setError(
        'Enter a category name.',
      )
      return
    }

    setSavingCategory(true)
    setError('')

    try {
      await api.createExpenseCategory({
        name: newCategoryName.trim(),
        description:
          newCategoryDescription.trim() ||
          undefined,
      })

      setNewCategoryName('')
      setNewCategoryDescription('')

      await loadCategories()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to create category.',
      )
    } finally {
      setSavingCategory(false)
    }
  }


  const handleDeactivateCategory =
    async (
      category: ExpenseCategory,
    ) => {
      if (!category.is_active) {
        return
      }

      const confirmed =
        window.confirm(
          `Deactivate "${category.name}"? Existing expenses will remain available.`,
        )

      if (!confirmed) {
        return
      }

      try {
        await api.deactivateExpenseCategory(
          category.id,
        )

        await loadCategories()
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to deactivate category.',
        )
      }
    }


  const handleArchiveExpense =
    async (
      expense: Expense,
    ) => {
      const confirmed =
        window.confirm(
          `Archive this ${formatCurrency(
            expense.amount,
          )} expense?`,
        )

      if (!confirmed) {
        return
      }

      try {
        await api.archiveExpense(
          expense.id,
        )

        await loadExpenses()
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'Unable to archive expense.',
        )
      }
    }


  const activeCategories =
    categories.filter(
      (category) =>
        category.is_active,
    )


  const visibleTotal =
    expenses.reduce(
      (sum, expense) =>
        sum +
        Number(
          expense.amount,
        ),
      0,
    )


  return (
    <>
      <SEO
        title="Expenses"
        description="Manage The DGym expenses."
      />

      <AddExpenseModal
        open={showExpenseModal}
        categories={activeCategories}
        expense={editingExpense}
        onClose={() => {
          setShowExpenseModal(false)
          setEditingExpense(null)
        }}
        onSaved={async () => {
          await loadExpenses()
        }}
      />

      <div className="p-6 md:p-8 max-w-6xl mx-auto">
        <div className="flex flex-col gap-5 mb-8 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
              Finance
            </p>

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
              <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                Filters
              </p>

              <h2 className="font-display text-lg font-bold uppercase text-white">
                Expense History
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search expenses..."
                className="rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
              />

              <select
                value={categoryFilter}
                onChange={(event) =>
                  setCategoryFilter(
                    event.target.value,
                  )
                }
                className="rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="">
                  All categories
                </option>

                {categories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.name}
                    </option>
                  ),
                )}
              </select>

              <select
                value={monthFilter}
                onChange={(event) =>
                  setMonthFilter(
                    event.target.value,
                  )
                }
                className="rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white outline-none focus:border-white/30"
              >
                {MONTHS.map(
                  (month) => (
                    <option
                      key={month.value}
                      value={month.value}
                    >
                      {month.label}
                    </option>
                  ),
                )}
              </select>

              <select
                value={yearFilter}
                onChange={(event) => {
                  setYearFilter(
                    event.target.value,
                  )

                  if (
                    !event.target.value
                  ) {
                    setMonthFilter('')
                  }
                }}
                className="rounded-lg border border-white/10 bg-surface-2 px-4 py-2.5 text-sm text-white outline-none focus:border-white/30"
              >
                <option value="">
                  All years
                </option>

                {[
                  currentYear - 2,
                  currentYear - 1,
                  currentYear,
                  currentYear + 1,
                ].map(
                  (year) => (
                    <option
                      key={year}
                      value={year}
                    >
                      {year}
                    </option>
                  ),
                )}
              </select>
            </div>
          </div>


          <div className="rounded-xl border border-white/8 bg-surface p-5">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-2">
              Filtered Total
            </p>

            <p className="font-display text-3xl font-black text-red">
              {formatCurrency(
                visibleTotal,
              )}
            </p>

            <p className="text-xs text-white/35 mt-2">
              {expenses.length}{' '}
              expense record
              {expenses.length === 1
                ? ''
                : 's'}
            </p>
          </div>
        </div>


        <div className="mb-10 overflow-hidden rounded-xl border border-white/8 bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
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

                  <th className="px-4 py-3">
                    Recorded By
                  </th>

                  <th className="px-4 py-3 text-right">
                    Amount
                  </th>

                  <th className="px-4 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-white/35"
                    >
                      Loading expenses...
                    </td>
                  </tr>
                ) : expenses.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center"
                    >
                      <p className="font-medium text-white/55">
                        No expenses found.
                      </p>

                      <p className="mt-1 text-xs text-white/30">
                        Add an expense or change your filters.
                      </p>
                    </td>
                  </tr>
                ) : (
                  expenses.map(
                    (expense) => (
                      <tr
                        key={expense.id}
                        className="transition hover:bg-white/[0.02]"
                      >
                        <td className="px-4 py-4 whitespace-nowrap text-white/55">
                          {formatDate(
                            expense.expense_date,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                            {expense.category_name}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <p className="max-w-sm text-white/65">
                            {expense.description}
                          </p>
                        </td>

                        <td className="px-4 py-4 text-white/45">
                          {expense.recorded_by_name ??
                            'Unknown'}
                        </td>

                        <td className="px-4 py-4 text-right font-semibold text-white whitespace-nowrap">
                          {formatCurrency(
                            expense.amount,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingExpense(
                                  expense,
                                )

                                setShowExpenseModal(
                                  true,
                                )
                              }}
                              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs font-medium text-white/60 transition hover:border-white/20 hover:bg-white/5 hover:text-white"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleArchiveExpense(
                                  expense,
                                )
                              }
                              className="rounded-lg border border-red/20 px-3 py-1.5 text-xs font-medium text-red transition hover:bg-red/10"
                            >
                              Archive
                            </button>
                          </div>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>


        <div className="rounded-xl border border-white/8 bg-surface p-6">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
              Setup
            </p>

            <h2 className="font-display text-xl font-black uppercase text-white">
              Expense Categories
            </h2>

            <p className="mt-1 text-sm text-white/40">
              Create categories such as Electricity, Rent, Equipment, Water, and Maintenance.
            </p>
          </div>


          <form
            onSubmit={
              handleCreateCategory
            }
            className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr_auto] mb-6"
          >
            <input
              type="text"
              value={newCategoryName}
              onChange={(event) =>
                setNewCategoryName(
                  event.target.value,
                )
              }
              placeholder="Category name"
              className="rounded-lg border border-white/10 bg-surface-2 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
            />

            <input
              type="text"
              value={
                newCategoryDescription
              }
              onChange={(event) =>
                setNewCategoryDescription(
                  event.target.value,
                )
              }
              placeholder="Description (optional)"
              className="rounded-lg border border-white/10 bg-surface-2 px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-white/30"
            />

            <Button
              type="submit"
              loading={savingCategory}
            >
              Add Category
            </Button>
          </form>


          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {categories.length === 0 ? (
              <div className="sm:col-span-2 xl:col-span-3 rounded-lg border border-dashed border-white/10 p-8 text-center text-sm text-white/35">
                No expense categories yet.
              </div>
            ) : (
              categories.map(
                (category) => (
                  <div
                    key={category.id}
                    className="flex items-start justify-between gap-4 rounded-lg border border-white/8 bg-background/30 p-4"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white truncate">
                          {category.name}
                        </p>

                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            category.is_active
                              ? 'bg-green-400'
                              : 'bg-white/20'
                          }`}
                        />
                      </div>

                      <p className="mt-1 text-xs text-white/35">
                        {category.description ||
                          'No description'}
                      </p>

                      {!category.is_active && (
                        <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                          Inactive
                        </p>
                      )}
                    </div>

                    {category.is_active && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDeactivateCategory(
                            category,
                          )
                        }
                        className="shrink-0 text-xs text-red/70 transition hover:text-red"
                      >
                        Deactivate
                      </button>
                    )}
                  </div>
                ),
              )
            )}
          </div>
        </div>
      </div>
    </>
  )
}