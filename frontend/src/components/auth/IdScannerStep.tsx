import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { Camera, CheckCircle2, RefreshCw, ShieldCheck, Upload, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { QuarterRing } from '@/components/ui/quarter-ring'
import { api } from '@/services/api'
import type { SupportedIdType } from '@/types/auth'
import { describeCameraError, extractIdFaceDescriptor, toCompressedJpegDataUrl } from '@/utils/faceBiometrics'
import { ID_TYPE_OPTIONS, parsePhilippineIdText, scanPhilippineId } from '@/utils/phIdOcr'

gsap.registerPlugin()

export interface IdScanCompletedData {
  idType: SupportedIdType
  fullName: string
  idNumber: string
  idOcrName: string
  idDescriptor: number[]
  idImageBase64?: string
}

interface IdScannerStepProps {
  title?: string
  subtitle?: string
  initialFullName?: string
  initialIdType?: SupportedIdType
  onConfirm: (data: IdScanCompletedData) => void
  onBack?: () => void
  confirmLabel?: string
}

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) return
  for (const track of stream.getTracks()) {
    track.stop()
  }
}

export function IdScannerStep({
  title = 'Scan Valid ID',
  subtitle = 'Philippine National ID (PhilSys), Driver’s License, School ID, or any valid government ID.',
  initialFullName = '',
  initialIdType = 'philsys',
  onConfirm,
  onBack,
  confirmLabel = 'Continue to Face Scan →',
}: IdScannerStepProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState<string | null>(null)

  const [idType, setIdType] = useState<SupportedIdType>(initialIdType)
  const [fullName, setFullName] = useState(initialFullName)
  const [idNumber, setIdNumber] = useState('')
  const [idOcrName, setIdOcrName] = useState('')
  const [idDescriptor, setIdDescriptor] = useState<number[] | null>(null)
  const [idImageBase64, setIdImageBase64] = useState<string | null>(null)
  const [ocrStatusMsg, setOcrStatusMsg] = useState<string | null>(null)
  const [needsReview, setNeedsReview] = useState(false)

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

  const connectCamera = useCallback(async (preferredFacing: 'environment' | 'user') => {
    stopMediaStream(streamRef.current)
    streamRef.current = null
    await Promise.resolve()

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraReady(false)
      setCameraError('Camera access is unavailable in this browser. Upload a clear photo of your ID below.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: preferredFacing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraError(null)
      setCameraReady(true)
    } catch (err) {
      setCameraReady(false)
      setCameraError(describeCameraError(err, 'id'))
    }
  }, [])

  useEffect(() => {
    if (!previewDataUrl) {
      void connectCamera(facingMode)
    }
    return () => {
      stopMediaStream(streamRef.current)
      streamRef.current = null
    }
  }, [facingMode, previewDataUrl, connectCamera])

  const processIdCanvas = async (canvas: HTMLCanvasElement) => {
    setScanning(true)
    setScanError(null)
    setOcrStatusMsg(null)
    setIdDescriptor(null)
    const compressedJpeg = toCompressedJpegDataUrl(canvas, 1024, 0.85)
    setPreviewDataUrl(compressedJpeg)
    setIdImageBase64(compressedJpeg)

    stopMediaStream(streamRef.current)
    streamRef.current = null

    try {
      const [faceResult, cloudOcr] = await Promise.all([
        extractIdFaceDescriptor(canvas),
        api.ocrScanId(compressedJpeg).catch(() => ({
          provider: 'tesseract_local',
          raw_text: '',
          used_external_api: false,
        })),
      ])

      if (!faceResult) {
        setScanError(
          'No clear face was detected on your ID photo. Retake in bright lighting and avoid glare over the photo.',
        )
        return
      }

      const ocrResult =
        cloudOcr.used_external_api && cloudOcr.raw_text
          ? parsePhilippineIdText(cloudOcr.raw_text, 88, idType)
          : await scanPhilippineId(canvas, idType)

      setIdDescriptor(faceResult.descriptor)
      setIdType(ocrResult.detectedType)
      setIdOcrName(ocrResult.fullName)
      if (ocrResult.fullName) {
        setFullName(ocrResult.fullName)
      }
      if (ocrResult.idNumber) {
        setIdNumber(ocrResult.idNumber)
      }
      setNeedsReview(ocrResult.needsReview)
      const sourceLabel = cloudOcr.used_external_api
        ? 'OCR.space Cloud API'
        : `${ocrResult.confidence}% local OCR`
      setOcrStatusMsg(
        ocrResult.needsReview
          ? `ID photo verified (${sourceLabel}). Please confirm or edit your name below.`
          : `Auto-filled from ID (${sourceLabel}). Confirm details before continuing.`,
      )
    } catch (err) {
      setScanError(
        err instanceof Error
          ? err.message
          : 'Failed to scan valid ID. Please retake with clearer lighting.',
      )
    } finally {
      setScanning(false)
    }
  }

  const handleCaptureFrame = async () => {
    const video = videoRef.current
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      setScanError('Camera feed is still warming up. Please wait a second.')
      return
    }
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    await processIdCanvas(canvas)
  }

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    const objectUrl = URL.createObjectURL(file)
    const img = new Image()
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.drawImage(img, 0, 0)
        await processIdCanvas(canvas)
      } finally {
        URL.revokeObjectURL(objectUrl)
      }
    }
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      setScanError('Selected file could not be loaded as an image.')
    }
    img.src = objectUrl
  }

  const handleRetake = () => {
    setPreviewDataUrl(null)
    setIdDescriptor(null)
    setIdImageBase64(null)
    setScanError(null)
    setOcrStatusMsg(null)
  }

  const handleConfirm = () => {
    if (!idDescriptor) {
      setScanError('Please capture or upload a valid ID showing your face photo first.')
      return
    }
    if (fullName.trim().length < 2) {
      setScanError('Please enter or confirm your full name as shown on your ID.')
      return
    }
    onConfirm({
      idType,
      fullName: fullName.trim(),
      idNumber: idNumber.trim(),
      idOcrName: (idOcrName || fullName).trim(),
      idDescriptor,
      idImageBase64: idImageBase64 || undefined,
    })
  }

  return (
    <div ref={containerRef} className="space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] uppercase tracking-widest text-red font-mono font-semibold">
          Step 1 • Valid ID & OCR Scan
        </p>
        <h2 className="font-display text-xl font-bold uppercase tracking-tight text-white">
          {title}
        </h2>
        <p className="text-xs text-white/50 leading-relaxed">{subtitle}</p>
      </div>

      {/* ID Type Selector */}
      <div>
        <label
          htmlFor="id-type-select"
          className="block text-xs uppercase tracking-widest text-white/50 font-semibold mb-1.5"
        >
          ID Type
        </label>
        <select
          id="id-type-select"
          value={idType}
          onChange={(e) => setIdType(e.target.value as SupportedIdType)}
          className="w-full px-3.5 py-2.5 bg-surface-2 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-red/40 transition-colors"
        >
          {ID_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value} className="bg-surface-2">
              {opt.label} — {opt.hint}
            </option>
          ))}
        </select>
      </div>

      {/* Camera / Preview Frame */}
      <div className="relative rounded-xl overflow-hidden border border-white/10 bg-black aspect-[16/10] flex items-center justify-center">
        {previewDataUrl ? (
          <img
            src={previewDataUrl}
            alt="Captured Valid ID preview"
            className="w-full h-full object-contain bg-black"
          />
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              className="w-full h-full object-cover"
            />
            {cameraReady && (
              <div
                className="pointer-events-none absolute inset-4 rounded-xl border-2 border-dashed border-white/35 flex items-end justify-center pb-3"
                aria-hidden="true"
              >
                <span className="px-2.5 py-1 rounded bg-black/70 text-[11px] font-mono text-white/80">
                  Align front of ID inside frame
                </span>
              </div>
            )}
            {!cameraReady && !cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/80 text-white/60 text-xs font-mono">
                <QuarterRing className="w-8 h-8 text-red" />
                <span>Starting ID camera...</span>
              </div>
            )}
            {cameraError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center bg-surface-2/95">
                <Camera className="w-8 h-8 text-white/35" />
                <p className="text-xs text-white/65 max-w-xs leading-relaxed">{cameraError}</p>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={scanning}
                  onClick={() => void connectCamera(facingMode)}
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Retry Camera
                </Button>
              </div>
            )}
          </>
        )}

        {scanning && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <QuarterRing className="w-10 h-10 text-red" />
            <p className="text-xs font-mono uppercase tracking-widest text-white/80">
              Scanning ID & Face Photo...
            </p>
          </div>
        )}
      </div>

      {/* Capture / Upload Controls */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileUpload}
      />

      {!previewDataUrl ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="primary"
            size="md"
            className="flex-1"
            disabled={!cameraReady || scanning}
            onClick={handleCaptureFrame}
          >
            <Camera className="w-4 h-4" />
            Capture & Scan ID
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="md"
            disabled={scanning}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-4 h-4" />
            Upload Photo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="md"
            disabled={scanning}
            onClick={() => setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))}
            title="Switch camera"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2.5">
          <Button type="button" variant="secondary" size="sm" disabled={scanning} onClick={handleRetake}>
            <RefreshCw className="w-3.5 h-3.5" />
            Retake ID Photo
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={scanning}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
            Upload Different File
          </Button>
        </div>
      )}

      {/* Status / Errors */}
      {scanError && (
        <div
          role="alert"
          className="p-3.5 rounded-xl border border-red/30 bg-red/10 text-xs text-red-300 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-red shrink-0 mt-0.5" />
          <span>{scanError}</span>
        </div>
      )}

      {ocrStatusMsg && idDescriptor && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-start gap-2.5 ${
            needsReview
              ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
              : 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
          }`}
        >
          {needsReview ? (
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
          ) : (
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          )}
          <span>{ocrStatusMsg}</span>
        </div>
      )}

      {/* Extracted & Editable Details (Manual Fallback Always Available) */}
      {idDescriptor && (
        <div className="space-y-3.5 pt-2 border-t border-white/10">
          <Input
            label="Full Name (as shown on ID) *"
            type="text"
            name="ocr_full_name"
            placeholder="Juan Dela Cruz"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
          <Input
            label="ID Number (Optional — masked & hashed on server)"
            type="text"
            name="ocr_id_number"
            placeholder="Auto-detected or leave blank"
            value={idNumber}
            onChange={(e) => setIdNumber(e.target.value)}
          />
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center justify-between gap-3 pt-2">
        {onBack ? (
          <Button type="button" variant="ghost" size="md" onClick={onBack}>
            ← Back
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="button"
          variant="primary"
          size="md"
          disabled={!idDescriptor || scanning}
          onClick={handleConfirm}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  )
}
