import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { SEO } from '@/components/ui/SEO'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'

gsap.registerPlugin(ScrollTrigger)

interface SectionNav {
  id: string
  title: string
}

const SECTIONS: SectionNav[] = [
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

export function PrivacyPolicyPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (!heroRef.current) return
      gsap.fromTo(
        heroRef.current.querySelectorAll('.policy-hero-item'),
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 }
      )
    },
    { scope: heroRef }
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
          }
        )
      })
    },
    { scope: contentRef }
  )

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      const yOffset = -100
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset
      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }

  return (
    <>
      <SEO
        title="Privacy Policy | The DGym Rosario Batangas"
        description="The DGym privacy policy. Learn how we safeguard your personal data in compliance with Republic Act No. 10173 (Philippine Data Privacy Act of 2012)."
        canonical="https://thedgym.com/privacy"
      />

      {/* Hero Header */}
      <div ref={heroRef} className="border-b border-white/8 section-padding bg-black">
        <div className="container-dgym">
          <div className="policy-hero-item flex items-center gap-2 mb-4">
            <Badge variant="default" size="sm">
              LEGAL COMPLIANCE
            </Badge>
            <span className="text-xs uppercase font-mono tracking-widest text-white/40">
              PHILIPPINE DATA PRIVACY ACT OF 2012 (RA 10173)
            </span>
          </div>

          <h1 className="policy-hero-item font-display text-4xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white mb-6 max-w-4xl">
            Privacy Policy
          </h1>

          <p className="policy-hero-item text-base sm:text-lg text-white/60 max-w-2xl leading-relaxed mb-6">
            The DGym Rosario Batangas is committed to maintaining the utmost confidentiality,
            integrity, and security of your personal data. This policy details how our facility
            collects, manages, and protects athlete records.
          </p>

          <div className="policy-hero-item flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-white/40 font-mono">
            <span>EFFECTIVE DATE: OCTOBER 2026</span>
            <span>•</span>
            <span>LAST REVISED: OCTOBER 2026</span>
            <span>•</span>
            <span>GOVERNING JURISDICTION: PHILIPPINES (NPC)</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div ref={contentRef} className="container-dgym py-12 md:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
          
          {/* Quick Navigation Sidebar */}
          <aside className="lg:col-span-4">
            <div className="lg:sticky lg:top-28 space-y-6">
              <Card className="p-6 border-white/10 bg-[#0f0f12]">
                <h2 className="text-xs font-bold uppercase tracking-widest text-white/40 font-mono mb-4">
                  POLICY TABLE OF CONTENTS
                </h2>
                <nav className="space-y-1.5" aria-label="Privacy Policy Sections">
                  {SECTIONS.map((sec) => (
                    <button
                      key={sec.id}
                      type="button"
                      onClick={() => scrollToSection(sec.id)}
                      className="w-full text-left px-3 py-2 text-xs font-medium text-white/60 hover:text-white hover:bg-white/5 rounded-lg transition-colors duration-150 cursor-pointer truncate"
                    >
                      {sec.title}
                    </button>
                  ))}
                </nav>
              </Card>

              {/* Key Trust Highlights */}
              <Card className="p-6 border-white/10 bg-[#0f0f12]/60 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 font-mono">
                  OUR PRIVACY COMMITMENTS
                </h3>
                <div className="space-y-3 text-xs text-white/70">
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold">✓</span>
                    <span>Zero third-party marketing brokers or data resale.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold">✓</span>
                    <span>Encrypted passwords and authenticated session cookies.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold">✓</span>
                    <span>Transparent retention algorithms used exclusively for member benefits.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="text-red font-bold">✓</span>
                    <span>Full compliance with the National Privacy Commission (NPC).</span>
                  </div>
                </div>
              </Card>
            </div>
          </aside>

          {/* Legal Text Body */}
          <div className="lg:col-span-8 space-y-12 text-white/80 leading-relaxed text-sm md:text-base">
            
            {/* Section 1 */}
            <section id="introduction" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 01
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                1. Introduction & Statutory Scope
              </h2>
              <p>
                The DGym Rosario Batangas (&quot;The DGym&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) 
                operates a high-end strength, conditioning, and powerlifting athletic facility 
                situated in Rosario, Batangas, Philippines, alongside our web application portal 
                at <Link to="/" className="text-white underline hover:text-red transition-colors">thedgym.com</Link>.
              </p>
              <p>
                We value your fundamental human right to privacy. In accordance with the{' '}
                <strong className="text-white">Republic Act No. 10173</strong>, otherwise known as the{' '}
                <strong className="text-white">Data Privacy Act of 2012 (DPA)</strong>, and its Implementing Rules 
                and Regulations (IRR) promulgated by the National Privacy Commission (NPC), this Privacy Policy 
                outlines how we process personal, sensitive personal, and operational information gathered from 
                registered accounts, active gym members, visitors, and website users.
              </p>
            </section>

            {/* Section 2 */}
            <section id="data-collected" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 02
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                2. Information We Collect
              </h2>
              <p>
                To provide safe gym access, facilitate certified coaching, and manage athletic memberships, 
                we collect and process the following categories of data:
              </p>
              
              <div className="space-y-4 pt-2">
                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white mb-1">
                    A. Identity & Contact Information
                  </h3>
                  <p className="text-xs sm:text-sm text-white/60">
                    Full legal name, email address, mobile phone number, residential or postal address, date of 
                    birth, profile image, and emergency contact details (name and contact number).
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white mb-1">
                    B. Health, Safety & PAR-Q Information
                  </h3>
                  <p className="text-xs sm:text-sm text-white/60">
                    Physical Activity Readiness Questionnaire (PAR-Q) disclosures, voluntary declarations of 
                    pre-existing cardiovascular, orthopedic, or metabolic conditions, and relevant physical 
                    limitations required to safeguard lifter well-being during heavy training.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white mb-1">
                    C. Facility Attendance & Usage Signals
                  </h3>
                  <p className="text-xs sm:text-sm text-white/60">
                    Front-desk check-in and check-out timestamps, visit velocity (weekly sessions), class session 
                    enrollments, personal training appointments, and session notes recorded by certified trainers.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-white mb-1">
                    D. Financial & Transactional Records
                  </h3>
                  <p className="text-xs sm:text-sm text-white/60">
                    Selected membership plan tier (Day Pass, Monthly, Quarterly), billing dates, official receipt 
                    numbers, paid amounts (PHP), and payment channels (Cash, GCash, Bank Transfer, Card). We do 
                    not store full raw credit card numbers on our local databases.
                  </p>
                </div>
              </div>
            </section>

            {/* Section 3 */}
            <section id="processing-purpose" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 03
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                3. How We Use Your Information
              </h2>
              <p>Your information is processed strictly under lawful bases recognized by the DPA, including:</p>
              <ul className="list-disc pl-5 space-y-2 text-white/70 text-xs sm:text-sm">
                <li><strong className="text-white">Fulfillment of Contract:</strong> Administering membership passes, validating turnstile access, scheduling coaches, and processing renewals.</li>
                <li><strong className="text-white">Athlete Safety & Medical Emergency:</strong> Alerting staff in the event of an acute injury, physical distress, or emergency on the gym turf.</li>
                <li><strong className="text-white">Facility Capacity & Operations:</strong> Monitoring peak training hours to ensure safe lifter-to-equipment ratios and well-maintained lifting platforms.</li>
                <li><strong className="text-white">Legal & Tax Compliance:</strong> Issuing official receipts and complying with Bureau of Internal Revenue (BIR) and local government regulations in Batangas.</li>
              </ul>
            </section>

            {/* Section 4 */}
            <section id="ai-analytics" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 04
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                4. AI & Retention Analytics Processing
              </h2>
              <p>
                The DGym incorporates an intelligent, privacy-preserving machine learning system 
                designed to prevent athlete burnout, lapse, or membership abandonment.
              </p>
              <div className="p-4 rounded-xl border border-red/20 bg-red/5 space-y-2 text-xs sm:text-sm text-white/70">
                <p className="font-semibold text-white">How our retention model functions:</p>
                <p>
                  Our internal system evaluates objective facility telemetry—such as days elapsed since last 
                  check-in and rolling 30-day attendance counts. When a member exhibits prolonged absence, 
                  our system assists gym management in offering personalized re-engagement incentives (such as 
                  complimentary 1-on-1 technique assessments, renewal rate reductions, or recovery clinic passes) 
                  delivered through your authenticated in-app Notification Bell.
                </p>
                <p className="text-white/50 text-[11px] font-mono">
                  * Note: We do not license, transfer, or expose member telemetry to external data brokers or advertisers.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section id="security" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 05
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                5. Data Protection & Security Controls
              </h2>
              <p>
                We implement comprehensive organizational, physical, and technical safeguards to prevent unauthorized 
                access, disclosure, modification, or destruction of member records:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-white/70 text-xs sm:text-sm">
                <li><strong className="text-white">Transport Security:</strong> All data transmitted between your browser and our servers is encrypted using modern TLS (Transport Layer Security).</li>
                <li><strong className="text-white">Cryptographic Credential Hashing:</strong> Passwords are hashed using salted cryptographic algorithms (Argon2 / PBKDF2). Plaintext passwords are never accessible to our personnel.</li>
                <li><strong className="text-white">Role-Based Access Control (RBAC):</strong> Access to sensitive member files is strictly segregated among certified coaches, authorized front desk staff, and system administrators.</li>
                <li><strong className="text-white">Database Auditing:</strong> Administrative actions and data updates are recorded with immutable audit logs.</li>
              </ul>
            </section>

            {/* Section 6 */}
            <section id="sharing" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 06
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                6. Third-Party Sharing & Disclosure
              </h2>
              <p>
                The DGym does not sell, rent, or lease personal data. We disclose member information only under 
                the following narrow circumstances:
              </p>
              <ul className="list-disc pl-5 space-y-2 text-white/70 text-xs sm:text-sm">
                <li><strong className="text-white">Authorized Service Providers:</strong> Trusted cloud infrastructure and transactional notification processors bound by binding data sharing agreements.</li>
                <li><strong className="text-white">Medical First Responders:</strong> Emergency contact information and known vital alerts provided to medical personnel in cases of acute bodily injury.</li>
                <li><strong className="text-white">Legal Compulsion:</strong> When required by a valid court subpoena, law enforcement warrant, or lawful order issued by Philippine regulatory agencies.</li>
              </ul>
            </section>

            {/* Section 7 */}
            <section id="retention-period" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 07
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                7. Data Retention & Erasure Schedule
              </h2>
              <p>
                Personal data is retained only for the duration necessary to satisfy the purposes specified in 
                this policy. Active member accounts and visit histories remain in our secure database throughout 
                active subscription tenure.
              </p>
              <p className="text-white/70 text-xs sm:text-sm">
                Upon account deactivation or expiration, records are retained for a maximum of five (5) years to 
                comply with Philippine statutory accounting and tax regulations, after which personal identifying 
                details are permanently expunged or anonymized for aggregated statistical research.
              </p>
            </section>

            {/* Section 8 */}
            <section id="member-rights" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 08
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                8. Your Rights Under Republic Act No. 10173
              </h2>
              <p>As a data subject under Philippine law, you are entitled to exercise the following rights:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border border-white/8 bg-white/[0.02]">
                  <p className="font-bold text-white text-xs uppercase font-mono mb-1">Right to Be Informed</p>
                  <p className="text-[11px] text-white/60">Know how your personal data is collected and handled.</p>
                </div>
                <div className="p-3.5 rounded-xl border border-white/8 bg-white/[0.02]">
                  <p className="font-bold text-white text-xs uppercase font-mono mb-1">Right to Access</p>
                  <p className="text-[11px] text-white/60">Obtain a copy of the personal information stored in your record.</p>
                </div>
                <div className="p-3.5 rounded-xl border border-white/8 bg-white/[0.02]">
                  <p className="font-bold text-white text-xs uppercase font-mono mb-1">Right to Rectification</p>
                  <p className="text-[11px] text-white/60">Request immediate correction of inaccurate or outdated data.</p>
                </div>
                <div className="p-3.5 rounded-xl border border-white/8 bg-white/[0.02]">
                  <p className="font-bold text-white text-xs uppercase font-mono mb-1">Right to Erasure or Blocking</p>
                  <p className="text-[11px] text-white/60">Request deletion or suspension of data under statutory conditions.</p>
                </div>
              </div>
            </section>

            {/* Section 9 */}
            <section id="cctv-facility" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 09
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                9. Facility Surveillance & Physical Safety (CCTV)
              </h2>
              <p>
                For the personal security of our members, staff, and equipment, 24-hour Closed-Circuit 
                Television (CCTV) cameras operate continuously throughout the lifting floor, cardio zone, 
                reception desk, and facility perimeter in Rosario, Batangas.
              </p>
              <p className="text-white/70 text-xs sm:text-sm">
                CCTV cameras are strictly prohibited and never installed in private areas such as locker rooms, 
                showers, or restrooms. Video footage is maintained securely on encrypted storage and is overwritten 
                cyclically, accessed only in the investigation of security breaches, theft, or physical injury.
              </p>
            </section>

            {/* Section 10 */}
            <section id="cookies" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 10
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                10. Cookies & Session Storage
              </h2>
              <p>
                Our web application uses essential cookies and browser session storage to maintain authenticated 
                sessions, remember UI preferences (e.g. read notification status), and prevent cross-site request 
                forgery (CSRF). We do not deploy third-party advertising tracking beacons.
              </p>
            </section>

            {/* Section 11 */}
            <section id="contact-dpo" className="reveal-card scroll-mt-28 space-y-4">
              <span className="text-xs uppercase font-mono font-bold tracking-widest text-red">
                SECTION 11
              </span>
              <h2 className="font-display text-2xl md:text-3xl font-bold uppercase tracking-tight text-white">
                11. Data Protection Officer (DPO) Contact Details
              </h2>
              <p>
                If you have inquiries, complaints, or wish to exercise your data subject rights under RA 10173, 
                you may contact our Data Protection Office directly:
              </p>
              <Card className="p-6 border-white/10 bg-[#0f0f12]">
                <div className="space-y-3 text-xs sm:text-sm">
                  <p className="text-white font-bold uppercase tracking-wider font-mono">
                    The DGym Data Protection Office
                  </p>
                  <p className="text-white/70">
                    <strong className="text-white">Facility Address:</strong> Rosario, Batangas, Philippines
                  </p>
                  <p className="text-white/70">
                    <strong className="text-white">Official Facebook Channel:</strong>{' '}
                    <a
                      href="https://www.facebook.com/profile.php?id=61577169056417"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-red hover:underline"
                    >
                      The DGym Rosario Batangas
                    </a>
                  </p>
                  <p className="text-white/70">
                    <strong className="text-white">Web Contact Portal:</strong>{' '}
                    <Link to="/contact" className="text-red hover:underline">
                      thedgym.com/contact
                    </Link>
                  </p>
                  <p className="text-white/40 text-[11px] pt-2 border-t border-white/8 font-mono">
                    Inquiries are addressed within fifteen (15) business days in accordance with NPC guidelines.
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
