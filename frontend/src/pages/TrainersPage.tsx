import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/context/AuthContext'
import { OFFICIAL_COACHES, OFFICIAL_PT_PACKAGES } from '@/constants/coaches'
import { GYM_INFO } from '@/constants/gymInfo'

/*
 * TRAINERS NOTE:
 * Official coaches and 12-session PT packages verified from TDGGYM-QUESTIONNAIRES-1.
 */

export function TrainersPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated, user } = useAuth()
  const bookingHref =
    isAuthenticated && user?.has_active_membership ? '/manage/book-pt' : '/contact'
  const bookingLabel =
    isAuthenticated && user?.has_active_membership
      ? 'Book a PT Session'
      : 'Inquire for PT Sessions'

  useGSAP(() => {
    if (!heroRef.current) return
    gsap.fromTo(
      heroRef.current.querySelectorAll('.hero-item'),
      { opacity: 0, y: 36 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
    )
  }, { scope: heroRef })

  return (
    <>
      <SEO
        title="Personal Trainers & Coaches"
        description="Train with Coach Ivan, Coach Marta, and Coach Kresler at The DGym Rosario Batangas. Official 12-session Muscle Gain and Boxing packages."
        canonical="https://thedgym.com/trainers"
        ogImage="/assets/images/img4.jpg"
      />

      {/* Hero */}
      <div ref={heroRef} className="border-b border-white/8 section-padding">
        <div className="container-dgym">
          <p className="hero-item text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Coaching • Rosario, Batangas
          </p>
          <h1 className="hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-white mb-4 max-w-2xl">
            Train With<br />Our Coaches
          </h1>
          <p className="hero-item text-lg text-white/60 max-w-lg leading-relaxed">
            One-on-one coaching and progressive overload programming built around your goals. Not a cookie-cutter routine — your plan.
          </p>
        </div>
      </div>

      {/* What PT offers */}
      <div className="container-dgym py-16 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">
              Why personal training
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white mb-6">
              Faster Progress.<br />Fewer Wasted Sessions.
            </h2>
            <div className="space-y-4 mb-8">
              {[
                'Individualized programming designed for your current fitness baseline and exact goals',
                'Strict technique coaching and form correction so you lift safely and heavily',
                'Accountability and consistency that keeps your training on track week after week',
                'Real-time load adjustments as you hit PRs and adapt to progressive overload',
              ].map((point) => (
                <div key={point} className="flex items-start gap-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-red mt-2 shrink-0" aria-hidden="true" />
                  <p className="text-base text-white/70">{point}</p>
                </div>
              ))}
            </div>
            <div>
              <Link to={bookingHref}>
                <Button size="lg">{bookingLabel}</Button>
              </Link>
            </div>
          </div>

          {/* Real Photo: 1-on-1 Coaching session in action */}
          <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-video lg:aspect-[4/3] shadow-2xl">
            <img
              src="/assets/images/img6.jpg"
              alt="Coach personal training session in action at The DGym Rosario Batangas"
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-4">
              <span className="text-xs font-semibold uppercase tracking-widest text-red">In Action</span>
              <p className="text-base font-bold text-white mt-0.5">Hands-On Form & Technique Coaching</p>
            </div>
          </div>
        </div>

        {/* Official Certified Coaches Roster */}
        <div className="mb-20">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
              Official Roster
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white">
              Meet Your Certified Coaches
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
            {OFFICIAL_COACHES.map((coach) => (
              <div
                key={coach.name}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-surface p-6 hover:border-white/20 transition-colors"
              >
                <div>
                  <p className="text-xs uppercase tracking-widest text-red font-semibold mb-1">
                    {coach.role}
                  </p>
                  <h3 className="font-display text-2xl font-bold uppercase tracking-wide text-white mb-1">
                    {coach.name}
                  </h3>
                  <p className="text-xs text-white/40 font-mono mb-4">
                    Focus: {coach.primaryFocus}
                  </p>
                  <p className="text-sm text-white/60 leading-relaxed mb-5">
                    {coach.bio}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-4 border-t border-white/8">
                  {coach.specialties.map((spec) => (
                    <Badge key={spec} variant="default" size="sm">
                      {spec}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
            {/* Team photo */}
            <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-video shadow-xl">
              <img
                src="/assets/images/img4.jpg"
                alt="The DGym Coaching Team in official uniform at Rosario, Batangas"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4">
                <span className="text-xs font-semibold uppercase tracking-widest text-red">Official Staff</span>
                <p className="text-base font-bold text-white mt-0.5">The DGym Certified Coaches</p>
              </div>
            </div>

            {/* Coach Creed & Details */}
            <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-surface-2 aspect-video shadow-xl">
              <img
                src="/assets/images/img5.jpg"
                alt="The DGym Coach shirt with Philippians 4:13 verse"
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6">
                <span className="text-xs font-semibold uppercase tracking-widest text-red">Coach Standard</span>
                <p className="text-lg font-bold text-white mt-1">"I Can Do All Things Through Christ Who Strengthens Me"</p>
                <p className="text-xs text-white/50 mt-1 uppercase tracking-wider">Philippians 4:13</p>
              </div>
            </div>
          </div>
        </div>

        {/* Official Personal Training Packages */}
        <div className="mb-20">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-2">
              1-on-1 Coaching Rates
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white">
              Personal Training Packages
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {OFFICIAL_PT_PACKAGES.map((pkg) => (
              <div
                key={pkg.id}
                className="flex flex-col justify-between rounded-2xl border border-white/10 bg-surface p-7 hover:border-white/20 transition-colors"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <Badge variant="red" size="sm">
                      {pkg.sessionsCount} Sessions
                    </Badge>
                    <span className="text-xs text-white/40 font-mono">
                      {pkg.durationLabel}
                    </span>
                  </div>

                  <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white mb-2">
                    {pkg.name}
                  </h3>

                  <p className="text-3xl font-bold font-mono text-white mb-3">
                    {pkg.priceFormatted}
                  </p>

                  <p className="text-xs uppercase tracking-widest text-white/40 mb-3">
                    Assigned: <span className="text-white/80">{pkg.coachesLabel}</span>
                  </p>

                  <p className="text-sm text-white/60 leading-relaxed mb-6">
                    {pkg.description}
                  </p>
                </div>

                <Link to={bookingHref}>
                  <Button fullWidth variant="secondary">
                    {bookingLabel}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="p-8 md:p-12 rounded-2xl border border-red/20 bg-red/5 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wide text-white mb-3">
            Ready to train with a DGym Coach?
          </h2>
          <p className="text-sm text-white/60 mb-8 max-w-md mx-auto leading-relaxed">
            Call {GYM_INFO.phoneDisplay}, message us on Facebook, or submit an inquiry to start your 12-session Muscle Gain or Boxing package in Rosario, Batangas.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to={bookingHref}><Button size="lg">{bookingLabel}</Button></Link>
            <a href={GYM_INFO.facebookUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="lg">Facebook Page</Button>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
