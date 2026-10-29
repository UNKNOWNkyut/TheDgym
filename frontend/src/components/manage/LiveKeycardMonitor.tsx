import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  CheckCircle2,
  ShieldAlert,
  AlertTriangle,
  ArrowRight,
  LogOut,
  X,
} from 'lucide-react'
import { api } from '@/services/api'
import { useRfidScanner, playAccessChime } from '@/hooks/useRfidScanner'
import type { TapVerificationResult } from '@/types/auth'

gsap.registerPlugin()

interface LiveKeycardMonitorProps {
  onTapProcessed: () => void
}

function formatDecisionLabel(decision: string): string {
  switch (decision) {
    case 'granted_check_in':
      return 'ACCESS GRANTED • CHECKED IN'
    case 'granted_check_out':
      return 'CHECKED OUT • SESSION LOGGED'
    case 'already_checked_in':
      return 'ALREADY CHECKED IN • NO DUPLICATE LOGGED'
    case 'already_checked_out':
      return 'ALREADY CHECKED OUT • EXIT COOLDOWN'
    case 'paired_card':
      return 'SMART PAIRING • KEYCARD BOUND'
    case 'denied_unregistered_card':
      return 'UNREGISTERED KEYCARD'
    case 'denied_card_lost_or_stolen':
      return 'SECURITY ALERT • LOST / STOLEN CARD'
    case 'denied_card_revoked':
      return 'KEYCARD REVOKED'
    case 'denied_member_suspended':
      return 'ACCESS BLOCKED • MEMBER SUSPENDED'
    case 'denied_member_inactive':
      return 'ACCESS BLOCKED • ACCOUNT INACTIVE'
    case 'denied_membership_expired':
      return 'ACCESS BLOCKED • MEMBERSHIP EXPIRED'
    case 'denied_payment_pending':
      return 'ACCESS BLOCKED • PAYMENT PENDING'
    case 'denied_no_membership':
      return 'ACCESS BLOCKED • NO ACTIVE PLAN'
    case 'denied_cooldown_duplicate':
      return 'DUPLICATE TAP IGNORED (60S COOLDOWN)'
    default:
      return decision.replace(/_/g, ' ').toUpperCase()
  }
}

export function LiveKeycardMonitor({ onTapProcessed }: LiveKeycardMonitorProps) {
  const [latestTap, setLatestTap] = useState<TapVerificationResult | null>(null)
  const [tapCounter, setTapCounter] = useState(0)

  const alertCardRef = useRef<HTMLDivElement>(null)
  const lastProcessedStampRef = useRef<string>('')
  const onTapProcessedRef = useRef(onTapProcessed)
  onTapProcessedRef.current = onTapProcessed

  const applyTapResult = useCallback((result: TapVerificationResult) => {
    const signature = `${result.card_uid_masked}:${result.decision}:${result.tapped_at}`
    if (lastProcessedStampRef.current === signature) {
      return
    }
    lastProcessedStampRef.current = signature

    setLatestTap(result)
    setTapCounter((c) => c + 1)

    if (result.decision === 'granted_check_out') {
      playAccessChime('checkout', false)
    } else if (result.granted) {
      playAccessChime('granted', false)
    } else {
      playAccessChime('denied', false)
    }

    if (result.decision === 'granted_check_in') {
      window.dispatchEvent(new CustomEvent('dgym:refresh-notifications'))
    }

    onTapProcessedRef.current()
  }, [])

  const triggerCardTap = useCallback(
    async (rawUid: string) => {
      const cleaned = rawUid.trim()
      if (!cleaned) return
      try {
        const res = await api.verifyKeycardTap(cleaned)
        applyTapResult(res)
      } catch {
        // Ignore transient network errors
      }
    },
    [applyTapResult],
  )

  // Listen to physical USB HID Keyboard-Wedge scanner bursts
  useRfidScanner({
    enabled: true,
    onScan: (scannedUid) => {
      triggerCardTap(scannedUid)
    },
  })

  // Connect to Real-Time WebSocket Live Feed (with automatic reconnect)
  useEffect(() => {
    let ws: WebSocket | null = null
    let pingTimer: number | undefined
    let reconnectTimer: number | undefined
    let unmounted = false

    const connectWs = () => {
      if (unmounted) return
      try {
        ws = new WebSocket(api.getAccessLiveFeedWsUrl())

        ws.onopen = () => {
          if (unmounted) return
          pingTimer = window.setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send('ping')
            }
          }, 25000)
        }

        ws.onmessage = (evt) => {
          try {
            const packet = JSON.parse(evt.data)
            if (packet?.event === 'keycard_tap' && packet.data) {
              applyTapResult(packet.data as TapVerificationResult)
            } else if (packet?.event === 'admin_notification') {
              window.dispatchEvent(new CustomEvent('dgym:refresh-notifications'))
            }
          } catch {
            // ignore malformed frame
          }
        }

        ws.onclose = () => {
          if (pingTimer) window.clearInterval(pingTimer)
          if (!unmounted) {
            reconnectTimer = window.setTimeout(connectWs, 3500)
          }
        }

        ws.onerror = () => {
          ws?.close()
        }
      } catch {
        if (!unmounted) {
          reconnectTimer = window.setTimeout(connectWs, 4000)
        }
      }
    }

    connectWs()

    return () => {
      unmounted = true
      if (pingTimer) window.clearInterval(pingTimer)
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      ws?.close()
    }
  }, [applyTapResult])

  // GSAP GPU-accelerated entrance animation on every new tap verification
  useGSAP(
    () => {
      if (tapCounter > 0 && alertCardRef.current) {
        gsap.fromTo(
          alertCardRef.current,
          { opacity: 0, scale: 0.98, y: -10 },
          { opacity: 1, scale: 1, y: 0, duration: 0.28, ease: 'power2.out' },
        )
      }
    },
    { dependencies: [tapCounter] },
  )

  if (!latestTap) {
    return null
  }

  return (
    <div
      ref={alertCardRef}
      className={`rounded-2xl border p-5 sm:p-6 relative transition-colors ${
        latestTap.granted
          ? latestTap.decision === 'granted_check_out' ||
            latestTap.decision === 'already_checked_out'
            ? 'border-blue-500/40 bg-blue-500/[0.07] shadow-[0_0_30px_rgba(59,130,246,0.12)]'
            : latestTap.decision === 'already_checked_in'
            ? 'border-sky-500/40 bg-sky-500/[0.07] shadow-[0_0_30px_rgba(14,165,233,0.12)]'
            : 'border-emerald-500/40 bg-emerald-500/[0.07] shadow-[0_0_30px_rgba(16,185,129,0.14)]'
          : latestTap.decision === 'denied_cooldown_duplicate'
          ? 'border-amber-500/40 bg-amber-500/[0.07]'
          : 'border-red/50 bg-red/[0.08] shadow-[0_0_30px_rgba(239,68,68,0.16)]'
      }`}
    >
      <button
        type="button"
        onClick={() => setLatestTap(null)}
        aria-label="Dismiss tap alert"
        className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pr-8">
        <div className="flex items-start gap-4">
          <div
            className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${
              latestTap.granted
                ? latestTap.decision === 'granted_check_out' ||
                  latestTap.decision === 'already_checked_out'
                  ? 'border-blue-400/40 bg-blue-500/15 text-blue-400'
                  : latestTap.decision === 'already_checked_in'
                  ? 'border-sky-400/40 bg-sky-500/15 text-sky-400'
                  : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-400'
                : latestTap.decision === 'denied_cooldown_duplicate'
                ? 'border-amber-400/40 bg-amber-500/15 text-amber-400'
                : 'border-red/40 bg-red/15 text-red'
            }`}
          >
            {latestTap.granted ? (
              latestTap.decision === 'granted_check_out' ||
              latestTap.decision === 'already_checked_out' ? (
                <LogOut className="w-6 h-6" />
              ) : (
                <CheckCircle2 className="w-6 h-6" />
              )
            ) : (
              <ShieldAlert className="w-6 h-6" />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span
                className={`text-xs font-mono font-bold uppercase tracking-widest ${
                  latestTap.granted
                    ? latestTap.decision === 'granted_check_out' ||
                      latestTap.decision === 'already_checked_out'
                      ? 'text-blue-400'
                      : latestTap.decision === 'already_checked_in'
                      ? 'text-sky-400'
                      : 'text-emerald-400'
                    : latestTap.decision === 'denied_cooldown_duplicate'
                    ? 'text-amber-400'
                    : 'text-red'
                }`}
              >
                {formatDecisionLabel(latestTap.decision)}
              </span>
              <span className="text-[11px] font-mono text-white/40">
                Card {latestTap.card_uid_masked} • {latestTap.latency_ms}ms
              </span>
            </div>

            <h3 className="text-xl font-bold tracking-tight text-white">
              {latestTap.member_name
                ? `${latestTap.member_name} (${latestTap.member_code ?? ''})`
                : 'Unassigned Smart Keycard'}
            </h3>

            <p className="text-sm text-white/75 max-w-2xl">{latestTap.reason_message}</p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          {latestTap.plan_name && (
            <div className="px-3 py-1.5 rounded-xl border border-white/10 bg-black/30 text-xs font-mono text-white/80">
              <span>{latestTap.plan_name}</span>
              {latestTap.days_remaining !== null && latestTap.granted && (
                <span className="text-emerald-400 ml-2">
                  • {latestTap.days_remaining}d left
                </span>
              )}
            </div>
          )}

          {latestTap.member_id && !latestTap.granted && (
            <Link
              to={`/manage/members/${latestTap.member_id}`}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red hover:bg-red/85 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all"
            >
              <span>Open Profile / Renew Plan</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>

      {latestTap.warning_banner && (
        <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2 text-xs font-mono text-amber-300">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{latestTap.warning_banner}</span>
        </div>
      )}
    </div>
  )
}
