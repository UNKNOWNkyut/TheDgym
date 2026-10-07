import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Button } from '@/components/ui/Button'

gsap.registerPlugin(ScrollTrigger)

export function AboutPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (!heroRef.current) return
    gsap.fromTo(
      heroRef.current.querySelectorAll('.about-hero-item'),
      { opacity: 0, y: 40 },
      { opacity: 1, y: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 }
    )
  }, { scope: heroRef })

  useGSAP(() => {
    if (!contentRef.current) return
    contentRef.current.querySelectorAll('.reveal').forEach((el) => {
      gsap.fromTo(el, { opacity: 0, y: 28 }, {
        opacity: 1, y: 0, duration: 0.6, ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
      })
    })
  }, { scope: contentRef })

  return (
    <>
      <SEO
        title="About The DGym Rosario Batangas"
        description="Learn about The DGym Rosario Batangas — High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas."
        canonical="https://thedgym.com/about"
        ogImage="/assets/images/img15.jpg"
      />

      {/* Page header */}
      <div ref={heroRef} className="border-b border-white/8 section-padding">
        <div className="container-dgym">
          <p className="about-hero-item text-xs font-semibold uppercase tracking-widest text-white/30 mb-4">
            Our story • Rosario, Batangas
          </p>
          <h1 className="about-hero-item font-display text-5xl md:text-7xl font-black uppercase tracking-tight text-white mb-6 max-w-3xl">
            About The DGym
          </h1>
          <p className="about-hero-item text-lg text-white/60 max-w-xl leading-relaxed">
            High End Premium Weightlifting, Powerlifting, and Fitness Gym in Rosario, Batangas — built for people who demand real results.
          </p>
        </div>
      </div>

      <div ref={contentRef} className="container-dgym py-16 md:py-24 space-y-20">

        {/* Mission */}
        <div className="reveal grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">What we're about</p>
            <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white mb-5">
              Elevate Your Fitness Journey
            </h2>
            <p className="text-base text-white/60 leading-relaxed mb-4 max-w-lg">
              The DGym Rosario Batangas was built with one purpose: give every lifter and athlete an environment where serious training thrives. Premium Technogym machines, Rogue powerlifting platforms, dedicated coaching, and an electric atmosphere.
            </p>
            <p className="text-base text-white/60 leading-relaxed max-w-lg">
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
          <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-3">What drives us</p>
          <h2 className="font-display text-3xl md:text-4xl font-bold uppercase tracking-tight text-white mb-10">
            Our Standards
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
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
                body: 'Over 2,400+ members and fitness enthusiasts in Rosario, Batangas pushing each other forward.',
              },
            ].map((v) => (
              <div key={v.label} className="p-6 rounded-xl border border-white/8 bg-surface hover:border-white/15 transition-colors duration-200">
                <div className="w-1 h-8 bg-red rounded-full mb-4" aria-hidden="true" />
                <h3 className="font-display text-xl font-bold uppercase tracking-wide text-white mb-2">{v.label}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{v.body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Location note */}
        <div className="reveal p-8 rounded-2xl border border-white/8 bg-surface flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-2">Location</p>
            <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white mb-1">
              Rosario, Batangas
            </h2>
            <p className="text-sm text-white/50">
              Visit our official Facebook page for announcements, operating hours, and location directions.
            </p>
          </div>
          <div className="flex gap-3 shrink-0">
            <a
              href="https://www.facebook.com/profile.php?id=61577169056417"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block"
            >
              <Button variant="secondary">Facebook Page</Button>
            </a>
            <Link to="/contact">
              <Button>Contact Us</Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
