type FaceApiModule = typeof import('@vladmandic/face-api')

export interface Point2D {
  x: number
  y: number
}

export interface LiveFaceFrameMetrics {
  detected: boolean
  ear: number
  yawRatio: number
}

export interface ExtractedFaceResult {
  descriptor: number[]
  score: number
  snapshotDataUrl?: string
}

/** Downscale and compress a canvas snapshot into a compact JPEG data URI (<150 KB typically). */
export function toCompressedJpegDataUrl(
  source: HTMLCanvasElement,
  maxDim = 960,
  quality = 0.84,
): string {
  const longestSide = Math.max(source.width, source.height, 1)
  const scale = Math.min(1, maxDim / longestSide)
  if (scale === 1) {
    return source.toDataURL('image/jpeg', quality)
  }

  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(source.width * scale))
  out.height = Math.max(1, Math.round(source.height * scale))
  const ctx = out.getContext('2d')
  if (!ctx) return source.toDataURL('image/jpeg', quality)

  ctx.drawImage(source, 0, 0, out.width, out.height)
  return out.toDataURL('image/jpeg', quality)
}

export const ID_SELFIE_MATCH_LIMIT = 0.62

/** Convert getUserMedia DOMException codes into actionable camera instructions. */
export function describeCameraError(err: unknown, context: 'id' | 'face'): string {
  const errName = err instanceof DOMException || err instanceof Error ? err.name : ''
  const suffix =
    context === 'id' ? 'You can also use "Upload Photo" below.' : 'Please connect/allow a webcam and click Retry.'

  if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
    return `No webcam detected on this device. ${suffix}`
  }
  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    return `Camera is currently in use by another app. Close the other app and retry. ${suffix}`
  }
  if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
    return `Camera access was blocked by browser or OS settings. ${suffix}`
  }
  return `Could not access camera${errName ? ` (${errName})` : ''}. ${suffix}`
}

let faceApiPromise: Promise<FaceApiModule> | null = null
let modelsLoadPromise: Promise<FaceApiModule> | null = null

async function getFaceApi(): Promise<FaceApiModule> {
  if (!faceApiPromise) {
    faceApiPromise = import('@vladmandic/face-api')
  }
  return faceApiPromise
}

/** Lazy-load self-hosted face detection, 68-point tiny landmark, and recognition weights once. */
export async function loadFaceModels(): Promise<FaceApiModule> {
  if (!modelsLoadPromise) {
    modelsLoadPromise = (async () => {
      const faceapi = await getFaceApi()
      const modelRoot = '/models'
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelRoot),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(modelRoot),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelRoot),
      ])
      return faceapi
    })().catch((err) => {
      modelsLoadPromise = null
      throw err
    })
  }
  return modelsLoadPromise
}

function pointDist(a: Point2D, b: Point2D): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return Math.hypot(dx, dy)
}

function computeEyeAspectRatio(eye: readonly Point2D[]): number {
  if (eye.length < 6) return 0.3
  const v1 = pointDist(eye[1], eye[5])
  const v2 = pointDist(eye[2], eye[4])
  const h = pointDist(eye[0], eye[3])
  return h > 0 ? (v1 + v2) / (2 * h) : 0.3
}

/** Compute Euclidean distance between two 128-d face descriptors. */
export function euclideanDistance(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length || a.length === 0) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let i = 0; i < a.length; i += 1) {
    const diff = a[i] - b[i]
    sum += diff * diff
  }
  return Math.sqrt(sum)
}

/** Extract a 128-d face descriptor from a captured/uploaded valid ID card. */
export async function extractIdFaceDescriptor(
  source: HTMLImageElement | HTMLCanvasElement,
): Promise<ExtractedFaceResult | null> {
  const faceapi = await loadFaceModels()
  const attempts = [
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }),
    new faceapi.TinyFaceDetectorOptions({ inputSize: 512, scoreThreshold: 0.28 }),
  ]

  for (const options of attempts) {
    const detection = await faceapi
      .detectSingleFace(source, options)
      .withFaceLandmarks(true)
      .withFaceDescriptor()
    if (detection) {
      return {
        descriptor: Array.from(detection.descriptor),
        score: detection.detection.score,
      }
    }
  }
  return null
}

/** Measure live eye blink (EAR) and horizontal head yaw ratio without heavy descriptor math per frame. */
export async function analyzeFaceFrame(video: HTMLVideoElement): Promise<LiveFaceFrameMetrics> {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return { detected: false, ear: 0, yawRatio: 0.5 }
  }

  const faceapi = await loadFaceModels()
  const detection = await faceapi
    .detectSingleFace(
      video,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.45 }),
    )
    .withFaceLandmarks(true)

  if (!detection) {
    return { detected: false, ear: 0, yawRatio: 0.5 }
  }

  const pts = detection.landmarks.positions
  const leftEye = pts.slice(36, 42)
  const rightEye = pts.slice(42, 48)
  const ear = (computeEyeAspectRatio(leftEye) + computeEyeAspectRatio(rightEye)) / 2

  const leftJaw = pts[0]
  const rightJaw = pts[16]
  const noseTip = pts[30]
  const faceSpan = Math.abs(rightJaw.x - leftJaw.x)
  const yawRatio = faceSpan > 1 ? (noseTip.x - leftJaw.x) / faceSpan : 0.5

  return { detected: true, ear, yawRatio }
}

/** Snap current live webcam frame to an offscreen canvas and extract 128-d face descriptor. */
export async function captureLiveFaceDescriptor(
  video: HTMLVideoElement,
): Promise<ExtractedFaceResult | null> {
  if (video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
    return null
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  const faceapi = await loadFaceModels()
  const detection = await faceapi
    .detectSingleFace(
      canvas,
      new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.45 }),
    )
    .withFaceLandmarks(true)
    .withFaceDescriptor()

  if (!detection) return null
  return {
    descriptor: Array.from(detection.descriptor),
    score: detection.detection.score,
    snapshotDataUrl: toCompressedJpegDataUrl(canvas, 640, 0.82),
  }
}
