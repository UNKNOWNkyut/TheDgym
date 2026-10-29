import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@/types/auth'
import { api } from '@/services/api'

export interface GymNotification {
  id: string
  title: string
  message: string
  type:
    | 'offer'
    | 'retention'
    | 'booking'
    | 'announcement'
    | 'churn_alert'
    | 'enrollment'
    | 'registration'
    | 'pt_booking'
    | 'session_alert'
  timestamp: string
  read: boolean
  actionText?: string
  actionUrl?: string
  isServer?: boolean
}

interface NotificationBellProps {
  user: User
}

function formatRelativeTime(dateString?: string): string {
  if (!dateString) return 'Just now'
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    if (isNaN(diffMs) || diffMs < 0) return 'Just now'
    const diffSec = Math.floor(diffMs / 1000)
    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHours = Math.floor(diffMin / 60)
    if (diffHours < 24) return `${diffHours}h ago`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return `${diffDays}d ago`
    return date.toLocaleDateString()
  } catch {
    return 'Recently'
  }
}

export function NotificationBell({ user }: NotificationBellProps) {
  const [isOpen, setIsOpen] = useState(false)
  const popoverRef = useRef<HTMLDivElement>(null)

  // Generate initial contextual notifications based strictly on user role
  const getInitialNotifications = (): GymNotification[] => {
    // 1. ADMIN NOTIFICATIONS — No member offers; only operations, churn alerts, and enrollments
    if (user.role === 'admin') {
      return [
        {
          id: 'admin-churn-1',
          title: '⚠️ High Churn Risk Alert: Action Needed',
          message:
            'AI Model flagged Juan Dela Cruz (Recency: Today, Churn Risk: 88%) with high cancellation velocity. Immediate retention strategy required.',
          type: 'churn_alert',
          timestamp: 'Just now',
          read: false,
          actionText: 'Review AI Strategy',
          actionUrl: '/manage/analytics',
        },
        {
          id: 'admin-enroll-1',
          title: '🎉 New Member Enrollment',
          message:
            'Alex Cruz enrolled in 1-Month Unlimited Plan (₱1,500). Payment confirmed via GCash.',
          type: 'enrollment',
          timestamp: '2 hours ago',
          read: false,
          actionText: 'View Members',
          actionUrl: '/manage/members',
        },
        {
          id: 'admin-user-1',
          title: '👤 New User Registered',
          message:
            'Jordan Ramos created a DGym account via mobile onboarding. Awaiting membership plan selection.',
          type: 'registration',
          timestamp: 'Yesterday',
          read: true,
          actionText: 'View Users',
          actionUrl: '/manage/users',
        },
      ]
    }

    // 2. TRAINER NOTIFICATIONS — Only PT enrollments & coaching check-ins (no member offers)
    if (user.role === 'trainer') {
      return [
        {
          id: 'trainer-pt-1',
          title: '🏋️ New 1-on-1 PT Session Booking',
          message:
            'Alex Cruz enrolled and booked a 1-on-1 Powerlifting Assessment session with you for Saturday 9:00 AM.',
          type: 'pt_booking',
          timestamp: 'Just now',
          read: false,
          actionText: 'View PT Sessions',
          actionUrl: '/manage/pt-sessions',
        },
        {
          id: 'trainer-checkin-1',
          title: '📅 PT Client Check-In',
          message:
            'Marcus Vance checked in for today\'s 4:00 PM Strength & Hypertrophy session.',
          type: 'session_alert',
          timestamp: '3 hours ago',
          read: true,
          actionText: 'Open PT Schedule',
          actionUrl: '/manage/pt-sessions',
        },
      ]
    }

    // 3. ACTIVE MEMBER NOTIFICATIONS — Retention offers, coaching slots, facility news
    const isMemberActive = Boolean(user.has_active_membership)
    if (isMemberActive) {
      return [
        {
          id: 'retention-offer-1',
          title: '🔥 Retention Offer: 20% OFF Renewal',
          message:
            'Exclusive loyal athlete rate! Renew your training pass early this week and claim 20% off your next quarter.',
          type: 'retention',
          timestamp: 'Just now',
          read: false,
          actionText: 'View Renewal Rates',
          actionUrl: '/membership',
        },
        {
          id: 'coach-pt-1',
          title: '📅 1-on-1 Coaching Slots Open',
          message:
            'Coach Mark and DGym instructors have opened new powerlifting assessment slots. Reserve your 1-on-1 spot.',
          type: 'booking',
          timestamp: '2 hours ago',
          read: false,
          actionText: 'Book a Coach',
          actionUrl: '/dashboard/book',
        },
        {
          id: 'gym-announce-1',
          title: '📢 Competition Turf Calibrated Plates',
          message:
            'New IPF-grade calibrated steel plates and deadlift jacks have arrived at Turf A.',
          type: 'announcement',
          timestamp: 'Yesterday',
          read: true,
        },
      ]
    }

    // 4. REGISTERED USER / INACTIVE NOTIFICATIONS — Starter discounts, onboarding, hours
    return [
      {
        id: 'starter-offer-1',
        title: '⚡ Starter Offer: Free Form Assessment',
        message:
          'Activate your gym pass today with a Day Pass or Monthly Unlimited and get a complimentary 1-on-1 technique assessment!',
        type: 'offer',
        timestamp: 'Just now',
        read: false,
        actionText: 'Avail Training Plan',
        actionUrl: '/membership',
      },
      {
        id: 'welcome-announce-1',
        title: '👋 Welcome to The DGym Community',
        message:
          'Your athlete account is registered. Explore classes, certified coaches, and facilities before availing your pass.',
        type: 'announcement',
        timestamp: '1 hour ago',
        read: false,
        actionText: 'Explore Classes',
        actionUrl: '/classes',
      },
      {
        id: 'hours-notice-1',
        title: '⏰ Facility Operating Schedule',
        message:
          'The DGym Rosario Batangas is open daily from 6:00 AM to 10:00 PM.',
        type: 'announcement',
        timestamp: '1 day ago',
        read: true,
      },
    ]
  }

  const storageKey = `dgym_notifs_${user.id}_${user.role || (user.has_active_membership ? 'member' : 'user')}`

  const [notifications, setNotifications] = useState<GymNotification[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        return JSON.parse(saved)
      }
    } catch {}
    return getInitialNotifications()
  })

  // Synchronize notifications from the backend API with fallback
  const fetchServerNotifications = useCallback(async () => {
    try {
      const serverNotifs = await api.getMyNotifications()
      if (serverNotifs && serverNotifs.length > 0) {
        const mapped: GymNotification[] = serverNotifs.map((n) => ({
          id: String(n.id),
          title: n.title,
          message: n.message,
          type: n.type,
          timestamp: formatRelativeTime(n.created_at),
          read: n.is_read,
          actionText: n.action_text || undefined,
          actionUrl: n.action_url || undefined,
          isServer: true,
        }))
        setNotifications(mapped)
      } else {
        // Fallback to local storage or initial defaults
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          try {
            setNotifications(JSON.parse(saved))
          } catch {
            setNotifications(getInitialNotifications())
          }
        } else {
          setNotifications(getInitialNotifications())
        }
      }
    } catch {
      // Backend offline or error fallback to saved
      try {
        const saved = localStorage.getItem(storageKey)
        if (saved) {
          setNotifications(JSON.parse(saved))
        }
      } catch {}
    }
  }, [storageKey])

  useEffect(() => {
    fetchServerNotifications()
    const interval = window.setInterval(fetchServerNotifications, 30000)
    const handleInstantRefresh = () => {
      fetchServerNotifications()
    }
    window.addEventListener('dgym:refresh-notifications', handleInstantRefresh)

    // Real-time WebSocket push for Admin Check-In notifications across all portal pages
    let ws: WebSocket | null = null
    let reconnectTimer: number | undefined
    let unmounted = false

    const connectAdminNotifWs = () => {
      if (unmounted || user.role !== 'admin') return
      try {
        ws = new WebSocket(api.getAccessLiveFeedWsUrl())
        ws.onmessage = (evt) => {
          try {
            const packet = JSON.parse(evt.data)
            if (
              packet?.event === 'admin_notification' ||
              (packet?.event === 'keycard_tap' &&
                packet?.data?.decision === 'granted_check_in')
            ) {
              fetchServerNotifications()
            }
          } catch {
            // ignore malformed frame
          }
        }
        ws.onclose = () => {
          if (!unmounted) {
            reconnectTimer = window.setTimeout(connectAdminNotifWs, 5000)
          }
        }
        ws.onerror = () => ws?.close()
      } catch {
        // ignore WS error
      }
    }

    if (user.role === 'admin') {
      connectAdminNotifWs()
    }

    return () => {
      unmounted = true
      window.clearInterval(interval)
      window.removeEventListener('dgym:refresh-notifications', handleInstantRefresh)
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [fetchServerNotifications, user.role])

  // Re-fetch when opened to ensure fresh status
  useEffect(() => {
    if (isOpen) {
      fetchServerNotifications()
    }
  }, [isOpen, fetchServerNotifications])

  // Save changes to localStorage as offline mirror
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(notifications))
    } catch {}
  }, [notifications, storageKey])

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const unreadCount = notifications.filter((n) => !n.read).length

  const markAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    try {
      await api.markAllNotificationsRead()
    } catch (err) {
      console.warn('Failed to mark all notifications read on server:', err)
    }
  }

  const markAsRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
    const numId = Number(id)
    if (!isNaN(numId) && numId > 0) {
      try {
        await api.markNotificationRead(numId)
      } catch (err) {
        console.warn('Failed to mark notification read on server:', err)
      }
    }
  }

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
  }

  return (
    <div ref={popoverRef} className="relative">
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative p-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/25 text-white/70 hover:text-white transition-all duration-150 focus:outline-none cursor-pointer group"
        aria-label="View notifications"
        aria-expanded={isOpen}
      >
        <svg
          className="w-5 h-5 transition-transform group-hover:scale-105"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.8}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-red text-[9px] font-bold text-white items-center justify-center font-mono">
              {unreadCount}
            </span>
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl border border-white/10 bg-[#111114]/95 backdrop-blur-xl shadow-2xl p-4 z-50 animate-fade-in text-white">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/8">
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase font-bold tracking-widest text-white/50 font-mono">
                NOTIFICATIONS
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-red/20 text-red border border-red/30 font-semibold font-mono">
                  {unreadCount} new
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-[11px] text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                Mark all as read
              </button>
            )}
          </div>

          {/* Notification List */}
          <div className="mt-3 space-y-2.5 max-h-80 overflow-y-auto pr-1">
            {notifications.length === 0 ? (
              <div className="py-8 text-center text-xs text-white/40">
                No notifications right now
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => markAsRead(notif.id)}
                  className={`p-3 rounded-xl border transition-all duration-150 relative group ${
                    notif.read
                      ? 'border-white/5 bg-white/[0.02] text-white/60'
                      : 'border-white/15 bg-white/[0.06] text-white shadow-sm'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {notif.type === 'retention' && (
                        <span className="inline-block text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-red/20 text-red border border-red/30 mb-1">
                          VIP Retention Offer
                        </span>
                      )}
                      {notif.type === 'churn_alert' && (
                        <span className="inline-block text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 mb-1">
                          AI Churn Risk Alert
                        </span>
                      )}
                      {notif.type === 'enrollment' && (
                        <span className="inline-block text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 mb-1">
                          New Enrollment
                        </span>
                      )}
                      {notif.type === 'registration' && (
                        <span className="inline-block text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 mb-1">
                          New Registered User
                        </span>
                      )}
                      {notif.type === 'pt_booking' && (
                        <span className="inline-block text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-400 border border-purple-500/30 mb-1">
                          1-on-1 PT Booking
                        </span>
                      )}
                      {notif.type === 'session_alert' && (
                        <span className="inline-block text-[9px] uppercase font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 mb-1">
                          Session Check-In
                        </span>
                      )}
                      <p className="text-xs font-semibold leading-snug">
                        {notif.title}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        dismissNotification(notif.id)
                      }}
                      className="text-white/20 hover:text-white/70 p-0.5 transition-colors cursor-pointer"
                      title="Dismiss"
                    >
                      ✕
                    </button>
                  </div>

                  <p className="text-[11px] text-white/60 mt-1 leading-relaxed">
                    {notif.message}
                  </p>

                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[10px] text-white/30 font-mono">
                      {notif.timestamp}
                    </span>

                    {notif.actionUrl && notif.actionText && (
                      <Link
                        to={notif.actionUrl}
                        onClick={() => {
                          markAsRead(notif.id)
                          setIsOpen(false)
                        }}
                        className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-red/20 hover:bg-red/30 text-white border border-red/30 transition-colors uppercase tracking-wider font-mono"
                      >
                        {notif.actionText} →
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
