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
