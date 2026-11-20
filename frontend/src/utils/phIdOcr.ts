import type { SupportedIdType } from '@/types/auth'

export interface IdTypeOption {
  value: SupportedIdType
  label: string
  hint: string
}

export interface ParsedIdOcrResult {
  detectedType: SupportedIdType
  fullName: string
  idNumber: string
  confidence: number
  needsReview: boolean
  rawText: string
}

export interface IdImageQualityResult {
  ok: boolean
  reason?: string
  brightness: number
  sharpness: number
}

export interface IdTypeValidationResult {
  matched: boolean
  detectedType: SupportedIdType | null
  reason?: string
}

export interface NameMatchResult {
  matched: boolean
  score: number
  warning?: string
}

export const ID_TYPE_OPTIONS: readonly IdTypeOption[] = [
  { value: 'philsys', label: 'PhilSys / National ID', hint: 'PSA ePhilID or PVC card' },
  { value: 'drivers_license', label: "LTO Driver's License", hint: 'Professional or Non-Pro' },
  { value: 'school_id', label: 'School / Student ID', hint: 'University, college, or SHS ID' },
  { value: 'umid', label: 'UMID / SSS Card', hint: 'Unified Multi-Purpose ID' },
  { value: 'passport', label: 'Philippine Passport', hint: 'DFA bio-data page' },
  { value: 'postal_id', label: 'Postal ID', hint: 'PHLPost improved Postal ID' },
  { value: 'voters_id', label: "Voter's ID", hint: 'COMELEC voter card' },
  { value: 'other_gov_id', label: 'Other Valid ID', hint: 'PRC, TIN, PhilHealth, Company ID' },
]

const BOILERPLATE_RE =
  /\b(REPUBLIC|PHILIPPINES|REPUBLIKA|PILIPINAS|PHILIPPINE|STATISTICS|AUTHORITY|LAND\s+TRANSPORTATION|TRANSPORTATION|DEPARTMENT|OFFICE|DRIVER|LICENSE|IDENTIFICATION|CARD|NATIONAL|UNIFIED|MULTI[-\s]?PURPOSE|STUDENT|UNIVERSITY|STATE|COLLEGE|INSTITUTE|POLYTECHNIC|ACADEMY|CAMPUS|SCHOOL|HIGH\s+SCHOOL|ENGINEERING|TECHNOLOGY|INFORMATION|SCIENCE|COMPUTER|EDUCATION|ACCOUNTANCY|ADMINISTRATION|BUSINESS|MANAGEMENT|NURSING|CRIMINOLOGY|HOSPITALITY|TOURISM|ARCHITECTURE|AGRICULTURE|BACHELOR|COURSE|PROGRAM|STRAND|TRACK|MAJOR|GRADE|SECTION|SEMESTER|ACADEMIC|REGISTRAR|PRESIDENT|DEAN|BATANGAS|ROSARIO|PROVINCE|MUNICIPALITY|BARANGAY|PAMBANSANG|PAGKAKAKILANLAN|GIVEN\s+NAMES?|LAST\s+NAMES?|MIDDLE\s+NAMES?|SURNAME|FIRST\s+NAMES?|FULL\s+NAME|MGA\s+PANGALAN|GITNANG|PANGALAN|APELYIDO|DATE\s+OF\s+BIRTH|BIRTHDATE|ADDRESS|SIGNATURE|SEX|NATIONALITY|BLOOD|HEIGHT|WEIGHT|EXPIRATION|AGENCY|VALID|UNTIL|ISSUED|PASSPORT|COMELEC|PHLPOST|POSTAL|SSS|GSIS|PHILHEALTH|PRC|TIN|DFA|LTO|PCN|CRN|LRN|SR[-\s]?CODE|BS|BA|AB|BSED|BEED|BSIT|BSCS|BSCE|BSEE|BSME|BSA|BSBA|BSN|BSHM|BSTM|BSCPE|BSIE|BSPSY|BSBIO|MBA|PHD|SHS|STEM|ABM|HUMSS|GAS|TVL)\b/i

const ACADEMIC_OR_URL_RE = /(?:WWW\.|HTTP|@|\.(?:EDU|PH|COM|GOV|ORG|NET)\b|\b(?:MA|MS)\s+(?:OF|IN)\b)/i

const INSTITUTION_TITLE_FOLLOW_RE = /\b(UNIVERSITY|COLLEGE|INSTITUTE|POLYTECHNIC|ACADEMY|SCHOOL)\b/i

const NON_NAME_CHARS_RE = /[^A-Za-zÑñ.\-\s]/

const ID_LABEL_PREFIX_RE =
  /(?:ID\s*(?:NO\.?|NUM(?:BER)?|#)|SR[-\s]?CODE|STUDENT\s*(?:ID|NO\.?|#)|LRN|PCN|CRN|DL\s*NO\.?|LICENSE\s*NO\.?|PASSPORT\s*NO\.?)/i

function toTitleCaseName(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => {
      if (part.length <= 2 && part.endsWith('.')) return part.toUpperCase()
      return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase()
    })
    .join(' ')
}

function cleanCandidateLine(line: string): string {
  return line
    .replace(/[^A-Za-zÑñ0-9,\-.\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function detectExplicitIdType(upper: string): SupportedIdType | null {
  if (/PHILSYS|PAMBANSANG\s+PAGKAKAKILANLAN|PHILIPPINE\s+IDENTIFICATION|STATISTICS\s+AUTHORITY|\bPCN\b/.test(upper)) {
    return 'philsys'
  }
  if (/LAND\s+TRANSPORTATION|DRIVER'?S?\s+LICENSE|\bLTO\b|RESTRICTIONS|DL\s+NO/.test(upper)) {
    return 'drivers_license'
  }
  if (/UNIFIED\s+MULTI|COMMON\s+REFERENCE|\bUMID\b|\bCRN[-\s]?\d/.test(upper)) {
    return 'umid'
  }
  if (/PASSPORT|DFA\b|REPUBLIC\s+OF\s+THE\s+PHILIPPINES.*P<PHL/.test(upper)) {
    return 'passport'
  }
  if (/PHLPOST|POSTAL\s+ID/.test(upper)) {
    return 'postal_id'
  }
  if (/COMELEC|VOTER/.test(upper)) {
    return 'voters_id'
  }
  if (
    /STUDENT|UNIVERSITY|COLLEGE|HIGH\s+SCHOOL|POLYTECHNIC|INSTITUTE|CAMPUS|\bLRN\b|SR[-\s]?CODE|\.EDU\.PH/.test(
      upper,
    )
  ) {
    return 'school_id'
  }
  return null
}

function normalizeOcrIdToken(rawToken: string): string {
  const cleaned = rawToken.toUpperCase().replace(/[^A-Z0-9\-]/g, '').replace(/^-+|-+$/g, '')
  if (!cleaned) return ''

  const digitCount = (cleaned.match(/\d/g) || []).length
  const alphaCount = (cleaned.match(/[A-Z]/g) || []).length

  if (digitCount >= alphaCount && digitCount >= 3) {
    // Fix common OCR confusion in numeric portions while keeping a leading alpha prefix if present
    const leadingAlphaMatch = cleaned.match(/^([A-Z]{1,3})([\d\-OILSZB]{4,})$/)
    const mapNumeric = (segment: string) =>
      segment
        .replace(/[OQ]/g, '0')
        .replace(/[IL|]/g, '1')
        .replace(/S/g, '5')
        .replace(/B/g, '8')
        .replace(/Z/g, '2')

    if (leadingAlphaMatch) {
      return `${leadingAlphaMatch[1]}${mapNumeric(leadingAlphaMatch[2])}`
    }
    return mapNumeric(cleaned)
  }

  return cleaned
}

function extractIdNumberFromText(upper: string, lines: string[]): string {
  for (let i = 0; i < lines.length; i += 1) {
    const lineUpper = lines[i].toUpperCase()
    const match = lineUpper.match(new RegExp(`${ID_LABEL_PREFIX_RE.source}\\s*[:.\\-]?\\s*(.*)$`, 'i'))
    if (!match) continue

    const segments = [match[1] || '', i + 1 < lines.length ? lines[i + 1].toUpperCase() : '']
    for (const seg of segments) {
      const candidateMatch = seg.match(
        /(?:CRN[-\s:]?)?[A-Z0-9]{2,4}(?:[-\s][A-Z0-9]{2,8}){1,3}|[A-Z0-9]{6,16}/,
      )
      if (!candidateMatch?.[0]) continue
      const normalized = normalizeOcrIdToken(candidateMatch[0].replace(/\s+/g, '-'))
      if (normalized.length >= 5 && /\d{3,}/.test(normalized)) {
        return normalized
      }
    }
  }

  const patterns = [
    /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/, // PhilSys 16-digit PCN
    /\b[A-Z]\d{2}[-\s]\d{2}[-\s]\d{6}\b/, // LTO Driver's License
    /\bCRN[-\s:]?\d{4}[-\s]?\d{7}[-\s]?\d\b/, // UMID CRN
    /\b[A-Z]{1,2}\d{7}[A-Z]?\b/, // Passport
    /\b\d{2,4}[-\s]\d{4,8}\b/, // School / Student ID (e.g. 24-31051 or 2024-10452)
  ]

  for (const re of patterns) {
    const match = upper.match(re)
    if (match?.[0]) {
      return match[0].replace(/\s+/g, '-').trim()
    }
  }
  return ''
}

function isBoilerplateLine(candidate: string): boolean {
  return BOILERPLATE_RE.test(candidate) || ACADEMIC_OR_URL_RE.test(candidate)
}

function isPlausibleNameLine(candidate: string): boolean {
  if (!candidate || candidate.length < 4 || candidate.length > 52) return false
  if (/\d/.test(candidate)) return false
  if (NON_NAME_CHARS_RE.test(candidate.replace(/,/g, ''))) return false
  if (isBoilerplateLine(candidate)) return false
  const words = candidate.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean)
  return words.length >= 2 && words.length <= 5 && words.every((w) => w.length >= 2 || /^[A-Za-zÑñ]\.?$/.test(w))
}

function isPlausibleNameFragment(candidate: string): boolean {
  if (!candidate || candidate.length < 2 || candidate.length > 36) return false
  if (/\d/.test(candidate)) return false
  if (NON_NAME_CHARS_RE.test(candidate.replace(/,/g, ''))) return false
  if (isBoilerplateLine(candidate)) return false
  const words = candidate.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean)
  return (
    words.length >= 1 &&
    words.length <= 4 &&
    words.every((w) => /^[A-Za-zÑñ]{2,}\.?$/.test(w) || /^[A-Za-zÑñ]\.$/.test(w))
  )
}

function reorderLastFirstComma(raw: string): string {
  if (!raw.includes(',')) return raw
  const [lastPart, restPart] = raw.split(',', 2)
  if (!restPart?.trim()) return lastPart.trim()
  return `${restPart.trim()} ${lastPart.trim()}`
}

function extractLabeledField(lines: string[], labelRe: RegExp): string {
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const inline = line.match(new RegExp(`(?:${labelRe.source})\\s*[:\\-]?\\s*(.+)$`, 'i'))
    if (inline?.[1] && !/^\s*\//.test(inline[1])) {
      const cleaned = cleanCandidateLine(inline[1])
      if (
        !isBoilerplateLine(cleaned) &&
        (isPlausibleNameLine(cleaned) || /^[A-Za-zÑñ.\-\s]{2,30}$/.test(cleaned))
      ) {
        return cleaned
      }
    }
    if (labelRe.test(line) && i + 1 < lines.length) {
      const nextCleaned = cleanCandidateLine(lines[i + 1])
      if (/^[A-Za-zÑñ.\-\s,]{2,45}$/.test(nextCleaned) && !isBoilerplateLine(nextCleaned)) {
        return nextCleaned
      }
    }
  }
  return ''
}

function extractUnlabeledName(lines: string[]): string {
  interface Fragment {
    index: number
    cleaned: string
    wordCount: number
    isAllCaps: boolean
  }

  const fragments: Fragment[] = []
  for (let i = 0; i < lines.length; i += 1) {
    const rawLine = lines[i]
    if (ACADEMIC_OR_URL_RE.test(rawLine)) continue
    if (i + 1 < lines.length && INSTITUTION_TITLE_FOLLOW_RE.test(lines[i + 1])) continue

    const cleaned = cleanCandidateLine(rawLine)
    if (!isPlausibleNameFragment(cleaned)) continue

    const wordCount = cleaned.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean).length
    const isAllCaps = cleaned === cleaned.toUpperCase() && /[A-Z]/.test(cleaned)
    fragments.push({ index: i, cleaned, wordCount, isAllCaps })
  }

  let bestName = ''
  let bestScore = -1

  const considerCandidate = (candidate: string, score: number) => {
    const normalized = reorderLastFirstComma(candidate)
    if (!isPlausibleNameLine(normalized)) return
    if (score > bestScore) {
      bestScore = score
      bestName = normalized
    }
  }

  for (let i = 0; i < fragments.length; i += 1) {
    const curr = fragments[i]
    const hasInitial = /\b[A-Z]\./.test(curr.cleaned)
    let singleScore = curr.isAllCaps ? 3 : 1
    if (curr.wordCount >= 2 && curr.wordCount <= 4) singleScore += 2
    if (hasInitial) singleScore += 1
    considerCandidate(curr.cleaned, singleScore)

    if (i + 1 < fragments.length) {
      const next = fragments[i + 1]
      const areAdjacent = next.index === curr.index + 1
      const totalWords = curr.wordCount + next.wordCount
      if (areAdjacent && curr.wordCount <= 3 && next.wordCount <= 2 && totalWords >= 2 && totalWords <= 5) {
        const merged = `${curr.cleaned} ${next.cleaned}`
        let mergedScore = curr.isAllCaps && next.isAllCaps ? 5 : 3
        if (/\b[A-Z]\./.test(merged)) mergedScore += 2
        if (totalWords >= 2 && totalWords <= 4) mergedScore += 2
        considerCandidate(merged, mergedScore)
      }
    }
  }

  return bestName
}

/** Parse raw OCR text from Philippine IDs (PhilSys, Driver's License, School ID, UMID, etc.). */
export function parsePhilippineIdText(
  rawText: string,
  confidence: number,
  fallbackType: SupportedIdType = 'philsys',
): ParsedIdOcrResult {
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  const upper = rawText.toUpperCase()

  const detectedType = detectExplicitIdType(upper) ?? fallbackType
  const idNumber = extractIdNumberFromText(upper, lines)

  let extractedName = ''
  const combinedLabelFull = extractLabeledField(
    lines,
    /(?:LAST\s*NAMES?.*FIRST\s*NAMES?|FULL\s*NAME)/i,
  )
  if (combinedLabelFull && isPlausibleNameLine(combinedLabelFull)) {
    extractedName = reorderLastFirstComma(combinedLabelFull)
  }

  if (!extractedName) {
    const individualLines = lines.filter((l) => !/LAST\s*NAMES?.*FIRST\s*NAMES?/i.test(l))
    const lastName = extractLabeledField(individualLines, /(?:LAST\s*NAMES?|SURNAME|APELYIDO)/i)
    const givenName = extractLabeledField(individualLines, /(?:GIVEN\s*NAMES?|FIRST\s*NAMES?|MGA\s*PANGALAN)/i)
    const middleName = extractLabeledField(individualLines, /(?:MIDDLE\s*NAMES?|GITNANG\s*(?:APELYIDO|PANGALAN))/i)

    if (givenName && lastName) {
      extractedName = [givenName, middleName, lastName].filter(Boolean).join(' ')
    } else {
      const simpleLabelName = extractLabeledField(individualLines, /(?:\bNAME\b)/i)
      if (simpleLabelName && isPlausibleNameLine(simpleLabelName)) {
        extractedName = reorderLastFirstComma(simpleLabelName)
      }
    }
  }

  if (!extractedName) {
    extractedName = extractUnlabeledName(lines)
  }

  const formattedName = extractedName ? toTitleCaseName(extractedName) : ''
  const needsReview = !formattedName || confidence < 62

  return {
    detectedType,
    fullName: formattedName,
    idNumber,
    confidence: Math.round(confidence),
    needsReview,
    rawText,
  }
}

/** Check captured/uploaded ID canvas resolution, brightness, and sharpness before OCR. */
export function assessIdImageQuality(canvas: HTMLCanvasElement): IdImageQualityResult {
  if (canvas.width < 320 || canvas.height < 200) {
    return {
      ok: false,
      brightness: 0,
      sharpness: 0,
      reason: 'ID image resolution is too low. Move closer or upload a clearer photo.',
    }
  }

  const targetWidth = Math.min(320, canvas.width)
  const scale = targetWidth / canvas.width
  const width = Math.max(64, Math.round(canvas.width * scale))
  const height = Math.max(48, Math.round(canvas.height * scale))

  const probe = document.createElement('canvas')
  probe.width = width
  probe.height = height
  const ctx = probe.getContext('2d')
  if (!ctx) {
    return { ok: true, brightness: 128, sharpness: 100 }
  }

  ctx.drawImage(canvas, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)
  const totalPixels = width * height
  const luma = new Float32Array(totalPixels)

  let sumBrightness = 0
  for (let i = 0; i < totalPixels; i += 1) {
    const idx = i * 4
    const y = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2]
    luma[i] = y
    sumBrightness += y
  }
  const brightness = sumBrightness / totalPixels

  let lapSum = 0
  let lapSqSum = 0
  let edgeCount = 0
  for (let y = 1; y < height - 1; y += 1) {
    const rowOffset = y * width
    for (let x = 1; x < width - 1; x += 1) {
      const idx = rowOffset + x
      const lap = 4 * luma[idx] - luma[idx - 1] - luma[idx + 1] - luma[idx - width] - luma[idx + width]
      lapSum += lap
      lapSqSum += lap * lap
      edgeCount += 1
    }
  }
  const meanLap = edgeCount > 0 ? lapSum / edgeCount : 0
  const sharpness = edgeCount > 0 ? lapSqSum / edgeCount - meanLap * meanLap : 0

  if (brightness < 38) {
    return {
      ok: false,
      brightness,
      sharpness,
      reason: 'ID photo is too dark. Retake in a brighter area without shadows.',
    }
  }
  if (brightness > 240) {
    return {
      ok: false,
      brightness,
      sharpness,
      reason: 'ID photo has too much glare or overexposure. Tilt slightly to remove reflections.',
    }
  }
  if (sharpness < 18) {
    return {
      ok: false,
      brightness,
      sharpness,
      reason: 'ID photo appears too blurry to read. Hold steady and capture again.',
    }
  }

  return { ok: true, brightness, sharpness }
}

function getIdTypeLabel(idType: SupportedIdType): string {
  return ID_TYPE_OPTIONS.find((opt) => opt.value === idType)?.label ?? idType
}

/** Verify OCR output contains readable ID content consistent with the selected ID Type. */
export function validateSelectedIdType(
  rawText: string,
  selectedType: SupportedIdType,
  detectedIdNumber = '',
): IdTypeValidationResult {
  const alnumOnly = (rawText || '').replace(/[^A-Za-z0-9]/g, '')
  if (alnumOnly.length < 10) {
    return {
      matched: false,
      detectedType: null,
      reason: 'No readable ID text was detected. Hold a valid ID clearly inside the frame and retake.',
    }
  }

  const upper = rawText.toUpperCase()
  const detectedType = detectExplicitIdType(upper)

  if (selectedType === 'other_gov_id') {
    return { matched: true, detectedType }
  }

  if (detectedType && detectedType !== selectedType) {
    return {
      matched: false,
      detectedType,
      reason: `Detected ${getIdTypeLabel(detectedType)}, which does not match your selected ID Type (${getIdTypeLabel(selectedType)}). Select the matching ID Type or upload the right card.`,
    }
  }

  if (selectedType === 'school_id' && !detectedType) {
    const hasSchoolMarkers =
      /\b(STATE|UNIVERSITY|COLLEGE|SCHOOL|CAMPUS|BACHELOR|ENGINEERING|TECHNOLOGY|BS|BA|STUDENT|SHS)\b|\.EDU|SR[-\s]?CODE|ID\s*NO/.test(
        upper,
      )
    if (!hasSchoolMarkers && !detectedIdNumber) {
      return {
        matched: false,
        detectedType: null,
        reason: 'This image does not look like a School / Student ID. Ensure school details and ID number are visible.',
      }
    }
  }

  if (!detectedType && !detectedIdNumber) {
    const linesCount = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean).length
    if (linesCount < 3) {
      return {
        matched: false,
        detectedType: null,
        reason: `Could not confirm this image as a ${getIdTypeLabel(selectedType)}. Capture the full front of your ID clearly.`,
      }
    }
  }

  return { matched: true, detectedType: detectedType ?? selectedType }
}

function normalizeNameTokens(raw: string): string[] {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 2)
}

function levenshtein(a: string, b: string): number {
  const dp: number[] = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i += 1) {
    let prev = dp[0]
    dp[0] = i
    for (let j = 1; j <= b.length; j += 1) {
      const next =
        a[i - 1] === b[j - 1]
          ? prev
          : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = dp[j]
      dp[j] = next
    }
  }
  return dp[b.length]
}

/** Fuzzy-match Step 1 Account Name against the OCR-extracted ID name. */
export function compareAccountAndIdNames(accountName: string, ocrName: string): NameMatchResult {
  const accountTokens = normalizeNameTokens(accountName)
  const ocrTokens = normalizeNameTokens(ocrName)
  if (!accountTokens.length || !ocrTokens.length) {
    return { matched: true, score: 1 }
  }

  let matchedCount = 0
  for (const accTok of accountTokens) {
    const maxDist = accTok.length >= 7 ? 2 : 1
    const found = ocrTokens.some(
      (ocrTok) => ocrTok === accTok || levenshtein(accTok, ocrTok) <= maxDist,
    )
    if (found) matchedCount += 1
  }

  const ratio = matchedCount / accountTokens.length
  const required = Math.min(2, accountTokens.length)
  const matched = matchedCount >= required || ratio >= 0.65

  if (matched) {
    return { matched: true, score: ratio }
  }

  return {
    matched: false,
    score: ratio,
    warning: `ID name ("${ocrName}") does not match your Account Name ("${accountName}"). Confirm the correct ID or return to Step 1 to update your name.`,
  }
}

function preprocessIdCanvas(source: HTMLCanvasElement): HTMLCanvasElement {
  const targetWidth = Math.min(1400, Math.max(960, source.width))
  const scale = targetWidth / Math.max(1, source.width)
  const out = document.createElement('canvas')
  out.width = Math.round(source.width * scale)
  out.height = Math.round(source.height * scale)

  const ctx = out.getContext('2d')
  if (!ctx) return source

  ctx.filter = 'grayscale(100%) contrast(130%) brightness(105%)'
  ctx.drawImage(source, 0, 0, out.width, out.height)
  return out
}

/** Run self-hosted Tesseract WASM OCR on an ID image/canvas and parse PH ID fields. */
export async function scanPhilippineId(
  sourceCanvas: HTMLCanvasElement,
  fallbackType: SupportedIdType,
): Promise<ParsedIdOcrResult> {
  const { createWorker } = await import('tesseract.js')
  const prepared = preprocessIdCanvas(sourceCanvas)

  const worker = await createWorker('eng', 1, {
    workerPath: '/ocr/worker.min.js',
    workerBlobURL: false,
    corePath: '/ocr/core',
    langPath: '/ocr',
  })

  try {
    const result = await worker.recognize(prepared)
    return parsePhilippineIdText(result.data.text || '', result.data.confidence || 0, fallbackType)
  } finally {
    await worker.terminate()
  }
}
