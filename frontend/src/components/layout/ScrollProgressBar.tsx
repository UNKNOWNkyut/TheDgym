import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin()

export function ScrollProgressBar() {
  const barRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    const bar = barRef.current
    if (!bar) return

    const updateProgress = () => {
      const scrollTop = window.scrollY
      const docHeight = document.documentElement.scrollHeight - window.innerHeight
      const progress = docHeight > 0 ? scrollTop / docHeight : 0

      gsap.set(bar, { scaleX: progress, transformOrigin: 'left center' })
    }

    window.addEventListener('scroll', updateProgress, { passive: true })
    updateProgress()

    return () => {
      window.removeEventListener('scroll', updateProgress)
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[60] h-[2px] bg-surface-2"
    >
      <div
        ref={barRef}
        className="h-full bg-red origin-left scale-x-0"
        style={{ willChange: 'transform' }}
      />
    </div>
  )
}
