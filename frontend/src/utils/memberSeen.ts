import type { Member } from '@/types/auth'
import { parseUtcDate } from '@/utils/dateTime'

const NEW_MEMBER_WINDOW_MS = 24 * 60 * 60 * 1000

function getSeenStorageKey(adminUserId: number): string {
  return `dgym_admin_seen_members_${adminUserId}`
}

export function loadSeenMemberIds(adminUserId?: number): Set<number> {
  if (!adminUserId) return new Set()
  try {
    const raw = localStorage.getItem(getSeenStorageKey(adminUserId))
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.map(Number).filter(Number.isFinite))
  } catch {
    return new Set()
  }
}

export function markMemberSeenLocally(adminUserId: number | undefined, memberId: number): Set<number> {
  const next = loadSeenMemberIds(adminUserId)
  next.add(memberId)
  if (adminUserId) {
    try {
      localStorage.setItem(getSeenStorageKey(adminUserId), JSON.stringify(Array.from(next)))
    } catch {
      // ignore storage quota errors
    }
  }
  return next
}

export function isNewMemberBadgeVisible(
  member: Pick<Member, 'id' | 'created_at' | 'joined_at' | 'admin_viewed_at'>,
  seenIds: ReadonlySet<number>,
  nowMs: number,
): boolean {
  if (member.admin_viewed_at || seenIds.has(member.id)) {
    return false
  }
  const registeredAt = parseUtcDate(member.created_at || member.joined_at)
  if (Number.isNaN(registeredAt.getTime())) return false
  return nowMs - registeredAt.getTime() < NEW_MEMBER_WINDOW_MS
}
