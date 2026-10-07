interface SkeletonProps {
  className?: string
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

/** Generic shimmer skeleton block */
export function Skeleton({ className = '', rounded = 'md' }: SkeletonProps) {
  const roundedClass = {
    sm: 'rounded',
    md: 'rounded-lg',
    lg: 'rounded-xl',
    full: 'rounded-full',
  }[rounded]

  return (
    <div
      className={`skeleton-shimmer ${roundedClass} ${className}`}
      role="status"
      aria-label="Loading..."
    />
  )
}

/** Skeleton for a card with a title + body */
export function SkeletonCard() {
  return (
    <div className="bg-surface rounded-xl border border-white/8 p-6 space-y-4">
      <Skeleton className="h-5 w-2/5" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  )
}

/** Skeleton for a stat / metric widget */
export function SkeletonStat() {
  return (
    <div className="bg-surface rounded-xl border border-white/8 p-6 space-y-3">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-8 w-1/2" rounded="sm" />
      <Skeleton className="h-2 w-2/3" />
    </div>
  )
}

/** Skeleton for a list row */
export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-white/5">
      <Skeleton className="h-10 w-10 shrink-0" rounded="full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="h-2 w-1/3" />
      </div>
      <Skeleton className="h-6 w-16" rounded="full" />
    </div>
  )
}
