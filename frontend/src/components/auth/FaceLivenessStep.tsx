import { useCallback, useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { AlertCircle, Camera, CheckCircle2, Eye, RefreshCw, ScanFace } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { QuarterRing } from '@/components/ui/quarter-ring'
import {
  ID_SELFIE_MATCH_LIMIT,
  analyzeFaceFrame,
  captureLiveFaceDescriptor,
  describeCameraError,
  euclideanDistance,
  loadFaceModels,
} from '@/utils/faceBiometrics'

gsap.registerPlugin()

export interface FaceLivenessResult {
  descriptor: number[]
  livenessPassed: boolean
  idMatchScore?: number
  liveImageBase64?: string
}

export interface VerificationChecklistItem {
  label: string
  status: 'pending' | 'active' | 'done'
}

interface FaceLivenessStepProps {
  mode: 'verify' | 'enroll_match'
  stepBadge?: string
  title: string
  subtitle: string
  referenceIdDescriptor?: number[]
  submitting?: boolean
  serverError?: string | null
  verificationChecklist?: readonly VerificationChecklistItem[]
  onVerified: (result: FaceLivenessResult) => void | Promise<void>
  onBack?: () => void
  backLabel?: string
}

function renderChecklistIcon(status: VerificationChecklistItem['status']) {
  if (status === 'done') {
    return <CheckCircle2 className="w-3.5 h-3.5 text-white shrink-0" />
  }
  if (status === 'active') {
    return <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse shrink-0 ml-0.5" />
  }
  return <span className="w-2.5 h-2.5 rounded-full bg-white/20 shrink-0 ml-0.5" />
}

function stopStream(stream: MediaStream | null) {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

export function FaceLivenessStep({
  mode,
  stepBadge,
  title,
  subtitle,
  referenceIdDescriptor,
  submitting = false,
  serverError = null,
  verificationChecklist,
  onVerified,
  onBack,
  backLabel = '← Back',
}: FaceLivenessStepProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const busyRef = useRef(false)
  const completedRef = useRef(false)

  // Liveness tracking refs (updated at frame rate without forcing heavy re-renders)
  const baselineEarRef = useRef<number | null>(null)
  const sawEyeCloseRef = useRef(false)

  const [cameraReady, setCameraReady] = useState(false)
  const [modelsReady, setModelsReady] = useState(false)
  const [faceDetected, setFaceDetected] = useState(false)
  const [livenessConfirmed, setLivenessConfirmed] = useState(false)
  const [capturingMatch, setCapturingMatch] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [statusHint, setStatusHint] = useState('Look straight into the camera...')

  useGSAP(
    () => {
      if (!containerRef.current) return
      gsap.fromTo(
        containerRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' },
      )
    },
    { scope: containerRef },
  )

  const connectCameraAndModels = useCallback(async () => {
    stopStream(streamRef.current)
    streamRef.current = null
    completedRef.current = false
    baselineEarRef.current = null
    sawEyeCloseRef.current = false
    await Promise.resolve()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraReady(false)
      setLocalError('Webcam access is not supported in this browser.')
      return
    }

    try {
      const [stream] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        }),
        loadFaceModels().then(() => setModelsReady(true)),
      ])

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setLocalError(null)
      setCameraReady(true)
      setStatusHint('Center your face inside the ring, then blink once or turn your head slightly.')
    } catch (err) {
      setCameraReady(false)
      setLocalError(describeCameraError(err, 'face'))
    }
  }, [])

  useEffect(() => {
    void connectCameraAndModels()
    return () => {
      stopStream(streamRef.current)
      streamRef.current = null
    }
  }, [connectCameraAndModels])

  const finalizeLiveCapture = useCallback(async () => {
    const video = videoRef.current
    if (!video || completedRef.current) return

    completedRef.current = true
    setCapturingMatch(true)
    setStatusHint('Capturing biometric signature...')

    try {
      const captured = await captureLiveFaceDescriptor(video)
      if (!captured) {
        completedRef.current = false
        setLivenessConfirmed(false)
        setLocalError('Face moved out of frame during capture. Please try again.')
        return
      }

      if (mode === 'enroll_match') {
        if (!referenceIdDescriptor?.length) {
          completedRef.current = false
          setLocalError('ID face reference is missing. Please re-scan your valid ID.')
          return
        }
        const matchDistance = euclideanDistance(captured.descriptor, referenceIdDescriptor)
        if (matchDistance > ID_SELFIE_MATCH_LIMIT) {
          completedRef.current = false
          setLivenessConfirmed(false)
          setLocalError(
            `Selfie did not match the face on your valid ID (distance ${matchDistance.toFixed(2)}). Use brighter lighting and retry.`,
          )
          return
        }
        await onVerified({
          descriptor: captured.descriptor,
          livenessPassed: true,
          idMatchScore: Number(matchDistance.toFixed(4)),
          liveImageBase64: captured.snapshotDataUrl,
        })
        return
      }

      await onVerified({
        descriptor: captured.descriptor,
        livenessPassed: true,
        liveImageBase64: captured.snapshotDataUrl,
      })
    } catch {
      completedRef.current = false
    } finally {
      setCapturingMatch(false)
    }
  }, [mode, onVerified, referenceIdDescriptor])

  useEffect(() => {
    if (!cameraReady || !modelsReady || submitting) return

    const timer = window.setInterval(async () => {
      if (busyRef.current || completedRef.current || !videoRef.current) return
      busyRef.current = true

      try {
        const metrics = await analyzeFaceFrame(videoRef.current)
        if (!metrics.detected) {
          setFaceDetected(false)
          setStatusHint('No face detected — position your face in the center.')
          return
        }

        setFaceDetected(true)

        // Update baseline Eye Aspect Ratio while eyes are open
        if (baselineEarRef.current === null) {
          baselineEarRef.current = metrics.ear
        } else if (!sawEyeCloseRef.current && metrics.ear > baselineEarRef.current) {
          baselineEarRef.current = baselineEarRef.current * 0.7 + metrics.ear * 0.3
        }

        const baseEar = baselineEarRef.current ?? 0.28
        const blinkDropThreshold = Math.min(0.22, baseEar * 0.8)
        if (metrics.ear < blinkDropThreshold) {
          sawEyeCloseRef.current = true
        }

        const completedBlink = sawEyeCloseRef.current && metrics.ear >= baseEar * 0.86
        const turnedHead = metrics.yawRatio < 0.36 || metrics.yawRatio > 0.64

        if (completedBlink || turnedHead) {
          setLivenessConfirmed(true)
          await finalizeLiveCapture()
        } else {
          setStatusHint('Face locked — blink once OR slightly turn your head to verify liveness.')
        }
      } catch {
        // Ignore transient frame decode hiccups
      } finally {
        busyRef.current = false
      }
    }, 180)

    return () => window.clearInterval(timer)
  }, [cameraReady, modelsReady, submitting, finalizeLiveCapture])

  const activeError = serverError || localError
  const isVerifying = submitting || capturingMatch
  const resolvedBadge =
    stepBadge || (mode === 'enroll_match' ? 'Step 2 • Live Selfie & Liveness' : 'Step 2 • Face Verification')

  const defaultEnrollChecklist: VerificationChecklistItem[] = [
    {
      label: '1. Verifying liveness & ID-to-selfie match',
      status: submitting ? 'done' : 'active',
    },
    {
      label: '2. Checking for duplicate account, ID & face identity',
      status: submitting ? 'active' : 'pending',
    },
  ]

  const defaultVerifyChecklist: VerificationChecklistItem[] = [
    { label: '1. Verifying live face descriptor & liveness', status: 'active' },
  ]

  const activeChecklist =
    verificationChecklist ??
    (mode === 'enroll_match' ? defaultEnrollChecklist : defaultVerifyChecklist)

  const handleRetry = () => {
    completedRef.current = false
    baselineEarRef.current = null
    sawEyeCloseRef.current = false
    setLivenessConfirmed(false)
    setCapturingMatch(false)
    setLocalError(null)
    if (!cameraReady || !modelsReady) {
      setCameraReady(false)
      setStatusHint('Loading biometric scanner & camera...')
      void connectCameraAndModels()
      return
    }
    setStatusHint('Center your face inside the ring, then blink once or turn your head slightly.')
  }

  return (
    <div ref={containerRef} className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-widest text-red font-mono font-semibold">
          {resolvedBadge}
        </p>
        <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white">
          {title}
        </h2>
        <p className="text-xs text-white/50 leading-relaxed">{subtitle}</p>
      </div>

      {/* Live Camera Viewport */}
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black aspect-[4/3] flex items-center justify-center">
        <video
          ref={videoRef}
          playsInline
          muted
          className="w-full h-full object-cover scale-x-[-1]"
        />

        {/* Alignment Oval Ring */}
        {cameraReady && (
          <div
            className={`pointer-events-none absolute w-48 h-60 rounded-[50%] border-2 transition-colors duration-200 ${
              livenessConfirmed
                ? 'border-emerald-400 shadow-[0_0_24px_rgba(52,211,153,0.35)]'
                : faceDetected
                  ? 'border-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.25)]'
                  : 'border-white/30'
            }`}
            aria-hidden="true"
          />
        )}

        {!submitting && localError && (!cameraReady || !modelsReady) && (
          <div className="absolute inset-0 bg-surface-2/95 flex flex-col items-center justify-center gap-3 p-5 text-center">
            <Camera className="w-8 h-8 text-white/35" />
            <p className="text-xs text-white/65 max-w-xs leading-relaxed">{localError}</p>
            <Button type="button" variant="secondary" size="sm" onClick={handleRetry}>
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Camera
            </Button>
          </div>
        )}

        {(isVerifying || (!localError && (!cameraReady || !modelsReady))) && (
          <div className="absolute inset-0 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4 text-center">
            <QuarterRing className="w-10 h-10 text-white" />
            <p className="text-xs font-mono uppercase tracking-widest text-white">
              {isVerifying ? 'Verifying Biometric Identity...' : 'Initializing Face Scanner...'}
            </p>
          </div>
        )}
      </div>

      {/* White / Monochrome Skeleton Loading UI during post-capture verification */}
      {isVerifying && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-xl border border-white/15 bg-surface-2/80 space-y-4"
        >
          <div className="space-y-2">
            {activeChecklist.map((item) => (
              <div
                key={item.label}
                className={`flex items-center gap-2.5 text-xs font-mono ${
                  item.status === 'pending' ? 'text-white/40' : 'text-white'
                }`}
              >
                {renderChecklistIcon(item.status)}
                <span>{item.label}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2.5 pt-2 border-t border-white/10">
            <div className="h-3 w-32 rounded bg-white/15 animate-pulse" />
            <div className="h-9 w-full rounded-lg bg-white/10 animate-pulse" />
          </div>
        </div>
      )}

      {/* Real-time Liveness Checklist */}
      <div className="grid grid-cols-2 gap-2.5 text-xs">
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 ${
            faceDetected
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : 'border-white/10 bg-surface-2 text-white/50'
          }`}
        >
          <ScanFace className="w-4 h-4 shrink-0" />
          <span className="font-medium">{faceDetected ? 'Face Locked' : 'Looking for Face'}</span>
        </div>

        <div
          className={`p-3 rounded-xl border flex items-center gap-2 ${
            livenessConfirmed
              ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
              : 'border-white/10 bg-surface-2 text-white/50'
          }`}
        >
          {livenessConfirmed ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <Eye className="w-4 h-4 shrink-0" />
          )}
          <span className="font-medium">
            {livenessConfirmed ? 'Liveness Confirmed' : 'Blink or Turn Head'}
          </span>
        </div>
      </div>

      <p className="text-xs text-center text-white/60 font-mono">{statusHint}</p>

      {activeError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-red/30 bg-red/10 text-xs text-red-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red shrink-0 mt-0.5" />
          <span>{activeError}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {onBack ? (
          <Button type="button" variant="ghost" size="md" disabled={isVerifying} onClick={onBack}>
            {backLabel}
          </Button>
        ) : (
          <span />
        )}
        <Button type="button" variant="secondary" size="sm" disabled={isVerifying} onClick={handleRetry}>
          <RefreshCw className="w-3.5 h-3.5" />
          Retry Face Scan
        </Button>
      </div>
    </div>
  )
}
