import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

gsap.registerPlugin(ScrollTrigger)

/*
 * CLASS CONTENT NOTE:
 * Specific class names, instructors, and schedule are [PLACEHOLDER].
 * General category types (Strength, Cardio, Group Training) are reasonable
 * for any gym context and do not constitute a fabricated business claim.
 * Actual schedule must be provided by client before Phase 2 is considered final.
 */

const CLASS_TYPES = [
  {
    category: 'Strength',
    name: 'Barbell Club',
    description: 'Structured progressive overload programming built around the big lifts.',
    days: '[PLACEHOLDER]',
    time: '[PLACEHOLDER]',
    level: 'Intermediate',
    levelVariant: 'warning' as const,
  },
  {
    category: 'Conditioning',
    name: 'Circuit Training',
    description: 'High-intensity rounds combining resistance and cardio work for full-body conditioning.',
    days: '[PLACEHOLDER]',
    time: '[PLACEHOLDER]',
    level: 'All Levels',
    levelVariant: 'success' as const,
  },
  {
    category: 'Strength',
    name: 'Functional Fitness',
    description: 'Movement patterns that carry over into everyday life and athletic performance.',
    days: '[PLACEHOLDER]',
    time: '[PLACEHOLDER]',
    level: 'Beginner',
    levelVariant: 'success' as const,
  },
  {
    category: 'Cardio',
    name: 'Endurance',
    description: 'Sustained effort training for cardiovascular base building and stamina.',
    days: '[PLACEHOLDER]',
    time: '[PLACEHOLDER]',
    level: 'All Levels',
    levelVariant: 'success' as const,
  },
]

export function ClassesPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!heroRef.current) return
    gsap.fromTo(
      heroRef.current.querySelectorAll('.hero-item'),
      { opacity: 0, y: 36 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
    )
  }, { scope: heroRef })

  useGSAP(() => {
    if (!listRef.current) return
    listRef.current.querySelectorAll('.class-card').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 28 }, {
        opacity: 1, y: 0, duration: 0.55, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      })
    })
  }, { scope: listRef })

  return (
    <>
      <SEO
        title="Group Classes & Training"
        description="Group fitness classes at The DGym in Rosario, Batangas. Strength, conditioning, functional fitness, and cardio."
        canonical="https://thedgym.com/classes"
        ogImage="/assets/images/img14.jpg"
      />

      {/* Hero */}
      <div ref={heroRef} className="border-b border-white/8 section-padding">
        <div className="container-dgym">
          <p className="hero-item text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Group Training • Rosario, Batangas
          </p>
          <h1 className="hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-white mb-4 max-w-2xl">
            Classes Built<br />Around Results
          </h1>
          <p className="hero-item text-lg text-white/60 max-w-lg leading-relaxed">
            Structured group training sessions led by DGym coaches. Train with purpose, surrounded by people who keep you going.
          </p>
        </div>
      </div>

      {/* Classes grid */}
      <div ref={listRef} className="container-dgym section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-16">
          {CLASS_TYPES.map((cls) => (
            <div
              key={cls.name}
              className="class-card group p-6 rounded-xl border border-white/8 bg-surface hover:border-white/15 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">
                    {cls.category}
                  </p>
                  <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
                    {cls.name}
                  </h2>
                </div>
                <Badge variant={cls.levelVariant} dot>{cls.level}</Badge>
              </div>

              <p className="text-sm text-white/55 leading-relaxed mb-5">
                {cls.description}
              </p>

              <div className="flex flex-wrap gap-4 text-sm text-white/30 border-t border-white/8 pt-4">
                <span>
                  <span className="text-white/20 uppercase text-xs tracking-widest mr-1.5">Days</span>
                  {cls.days}
                </span>
                <span>
                  <span className="text-white/20 uppercase text-xs tracking-widest mr-1.5">Time</span>
                  {cls.time}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Real community photos */}
        <div className="mb-16">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Class Atmosphere</p>
            <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">Community in Action</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-video relative group">
              <img
                src="/assets/images/img14.jpg"
                alt="Group fitness class training together on the turf at The DGym Rosario Batangas"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-red">Turf & Boxing Zone</span>
                <p className="text-sm font-bold text-white mt-0.5">High-energy conditioning and team training</p>
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-video relative group">
              <img
                src="/assets/images/img17.jpg"
                alt="The DGym community group class photo with trainers in Rosario, Batangas"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-red">Community Spirit</span>
                <p className="text-sm font-bold text-white mt-0.5">Supportive environment for every fitness level</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">
          <p className="text-sm text-white/40 mb-4">
            All classes are included with monthly and quarterly memberships.
          </p>
          <Link to="/membership">
            <Button size="lg">See Membership Plans</Button>
          </Link>
        </div>
      </div>
    </>
  )
}
