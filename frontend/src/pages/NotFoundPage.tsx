import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { Button } from '@/components/ui/Button'

export function NotFoundPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!containerRef.current) return
    gsap.fromTo(
      containerRef.current.querySelectorAll('.not-found-animate'),
      { opacity: 0, y: 24 },
      {
        opacity: 1,
        y: 0,
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.08,
      }
    )
  }, { scope: containerRef })

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center flex-1 text-center section-padding px-4"
    >
      <p className="not-found-animate text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
        Error 404
      </p>
      <h1 className="not-found-animate font-display text-7xl md:text-9xl font-black uppercase tracking-tight text-white leading-none mb-4">
        Lost?
      </h1>
      <p className="not-found-animate text-base text-white/50 max-w-sm mb-8">
        This page doesn't exist. Head back to the gym.
      </p>
      <div className="not-found-animate">
        <Link to="/">
          <Button size="lg">Back to Home</Button>
        </Link>
      </div>
    </div>
  )
}
