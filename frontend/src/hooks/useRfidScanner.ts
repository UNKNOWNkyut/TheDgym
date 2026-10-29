import { useEffect, useRef } from 'react'

export function playAccessChime(
  tone: 'granted' | 'denied' | 'checkout',
  muted = false,
): void {
  if (muted || typeof window === 'undefined') return
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const now = ctx.currentTime

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    if (tone === 'granted') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(660, now)
      osc.frequency.setValueAtTime(880, now + 0.08)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (tone === 'checkout') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(784, now)
      osc.frequency.setValueAtTime(587, now + 0.09)
      gain.gain.setValueAtTime(0.07, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24)
      osc.start(now)
      osc.stop(now + 0.25)
    } else {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(240, now)
      osc.frequency.setValueAtTime(180, now + 0.12)
      gain.gain.setValueAtTime(0.11, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.34)
      osc.start(now)
      osc.stop(now + 0.35)
    }
  } catch {
    // Ignore audio context autoplay restrictions gracefully
  }
}

interface UseRfidScannerOptions {
  enabled?: boolean
  onScan: (cardUid: string) => void
}

/**
 * Listens for high-speed USB HID Keyboard-Wedge RFID/NFC scanner bursts
 * (< 50ms inter-keystroke interval ending in Enter) without interfering
 * with normal staff typing inside form inputs.
 */
export function useRfidScanner({ enabled = true, onScan }: UseRfidScannerOptions): void {
  const bufferRef = useRef<string>('')
  const lastKeyTimeRef = useRef<number>(0)
  const onScanRef = useRef(onScan)
  onScanRef.current = onScan

  useEffect(() => {
    if (!enabled) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isCaptureInput = target?.getAttribute('data-rfid-capture') === 'true'
      const isTypingField =
        target &&
        !isCaptureInput &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)

      if (isTypingField) {
        bufferRef.current = ''
        return
      }

      const now = performance.now()
      const delta = now - lastKeyTimeRef.current
      lastKeyTimeRef.current = now

      if (event.key === 'Enter') {
        const candidate = bufferRef.current.trim()
        bufferRef.current = ''
        if (candidate.length >= 4 && delta < 120) {
          event.preventDefault()
          onScanRef.current(candidate)
        }
        return
      }

      if (event.key.length === 1 && /^[a-zA-Z0-9:-]$/.test(event.key)) {
        if (delta > 80) {
          // Reset buffer if previous keystroke was human-speed rather than scanner burst
          bufferRef.current = event.key
        } else {
          bufferRef.current += event.key
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [enabled])
}
