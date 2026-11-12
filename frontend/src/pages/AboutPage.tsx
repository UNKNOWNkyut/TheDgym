import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { GYM_INFO } from '@/constants/gymInfo'

gsap.registerPlugin(ScrollTrigger)

interface StandardItem {
  label: string
  body: string
}

const STANDARDS: readonly StandardItem[] = [
  {
    label: 'Equipment',
    body: 'Technogym dumbbells, Rogue deadlift platforms, and precision plate-loaded machinery.',
  },
  {
    label: 'Coaching',
    body: 'Dedicated personal trainers who program around your specific goals, biomechanics, and progress.',
  },
  {
    label: 'Community',
    body: 'A welcoming training environment in Rosario, Batangas with lounge workspace, free Wi-Fi, and monthly fitness challenges.',
  },
]

export function AboutPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!heroRef.current) return
      gsap.fromTo(
        heroRef.current.querySelectorAll('.about-hero-item'),
        { opacity: 0, y: 40 },
        { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 },
      )
    },
    { scope: heroRef },
  )

  useGSAP(
    () => {
      if (!contentRef.current) return
      contentRef.current.querySelectorAll('.reveal').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
          },
        )
      })
    },
    { scope: contentRef },
  )

  return (
    <>
      <SEO
        title="About"
        description="Learn about The DGym Rosario Batangas — High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas."
        canonical="https://thedgym.com/about"
        ogImage="/assets/images/img15.jpg"
      />

      {/* Page header */}
      <div ref={heroRef} className="border-b border-zinc-200 dark:border-white/8 section-padding">
        <div className="container-dgym">
          <p className="about-hero-item text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-4">
            Our story • Rosario, Batangas
          </p>
          <h1 className="about-hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-zinc-950 dark:text-white mb-6 max-w-3xl">
            About The DGym
          </h1>
          <p className="about-hero-item text-lg text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
            High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas — built for people who demand real results.
          </p>
        </div>
      </div>

      <div ref={contentRef} className="container-dgym py-16 md:py-24 space-y-20">
        {/* Mission */}
        <div className="reveal grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">
              What we&apos;re about
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white mb-5">
              Elevate Your Fitness Journey
            </h2>
            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed mb-4 max-w-lg">
              The DGym Rosario Batangas was built with one purpose: give every lifter and athlete an environment where serious training thrives. Premium Technogym machines, Rogue powerlifting platforms, dedicated coaching, and an electric atmosphere.
            </p>
            <p className="text-base text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-lg">
              Located in Rosario, Batangas, we provide the community with an unmatched facility that never cuts corners on equipment quality or athletic support.
            </p>
          </div>

          {/* Visual block — uses real gym photo */}
          <div className="relative rounded-2xl overflow-hidden aspect-video lg:aspect-square">
            <img
              src="/assets/images/img15.jpg"
              alt="The DGym Rosario Batangas interior — plate-loaded machinery and Technogym equipment floor"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-black/60 to-transparent" />
            <div className="absolute bottom-4 left-4">
              <img
                src="/assets/logos/thedgym.png"
                alt=""
                aria-hidden="true"
                className="h-10 w-auto opacity-95 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
              />
            </div>
          </div>
        </div>

        {/* Values */}
        <div className="reveal">
          <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">
            What drives us
          </p>
          <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white mb-10">
            Our Standards
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {STANDARDS.map((v) => (
              <div
                key={v.label}
                className="p-6 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-surface hover:border-zinc-300 dark:hover:border-white/15 shadow-xs dark:shadow-none transition-colors duration-200"
              >
                <div className="w-1 h-8 bg-red rounded-full mb-4" aria-hidden="true" />
                <h3 className="font-display text-xl font-bold uppercase tracking-wide text-zinc-950 dark:text-white mb-2">
                  {v.label}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-white/65 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Location note */}
        <div className="reveal p-8 rounded-2xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-surface shadow-xs dark:shadow-none flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:text-white/45 mb-2">
              Location &amp; Hours
            </p>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-zinc-950 dark:text-white mb-1">
              {GYM_INFO.streetAddress}
            </h2>
            <p className="text-sm text-zinc-600 dark:text-white/65 mb-2">{GYM_INFO.landmark}</p>
            <p className="text-xs font-mono text-zinc-500 dark:text-white/55">
              {GYM_INFO.operatingHoursSummary}
            </p>
          </div>
          <div className="flex flex-wrap gap-3 shrink-0">
            <a
              href={GYM_INFO.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 font-semibold rounded-lg text-sm px-6 py-3 min-h-[44px] border border-zinc-300 dark:border-white/15 text-zinc-900 dark:text-white bg-zinc-50 dark:bg-transparent hover:bg-zinc-100 dark:hover:bg-white/5 hover:border-zinc-400 dark:hover:border-white/25 active:scale-[0.97] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-zinc-900/50 dark:focus-visible:outline-white/50 focus-visible:outline-offset-2"
            >
              Facebook Page
            </a>
            <Link
              to="/contact"
              className="inline-flex items-center justify-center gap-2 font-semibold rounded-lg text-sm px-6 py-3 min-h-[44px] bg-red text-white hover:bg-red-hover hover:shadow-[0_0_24px_rgba(229,32,26,0.4)] active:scale-[0.97] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-zinc-900/50 dark:focus-visible:outline-white/50 focus-visible:outline-offset-2"
            >
              Contact Us
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
