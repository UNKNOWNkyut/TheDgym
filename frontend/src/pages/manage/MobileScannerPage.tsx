import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  Smartphone,
  Radio,
  CheckCircle2,
  ShieldAlert,
  LogOut,
  Volume2,
  VolumeX,
  Sparkles,
  Wifi,
  AlertTriangle,
  ArrowLeft,
  CreditCard,
} from 'lucide-react'
import { api, ApiError } from '@/services/api'
import { playAccessChime } from '@/hooks/useRfidScanner'
import type {
  TapVerificationResult,
  PairingSessionStatus,
} from '@/types/auth'

gsap.registerPlugin()

interface NDEFReadingEvent extends Event {
  serialNumber?: string
}

interface NDEFReaderInstance {
  scan: (options?: { signal?: AbortSignal }) => Promise<void>
  onreading: ((this: NDEFReaderInstance, ev: NDEFReadingEvent) => void) | null
  onreadingerror: ((this: NDEFReaderInstance, ev: Event) => void) | null
}

function getWebNfcConstructor(): (new () => NDEFReaderInstance) | null {
  if (typeof window === 'undefined') return null
  const win = window as unknown as { NDEFReader?: new () => NDEFReaderInstance }
  return win.NDEFReader ?? null
}

function formatTapBadge(decision: string): string {
  switch (decision) {
    case 'granted_check_in':
      return 'CHECKED IN • ACCESS GRANTED'
    case 'granted_check_out':
      return 'CHECKED OUT • SESSION CLOSED'
    case 'already_checked_in':
      return 'ALREADY CHECKED IN • ACTIVE'
    case 'already_checked_out':
      return 'RECENTLY CHECKED OUT'
    case 'paired_card':
      return 'KEYCARD PAIRED SUCCESSFULLY'
    case 'denied_unregistered_card':
      return 'UNREGISTERED NFC CARD'
    case 'denied_membership_expired':
      return 'DENIED • MEMBERSHIP EXPIRED'
    case 'denied_card_lost_or_stolen':
      return 'ALERT • LOST / STOLEN CARD'
    default:
      return decision.replace(/_/g, ' ').toUpperCase()
  }
}

export function MobileScannerPage() {
  const [webNfcSupported] = useState<boolean>(() => Boolean(getWebNfcConstructor()))
  const [isScanning, setIsScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)
  const [wakeLockActive, setWakeLockActive] = useState(false)
  const [wsConnected, setWsConnected] = useState(false)
  const [soundMuted, setSoundMuted] = useState(false)

  const [pairingSession, setPairingSession] = useState<PairingSessionStatus | null>(null)

  const [processingTap, setProcessingTap] = useState(false)
  const [lastScannedRawUid, setLastScannedRawUid] = useState<string | null>(null)
  const [latestResult, setLatestResult] = useState<TapVerificationResult | null>(null)
  const [conflictAlert, setConflictAlert] = useState<string | null>(null)
  const [recentResults, setRecentResults] = useState<TapVerificationResult[]>([])
  const [manualUid, setManualUid] = useState('')
  const [pulseCount, setPulseCount] = useState(0)

  const pageRef = useRef<HTMLDivElement>(null)
  const radarRingRef = useRef<HTMLDivElement>(null)
  const resultCardRef = useRef<HTMLDivElement>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null)
  const lastDebounceUidRef = useRef<string>('')
  const lastDebounceTsRef = useRef<number>(0)
  const mutedRef = useRef(soundMuted)
  mutedRef.current = soundMuted

  // Entrance & radar pulse GSAP animations (transform + opacity only)
  useGSAP(
    () => {
      if (pageRef.current) {
        gsap.fromTo(
          pageRef.current,
          { opacity: 0, y: 16 },
          { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' },
        )
      }
    },
    { scope: pageRef },
  )

  useGSAP(
    () => {
      if (!radarRingRef.current) return
      gsap.killTweensOf(radarRingRef.current)
      if (isScanning) {
        gsap.fromTo(
          radarRingRef.current,
          { scale: 0.92, opacity: 0.65 },
          {
            scale: 1.24,
            opacity: 0,
            duration: 1.6,
            repeat: -1,
            ease: 'power1.out',
          },
        )
      } else {
        gsap.set(radarRingRef.current, { scale: 1, opacity: 0 })
      }
    },
    { dependencies: [isScanning] },
  )

  useGSAP(
    () => {
      if (pulseCount > 0 && resultCardRef.current) {
        gsap.fromTo(
          resultCardRef.current,
          { opacity: 0, scale: 0.96, y: 10 },
          { opacity: 1, scale: 1, y: 0, duration: 0.26, ease: 'power2.out' },
        )
      }
    },
    { dependencies: [pulseCount] },
  )

  const vibratePhone = (pattern: number | number[]) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(pattern)
      }
    } catch {
      // ignore on unsupported devices
    }
  }

  const acquireWakeLock = useCallback(async () => {
    try {
      const nav = navigator as unknown as {
        wakeLock?: { request: (type: 'screen') => Promise<{ release: () => Promise<void> }> }
      }
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request('screen')
        setWakeLockActive(true)
      }
    } catch {
      setWakeLockActive(false)
    }
  }, [])

  const releaseWakeLock = useCallback(async () => {
    try {
      await wakeLockRef.current?.release()
    } catch {
      // ignore
    } finally {
      wakeLockRef.current = null
      setWakeLockActive(false)
    }
  }, [])

  const handleCardUidRead = useCallback(async (rawUid: string) => {
    const cleaned = rawUid.trim()
    if (!cleaned) return

    // Prevent accidental rapid multi-reads while card rests against phone back (1.8s window)
    const nowMs = Date.now()
    if (
      lastDebounceUidRef.current === cleaned.toUpperCase() &&
      nowMs - lastDebounceTsRef.current < 1800
    ) {
      return
    }
    lastDebounceUidRef.current = cleaned.toUpperCase()
    lastDebounceTsRef.current = nowMs

    setProcessingTap(true)
    setConflictAlert(null)
    setLastScannedRawUid(cleaned.toUpperCase())

    try {
      const res = await api.verifyKeycardTap(cleaned)
      setLatestResult(res)
      setRecentResults((prev) => [res, ...prev].slice(0, 5))
      setPulseCount((c) => c + 1)

      if (res.decision === 'granted_check_out') {
        vibratePhone(90)
        playAccessChime('checkout', mutedRef.current)
      } else if (res.granted) {
        vibratePhone([80, 40, 120])
        playAccessChime('granted', mutedRef.current)
      } else {
        vibratePhone([180, 70, 180])
        playAccessChime('denied', mutedRef.current)
      }

      if (res.decision === 'granted_check_in') {
        window.dispatchEvent(new CustomEvent('dgym:refresh-notifications'))
      }
    } catch (err) {
      vibratePhone([180, 70, 180])
      playAccessChime('denied', mutedRef.current)
      if (err instanceof ApiError) {
        setConflictAlert(err.message)
      } else {
        setConflictAlert('Network error verifying NFC tap. Confirm PC server is reachable.')
      }
      setPulseCount((c) => c + 1)
    } finally {
      setProcessingTap(false)
    }
  }, [])

  const startPhoneNfcScan = async () => {
    setScanError(null)
    const NDEFReaderCtor = getWebNfcConstructor()
    if (!NDEFReaderCtor) {
      setScanError(
        'Web NFC (NDEFReader) is not available in this browser. Open this URL in Chrome on Android with NFC turned ON.',
      )
      return
    }

    try {
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      const ndef = new NDEFReaderCtor()
      await ndef.scan({ signal: controller.signal })

      ndef.onreading = (event: NDEFReadingEvent) => {
        const uid = event.serialNumber || ''
        if (uid) {
          handleCardUidRead(uid)
        } else {
          setScanError('Card detected, but UID could not be read. Hold card steady at back of phone.')
        }
      }

      ndef.onreadingerror = () => {
        vibratePhone(140)
        setScanError('NFC read interrupted — hold NTAG215 card flat against phone NFC zone.')
      }

      setIsScanning(true)
      await acquireWakeLock()
    } catch (err) {
      setIsScanning(false)
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to start NFC reader. Ensure Android NFC is turned ON and Chrome permission is allowed.'
      setScanError(msg)
    }
  }

  const stopPhoneNfcScan = async () => {
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setIsScanning(false)
    await releaseWakeLock()
  }

  // Load Pairing Mode + Live WebSocket Sync
  useEffect(() => {
    api.getPairingSession().then(setPairingSession).catch(() => {})

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
          setWsConnected(true)
          pingTimer = window.setInterval(() => {
            if (ws && ws.readyState === WebSocket.OPEN) ws.send('ping')
          }, 25000)
        }
        ws.onmessage = (evt) => {
          try {
            const packet = JSON.parse(evt.data)
            if (packet?.event === 'connected' && packet.pairing) {
              setPairingSession(packet.pairing as PairingSessionStatus)
            } else if (packet?.event === 'pairing_mode_changed' && packet.data) {
              setPairingSession(packet.data as PairingSessionStatus)
              setConflictAlert(null)
            }
          } catch {
            // ignore malformed frame
          }
        }
        ws.onclose = () => {
          if (pingTimer) window.clearInterval(pingTimer)
          if (!unmounted) {
            setWsConnected(false)
            reconnectTimer = window.setTimeout(connectWs, 3500)
          }
        }
        ws.onerror = () => ws?.close()
      } catch {
        if (!unmounted) {
          setWsConnected(false)
          reconnectTimer = window.setTimeout(connectWs, 4000)
        }
      }
    }

    connectWs()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && isScanning) {
        acquireWakeLock()
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      unmounted = true
      document.removeEventListener('visibilitychange', handleVisibility)
      if (pingTimer) window.clearInterval(pingTimer)
      if (reconnectTimer) window.clearTimeout(reconnectTimer)
      ws?.close()
      abortControllerRef.current?.abort()
      releaseWakeLock()
    }
  }, [acquireWakeLock, releaseWakeLock])

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manualUid.trim()) return
    handleCardUidRead(manualUid.trim())
    setManualUid('')
  }

  const isPairingActive = Boolean(pairingSession?.active && pairingSession?.member_id)

  return (
    <div ref={pageRef} className="p-4 sm:p-6 md:p-8 max-w-2xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          to="/manage/visits"
          className="inline-flex items-center gap-2 text-xs font-mono text-white/50 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Gym Visits</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSoundMuted((m) => !m)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 bg-white/5 text-[11px] font-mono text-white/60 hover:text-white transition-colors cursor-pointer"
          >
            {soundMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
            <span>{soundMuted ? 'Muted' : 'Sound'}</span>
          </button>
        </div>
      </div>

      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border ${
              wsConnected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }`}
          >
            <Wifi className="w-3 h-3" />
            {wsConnected ? 'Live Sync Connected' : 'Reconnecting...'}
          </span>
          {wakeLockActive && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono uppercase border border-sky-500/30 bg-sky-500/10 text-sky-300">
              Screen Awake
            </span>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">
          NFC Keycard Scanner
        </h1>
      </div>

      {/* Smart Pairing Mode Live Banner (Edge Case #4) */}
      {isPairingActive && (
        <div className="rounded-2xl border border-amber-400/45 bg-amber-500/[0.09] p-4 sm:p-5 space-y-2 shadow-[0_0_28px_rgba(245,158,11,0.14)]">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-amber-300">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Smart Pairing Mode Active</span>
            </span>
            <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/15 text-amber-200">
              Intercepting Next Tap
            </span>
          </div>
          <p className="text-base font-bold text-white">
            Pairing to: {pairingSession?.member_name} ({pairingSession?.member_code})
          </p>
          <p className="text-xs text-white/70">
            Tap an unassigned card on the Scanner now.
          </p>
        </div>
      )}

      {/* Primary NFC Radar Touch Zone */}
      <div className="rounded-2xl border border-white/10 bg-surface p-6 sm:p-8 flex flex-col items-center text-center space-y-5">
        <div className="relative flex items-center justify-center w-28 h-28">
          <div
            ref={radarRingRef}
            className="absolute inset-0 rounded-full border-2 border-emerald-400/50 pointer-events-none opacity-0"
          />
          <div
            className={`w-24 h-24 rounded-full border flex items-center justify-center transition-colors ${
              isScanning
                ? isPairingActive
                  ? 'border-amber-400/50 bg-amber-500/15 text-amber-300 shadow-[0_0_32px_rgba(245,158,11,0.2)]'
                  : 'border-emerald-400/50 bg-emerald-500/15 text-emerald-400 shadow-[0_0_32px_rgba(16,185,129,0.2)]'
                : 'border-white/15 bg-white/[0.03] text-white/40'
            }`}
          >
            {isScanning ? (
              <Radio className="w-10 h-10 animate-pulse" />
            ) : (
              <Smartphone className="w-10 h-10" />
            )}
          </div>
        </div>

        <div className="space-y-1 max-w-md">
          <h2 className="text-lg font-bold tracking-tight text-white">
            {processingTap
              ? 'Verifying Keycard...'
              : isScanning
              ? isPairingActive
                ? 'Ready to Pair Blank Card'
                : 'NFC Scanner Armed & Listening'
              : 'Scanner Paused'}
          </h2>
          <p className="text-xs text-white/50 leading-relaxed">
            {isScanning
              ? 'Tap the member’s card on the scanner.'
              : webNfcSupported
              ? 'Tap the button below to activate the NFC scanner.'
              : 'Web NFC requires Chrome with NFC enabled. You can still test below using manual UID input.'}
          </p>
          {lastScannedRawUid && (
            <p className="text-[11px] font-mono text-white/40 pt-1">
              Last Read UID: <span className="text-white/75">{lastScannedRawUid}</span>
            </p>
          )}
        </div>

        {webNfcSupported && (
          <div className="w-full max-w-xs pt-1">
            {!isScanning ? (
              <button
                type="button"
                onClick={startPhoneNfcScan}
                className="w-full py-3.5 px-6 rounded-xl bg-red hover:bg-red/85 text-white text-xs font-mono font-bold uppercase tracking-widest transition-all cursor-pointer shadow-[0_0_24px_rgba(239,68,68,0.25)]"
              >
                Start Phone NFC Scanner
              </button>
            ) : (
              <button
                type="button"
                onClick={stopPhoneNfcScan}
                className="w-full py-3 px-6 rounded-xl border border-white/15 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-xs font-mono uppercase tracking-widest transition-colors cursor-pointer"
              >
                Stop Scanner
              </button>
            )}
          </div>
        )}

        {scanError && (
          <div className="w-full rounded-xl border border-red/30 bg-red/10 p-3.5 text-xs text-red text-left flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{scanError}</span>
          </div>
        )}
      </div>

      {/* Pairing Conflict Warning */}
      {conflictAlert && (
        <div
          ref={resultCardRef}
          className="rounded-2xl border border-red/50 bg-red/[0.08] p-5 space-y-2"
        >
          <div className="flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-widest text-red">
            <ShieldAlert className="w-4 h-4" />
            <span>Action Blocked</span>
          </div>
          <p className="text-sm text-white/85">{conflictAlert}</p>
        </div>
      )}

      {/* Latest Tap Result Card */}
      {latestResult && !conflictAlert && (
        <div
          ref={resultCardRef}
          className={`rounded-2xl border p-5 space-y-3 ${
            latestResult.granted
              ? latestResult.decision === 'granted_check_out' ||
                latestResult.decision === 'already_checked_out'
                ? 'border-blue-500/40 bg-blue-500/[0.08]'
                : latestResult.decision === 'already_checked_in'
                ? 'border-sky-500/40 bg-sky-500/[0.08]'
                : 'border-emerald-500/40 bg-emerald-500/[0.08]'
              : 'border-red/50 bg-red/[0.08]'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${
                  latestResult.granted
                    ? latestResult.decision === 'granted_check_out' ||
                      latestResult.decision === 'already_checked_out'
                      ? 'border-blue-400/40 bg-blue-500/15 text-blue-400'
                      : latestResult.decision === 'already_checked_in'
                      ? 'border-sky-400/40 bg-sky-500/15 text-sky-400'
                      : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-400'
                    : 'border-red/40 bg-red/15 text-red'
                }`}
              >
                {latestResult.granted ? (
                  latestResult.decision === 'granted_check_out' ||
                  latestResult.decision === 'already_checked_out' ? (
                    <LogOut className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )
                ) : (
                  <ShieldAlert className="w-5 h-5" />
                )}
              </div>
              <div>
                <p
                  className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                    latestResult.granted
                      ? latestResult.decision === 'granted_check_out' ||
                        latestResult.decision === 'already_checked_out'
                        ? 'text-blue-400'
                        : latestResult.decision === 'already_checked_in'
                        ? 'text-sky-400'
                        : 'text-emerald-400'
                      : 'text-red'
                  }`}
                >
                  {formatTapBadge(latestResult.decision)}
                </p>
                <h3 className="text-lg font-bold text-white leading-snug">
                  {latestResult.member_name
                    ? `${latestResult.member_name} (${latestResult.member_code ?? ''})`
                    : 'Unassigned NFC Card'}
                </h3>
              </div>
            </div>
            <span className="text-[11px] font-mono text-white/40 shrink-0">
              {latestResult.card_uid_masked}
            </span>
          </div>

          <p className="text-sm text-white/80 leading-relaxed">{latestResult.reason_message}</p>

          {latestResult.plan_name && (
            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs font-mono text-white/60">
              <span>Plan: {latestResult.plan_name}</span>
              {latestResult.days_remaining !== null && latestResult.granted && (
                <span className="text-emerald-400">{latestResult.days_remaining}d left</span>
              )}
            </div>
          )}

          {latestResult.warning_banner && (
            <div className="pt-2 border-t border-white/10 flex items-center gap-2 text-xs font-mono text-amber-300">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              <span>{latestResult.warning_banner}</span>
            </div>
          )}
        </div>
      )}

      {/* Fallback Manual UID Tester */}
      <form
        onSubmit={handleManualSubmit}
        className="rounded-2xl border border-white/10 bg-surface p-4 sm:p-5 space-y-3"
      >
        <div className="flex items-center justify-between">
          <label className="text-xs uppercase tracking-widest text-white/40 font-mono flex items-center gap-1.5">
            <CreditCard className="w-3.5 h-3.5 text-white/40" />
            <span>Manual / Test Card UID</span>
          </label>
          <span className="text-[10px] font-mono text-white/30">Fallback Input</span>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={manualUid}
            onChange={(e) => setManualUid(e.target.value.toUpperCase())}
            placeholder="e.g. 04:E6:CB:6F:D3:2A:81"
            className="flex-1 rounded-xl border border-white/15 bg-black/40 px-3.5 py-2.5 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-red"
          />
          <button
            type="submit"
            disabled={!manualUid.trim() || processingTap}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-mono font-bold uppercase tracking-wider text-white transition-colors cursor-pointer disabled:opacity-40"
          >
            Submit Tap
          </button>
        </div>
      </form>

      {/* Recent Scans on This Device */}
      {recentResults.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-surface p-4 sm:p-5 space-y-3">
          <p className="text-xs uppercase tracking-widest text-white/40 font-mono">
            Recent Scans (This Session)
          </p>
          <div className="space-y-2">
            {recentResults.map((item, idx) => (
              <div
                key={`${item.tapped_at}-${idx}`}
                className="p-3 rounded-xl border border-white/5 bg-black/25 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {item.member_name ?? 'Unassigned Card'}{' '}
                    {item.member_code ? `(${item.member_code})` : ''}
                  </p>
                  <p className="text-[11px] font-mono text-white/45 truncate">
                    {formatTapBadge(item.decision)}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-white/40 shrink-0">
                  {new Date(item.tapped_at).toLocaleTimeString('en-PH', {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
