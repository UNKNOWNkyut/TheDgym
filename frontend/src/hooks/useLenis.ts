import { useEffect, useRef } from 'react'
import Lenis from 'lenis'

/**
 * Initializes Lenis smooth scroll on mount.
 * Returns the Lenis instance for use in animations.
 * Automatically destroyed on component unmount.
 *
 * Usage: Call once at the root layout level.
 */
export function useLenis() {
  const lenisRef = useRef<Lenis | null>(null)

  useEffect(() => {
    const lenis = new Lenis({
      lerp: 0.08,           // 0.08 = athletic, slightly snappy
      smoothWheel: true,
      syncTouch: false,     // Let native touch scroll on mobile
    })

    lenisRef.current = lenis

    let rafId: number

    function raf(time: number) {
      lenis.raf(time)
      rafId = requestAnimationFrame(raf)
    }

    rafId = requestAnimationFrame(raf)

    return () => {
      cancelAnimationFrame(rafId)
      lenis.destroy()
      lenisRef.current = null
    }
  }, [])

  return lenisRef
}
