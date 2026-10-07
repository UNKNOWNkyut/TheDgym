import type { ReactNode, HTMLAttributes } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
  /** Adds a subtle red glow on hover — use for featured/hero cards */
  featured?: boolean
  /** Remove padding for custom layout inside */
  noPadding?: boolean
}

export function Card({
  children,
  featured = false,
  noPadding = false,
  className = '',
  ...props
}: CardProps) {
  return (
    <div
      className={[
        'bg-surface rounded-xl border border-white/8',
        'shadow-[0_1px_3px_rgba(0,0,0,0.4),0_0_0_1px_rgba(255,255,255,0.05)]',
        'transition-all duration-200',
        featured
          ? 'hover:border-red/40 hover:shadow-[0_0_32px_rgba(229,32,26,0.15)]'
          : 'hover:border-white/15',
        noPadding ? '' : 'p-6',
        className,
      ].join(' ')}
      {...props}
    >
      {children}
    </div>
  )
}

interface CardHeaderProps {
  title: string
  subtitle?: string
  action?: ReactNode
}

export function CardHeader({ title, subtitle, action }: CardHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div>
        <h3 className="font-display text-lg font-semibold uppercase tracking-wide text-white">
          {title}
        </h3>
        {subtitle && (
          <p className="text-sm text-white/40 mt-0.5">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
