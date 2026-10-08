import {
  useEffect,
  useState,
  type FormEvent,
} from 'react'

import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'

import type {
  Expense,
  ExpenseCategory,
} from '@/types/auth'


interface AddExpenseModalProps {
  open: boolean
  categories: ExpenseCategory[]
  expense?: Expense | null
  onClose: () => void
  onSaved: () => void
}


function getTodayInputValue() {
  const now = new Date()

  const year = now.getFullYear()

  const month = String(
    now.getMonth() + 1,
  ).padStart(2, '0')

  const day = String(
    now.getDate(),
  ).padStart(2, '0')

  return `${year}-${month}-${day}`
}


export function AddExpenseModal({
  open,
  categories,
  expense,
  onClose,
  onSaved,
}: AddExpenseModalProps) {
  const [categoryId, setCategoryId] = useState('')
  const [amount, setAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(
    getTodayInputValue(),
  )
  const [description, setDescription] = useState('')
  const [receiptPath, setReceiptPath] = useState('')

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')


  useEffect(() => {
    if (!open) {
      return
    }

    if (expense) {
      setCategoryId(
        String(expense.category_id),
      )

      setAmount(
        String(expense.amount),
      )

      setExpenseDate(
        expense.expense_date,
      )

      setDescription(
        expense.description,
      )

      setReceiptPath(
        expense.receipt_path ?? '',
      )
    } else {
      setCategoryId(
        categories.length > 0
          ? String(categories[0].id)
          : '',
      )

      setAmount('')
      setExpenseDate(
        getTodayInputValue(),
      )
      setDescription('')
      setReceiptPath('')
    }

    setError('')
  }, [
    open,
    expense,
    categories,
  ])


  if (!open) {
    return null
  }


  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault()

    setError('')

    const parsedCategory = Number(
      categoryId,
    )

    const parsedAmount = Number(
      amount,
    )

    if (!parsedCategory) {
      setError(
        'Please select an expense category.',
      )
      return
    }

    if (
      !parsedAmount ||
      parsedAmount <= 0
    ) {
      setError(
        'Please enter a valid amount.',
      )
      return
    }

    if (!expenseDate) {
      setError(
        'Please select the expense date.',
      )
      return
    }

    if (!description.trim()) {
      setError(
        'Please enter an expense description.',
      )
      return
    }

    setSaving(true)

    try {
      const data = {
        category_id: parsedCategory,
        amount: parsedAmount,
        expense_date: expenseDate,
        description: description.trim(),
        receipt_path:
          receiptPath.trim() || undefined,
      }

      if (expense) {
        await api.updateExpense(
          expense.id,
          data,
        )
      } else {
        await api.createExpense(
          data,
        )
      }

      onSaved()
      onClose()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to save expense.',
      )
    } finally {
      setSaving(false)
    }
  }


  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close expense modal"
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative z-10 w-full max-w-xl rounded-2xl border border-white/10 bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/8 px-6 py-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.22em] text-red font-semibold">
              Finance
            </p>

            <h2 className="font-display text-2xl font-black uppercase text-white">
              {expense
                ? 'Edit Expense'
                : 'Add Expense'}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/40 transition hover:bg-white/5 hover:text-white"
          >
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-6"
        >
          {error && (
            <div className="rounded-lg border border-red/30 bg-red/10 px-4 py-3 text-sm text-red">
              {error}
            </div>
          )}

          {categories.length === 0 && (
            <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-300">
              You need to create an expense category first.
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="expense-category"
              className="text-sm font-medium text-white/70"
            >
              Category
            </label>

            <select
              id="expense-category"
              value={categoryId}
              onChange={(event) =>
                setCategoryId(
                  event.target.value,
                )
              }
              className="w-full rounded-lg border border-white/10 bg-surface-2 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
              required
            >
              <option value="">
                Select category
              </option>

              {categories.map((category) => (
                <option
                  key={category.id}
                  value={category.id}
                >
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="expense-amount"
                className="text-sm font-medium text-white/70"
              >
                Amount
              </label>

              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-white/35">
                  ₱
                </span>

                <input
                  id="expense-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(event) =>
                    setAmount(
                      event.target.value,
                    )
                  }
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/10 bg-surface-2 py-3 pl-9 pr-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="expense-date"
                className="text-sm font-medium text-white/70"
              >
                Expense Date
              </label>

              <input
                id="expense-date"
                type="date"
                value={expenseDate}
                onChange={(event) =>
                  setExpenseDate(
                    event.target.value,
                  )
                }
                className="w-full rounded-lg border border-white/10 bg-surface-2 px-4 py-3 text-sm text-white outline-none transition focus:border-white/30"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="expense-description"
              className="text-sm font-medium text-white/70"
            >
              Description
            </label>

            <textarea
              id="expense-description"
              rows={4}
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value,
                )
              }
              placeholder="Example: October electricity bill"
              className="w-full resize-none rounded-lg border border-white/10 bg-surface-2 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="receipt-reference"
              className="text-sm font-medium text-white/70"
            >
              Receipt / Reference
            </label>

            <input
              id="receipt-reference"
              type="text"
              value={receiptPath}
              onChange={(event) =>
                setReceiptPath(
                  event.target.value,
                )
              }
              placeholder="Optional receipt number or reference"
              className="w-full rounded-lg border border-white/10 bg-surface-2 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-white/30"
            />

            <p className="text-xs text-white/30">
              Actual file upload can be added later.
            </p>
          </div>

          <div className="flex flex-col-reverse gap-3 border-t border-white/8 pt-5 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              loading={saving}
              disabled={
                categories.length === 0
              }
            >
              {expense
                ? 'Save Changes'
                : 'Add Expense'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}