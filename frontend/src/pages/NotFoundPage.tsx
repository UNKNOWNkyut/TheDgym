import { Link } from 'react-router-dom'
import { useRef } from 'react'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'

export function NotFoundPage() {
  const containerRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
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
        },
      )
    },
    { scope: containerRef },
  )

  return (
    <>
      <SEO
        title="Page Not Found"
        description="The requested page could not be found on The DGym website."
        noIndex
      />

      <div
        ref={containerRef}
        className="flex flex-col items-center justify-center flex-1 text-center section-padding px-4"
      >
        <p className="not-found-animate text-xs font-mono font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/50 mb-4">
          Error 404
        </p>
        <h1 className="not-found-animate font-display text-7xl md:text-9xl font-black uppercase tracking-tight text-zinc-950 dark:text-white leading-none mb-4">
          Lost?
        </h1>
        <p className="not-found-animate text-base text-zinc-600 dark:text-white/60 max-w-md mb-8 leading-relaxed">
          This page doesn&apos;t exist or may have moved. Head back to the main floor.
        </p>
        <div className="not-found-animate flex flex-wrap items-center justify-center gap-4">
          <Link
            to="/"
            className="inline-flex items-center justify-center gap-2 font-semibold rounded-lg text-base px-8 py-4 min-h-[52px] bg-red text-white hover:bg-red-hover hover:shadow-[0_0_24px_rgba(229,32,26,0.4)] active:scale-[0.97] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-zinc-900/50 dark:focus-visible:outline-white/50 focus-visible:outline-offset-2"
          >
            Back to Home
          </Link>
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 font-semibold rounded-lg text-base px-8 py-4 min-h-[52px] border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white bg-white/80 dark:bg-transparent hover:bg-white dark:hover:bg-white/5 hover:border-zinc-400 dark:hover:border-white/25 active:scale-[0.97] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-zinc-900/50 dark:focus-visible:outline-white/50 focus-visible:outline-offset-2"
          >
            Contact Us
          </Link>
        </div>
      </div>
    </>
  )
}
