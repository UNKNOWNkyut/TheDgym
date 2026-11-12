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
  /\b(REPUBLIC|PHILIPPINES|REPUBLIKA|PILIPINAS|PHILIPPINE|STATISTICS|AUTHORITY|LAND\s+TRANSPORTATION|TRANSPORTATION|DEPARTMENT|OFFICE|DRIVER|LICENSE|IDENTIFICATION|CARD|NATIONAL|UNIFIED|MULTI[-\s]?PURPOSE|STUDENT|UNIVERSITY|COLLEGE|SCHOOL|PAMBANSANG|PAGKAKAKILANLAN|GIVEN\s+NAMES?|LAST\s+NAMES?|MIDDLE\s+NAMES?|SURNAME|FIRST\s+NAMES?|MGA\s+PANGALAN|GITNANG|PANGALAN|APELYIDO|DATE\s+OF\s+BIRTH|BIRTHDATE|ADDRESS|SIGNATURE|SEX|NATIONALITY|BLOOD|HEIGHT|WEIGHT|EXPIRATION|AGENCY|VALID|UNTIL|ISSUED|PASSPORT)\b/i

const NON_NAME_CHARS_RE = /[^A-Za-zÑñ.\-\s]/

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

function detectIdTypeFromText(upper: string, fallbackType: SupportedIdType): SupportedIdType {
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
  if (/STUDENT|UNIVERSITY|COLLEGE|HIGH\s+SCHOOL|POLYTECHNIC|INSTITUTE|CAMPUS|LRN|ID\s*NO/.test(upper)) {
    return 'school_id'
  }
  return fallbackType
}

function extractIdNumberFromText(upper: string): string {
  const patterns = [
    /\b\d{4}[-\s]\d{4}[-\s]\d{4}[-\s]\d{4}\b/, // PhilSys 16-digit PCN
    /\b[A-Z]\d{2}[-\s]\d{2}[-\s]\d{6}\b/, // LTO Driver's License
    /\bCRN[-\s:]?\d{4}[-\s]?\d{7}[-\s]?\d\b/, // UMID CRN
    /\b[A-Z]{1,2}\d{7}[A-Z]?\b/, // Passport
    /\b(?:20\d{2}|19\d{2})[-\s]?\d{4,7}\b/, // Common PH School/Student ID (e.g. 24-31051 or 2023-10452)
    /\b\d{2,4}[-\s]\d{4,8}\b/,
  ]

  for (const re of patterns) {
    const match = upper.match(re)
    if (match?.[0]) {
      return match[0].replace(/\s+/g, '-').trim()
    }
  }
  return ''
}

function isPlausibleNameLine(candidate: string): boolean {
  if (!candidate || candidate.length < 4 || candidate.length > 52) return false
  if (/\d/.test(candidate)) return false
  if (NON_NAME_CHARS_RE.test(candidate.replace(/,/g, ''))) return false
  if (BOILERPLATE_RE.test(candidate)) return false
  const words = candidate.replace(/,/g, ' ').trim().split(/\s+/).filter(Boolean)
  return words.length >= 2 && words.length <= 5 && words.every((w) => w.length >= 2 || w.endsWith('.'))
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
        !BOILERPLATE_RE.test(cleaned) &&
        (isPlausibleNameLine(cleaned) || /^[A-Za-zÑñ.\-\s]{2,30}$/.test(cleaned))
      ) {
        return cleaned
      }
    }
    if (labelRe.test(line) && i + 1 < lines.length) {
      const nextCleaned = cleanCandidateLine(lines[i + 1])
      if (/^[A-Za-zÑñ.\-\s,]{2,45}$/.test(nextCleaned) && !BOILERPLATE_RE.test(nextCleaned)) {
        return nextCleaned
      }
    }
  }
  return ''
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

  const detectedType = detectIdTypeFromText(upper, fallbackType)
  const idNumber = extractIdNumberFromText(upper)

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
    for (const rawLine of lines) {
      const cleaned = cleanCandidateLine(rawLine)
      if (isPlausibleNameLine(cleaned)) {
        extractedName = reorderLastFirstComma(cleaned)
        break
      }
    }
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
