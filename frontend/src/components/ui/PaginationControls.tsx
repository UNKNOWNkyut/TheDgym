interface PaginationControlsProps {
  skip: number
  limit: number
  itemCount: number
  hasNext: boolean
  loading?: boolean
  onPrev: () => void
  onNext: () => void
  itemLabel?: string
}

export function PaginationControls({
  skip,
  limit,
  itemCount,
  hasNext,
  loading = false,
  onPrev,
  onNext,
  itemLabel = 'records',
}: PaginationControlsProps) {
  const pageNumber = Math.floor(skip / Math.max(1, limit)) + 1
  const rangeStart = itemCount === 0 ? 0 : skip + 1
  const rangeEnd = skip + itemCount

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/10">
      <p className="text-xs font-mono text-white/45">
        {itemCount === 0
          ? `Showing 0 ${itemLabel}`
          : `Showing ${rangeStart}–${rangeEnd} ${itemLabel} (Page ${pageNumber})`}
      </p>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={loading || skip === 0}
          onClick={onPrev}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-surface text-xs font-mono text-white/75 hover:text-white hover:border-white/25 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
        >
          Previous
        </button>
        <span className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] font-mono text-white/60">
          Page {pageNumber}
        </span>
        <button
          type="button"
          disabled={loading || !hasNext}
          onClick={onNext}
          className="px-3 py-1.5 rounded-lg border border-white/10 bg-surface text-xs font-mono text-white/75 hover:text-white hover:border-red/40 transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed"
        >
          Next
        </button>
      </div>
    </div>
  )
}
