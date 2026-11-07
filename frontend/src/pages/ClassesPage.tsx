import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { useAuth } from '@/context/AuthContext'
import { api } from '@/services/api'
import { CLASS_TYPE_LABELS, OFFICIAL_GROUP_CLASSES } from '@/constants/coaches'
import type { ClassSession } from '@/types/auth'

gsap.registerPlugin(ScrollTrigger)

/*
 * CLASS CONTENT NOTE:
 * Official group classes (TABATA w/ Coach Marta & HIIT w/ Coach Kresler — Every 6:00 PM, ₱0 free w/ membership)
 * verified from TDGGYM-QUESTIONNAIRES-1.
 */

export function ClassesPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated } = useAuth()
  const [liveSessions, setLiveSessions] = useState<ClassSession[]>([])
  const visibleSessions = isAuthenticated ? liveSessions : []

  useEffect(() => {
    if (!isAuthenticated) return
    let active = true
    api
      .getClassSessions({ status: 'scheduled', limit: 6 })
      .then((rows) => {
        if (active) setLiveSessions(rows)
      })
      .catch(() => {
        if (active) setLiveSessions([])
      })
    return () => {
      active = false
    }
  }, [isAuthenticated])

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
        description="Free 6:00 PM TABATA (Coach Marta) and HIIT (Coach Kresler) group fitness classes at The DGym in Rosario, Batangas."
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
            Unlimited free (₱0) access to our 6:00 PM TABATA and HIIT group sessions for all active members—led by Coach Marta and Coach Kresler.
          </p>
        </div>
      </div>

      {/* Official Group Classes grid */}
      <div ref={listRef} className="container-dgym section-padding">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-16">
          {OFFICIAL_GROUP_CLASSES.map((cls) => (
            <div
              key={cls.name}
              className="class-card group p-7 rounded-2xl border border-white/10 bg-surface hover:border-white/20 transition-all duration-200 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-1">
                      {cls.category}
                    </p>
                    <h2 className="font-display text-3xl font-bold uppercase tracking-wide text-white">
                      {cls.name}
                    </h2>
                  </div>
                  <Badge variant="success" dot>{cls.rateLabel}</Badge>
                </div>

                <p className="text-sm text-white/60 leading-relaxed mb-6">
                  {cls.description}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm border-t border-white/10 pt-4">
                <div>
                  <span className="block text-white/40 uppercase text-[11px] tracking-widest mb-0.5">
                    Instructor
                  </span>
                  <span className="text-white font-medium">{cls.coachName}</span>
                </div>
                <div>
                  <span className="block text-white/40 uppercase text-[11px] tracking-widest mb-0.5">
                    Time
                  </span>
                  <span className="text-white font-medium">{cls.scheduleTime}</span>
                </div>
                <div>
                  <span className="block text-white/40 uppercase text-[11px] tracking-widest mb-0.5">
                    Level
                  </span>
                  <span className="text-white/80">{cls.level}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Live Scheduled Sessions from API (for signed-in members/staff) */}
        {visibleSessions.length > 0 && (
          <div className="mb-16">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
                Live Portal Schedule
              </p>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                Upcoming Scheduled Sessions
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleSessions.map((session) => (
                <div
                  key={session.id}
                  className="p-5 rounded-xl border border-white/10 bg-surface flex items-center justify-between gap-4"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="default" size="sm">
                        {CLASS_TYPE_LABELS[session.class_type] ?? session.class_type}
                      </Badge>
                      {session.coach_name && (
                        <span className="text-xs text-white/50">{session.coach_name}</span>
                      )}
                    </div>
                    <h3 className="text-base font-semibold text-white">{session.name}</h3>
                    <p className="text-xs text-white/40 font-mono mt-0.5">
                      {new Date(session.scheduled_at).toLocaleString('en-PH', {
                        timeZone: 'Asia/Manila',
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                      {' • '}
                      {session.duration_minutes} mins
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-mono text-white/70">
                      {session.enrolled_count}/{session.max_capacity} slots
                    </p>
                    <p className="text-[11px] text-green-400">Free w/ Plan</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

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
            Unlimited free (₱0) access to all 6:00 PM group classes is included with every active membership.
          </p>
          <Link to="/membership">
            <Button size="lg">See Membership Plans</Button>
          </Link>
        </div>
      </div>
    </>
  )
}
