import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'

export function BackToTop() {
  const [visible, setVisible] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useGSAP(() => {
    if (!btnRef.current) return
    gsap.to(btnRef.current, {
      opacity: visible ? 1 : 0,
      y: visible ? 0 : 12,
      pointerEvents: visible ? 'auto' : 'none',
      duration: 0.3,
      ease: 'power2.out',
    })
  }, [visible])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      ref={btnRef}
      onClick={scrollToTop}
      aria-label="Back to top"
      className={[
        'fixed bottom-6 right-6 z-50',
        'w-11 h-11 rounded-full',
        'bg-surface border border-white/15',
        'flex items-center justify-center',
        'text-white/70 hover:text-white hover:border-white/30',
        'transition-colors duration-150 cursor-pointer',
        'opacity-0 pointer-events-none',
        'focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2',
      ].join(' ')}
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Up chevron */}
      <svg
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    </button>
  )
}
