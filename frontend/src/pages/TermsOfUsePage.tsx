import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { GYM_INFO } from '@/constants/gymInfo'

gsap.registerPlugin(ScrollTrigger)

interface SectionNav {
  id: string
  title: string
}

const SECTIONS: readonly SectionNav[] = [
  { id: 'agreement', title: '1. Agreement to Terms' },
  { id: 'eligibility', title: '2. Eligibility & Account Security' },
  { id: 'memberships', title: '3. Membership Plans & Payments' },
  { id: 'liability-waiver', title: '4. Assumption of Risk & Liability Waiver' },
  { id: 'code-of-conduct', title: '5. Gym Floor Rules & Lifting Etiquette' },
  { id: 'personal-training', title: '6. Personal Training & Classes' },
  { id: 'lockers-valuables', title: '7. Lockers & Personal Property' },
  { id: 'suspension', title: '8. Suspension & Membership Termination' },
  { id: 'intellectual-property', title: '9. Intellectual Property' },
  { id: 'governing-law', title: '10. Governing Law & Jurisdiction' },
  { id: 'contact', title: '11. Contact & Customer Support' },
]

function computeScrollTargetTop(rectTop: number, currentScrollY: number, offset = -100): number {
  return Math.max(0, rectTop + currentScrollY + offset)
}

export function TermsOfUsePage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [activeSectionId, setActiveSectionId] = useState<string>(SECTIONS[0].id)

  useGSAP(
    () => {
      if (!heroRef.current) return
      gsap.fromTo(
        heroRef.current.querySelectorAll('.terms-hero-item'),
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 },
      )
    },
    { scope: heroRef },
  )

  useGSAP(
    () => {
      if (!contentRef.current) return
      contentRef.current.querySelectorAll('.reveal-card').forEach((el) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 24 },
          {
            opacity: 1,
            y: 0,
            duration: 0.55,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          },
        )
      })
    },
    { scope: contentRef },
  )

  const scrollToSection = (id: string) => {
    setActiveSectionId(id)
    const el = document.getElementById(id)
    if (el) {
      const top = computeScrollTargetTop(el.getBoundingClientRect().top, window.scrollY)
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <>
      <SEO
        title="Terms of Use"
        description="The DGym terms of use, membership regulations, athletic liability release waiver, and facility code of conduct in Rosario, Batangas."
        canonical="https://thedgym.com/terms"
      />

      {/* Hero Header */}
      <div
        ref={heroRef}
        className="border-b border-zinc-200 dark:border-white/8 section-padding bg-white/70 dark:bg-black"
      >
        <div className="container-dgym">
          <div className="terms-hero-item flex flex-wrap items-center gap-2 mb-4">
            <Badge
              variant="default"
              size="sm"
              className="!bg-zinc-200/80 dark:!bg-white/10 !text-zinc-800 dark:!text-white/80 !border-zinc-300 dark:!border-white/10"
            >
              LEGAL AGREEMENT
            </Badge>
            <span className="text-xs uppercase font-mono tracking-widest text-zinc-600 dark:text-white/50">
              FACILITY RULES &amp; MEMBERSHIP CONDITIONS
            </span>
          </div>

          <h1 className="terms-hero-item font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-zinc-950 dark:text-white mb-6 max-w-4xl">
            Terms of Use
          </h1>

          <p className="terms-hero-item text-base sm:text-lg text-zinc-600 dark:text-white/65 max-w-2xl leading-relaxed mb-6">
            Please read these Terms of Use carefully. By entering The DGym athletic facility in
            Rosario, Batangas or utilizing our digital platform, you agree to comply with all
            facility safety guidelines, billing conditions, and the athlete liability release.
          </p>

          <div className="terms-hero-item flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-zinc-500 dark:text-white/45 font-mono">
            <span>EFFECTIVE DATE: OCTOBER 2026</span>
            <span aria-hidden="true">•</span>
            <span>LAST REVISED: OCTOBER 2026</span>
            <span aria-hidden="true">•</span>
            <span>APPLICABLE TO: ALL MEMBERS, VISITORS &amp; COACHES</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div ref={contentRef} className="container-dgym py-12 md:py-20">
        {/* Document Navigation Tabs */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-10 pb-6 border-b border-zinc-200 dark:border-white/8">
          <div className="flex items-center gap-2 p-1 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-[#0f0f12] w-fit shadow-xs dark:shadow-none">
            <Link
              to="/privacy"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider font-mono text-zinc-600 dark:text-white/60 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5 transition-all"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Privacy Policy</span>
            </Link>
            <Link
              to="/terms"
              aria-current="page"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider font-mono bg-red text-white shadow-sm transition-all"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Terms of Use</span>
            </Link>
          </div>

          <p className="text-xs text-zinc-500 dark:text-white/45 font-mono">
            Standalone Page: <span className="text-zinc-900 dark:text-white">thedgym.com/terms</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* Quick Navigation Sidebar */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 space-y-6">
              <Card className="p-6 !border-zinc-200 dark:!border-white/10 !bg-white dark:!bg-[#0f0f12] !shadow-sm dark:!shadow-none">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-white/45 font-mono mb-4">
                  TERMS TABLE OF CONTENTS
                </h2>
                <nav className="space-y-1.5" aria-label="Terms of Use Sections">
                  {SECTIONS.map((sec) => {
                    const isActive = activeSectionId === sec.id
                    return (
                      <button
                        key={sec.id}
                        type="button"
                        onClick={() => scrollToSection(sec.id)}
                        aria-current={isActive ? 'location' : undefined}
                        className={[
                          'w-full text-left px-3 py-2 text-xs font-medium rounded-lg transition-colors duration-150 cursor-pointer truncate border-l-2',
                          isActive
                            ? 'border-red bg-red/8 text-zinc-950 dark:text-white font-semibold'
                            : 'border-transparent text-zinc-600 dark:text-white/65 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5',
                        ].join(' ')}
                      >
                        {sec.title}
                      </button>
                    )
                  })}
                </nav>
              </Card>

              {/* Core Facility Rules Summary */}
              <Card className="p-6 !border-zinc-200 dark:!border-white/10 !bg-white/90 dark:!bg-[#0f0f12]/60 !shadow-sm dark:!shadow-none space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-white/45 font-mono">
                  GYM FLOOR COMMANDMENTS
                </h3>
                <div className="space-y-3 text-xs text-zinc-700 dark:text-white/75">
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      1.
                    </span>
                    <span>Always re-rack your weights and plates to their racks.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      2.
                    </span>
                    <span>Wipe down benches and machinery after every use.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      3.
                    </span>
                    <span>Drop weights only on rubber deadlift platforms with bumper plates.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      4.
                    </span>
                    <span>Closed-toe athletic shoes required at all times.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      5.
                    </span>
                    <span>Zero tolerance for harassment, bullying, or intimidation.</span>
                  </div>
                </div>
              </Card>
            </div>
          </aside>

          {/* Legal Text Body */}
          <div className="lg:col-span-8 space-y-12 text-zinc-700 dark:text-white/80 leading-relaxed text-sm md:text-base">
            {/* Section 1 */}
            <section id="agreement" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 01
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                1. Agreement to Terms
              </h2>
              <p>
                These Terms of Use (&quot;Terms&quot;) constitute a legally binding agreement between
                you (&quot;Athlete&quot;, &quot;Member&quot;, &quot;User&quot;, or &quot;You&quot;)
                and{' '}
                <strong className="text-zinc-950 dark:text-white">The DGym Rosario Batangas</strong>{' '}
                (&quot;The DGym&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;).
              </p>
              <p>
                By creating a digital account, purchasing a Day Pass or subscription membership,
                scheduling personal training, or physically accessing the gym facility at Rosario,
                Batangas, you acknowledge that you have read, understood, and agreed to be bound by
                all provisions of these Terms and our companion{' '}
                <Link
                  to="/privacy"
                  className="text-zinc-950 dark:text-white font-medium underline hover:text-red dark:hover:text-red transition-colors"
                >
                  Privacy Policy
                </Link>
                . If you do not agree to these Terms, you may not enter the facility or utilize our
                services.
              </p>
            </section>

            {/* Section 2 */}
            <section id="eligibility" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 02
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                2. Eligibility &amp; Account Security
              </h2>
              <p>
                Access to The DGym is open to individuals aged eighteen (18) years or older. Minors
                aged fifteen (15) to seventeen (17) may join provided a parent or legal guardian
                executes our physical Parental Consent &amp; Minor Liability Release Waiver on-site
                prior to initial gym floor entry.
              </p>
              <p className="text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                You are solely responsible for maintaining the confidentiality of your login
                credentials and NFC keycard. Account sharing, granting unauthorized individuals
                access via your membership credentials, or bypassing front-desk check-in verification
                constitutes grounds for immediate membership revocation without refund.
              </p>
            </section>

            {/* Section 3 */}
            <section id="memberships" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 03
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                3. Membership Plans, Billing &amp; Payments
              </h2>
              <div className="space-y-4">
                <p>
                  The DGym offers single-day access alongside recurring and multi-month membership
                  tiers (including ID-verified Student and Senior/PWD rates, 6-Month packages, and
                  Annual memberships):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                    <p className="font-bold text-zinc-950 dark:text-white text-xs uppercase font-mono mb-1">
                      Day Pass
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-white/65">
                      Single-day full equipment and locker access. Valid on date of purchase only.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                    <p className="font-bold text-zinc-950 dark:text-white text-xs uppercase font-mono mb-1">
                      Monthly Unlimited
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-white/65">
                      30 days unlimited gym, lounge, Wi-Fi, and free 6:00 PM TABATA &amp; HIIT
                      classes.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                    <p className="font-bold text-zinc-950 dark:text-white text-xs uppercase font-mono mb-1">
                      Multi-Month &amp; Annual
                    </p>
                    <p className="text-[11px] text-zinc-600 dark:text-white/65">
                      Quarterly (90 days), 6-Month (180 days), and Annual (365 days) unlimited
                      access options.
                    </p>
                  </div>
                </div>

                <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-white/75 text-xs sm:text-sm pt-2">
                  <li>
                    <strong className="text-zinc-950 dark:text-white">Currency &amp; Pricing:</strong>{' '}
                    All plan prices are stated in Philippine Pesos (PHP) inclusive of applicable
                    local commercial taxes.
                  </li>
                  <li>
                    <strong className="text-zinc-950 dark:text-white">Non-Transferability:</strong>{' '}
                    Memberships are strictly personal and non-transferable to other individuals.
                  </li>
                  <li>
                    <strong className="text-zinc-950 dark:text-white">Refund Policy:</strong> All
                    membership passes, personal training packages, and day passes are strictly
                    non-refundable once availed.
                  </li>
                </ul>
              </div>
            </section>

            {/* Section 4 */}
            <section id="liability-waiver" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 04
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                4. Assumption of Risk &amp; Liability Release Waiver
              </h2>
              <div className="p-5 rounded-2xl border border-red/30 bg-red/5 space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-red font-mono">
                  CRITICAL LEGAL NOTICE — PLEASE READ WITH CARE
                </p>
                <p className="text-xs sm:text-sm text-zinc-900 dark:text-white/90 leading-relaxed font-medium">
                  Weightlifting, powerlifting, barbell movements, cardiovascular conditioning, and
                  high-intensity training involve inherent risks of serious bodily injury, including
                  but not limited to muscular strains, ligament tears, fractures, concussions,
                  cardiac events, paralysis, or death.
                </p>
                <div className="space-y-2 text-xs text-zinc-700 dark:text-white/75">
                  <p>By engaging in activities at The DGym, you formally agree and declare:</p>
                  <ul className="list-disc pl-5 space-y-1.5">
                    <li>
                      You are in good physical health and possess no undisclosed medical condition
                      preventing intense resistance training.
                    </li>
                    <li>
                      You voluntarily assume all risks, known and unknown, associated with physical
                      exercise, equipment handling, and facility presence.
                    </li>
                    <li>
                      To the fullest extent permissible under Philippine law, you forever release,
                      waive, discharge, and hold harmless The DGym Rosario Batangas, its owners,
                      operators, trainers, and personnel from any liability, claims, or damages
                      arising out of personal injury, illness, or property damage incurred on
                      premises.
                    </li>
                  </ul>
                </div>
              </div>
            </section>

            {/* Section 5 */}
            <section id="code-of-conduct" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 05
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                5. Gym Floor Rules &amp; Lifting Etiquette
              </h2>
              <p>
                The DGym maintains an elite, high-performance training culture. Every athlete is
                required to honor our operational floor standards:
              </p>

              <div className="space-y-3 pt-2 text-xs sm:text-sm">
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <strong className="text-zinc-950 dark:text-white block mb-1">
                    A. Re-Racking Weights (The Universal Rule)
                  </strong>
                  <p className="text-zinc-600 dark:text-white/65">
                    Always unload barbells and return all weight plates, dumbbells, kettlebells, and
                    barbell collars to their designated racks immediately after finishing your sets.
                    Never leave loaded bars on racks or the floor.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <strong className="text-zinc-950 dark:text-white block mb-1">
                    B. Dropping Weights &amp; Platform Usage
                  </strong>
                  <p className="text-zinc-600 dark:text-white/65">
                    Dropping loaded barbells is strictly restricted to designated deadlift
                    platforms and rubber drop mats with bumper plates. Never intentionally drop
                    dumbbells, fixed barbells, or machine weights onto general turf or flooring.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <strong className="text-zinc-950 dark:text-white block mb-1">
                    C. Chalk Protocol
                  </strong>
                  <p className="text-zinc-600 dark:text-white/65">
                    Lifting chalk (powder or liquid) is permitted for heavy barbell work. Please keep
                    chalk use clean and confined to the provided chalk stands. Excessive dusting or
                    clapping chalk into the air is prohibited.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <strong className="text-zinc-950 dark:text-white block mb-1">
                    D. Hygiene, Attire &amp; Footwear
                  </strong>
                  <p className="text-zinc-600 dark:text-white/65">
                    Clean, closed-toe athletic training footwear must be worn at all times
                    (flat-soled deadlift shoes or weightlifting shoes permitted; sandals, slides, or
                    bare feet strictly prohibited on the main floor). Bring a personal sweat towel
                    and wipe down machine cushions and benches after every exercise.
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <strong className="text-zinc-950 dark:text-white block mb-1">
                    E. Zero-Tolerance Code of Conduct
                  </strong>
                  <p className="text-zinc-600 dark:text-white/65">
                    We maintain zero tolerance for harassment, aggressive intimidation, unwanted
                    physical contact, discrimination, or filming other members without explicit
                    permission. Violation results in immediate expulsion without refund.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 6 */}
            <section id="personal-training" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 06
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                6. Personal Training &amp; Classes
              </h2>
              <p>
                Only certified instructors employed or contracted by The DGym are authorized to
                provide coaching services within the facility. Commercial coaching by
                non-affiliated trainers is strictly prohibited.
              </p>
              <p className="text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                Members with an active plan may book 1-on-1 personal training or reserve spots in
                our 6:00 PM group classes directly through the portal. Please notify your coach or
                cancel ahead of time in the portal if you are unable to attend a scheduled session.
              </p>
            </section>

            {/* Section 7 */}
            <section id="lockers-valuables" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 07
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                7. Lockers &amp; Personal Property
              </h2>
              <p>
                Day-use lockers are provided for athletic bags during your workout session. Lockers
                must be emptied and personal padlocks removed upon departing the facility each day.
                Any locks left overnight will be clipped and contents logged with lost-and-found.
              </p>
              <p className="text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                The DGym accepts no responsibility or legal liability for lost, stolen, or damaged
                personal valuables, smartphones, wallets, jewelry, or gear brought onto gym
                premises.
              </p>
            </section>

            {/* Section 8 */}
            <section id="suspension" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 08
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                8. Suspension &amp; Membership Termination
              </h2>
              <p>
                The DGym management reserves the right to suspend or terminate membership privileges
                immediately without refund for:
              </p>
              <ul className="list-disc pl-5 space-y-1.5 text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                <li>Willful damage or abuse of gym machines, barbells, or calibrated plates.</li>
                <li>Verbal abuse, harassment, or physical altercation with members or gym staff.</li>
                <li>
                  Distribution or promotion of unauthorized performance-enhancing substances on
                  facility grounds.
                </li>
                <li>
                  Refusal to observe facility safety rules after formal warning by coaching staff.
                </li>
              </ul>
            </section>

            {/* Section 9 */}
            <section id="intellectual-property" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 09
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                9. Intellectual Property
              </h2>
              <p>
                All trademarks, logos, custom software algorithms, training materials, and design
                assets associated with The DGym Rosario Batangas are the exclusive property of The
                DGym. Unauthorized reproduction, scraping, or commercial exploitation is prohibited.
              </p>
            </section>

            {/* Section 10 */}
            <section id="governing-law" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 10
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                10. Governing Law &amp; Dispute Resolution
              </h2>
              <p>
                These Terms are governed by and construed in accordance with the laws of the
                Republic of the Philippines. Any disputes, controversies, or legal claims arising out
                of membership, platform use, or facility attendance shall be submitted to the
                exclusive jurisdiction of the competent courts of Batangas, Philippines.
              </p>
            </section>

            {/* Section 11 */}
            <section id="contact" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 11
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                11. Contact &amp; Customer Support
              </h2>
              <p>
                If you have questions regarding these Terms or membership policies, our front desk
                and management team are at your service:
              </p>
              <Card className="p-6 !border-zinc-200 dark:!border-white/10 !bg-white dark:!bg-[#0f0f12] !shadow-sm dark:!shadow-none">
                <div className="space-y-3 text-xs sm:text-sm">
                  <p className="text-zinc-950 dark:text-white font-bold uppercase tracking-wider font-mono">
                    The DGym Member Services
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">Facility:</strong>{' '}
                    {GYM_INFO.fullAddress}
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">Phone:</strong>{' '}
                    <a href={GYM_INFO.phoneHref} className="text-red font-medium hover:underline">
                      {GYM_INFO.phoneDisplay} ({GYM_INFO.phoneInternational})
                    </a>
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">
                      Customer Service Email:
                    </strong>{' '}
                    <a
                      href={GYM_INFO.emailHref}
                      className="text-red font-medium hover:underline break-all"
                    >
                      {GYM_INFO.email}
                    </a>
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">Facebook Community:</strong>{' '}
                    <a
                      href={GYM_INFO.facebookUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red font-medium hover:underline"
                    >
                      {GYM_INFO.facebookLabel}
                    </a>
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">Support Page:</strong>{' '}
                    <Link to="/contact" className="text-red font-medium hover:underline">
                      thedgym.com/contact
                    </Link>
                  </p>
                </div>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </>
  )
}
