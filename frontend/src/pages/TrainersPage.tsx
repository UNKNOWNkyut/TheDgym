import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'

/*
 * TRAINERS NOTE:
 * Trainer names and individual credentials are [PLACEHOLDER].
 * Not verified from client or public source.
 * Cards use placeholder structure — client must supply trainer profiles.
 */

export function TrainersPage() {
  const heroRef = useRef<HTMLDivElement>(null)

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
        description="Personal training and dedicated coaching at The DGym Rosario Batangas. One-on-one progressive programming."
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
              <Link to="/contact">
                <Button size="lg">Inquire for PT Sessions</Button>
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

        {/* The Coaching Team Section with real photos */}
        <div className="mb-20">
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">
              The DGym Staff
            </p>
            <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white">
              Our Coaching Team
            </h2>
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

        {/* CTA */}
        <div className="p-8 md:p-12 rounded-2xl border border-red/20 bg-red/5 text-center">
          <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-wide text-white mb-3">
            Ready to train with a DGym Coach?
          </h2>
          <p className="text-sm text-white/60 mb-8 max-w-md mx-auto leading-relaxed">
            Message us on Facebook or submit an inquiry to discuss coach availability, program goals, and personal training packages in Rosario, Batangas.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link to="/contact"><Button size="lg">Contact Us</Button></Link>
            <a href="https://www.facebook.com/profile.php?id=61577169056417" target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="lg">Facebook Page</Button>
            </a>
          </div>
        </div>
      </div>
    </>
  )
}
