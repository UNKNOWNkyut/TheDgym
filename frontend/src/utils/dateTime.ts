const PH_TIMEZONE = 'Asia/Manila'

/**
 * Safely parse ISO timestamps returned by FastAPI / SQLite as UTC Date objects.
 * SQLite may omit the trailing 'Z' on UTC timestamps; appending 'Z' prevents
 * browsers from misinterpreting UTC timestamps as local time (-8h offset in PH).
 */
export function parseUtcDate(dateInput: string | Date): Date {
  if (dateInput instanceof Date) return dateInput
  const trimmed = dateInput.trim()
  const normalized = trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T')
  const hasExplicitTz = /[zZ]|[+-]\d{2}:?\d{2}$/.test(normalized)
  return new Date(hasExplicitTz ? normalized : `${normalized}Z`)
}

/**
 * Format a server UTC timestamp into 12-hour Philippine Standard Time (e.g., "11:23 AM").
 */
export function formatPhTime(dateInput: string | Date, includeSeconds = false): string {
  const dt = parseUtcDate(dateInput)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleTimeString('en-PH', {
    timeZone: PH_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' } : {}),
    hour12: true,
  })
}

/**
 * Check whether a server UTC timestamp falls on today's calendar date in Asia/Manila.
 */
export function isTodayPh(dateInput: string | Date): boolean {
  const dt = parseUtcDate(dateInput)
  if (Number.isNaN(dt.getTime())) return false
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(dt) === fmt.format(new Date())
}

/**
 * Format a server UTC timestamp into a human-friendly relative string ("Just now", "3m ago", etc.).
 */
export function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Just now'
  try {
    const date = parseUtcDate(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    if (Number.isNaN(diffMs) || diffMs < 0) return 'Just now'
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString('en-PH', { timeZone: PH_TIMEZONE })
  } catch {
    return 'Recently'
  }
}
