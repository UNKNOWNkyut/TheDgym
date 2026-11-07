import type { PaymentMethod } from '@/types/auth'

export type PlanSlug =
  | 'day-pass'
  | 'monthly'
  | 'student-monthly'
  | 'senior-pwd-monthly'
  | 'quarterly'
  | 'six-month'
  | 'annual'

export interface PublicPlanOption {
  name: string
  slug: PlanSlug
  price: number
  priceFormatted: string
  period: string
  shortDesc: string
  description: string
  features: string[]
  highlight: boolean
  badge: string | null
  requirement?: string
}

/**
 * Primary 3-card membership hero tiers sourced from TDGGYM-QUESTIONNAIRES-1.
 */
export const PUBLIC_PLANS: readonly PublicPlanOption[] = [
  {
    name: 'Day Pass',
    slug: 'day-pass',
    price: 400,
    priceFormatted: '₱400',
    period: 'per visit',
    shortDesc: 'Drop in and train on your schedule.',
    description: 'Full gym access for one day. No commitment.',
    features: [
      'Full equipment access',
      'Locker use',
      'No sign-up required',
    ],
    highlight: false,
    badge: null,
  },
  {
    name: 'Monthly',
    slug: 'monthly',
    price: 1999,
    priceFormatted: '₱1,999',
    period: 'per month',
    shortDesc: 'Unlimited access, billed monthly. Flexible.',
    description: '30-day unlimited equipment, lounge, Wi-Fi, and free group classes.',
    features: [
      'Unlimited cardio & weight equipment',
      'Free 6:00 PM group classes (₱0)',
      'Lounge, workspace & free Wi-Fi',
      'Monthly fitness challenges',
    ],
    highlight: true,
    badge: 'Most Popular',
  },
  {
    name: 'Quarterly',
    slug: 'quarterly',
    price: 5400,
    priceFormatted: '₱5,400',
    period: 'per quarter',
    shortDesc: 'Commit and save. Best value per session.',
    description: 'Three months (90 days) upfront. Best value for consistent lifters.',
    features: [
      'Everything in Monthly',
      '90 days continuous unlimited access',
      'Free 6:00 PM TABATA & HIIT classes',
      'Priority coaching consultation',
    ],
    highlight: false,
    badge: 'Best Value',
  },
]

/**
 * Extended multi-month packages and official ID-verified discounts (TDGGYM-QUESTIONNAIRES-1).
 */
export const EXTENDED_PLANS: readonly PublicPlanOption[] = [
  {
    name: 'Student Monthly',
    slug: 'student-monthly',
    price: 1500,
    priceFormatted: '₱1,500',
    period: 'per month',
    shortDesc: 'Discounted 30-day unlimited plan for students.',
    description: 'Full 30-day unlimited gym, lounge, Wi-Fi, and group class access.',
    features: ['Unlimited equipment & group classes', 'Valid School ID required at front desk'],
    highlight: false,
    badge: 'Student Discount',
    requirement: 'Valid School ID required',
  },
  {
    name: 'Senior / PWD Monthly',
    slug: 'senior-pwd-monthly',
    price: 1500,
    priceFormatted: '₱1,500',
    period: 'per month',
    shortDesc: 'Discounted 30-day unlimited plan for Seniors & PWDs.',
    description: 'Full 30-day unlimited gym, lounge, Wi-Fi, and group class access.',
    features: ['Unlimited equipment & group classes', 'Valid Senior / PWD ID required at front desk'],
    highlight: false,
    badge: 'Senior / PWD',
    requirement: 'Valid Senior / PWD ID required',
  },
  {
    name: '6-Month Package',
    slug: 'six-month',
    price: 8000,
    priceFormatted: '₱8,000',
    period: 'for 6 months',
    shortDesc: '180 days of uninterrupted strength & cardio access.',
    description: 'Half-year package (~₱1,333/month) with all member inclusions.',
    features: ['180 days unlimited gym & group classes', 'Lounge, workspace & free Wi-Fi'],
    highlight: false,
    badge: '6 Months',
    requirement: '180 days unlimited access',
  },
  {
    name: 'Annual',
    slug: 'annual',
    price: 13000,
    priceFormatted: '₱13,000',
    period: 'per year',
    shortDesc: '365 days full-year commitment at our lowest monthly rate.',
    description: 'Full-year unlimited access (~₱1,083/month). Annual renewal ₱1,000 (min. 3-month subscription).',
    features: ['365 days unlimited gym & group classes', 'Annual Membership Card benefits'],
    highlight: false,
    badge: 'Full Year',
    requirement: '365 days unlimited access',
  },
]

export const ALL_PUBLIC_PLANS: readonly PublicPlanOption[] = [
  ...PUBLIC_PLANS,
  ...EXTENDED_PLANS,
]

export const MEMBERSHIP_INCLUSIONS: readonly string[] = [
  '40% off on subscriptions with active Annual Membership Card',
  'Unlimited cardio & weight equipment access',
  'Unlimited free (₱0) access to 6:00 PM group classes',
  'Lounge & workspace access + free facility-wide Wi-Fi',
  'Monthly fitness challenges with rewards',
]

export const PAYMENT_METHOD_OPTIONS: readonly { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'qr_payment', label: 'QR Payment' },
  { value: 'credit_card', label: 'Credit Card' },
  { value: 'debit_card', label: 'Debit Card' },
  { value: 'maya', label: 'Maya' },
  { value: 'other', label: 'Other' },
]

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash',
  gcash: 'GCash',
  bank_transfer: 'Bank Transfer',
  qr_payment: 'QR Payment',
  credit_card: 'Credit Card',
  debit_card: 'Debit Card',
  maya: 'Maya',
  other: 'Other',
}

export function formatPaymentMethod(method: PaymentMethod | string | null | undefined): string {
  if (!method) return '—'
  return PAYMENT_METHOD_LABELS[method as PaymentMethod] ?? method.replace(/_/g, ' ')
}

export function getPublicPlanBySlug(slug: string | null | undefined): PublicPlanOption | null {
  if (!slug) return null
  const normalized = slug.trim().toLowerCase()
  return ALL_PUBLIC_PLANS.find((plan) => plan.slug === normalized) ?? null
}
