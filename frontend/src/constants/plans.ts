export interface PublicPlanOption {
  name: string
  slug: 'day-pass' | 'monthly' | 'quarterly'
  price: number
  priceFormatted: string
  period: string
  shortDesc: string
  description: string
  features: string[]
  highlight: boolean
  badge: string | null
}

/**
 * Official membership tier rates from the TDGGYM Rosario, Batangas survey.
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
    description: 'Unlimited access, billed monthly. Cancel anytime.',
    features: [
      'Unlimited gym access',
      'Group class access',
      'Locker use',
      'Flexible — month to month',
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
    description: 'Three months upfront. Best value per session.',
    features: [
      'Everything in Monthly',
      'Better rate per session',
      'Priority class booking',
      'One PT session included',
    ],
    highlight: false,
    badge: 'Best Value',
  },
]

export function getPublicPlanBySlug(slug: string | null | undefined): PublicPlanOption | null {
  if (!slug) return null
  const normalized = slug.trim().toLowerCase()
  return PUBLIC_PLANS.find((plan) => plan.slug === normalized) ?? null
}
