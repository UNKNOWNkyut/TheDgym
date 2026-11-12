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
  { id: 'introduction', title: '1. Introduction & Statutory Scope' },
  { id: 'data-collected', title: '2. Information We Collect' },
  { id: 'processing-purpose', title: '3. How We Use Your Information' },
  { id: 'ai-analytics', title: '4. AI & Retention Analytics Processing' },
  { id: 'security', title: '5. Data Protection & Security Controls' },
  { id: 'sharing', title: '6. Third-Party Sharing & Disclosure' },
  { id: 'retention-period', title: '7. Data Retention & Erasure' },
  { id: 'member-rights', title: '8. Your Rights Under RA 10173' },
  { id: 'cctv-facility', title: '9. Facility Surveillance & Safety' },
  { id: 'cookies', title: '10. Cookies & Session Storage' },
  { id: 'contact-dpo', title: '11. Data Protection Officer Contact' },
]

function computeScrollTargetTop(rectTop: number, currentScrollY: number, offset = -100): number {
  return Math.max(0, rectTop + currentScrollY + offset)
}

export function PrivacyPolicyPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [activeSectionId, setActiveSectionId] = useState<string>(SECTIONS[0].id)

  useGSAP(
    () => {
      if (!heroRef.current) return
      gsap.fromTo(
        heroRef.current.querySelectorAll('.policy-hero-item'),
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
        title="Privacy Policy"
        description="The DGym privacy policy. Learn how we safeguard your personal data in compliance with Republic Act No. 10173 (Philippine Data Privacy Act of 2012)."
        canonical="https://thedgym.com/privacy"
      />

      {/* Hero Header */}
      <div
        ref={heroRef}
        className="border-b border-zinc-200 dark:border-white/8 section-padding bg-white/70 dark:bg-black"
      >
        <div className="container-dgym">
          <div className="policy-hero-item flex flex-wrap items-center gap-2 mb-4">
            <Badge
              variant="default"
              size="sm"
              className="!bg-zinc-200/80 dark:!bg-white/10 !text-zinc-800 dark:!text-white/80 !border-zinc-300 dark:!border-white/10"
            >
              LEGAL COMPLIANCE
            </Badge>
            <span className="text-xs uppercase font-mono tracking-widest text-zinc-600 dark:text-white/50">
              PHILIPPINE DATA PRIVACY ACT OF 2012 (RA 10173)
            </span>
          </div>

          <h1 className="policy-hero-item font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-zinc-950 dark:text-white mb-6 max-w-4xl">
            Privacy Policy
          </h1>

          <p className="policy-hero-item text-base sm:text-lg text-zinc-600 dark:text-white/65 max-w-2xl leading-relaxed mb-6">
            The DGym Rosario Batangas is committed to maintaining the utmost confidentiality,
            integrity, and security of your personal data. This policy details how our facility
            collects, manages, and protects athlete records.
          </p>

          <div className="policy-hero-item flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-zinc-500 dark:text-white/45 font-mono">
            <span>EFFECTIVE DATE: OCTOBER 2026</span>
            <span aria-hidden="true">•</span>
            <span>LAST REVISED: OCTOBER 2026</span>
            <span aria-hidden="true">•</span>
            <span>GOVERNING JURISDICTION: PHILIPPINES (NPC)</span>
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
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              <span>Privacy Policy</span>
            </Link>
            <Link
              to="/terms"
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
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              <span>Terms of Use</span>
            </Link>
          </div>

          <p className="text-xs text-zinc-500 dark:text-white/45 font-mono">
            Standalone Page: <span className="text-zinc-900 dark:text-white">thedgym.com/privacy</span>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          {/* Quick Navigation Sidebar */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 space-y-6">
              <Card className="p-6 !border-zinc-200 dark:!border-white/10 !bg-white dark:!bg-[#0f0f12] !shadow-sm dark:!shadow-none">
                <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-white/45 font-mono mb-4">
                  POLICY TABLE OF CONTENTS
                </h2>
                <nav className="space-y-1.5" aria-label="Privacy Policy Sections">
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

              {/* Key Trust Highlights */}
              <Card className="p-6 !border-zinc-200 dark:!border-white/10 !bg-white/90 dark:!bg-[#0f0f12]/60 !shadow-sm dark:!shadow-none space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-white/45 font-mono">
                  OUR PRIVACY COMMITMENTS
                </h3>
                <div className="space-y-3 text-xs text-zinc-700 dark:text-white/75">
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      ✓
                    </span>
                    <span>Zero third-party marketing brokers or data resale.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      ✓
                    </span>
                    <span>Argon2id credential hashing and HttpOnly session cookies.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      ✓
                    </span>
                    <span>Transparent retention algorithms used exclusively for member benefits.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold" aria-hidden="true">
                      ✓
                    </span>
                    <span>Full compliance with the National Privacy Commission (NPC).</span>
                  </div>
                </div>
              </Card>
            </div>
          </aside>

          {/* Legal Text Body */}
          <div className="lg:col-span-8 space-y-12 text-zinc-700 dark:text-white/80 leading-relaxed text-sm md:text-base">
            {/* Section 1 */}
            <section id="introduction" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 01
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                1. Introduction &amp; Statutory Scope
              </h2>
              <p>
                The DGym Rosario Batangas (&quot;The DGym&quot;, &quot;we&quot;, &quot;us&quot;, or
                &quot;our&quot;) operates a high-end strength, conditioning, and powerlifting
                athletic facility situated in Rosario, Batangas, Philippines, alongside our web
                application portal at{' '}
                <Link
                  to="/"
                  className="text-zinc-950 dark:text-white font-medium underline hover:text-red dark:hover:text-red transition-colors"
                >
                  thedgym.com
                </Link>
                .
              </p>
              <p>
                We value your fundamental human right to privacy. In accordance with the{' '}
                <strong className="text-zinc-950 dark:text-white">Republic Act No. 10173</strong>,
                otherwise known as the{' '}
                <strong className="text-zinc-950 dark:text-white">
                  Data Privacy Act of 2012 (DPA)
                </strong>
                , and its Implementing Rules and Regulations (IRR) promulgated by the National
                Privacy Commission (NPC), this Privacy Policy outlines how we process personal,
                sensitive personal, and operational information gathered from registered accounts,
                active gym members, visitors, and website users.
              </p>
            </section>

            {/* Section 2 */}
            <section id="data-collected" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 02
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                2. Information We Collect
              </h2>
              <p>
                To provide safe gym access, facilitate certified coaching, and manage athletic
                memberships, we collect and process the following categories of data:
              </p>

              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-950 dark:text-white mb-1">
                    A. Identity &amp; Contact Information
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-white/65">
                    Full legal name, email address, mobile phone number, residential or postal
                    address, date of birth, profile image, and emergency contact details (name and
                    contact number).
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-950 dark:text-white mb-1">
                    B. Health, Safety &amp; PAR-Q Information
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-white/65">
                    Physical Activity Readiness Questionnaire (PAR-Q) disclosures, voluntary
                    declarations of pre-existing cardiovascular, orthopedic, or metabolic
                    conditions, and relevant physical limitations required to safeguard lifter
                    well-being during heavy training.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-950 dark:text-white mb-1">
                    C. Facility Attendance &amp; Usage Signals
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-white/65">
                    Front-desk and NFC keycard check-in/check-out timestamps, visit velocity
                    (weekly sessions), class session enrollments, personal training appointments,
                    and session notes recorded by certified trainers.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-zinc-200 dark:border-white/10 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-950 dark:text-white mb-1">
                    D. Financial &amp; Transactional Records
                  </h3>
                  <p className="text-xs sm:text-sm text-zinc-600 dark:text-white/65">
                    Selected membership plan tier (Day Pass, Monthly, Student/Senior/PWD, Quarterly,
                    6-Month, or Annual), billing dates, official receipt numbers, paid amounts
                    (PHP), and payment channels (Cash, GCash, Maya, QR Payment, Bank Transfer, or
                    Card). We do not store full raw credit card numbers on our local databases.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="processing-purpose" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 03
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                3. How We Use Your Information
              </h2>
              <p>
                Your information is processed strictly under lawful bases recognized by the DPA,
                including:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                <li>
                  <strong className="text-zinc-950 dark:text-white">Fulfillment of Contract:</strong>{' '}
                  Administering membership passes, validating facility and NFC keycard access,
                  scheduling coaches, and processing renewals.
                </li>
                <li>
                  <strong className="text-zinc-950 dark:text-white">
                    Athlete Safety &amp; Medical Emergency:
                  </strong>{' '}
                  Alerting staff in the event of an acute injury, physical distress, or emergency
                  on the gym floor.
                </li>
                <li>
                  <strong className="text-zinc-950 dark:text-white">
                    Facility Capacity &amp; Operations:
                  </strong>{' '}
                  Monitoring peak training hours to ensure safe lifter-to-equipment ratios and
                  well-maintained lifting platforms.
                </li>
                <li>
                  <strong className="text-zinc-950 dark:text-white">Legal &amp; Tax Compliance:</strong>{' '}
                  Issuing official receipts and complying with Bureau of Internal Revenue (BIR) and
                  local government regulations in Batangas.
                </li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="ai-analytics" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 04
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                4. AI &amp; Retention Analytics Processing
              </h2>
              <p>
                The DGym incorporates an intelligent, privacy-preserving retention scoring system
                designed to prevent athlete burnout, lapse, or membership abandonment.
              </p>
              <div className="p-4 rounded-xl border border-red/25 dark:border-red/20 bg-red/5 space-y-2 text-xs sm:text-sm text-zinc-700 dark:text-white/75">
                <p className="font-semibold text-zinc-950 dark:text-white">
                  How our retention model functions:
                </p>
                <p>
                  Our internal system evaluates objective facility telemetry—such as days elapsed
                  since last check-in and rolling 30-day attendance counts. When a member exhibits
                  prolonged absence, our system assists gym management in offering personalized
                  re-engagement support (such as complimentary coaching check-ins or renewal
                  reminders) delivered through your authenticated portal notifications.
                </p>
                <p className="text-zinc-500 dark:text-white/55 text-[11px] font-mono">
                  * Note: We do not license, transfer, or expose member telemetry to external data
                  brokers or advertisers.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="security" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 05
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                5. Data Protection &amp; Security Controls
              </h2>
              <p>
                We implement comprehensive organizational, physical, and technical safeguards to
                prevent unauthorized access, disclosure, modification, or destruction of member
                records:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                <li>
                  <strong className="text-zinc-950 dark:text-white">Transport Security:</strong> All
                  data transmitted between your browser and our servers is encrypted using modern
                  TLS (Transport Layer Security).
                </li>
                <li>
                  <strong className="text-zinc-950 dark:text-white">
                    Cryptographic Credential Hashing:
                  </strong>{' '}
                  Passwords are hashed using salted Argon2id cryptography. Plaintext passwords are
                  never stored or accessible to our personnel.
                </li>
                <li>
                  <strong className="text-zinc-950 dark:text-white">
                    Role-Based Access Control (RBAC):
                  </strong>{' '}
                  Access to sensitive member files is strictly segregated among certified coaches,
                  authorized front-desk staff, and system administrators.
                </li>
                <li>
                  <strong className="text-zinc-950 dark:text-white">Database Auditing:</strong>{' '}
                  Administrative actions and security events are recorded in audit logs.
                </li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="sharing" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 06
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                6. Third-Party Sharing &amp; Disclosure
              </h2>
              <p>
                The DGym does not sell, rent, or lease personal data. We disclose member
                information only under the following narrow circumstances:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                <li>
                  <strong className="text-zinc-950 dark:text-white">
                    Authorized Service Providers:
                  </strong>{' '}
                  Trusted payment gateways, cloud infrastructure, and transactional notification
                  processors bound by data protection obligations.
                </li>
                <li>
                  <strong className="text-zinc-950 dark:text-white">Medical First Responders:</strong>{' '}
                  Emergency contact information and known vital alerts provided to medical
                  personnel in cases of acute bodily injury.
                </li>
                <li>
                  <strong className="text-zinc-950 dark:text-white">Legal Compulsion:</strong> When
                  required by a valid court subpoena, law enforcement warrant, or lawful order
                  issued by Philippine regulatory agencies.
                </li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="retention-period" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 07
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                7. Data Retention &amp; Erasure Schedule
              </h2>
              <p>
                Personal data is retained only for the duration necessary to satisfy the purposes
                specified in this policy. Active member accounts and visit histories remain in our
                secure database throughout active subscription tenure.
              </p>
              <p className="text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                Upon account deactivation or expiration, records are retained for a maximum of five
                (5) years to comply with Philippine statutory accounting and tax regulations, after
                which personal identifying details are permanently expunged or anonymized for
                aggregated statistical research.
              </p>
            </section>

            {/* Section 8 */}
            <section id="member-rights" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 08
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                8. Your Rights Under Republic Act No. 10173
              </h2>
              <p>
                As a data subject under Philippine law, you are entitled to exercise the following
                rights:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <p className="font-bold text-zinc-950 dark:text-white text-xs uppercase font-mono mb-1">
                    Right to Be Informed
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-white/65">
                    Know how your personal data is collected and handled.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <p className="font-bold text-zinc-950 dark:text-white text-xs uppercase font-mono mb-1">
                    Right to Access
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-white/65">
                    Obtain a copy of the personal information stored in your record.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <p className="font-bold text-zinc-950 dark:text-white text-xs uppercase font-mono mb-1">
                    Right to Rectification
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-white/65">
                    Request immediate correction of inaccurate or outdated data.
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-zinc-200 dark:border-white/8 bg-white dark:bg-white/[0.02] shadow-xs dark:shadow-none">
                  <p className="font-bold text-zinc-950 dark:text-white text-xs uppercase font-mono mb-1">
                    Right to Erasure or Blocking
                  </p>
                  <p className="text-[11px] text-zinc-600 dark:text-white/65">
                    Request deletion or suspension of data under statutory conditions.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 9 */}
            <section id="cctv-facility" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 09
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                9. Facility Surveillance &amp; Physical Safety (CCTV)
              </h2>
              <p>
                For the personal security of our members, staff, and equipment, 24-hour
                Closed-Circuit Television (CCTV) cameras operate continuously throughout the
                lifting floor, cardio zone, reception desk, and facility perimeter in Rosario,
                Batangas.
              </p>
              <p className="text-zinc-600 dark:text-white/75 text-xs sm:text-sm">
                CCTV cameras are strictly prohibited and never installed in private areas such as
                locker rooms, showers, or restrooms. Video footage is maintained securely on
                encrypted storage and is overwritten cyclically, accessed only in the investigation
                of security breaches, theft, or physical injury.
              </p>
            </section>

            {/* Section 10 */}
            <section id="cookies" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 10
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                10. Cookies &amp; Session Storage
              </h2>
              <p>
                Our web application uses essential HttpOnly cookies and browser local storage to
                maintain authenticated sessions, remember UI theme preferences, and protect
                state-changing requests. We do not deploy third-party advertising tracking beacons.
              </p>
            </section>

            {/* Section 11 */}
            <section id="contact-dpo" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 11
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-zinc-950 dark:text-white">
                11. Data Protection Officer (DPO) Contact Details
              </h2>
              <p>
                If you have inquiries, complaints, or wish to exercise your data subject rights
                under RA 10173, you may contact our Data Protection Office directly:
              </p>
              <Card className="p-6 !border-zinc-200 dark:!border-white/10 !bg-white dark:!bg-[#0f0f12] !shadow-sm dark:!shadow-none">
                <div className="space-y-3 text-xs sm:text-sm">
                  <p className="text-zinc-950 dark:text-white font-bold uppercase tracking-wider font-mono">
                    The DGym Data Protection Office
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">Facility Address:</strong>{' '}
                    {GYM_INFO.fullAddress}
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">Phone:</strong>{' '}
                    <a href={GYM_INFO.phoneHref} className="text-red font-medium hover:underline">
                      {GYM_INFO.phoneDisplay} ({GYM_INFO.phoneInternational})
                    </a>
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">Email:</strong>{' '}
                    <a
                      href={GYM_INFO.emailHref}
                      className="text-red font-medium hover:underline break-all"
                    >
                      {GYM_INFO.email}
                    </a>
                  </p>
                  <p className="text-zinc-700 dark:text-white/75">
                    <strong className="text-zinc-950 dark:text-white">
                      Official Facebook Channel:
                    </strong>{' '}
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
                    <strong className="text-zinc-950 dark:text-white">Web Contact Portal:</strong>{' '}
                    <Link to="/contact" className="text-red font-medium hover:underline">
                      thedgym.com/contact
                    </Link>
                  </p>
                  <p className="text-zinc-500 dark:text-white/45 text-[11px] pt-2 border-t border-zinc-200 dark:border-white/8 font-mono">
                    Inquiries are addressed within fifteen (15) business days in accordance with
                    NPC guidelines.
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
