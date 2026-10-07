import { useState, useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { Button } from '@/components/ui/Button'
import { api } from '@/services/api'
import type { Member, MembershipPlan, PaymentMethod } from '@/types/auth'

gsap.registerPlugin()

interface AssignMembershipModalProps {
  member: Member
  plans: MembershipPlan[]
  onClose: () => void
  onSuccess: () => void
}

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'maya', label: 'Maya' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'other', label: 'Other' },
]

export function AssignMembershipModal({
  member,
  plans,
  onClose,
  onSuccess,
}: AssignMembershipModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const activePlans = plans.filter((p) => p.is_active)

  const [selectedPlanId, setSelectedPlanId] = useState<number>(
    activePlans[0]?.id || 0
  )
  const [startDate, setStartDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  )
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [paymentRef, setPaymentRef] = useState('')
  const [customPrice, setCustomPrice] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const selectedPlan = activePlans.find((p) => p.id === Number(selectedPlanId))

  useGSAP(
    () => {
      gsap.from(modalRef.current, {
        opacity: 0,
        scale: 0.95,
        y: 10,
        duration: 0.25,
        ease: 'power2.out',
      })
    },
    { scope: modalRef }
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlanId) {
      setError('Please select a membership plan.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const price = customPrice ? parseFloat(customPrice) : undefined
      const startDateTime = new Date(`${startDate}T00:00:00Z`).toISOString()

      await api.assignMembership({
        member_id: member.id,
        plan_id: Number(selectedPlanId),
        start_date: startDateTime,
        paid_amount: price,
        payment_method: paymentMethod,
        payment_reference: paymentRef.trim() || undefined,
        notes: notes.trim() || undefined,
      })

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign plan.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div
        ref={modalRef}
        className="w-full max-w-lg rounded-2xl border border-white/10 bg-surface p-6 sm:p-8 shadow-2xl relative"
      >
        <div className="flex items-center justify-between pb-4 border-b border-white/8 mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-white/40">Assign Plan</p>
            <h3 className="font-display text-xl font-bold uppercase text-white mt-0.5">
              {member.full_name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
              Select Membership Tier *
            </label>
            <select
              value={selectedPlanId}
              onChange={(e) => setSelectedPlanId(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
            >
              {activePlans.map((p) => (
                <option key={p.id} value={p.id} className="bg-surface-2">
                  {p.name} ({p.duration_days} days) — ₱{parseFloat(p.price_php).toLocaleString()}
                </option>
              ))}
            </select>
            {selectedPlan && (
              <p className="text-xs text-white/40 mt-1">
                {selectedPlan.description || 'Standard gym access plan.'}
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
                required
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                Amount Paid (₱)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={selectedPlan ? `Default: ₱${parseFloat(selectedPlan.price_php).toLocaleString()}` : ''}
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/40 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                Payment Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors capitalize"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value} className="bg-surface-2">
                    {pm.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
                Payment Reference
              </label>
              <input
                type="text"
                placeholder="e.g. GCash Ref / OR #"
                value={paymentRef}
                onChange={(e) => setPaymentRef(e.target.value)}
                className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/40 transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest text-white/50 mb-1.5 font-semibold">
              Notes
            </label>
            <input
              type="text"
              placeholder="Optional remarks or receipt details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-red/40 transition-colors"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg border border-red/30 bg-red/10 text-red text-xs">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-white/8">
            <Button variant="ghost" size="sm" type="button" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit" loading={loading}>
              Confirm Assignment
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
