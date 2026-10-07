import { useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Skeleton, SkeletonCard, SkeletonStat, SkeletonRow } from '@/components/ui/Skeleton'

gsap.registerPlugin(ScrollTrigger)

/**
 * Design System Kitchen Sink Page (Phase 1 only)
 * Visual verification of every base component.
 * Will be replaced by real pages in Phase 2.
 */
export function DesignSystemPage() {
  const heroRef = useRef<HTMLDivElement>(null)
  const sectionsRef = useRef<HTMLDivElement>(null)

  // Hero entrance animation
  useGSAP(() => {
    if (!heroRef.current) return

    gsap.fromTo(
      heroRef.current.querySelectorAll('.hero-animate'),
      { opacity: 0, y: 40 },
      {
        opacity: 1,
        y: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.1,
      }
    )
  }, { scope: heroRef })

  // Scroll-triggered section reveals
  useGSAP(() => {
    if (!sectionsRef.current) return

    const sections = sectionsRef.current.querySelectorAll('.reveal-section')
    sections.forEach((el) => {
      gsap.fromTo(
        el,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            once: true,
          },
        }
      )
    })
  }, { scope: sectionsRef })

  return (
    <div>
      {/* Hero Section */}
      <section
        ref={heroRef}
        className="section-padding border-b border-white/8 relative overflow-hidden"
      >
        {/* Ambient red glow behind hero */}
        <div
          aria-hidden="true"
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red/8 rounded-full blur-[120px] pointer-events-none"
        />

        <div className="container-dgym relative">
          <p className="hero-animate text-xs font-semibold uppercase tracking-widest text-white/40 mb-4">
            Design System — Phase 1
          </p>
          <h1 className="hero-animate font-display text-5xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight text-white leading-none mb-6">
            The DGym
          </h1>
          <p className="hero-animate text-lg md:text-xl text-white/60 max-w-xl mb-8">
            Elevate your fitness journey at our Premium Fitness Gym in Lobo.
          </p>
          <div className="hero-animate flex flex-wrap gap-3">
            <Button size="lg">Join Now</Button>
            <Button variant="secondary" size="lg">View Membership</Button>
            <Button variant="ghost" size="lg">Learn More</Button>
          </div>
        </div>
      </section>

      {/* Component Sections */}
      <div ref={sectionsRef} className="container-dgym py-16 space-y-20">

        {/* --- BUTTONS --- */}
        <section className="reveal-section">
          <SectionLabel>Buttons</SectionLabel>
          <div className="space-y-6">

            {/* Variants */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Variants</p>
              <div className="flex flex-wrap gap-3">
                <Button variant="primary">Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="danger">Danger</Button>
              </div>
            </div>

            {/* Sizes */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Sizes</p>
              <div className="flex flex-wrap items-center gap-3">
                <Button size="sm">Small</Button>
                <Button size="md">Medium</Button>
                <Button size="lg">Large</Button>
              </div>
            </div>

            {/* States */}
            <div>
              <p className="text-xs text-white/30 uppercase tracking-widest mb-3">States</p>
              <div className="flex flex-wrap gap-3">
                <Button loading>Loading</Button>
                <Button disabled>Disabled</Button>
              </div>
            </div>

            {/* Full Width */}
            <div className="max-w-sm">
              <p className="text-xs text-white/30 uppercase tracking-widest mb-3">Full Width</p>
              <Button fullWidth>Full Width Button</Button>
            </div>
          </div>
        </section>

        {/* --- BADGES --- */}
        <section className="reveal-section">
          <SectionLabel>Badges</SectionLabel>
          <div className="flex flex-wrap gap-3">
            <Badge variant="default">Default</Badge>
            <Badge variant="success" dot>Active</Badge>
            <Badge variant="warning" dot>Medium Risk</Badge>
            <Badge variant="danger" dot>High Risk</Badge>
            <Badge variant="info">Info</Badge>
            <Badge variant="red">Premium</Badge>
            <Badge variant="success" size="md" dot>Large Success</Badge>
          </div>
        </section>

        {/* --- CARDS --- */}
        <section className="reveal-section">
          <SectionLabel>Cards</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader title="Standard Card" subtitle="Default hover border" />
              <p className="text-sm text-white/50">
                This is a standard card with a subtle border that brightens on hover.
              </p>
            </Card>
            <Card featured>
              <CardHeader
                title="Featured Card"
                subtitle="Red glow on hover"
                action={<Badge variant="red">New</Badge>}
              />
              <p className="text-sm text-white/50">
                Featured cards use a red glow effect for premium or highlighted content.
              </p>
            </Card>
            <Card>
              <CardHeader title="With Action" action={<Button size="sm" variant="secondary">Edit</Button>} />
              <p className="text-sm text-white/50">
                Cards can contain actions in the header slot.
              </p>
            </Card>
          </div>
        </section>

        {/* --- INPUTS --- */}
        <section className="reveal-section">
          <SectionLabel>Form Inputs</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl">
            <Input label="Full Name" placeholder="Dana Smith" />
            <Input label="Email Address" type="email" placeholder="dana@example.com" />
            <Input
              label="With Hint"
              placeholder="Enter value"
              hint="This is a helpful hint below the field."
            />
            <Input
              label="With Error"
              placeholder="Invalid input"
              defaultValue="bad input"
              error="This field is required."
            />
          </div>
        </section>

        {/* --- TYPOGRAPHY --- */}
        <section className="reveal-section">
          <SectionLabel>Typography</SectionLabel>
          <div className="space-y-4">
            <p className="font-display text-6xl font-black uppercase tracking-tight text-white">Display Heading</p>
            <h1 className="font-display text-4xl uppercase tracking-tight">Heading 1</h1>
            <h2 className="font-display text-3xl uppercase tracking-tight">Heading 2</h2>
            <h3 className="font-display text-2xl uppercase tracking-tight">Heading 3</h3>
            <p className="text-base text-white/70 max-w-2xl">
              Body text: Inter at 1rem, line-height 1.65. Constrained to 65ch for comfortable reading.
              This is how paragraph text appears throughout the site.
            </p>
            <p className="text-sm text-white/50">
              Small / secondary text at 0.875rem, white/50.
            </p>
            <p className="text-xs uppercase tracking-widest text-white/30">
              Label / Micro-copy — uppercase, widest tracking, white/30
            </p>
            <p className="font-mono text-sm text-white/60">
              Monospace: JetBrains Mono — for data tables and metrics
            </p>
          </div>
        </section>

        {/* --- SKELETONS --- */}
        <section className="reveal-section">
          <SectionLabel>Loading Skeletons</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <SkeletonCard />
            <SkeletonStat />
            <div className="bg-surface rounded-xl border border-white/8 p-6">
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Skeleton className="h-6 w-24" rounded="full" />
            <Skeleton className="h-6 w-32" rounded="full" />
            <Skeleton className="h-6 w-20" rounded="full" />
          </div>
        </section>

        {/* --- COLOR SYSTEM --- */}
        <section className="reveal-section">
          <SectionLabel>Color Tokens</SectionLabel>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { name: 'Red (Brand)', bg: 'bg-red' },
              { name: 'Success', bg: 'bg-success' },
              { name: 'Warning', bg: 'bg-warning' },
              { name: 'Danger', bg: 'bg-danger' },
              { name: 'Black', bg: 'bg-black border border-white/10' },
              { name: 'Surface', bg: 'bg-surface border border-white/10' },
              { name: 'Surface 2', bg: 'bg-surface-2 border border-white/10' },
              { name: 'Surface 3', bg: 'bg-surface-3 border border-white/10' },
            ].map(({ name, bg }) => (
              <div key={name}>
                <div className={`h-14 rounded-lg ${bg} mb-2`} />
                <p className="text-xs text-white/40">{name}</p>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-6 pb-4 border-b border-white/8">
      <p className="text-xs font-semibold uppercase tracking-widest text-white/30 mb-1">
        Component
      </p>
      <h2 className="font-display text-2xl font-bold uppercase tracking-wide text-white">
        {children}
      </h2>
    </div>
  )
}
