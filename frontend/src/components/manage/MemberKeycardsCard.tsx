import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import {
  CreditCard,
  Plus,
  ShieldAlert,
  CheckCircle2,
  RotateCcw,
  Ban,
  X,
  Radio,
  Smartphone,
  ChevronDown,
} from 'lucide-react'
import { api } from '@/services/api'
import { useAuth } from '@/context/AuthContext'
import {
  useRfidScanner,
  getWebNfcConstructor,
  playAccessChime,
  type NDEFReadingEvent,
} from '@/hooks/useRfidScanner'
import type { MemberKeycard, KeycardStatus, PairingSessionStatus } from '@/types/auth'

gsap.registerPlugin()

interface MemberKeycardsCardProps {
  memberId: number
  memberCode: string
  memberName: string
}

const DEFAULT_CARD_LABEL = 'NFC Smart Keycard'

function getStatusClasses(status: KeycardStatus): string {
  switch (status) {
    case 'active':
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'
    case 'lost':
    case 'stolen':
      return 'text-red bg-red/10 border-red/30'
    default:
      return 'text-white/40 bg-white/5 border-white/10'
  }
}

export function MemberKeycardsCard({
  memberId,
  memberCode,
  memberName,
}: MemberKeycardsCardProps) {
  const { user } = useAuth()
  const canManageCards = user?.role === 'admin'

  const [keycards, setKeycards] = useState<MemberKeycard[]>([])
  const [loading, setLoading] = useState(true)
  const [showPairModal, setShowPairModal] = useState(false)
  const [showManualFallback, setShowManualFallback] = useState(false)
  const [cardUidInput, setCardUidInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [actionId, setActionId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [phonePairingReady, setPhonePairingReady] = useState(false)
  const [pairingExpiresAt, setPairingExpiresAt] = useState<string | null>(null)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(90)
  const [pairingExpired, setPairingExpired] = useState(false)
  const [pairingAttempt, setPairingAttempt] = useState(0)
  const [detectedPhoneUid, setDetectedPhoneUid] = useState<string | null>(null)
  const [pairedSuccessMsg, setPairedSuccessMsg] = useState<string | null>(null)
  const [webNfcSupported] = useState<boolean>(() => Boolean(getWebNfcConstructor()))
  const [isLocalNfcScanning, setIsLocalNfcScanning] = useState(false)
  const [localNfcBusy, setLocalNfcBusy] = useState(false)
  const [localNfcError, setLocalNfcError] = useState<string | null>(null)

  const modalCardRef = useRef<HTMLDivElement>(null)
  const pairedByPhoneRef = useRef(false)
  const nfcAbortRef = useRef<AbortController | null>(null)
  const localPairingLockRef = useRef(false)

  const loadKeycards = useCallback(async () => {
    setLoading(true)
    try {
      const data = await api.getMemberKeycards(memberId)
      setKeycards(data)
    } catch {
      // Ignore silent fetch error
    } finally {
      setLoading(false)
    }
  }, [memberId])

  useEffect(() => {
    loadKeycards()
  }, [loadKeycards])

  useGSAP(
    () => {
      if (showPairModal && modalCardRef.current) {
        gsap.fromTo(
          modalCardRef.current,
          { opacity: 0, scale: 0.96, y: 12 },
          { opacity: 1, scale: 1, y: 0, duration: 0.25, ease: 'power2.out' },
        )
      }
    },
    { dependencies: [showPairModal] },
  )

  useRfidScanner({
    enabled: showPairModal,
    onScan: (scannedUid) => {
      setShowManualFallback(true)
      setCardUidInput(scannedUid.toUpperCase())
      setErrorMessage(null)
    },
  })

  const stopLocalNfcScan = useCallback(() => {
    nfcAbortRef.current?.abort()
    nfcAbortRef.current = null
    setIsLocalNfcScanning(false)
  }, [])

  const completePairedSuccess = useCallback(
    (displayUid: string, sourceLabel: string) => {
      if (pairedByPhoneRef.current) return
      pairedByPhoneRef.current = true
      stopLocalNfcScan()
      setErrorMessage(null)
      setLocalNfcError(null)
      setDetectedPhoneUid(displayUid)
      playAccessChime('granted', false)
      loadKeycards()

      window.setTimeout(() => {
        setPairedSuccessMsg(
          `Smart Keycard (${displayUid}) paired to ${memberName} ${sourceLabel}!`,
        )
        setCardUidInput('')
        setShowManualFallback(false)
        setShowPairModal(false)
      }, 750)
    },
    [loadKeycards, memberName, stopLocalNfcScan],
  )

  const pairDirectlyFromPhoneNfc = useCallback(
    async (rawUid: string) => {
      if (localPairingLockRef.current || pairedByPhoneRef.current) return
      localPairingLockRef.current = true
      setLocalNfcBusy(true)
      setErrorMessage(null)
      setLocalNfcError(null)
      try {
        const created = await api.pairMemberKeycard(memberId, {
          card_uid: rawUid,
          card_label: DEFAULT_CARD_LABEL,
        })
        completePairedSuccess(
          `${rawUid} (${created.card_uid_masked})`,
          'directly via Phone NFC',
        )
      } catch (err) {
        playAccessChime('denied', false)
        setErrorMessage(
          err instanceof Error ? err.message : 'Failed to pair smart keycard.',
        )
      } finally {
        localPairingLockRef.current = false
        setLocalNfcBusy(false)
      }
    },
    [completePairedSuccess, memberId],
  )

  const startLocalNfcScan = useCallback(async () => {
    const NDEFReaderCtor = getWebNfcConstructor()
    if (!NDEFReaderCtor) return

    setLocalNfcError(null)
    try {
      nfcAbortRef.current?.abort()
      const controller = new AbortController()
      nfcAbortRef.current = controller

      const ndef = new NDEFReaderCtor()
      await ndef.scan({ signal: controller.signal })

      ndef.onreading = (event: NDEFReadingEvent) => {
        const uid = (event.serialNumber || '').trim().toUpperCase()
        if (!uid) {
          setLocalNfcError(
            'Card detected, but UID could not be read. Hold card flat against back of phone.',
          )
          return
        }
        void pairDirectlyFromPhoneNfc(uid)
      }

      ndef.onreadingerror = () => {
        setLocalNfcError(
          'NFC read interrupted — hold NFC card steady at back of phone.',
        )
      }

      setIsLocalNfcScanning(true)
    } catch (err) {
      setIsLocalNfcScanning(false)
      setLocalNfcError(
        err instanceof Error
          ? err.message
          : 'Tap "Scan on This Phone" below to allow Chrome NFC reading.',
      )
    }
  }, [pairDirectlyFromPhoneNfc])

  const openPairModal = useCallback(() => {
    setErrorMessage(null)
    setPairedSuccessMsg(null)
    setDetectedPhoneUid(null)
    setCardUidInput('')
    setShowManualFallback(false)
    setPairingExpired(false)
    setPairingExpiresAt(null)
    setRemainingSeconds(90)
    setLocalNfcError(null)
    setShowPairModal(true)
    if (webNfcSupported) {
      void startLocalNfcScan()
    }
  }, [startLocalNfcScan, webNfcSupported])

  const handleExplicitCancelModal = useCallback(() => {
    if (submitting || localNfcBusy || detectedPhoneUid) return
    stopLocalNfcScan()
    setShowPairModal(false)
    if (!pairedByPhoneRef.current) {
      api.cancelPairingSession(memberId).catch(() => {})
    }
  }, [detectedPhoneUid, localNfcBusy, memberId, stopLocalNfcScan, submitting])

  const handleRestartPairing = useCallback(() => {
    setErrorMessage(null)
    setPairingExpired(false)
    setPhonePairingReady(false)
    setPairingExpiresAt(null)
    setRemainingSeconds(90)
    setPairingAttempt((n) => n + 1)
    if (webNfcSupported) {
      void startLocalNfcScan()
    }
  }, [startLocalNfcScan, webNfcSupported])

  // Smart Pairing Mode: DB-backed session + Live WebSocket + Fallback Poll (preserves session on route navigation!)
  useEffect(() => {
    if (!showPairModal || !canManageCards) {
      return
    }

    pairedByPhoneRef.current = false
    let unmounted = false
    let ws: WebSocket | null = null
    let pollTimer: number | undefined
    const modalOpenedAtMs = Date.now()

    const handleRemotePaired = (displayUid: string) => {
      if (unmounted) return
      completePairedSuccess(displayUid, 'via Phone NFC Scanner')
    }

    api
      .startPairingSession(memberId, DEFAULT_CARD_LABEL)
      .then((status: PairingSessionStatus) => {
        if (unmounted) return
        setPhonePairingReady(true)
        setPairingExpired(false)
        setPairingExpiresAt(
          status.expires_at ?? new Date(Date.now() + 90_000).toISOString(),
        )
      })
      .catch(() => {
        if (!unmounted) setPhonePairingReady(false)
      })

    // 1. Instant Real-Time WebSocket Listener
    try {
      ws = new WebSocket(api.getAccessLiveFeedWsUrl())
      ws.onmessage = (evt) => {
        try {
          const packet = JSON.parse(evt.data)
          if (
            packet?.event === 'keycard_paired' &&
            packet?.data?.member_id === memberId
          ) {
            const uidLabel = packet.data.card_uid
              ? `${packet.data.card_uid} (${packet.data.card_uid_masked})`
              : packet.data.card_uid_masked
            handleRemotePaired(uidLabel)
          } else if (
            packet?.event === 'pairing_conflict' &&
            packet?.data?.member_id === memberId
          ) {
            playAccessChime('denied', false)
            setErrorMessage(
              packet.data.message ||
                'That card is already assigned to another member. Please tap a blank unassigned card.',
            )
          }
        } catch {
          // ignore malformed WS message
        }
      }
    } catch {
      // ignore WS init failure
    }

    // 2. Resilient 1.2s Fallback Poll (guarantees auto-close even if WS is reconnecting)
    pollTimer = window.setInterval(async () => {
      if (pairedByPhoneRef.current || unmounted) return
      try {
        const cards = await api.getMemberKeycards(memberId)
        const latestActive = cards.find((c) => c.status === 'active')
        if (latestActive) {
          const issuedMs = new Date(latestActive.issued_at).getTime()
          if (issuedMs >= modalOpenedAtMs - 1500) {
            handleRemotePaired(latestActive.card_uid_masked)
          }
        }
      } catch {
        // ignore transient poll error
      }
    }, 1200)

    return () => {
      unmounted = true
      if (pollTimer) window.clearInterval(pollTimer)
      ws?.close()
      stopLocalNfcScan()
      setPhonePairingReady(false)
    }
  }, [
    showPairModal,
    pairingAttempt,
    memberId,
    canManageCards,
    completePairedSuccess,
    stopLocalNfcScan,
  ])

  // Live 90-second countdown synchronized to server expires_at
  useEffect(() => {
    if (!showPairModal || !pairingExpiresAt || detectedPhoneUid) {
      return
    }

    const updateRemaining = () => {
      const secs = Math.max(
        0,
        Math.ceil((new Date(pairingExpiresAt).getTime() - Date.now()) / 1000),
      )
      setRemainingSeconds(secs)
      if (secs <= 0) {
        setPairingExpired(true)
        setPhonePairingReady(false)
        stopLocalNfcScan()
      }
    }

    updateRemaining()
    const timer = window.setInterval(updateRemaining, 500)
    return () => window.clearInterval(timer)
  }, [showPairModal, pairingExpiresAt, detectedPhoneUid, stopLocalNfcScan])

  const handlePairSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!cardUidInput.trim()) {
      setErrorMessage('Enter a valid Card UID or tap the NFC card on your Android Phone Scanner.')
      return
    }
    setSubmitting(true)
    setErrorMessage(null)
    try {
      pairedByPhoneRef.current = true
      const created = await api.pairMemberKeycard(memberId, {
        card_uid: cardUidInput.trim(),
        card_label: DEFAULT_CARD_LABEL,
      })
      playAccessChime('granted', false)
      setPairedSuccessMsg(
        `Smart Keycard (${created.card_uid_masked}) paired to ${memberName}!`,
      )
      setCardUidInput('')
      setShowManualFallback(false)
      setShowPairModal(false)
      await loadKeycards()
    } catch (err) {
      pairedByPhoneRef.current = false
      setErrorMessage(err instanceof Error ? err.message : 'Failed to pair smart keycard.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStatusChange = async (card: MemberKeycard, nextStatus: KeycardStatus) => {
    setActionId(card.id)
    try {
      await api.updateKeycardStatus(card.id, {
        status: nextStatus,
        reason:
          nextStatus === 'lost'
            ? 'Reported lost by member at reception'
            : nextStatus === 'revoked'
            ? 'Manually revoked by front-desk staff'
            : 'Reactivated by staff',
      })
      await loadKeycards()
    } catch {
      // ignore
    } finally {
      setActionId(null)
    }
  }

  const activeCard = keycards.find((c) => c.status === 'active') ?? null

  return (
    <div className="mb-8 rounded-2xl border border-white/10 bg-surface p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-widest text-white/40 font-mono flex items-center gap-2">
            <CreditCard className="w-3.5 h-3.5 text-red" />
            <span>Smart Keycard Access (RFID / NFC)</span>
          </p>
          <p className="text-sm text-white/60 max-w-2xl">
            {activeCard
              ? `Active NFC Keycard (${activeCard.card_uid_masked}). Tapping at reception verifies membership instantly.`
              : 'No active smart keycard paired yet. Pair an NFC card to enable 1-tap check-in.'}
          </p>
        </div>

        {canManageCards && (
          <button
            type="button"
            onClick={openPairModal}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red hover:bg-red/85 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{activeCard ? 'Replace Keycard' : 'Pair Keycard'}</span>
          </button>
        )}
      </div>

      {pairedSuccessMsg && (
        <div className="p-3.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 flex items-center justify-between gap-3 text-xs font-mono text-emerald-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{pairedSuccessMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setPairedSuccessMsg(null)}
            className="text-white/40 hover:text-white cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="py-6 text-center text-xs font-mono text-white/40">
          Loading keycard credentials...
        </div>
      ) : keycards.length === 0 ? (
        <div className="p-5 rounded-xl border border-white/10 bg-black/30 flex items-center justify-between gap-4">
          <span className="text-xs font-mono text-white/40">
            0 keycards issued to {memberCode}
          </span>
          {canManageCards && (
            <button
              type="button"
              onClick={openPairModal}
              className="text-xs font-mono text-red hover:underline cursor-pointer"
            >
              Tap to assign card →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {keycards.map((card) => {
            const isActive = card.status === 'active'
            return (
              <div
                key={card.id}
                className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                  isActive
                    ? 'border-white/15 bg-white/[0.03]'
                    : 'border-white/5 bg-black/20 opacity-55'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-white/10 bg-white/5 text-white/40'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-white">NFC Smart Keycard</span>
                      <span className="text-xs font-mono text-white/60 px-2 py-0.5 rounded bg-black/40 border border-white/10">
                        {card.card_uid_masked}
                      </span>
                      <span
                        className={`text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full border ${getStatusClasses(
                          card.status,
                        )}`}
                      >
                        {card.status}
                      </span>
                    </div>
                    <p className="text-xs text-white/40 font-mono mt-1">
                      Issued {new Date(card.issued_at).toLocaleDateString()}
                      {card.last_tapped_at
                        ? ` • Last tap: ${new Date(card.last_tapped_at).toLocaleString()}`
                        : ' • Never tapped yet'}
                    </p>
                  </div>
                </div>

                {canManageCards && (
                  <div className="flex items-center gap-2 shrink-0">
                    {isActive ? (
                      <>
                        <button
                          type="button"
                          disabled={actionId === card.id}
                          onClick={() => handleStatusChange(card, 'lost')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red/30 bg-red/10 hover:bg-red/20 text-xs font-mono text-red transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <ShieldAlert className="w-3.5 h-3.5" />
                          <span>Report Lost</span>
                        </button>
                        <button
                          type="button"
                          disabled={actionId === card.id}
                          onClick={() => handleStatusChange(card, 'revoked')}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/25 text-xs font-mono text-white/60 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          <span>Revoke</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={actionId === card.id}
                        onClick={() => handleStatusChange(card, 'active')}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 hover:border-emerald-500/40 text-xs font-mono text-white/60 hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reactivate</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Pair / Replace Keycard Modal */}
      {showPairModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[99999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4"
            onClick={handleExplicitCancelModal}
          >
            <div
              ref={modalCardRef}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border border-white/15 bg-[#111114] p-6 shadow-2xl space-y-5"
            >
              <div className="flex items-center justify-between pb-3 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-red/10 border border-red/25 flex items-center justify-center text-red">
                    <Radio className="w-4 h-4 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      Pair Smart Keycard
                    </h3>
                    <p className="text-xs font-mono text-white/40">
                      {memberName} ({memberCode})
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!detectedPhoneUid && (phonePairingReady || pairingExpired) && (
                    <span
                      className={`text-[11px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full border ${
                        pairingExpired
                          ? 'border-red/40 bg-red/10 text-red'
                          : remainingSeconds <= 15
                          ? 'border-amber-400/40 bg-amber-500/10 text-amber-300'
                          : 'border-white/15 bg-white/5 text-white/70'
                      }`}
                    >
                      {pairingExpired ? 'Expired' : `${remainingSeconds}s`}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label="Close modal"
                    onClick={handleExplicitCancelModal}
                    className="p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {detectedPhoneUid ? (
                <div className="p-6 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 flex flex-col items-center text-center space-y-3">
                  <div className="w-12 h-12 rounded-full border border-emerald-400/40 bg-emerald-500/20 flex items-center justify-center text-emerald-400">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                      Keycard Paired Automatically!
                    </p>
                    <p className="text-sm font-mono text-white">{detectedPhoneUid}</p>
                    <p className="text-xs text-white/50">Closing window...</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Primary Automatic Phone NFC Pairing Zone */}
                  {pairingExpired ? (
                    <div className="p-5 rounded-2xl border border-red/35 bg-red/[0.08] flex flex-col items-center text-center space-y-3">
                      <div className="w-12 h-12 rounded-full border border-red/40 bg-red/15 flex items-center justify-center text-red">
                        <RotateCcw className="w-5 h-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-mono font-bold uppercase tracking-widest text-red">
                          Pairing Session Expired
                        </p>
                        <p className="text-xs text-white/65 leading-relaxed max-w-xs">
                          The 90-second pairing window timed out before a card tap was received.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRestartPairing}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red hover:bg-red/85 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Restart Pairing</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] flex flex-col items-center text-center space-y-3">
                      <div className="w-12 h-12 rounded-full border border-emerald-400/35 bg-emerald-500/15 flex items-center justify-center text-emerald-400">
                        <Smartphone className="w-6 h-6 animate-pulse" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-mono font-bold uppercase tracking-widest text-emerald-400">
                          {localNfcBusy
                            ? 'Pairing NFC Keycard...'
                            : isLocalNfcScanning
                            ? 'Tap NFC Card on Back of Phone'
                            : phonePairingReady
                            ? 'Waiting for Card Tap on Phone...'
                            : 'Activating Phone Pairing Mode...'}
                        </p>
                        <p className="text-xs text-white/65 leading-relaxed max-w-xs">
                          {isLocalNfcScanning
                            ? 'Hold the blank NFC card against the back of this phone, or tap on /manage/scanner.'
                            : webNfcSupported
                            ? 'Tap the card on /manage/scanner, or scan directly using this phone.'
                            : 'Tap the card on the /manage/scanner Phone or USB reader now.'}
                        </p>
                      </div>
                      {webNfcSupported && !isLocalNfcScanning && (
                        <button
                          type="button"
                          onClick={() => void startLocalNfcScan()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red hover:bg-red/85 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer"
                        >
                          <Smartphone className="w-3.5 h-3.5" />
                          <span>Scan NFC Card on This Phone</span>
                        </button>
                      )}
                      {localNfcError && (
                        <p className="text-[11px] text-amber-300 bg-amber-500/10 border border-amber-500/25 rounded-lg px-3 py-2 w-full">
                          {localNfcError}
                        </p>
                      )}
                    </div>
                  )}

                  {errorMessage && (
                    <p className="text-xs text-red bg-red/10 border border-red/25 rounded-xl p-3">
                      {errorMessage}
                    </p>
                  )}

                  {/* Optional Manual Fallback */}
                  <div className="pt-1 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => setShowManualFallback((v) => !v)}
                      className="w-full flex items-center justify-between py-2 text-xs font-mono text-white/45 hover:text-white/80 transition-colors cursor-pointer"
                    >
                      <span>No phone nearby? Enter Card UID manually</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 transition-transform ${
                          showManualFallback ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {showManualFallback && (
                      <form onSubmit={handlePairSubmit} className="pt-3 space-y-3">
                        <label className="text-[11px] uppercase tracking-widest text-white/40 font-mono block">
                          Manual Card UID
                        </label>
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            data-rfid-capture="true"
                            value={cardUidInput}
                            onChange={(e) => setCardUidInput(e.target.value.toUpperCase())}
                            placeholder="e.g. 04E6CB6FD32A81"
                            className="flex-1 rounded-xl border border-white/15 bg-black/50 px-3.5 py-2 text-xs font-mono text-white placeholder-white/30 focus:outline-none focus:border-red transition-colors"
                          />
                          <button
                            type="submit"
                            disabled={submitting || !cardUidInput.trim()}
                            className="px-4 py-2 rounded-xl bg-red hover:bg-red/85 text-white text-xs font-mono font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-40 shrink-0"
                          >
                            {submitting ? 'Pairing...' : 'Bind UID'}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>

                  <div className="flex items-center justify-end pt-1">
                    <button
                      type="button"
                      onClick={handleExplicitCancelModal}
                      disabled={submitting || localNfcBusy}
                      className="px-4 py-2 rounded-xl border border-white/10 text-xs font-mono text-white/60 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}
