import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { useAuth } from '@/context/AuthContext'
import type { NavItem } from '@/types'

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Membership', href: '/membership' },
  { label: 'Classes', href: '/classes' },
  { label: 'Trainers', href: '/trainers' },
  { label: 'Contact', href: '/contact' },
]

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)

  // Detect scroll for header background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Lock body scroll when menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  // Animate mobile menu open/close
  useGSAP(() => {
    const menu = mobileMenuRef.current
    if (!menu) return

    if (menuOpen) {
      gsap.fromTo(
        menu,
        { opacity: 0, y: -12 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power3.out' }
      )
    } else {
      gsap.to(menu, {
        opacity: 0,
        y: -12,
        duration: 0.2,
        ease: 'power2.in',
      })
    }
  }, [menuOpen])

  const isActive = (href: string) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href)

  return (
    <header
      className={[
        'fixed top-0 left-0 right-0 z-50',
        'transition-all duration-300',
        scrolled
          ? 'bg-black/85 backdrop-blur-md border-b border-white/8 shadow-[0_1px_0_rgba(255,255,255,0.05)]'
          : 'bg-transparent',
      ].join(' ')}
      role="banner"
    >
      <div className="container-dgym">
        <div className="flex items-center justify-between h-20 md:h-24">

          {/* Logo */}
          <Link
            to="/"
            aria-label="The DGym — Go to homepage"
            className="flex items-center shrink-0 focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2 rounded-sm py-1"
          >
            <img
              src="/assets/logos/thedgym.png"
              alt="The DGym Rosario Batangas"
              width={220}
              height={70}
              className="h-12 sm:h-14 md:h-16 lg:h-18 w-auto object-contain drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)] transition-transform duration-200 hover:scale-105"
              loading="eager"
            />
          </Link>

          {/* Desktop Navigation */}
          <nav
            aria-label="Main navigation"
            className="hidden md:flex items-center gap-1"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={[
                  'px-4 py-2 text-sm rounded-lg transition-colors duration-150',
                  'focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2',
                  isActive(item.href)
                    ? 'text-white font-semibold'
                    : 'text-white/60 hover:text-white hover:bg-white/5',
                ].join(' ')}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                <Link
                  to="/dashboard"
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-150 group"
                >
                  <div className="w-8 h-8 rounded-full bg-red text-white flex items-center justify-center text-xs font-bold uppercase tracking-wider shadow-sm">
                    {user.full_name.slice(0, 2)}
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-semibold text-white group-hover:text-red transition-colors leading-none">
                      {user.full_name.split(' ')[0]}
                    </p>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-mono">
                      {user.role}
                    </span>
                  </div>
                </Link>

                <button
                  onClick={() => logout()}
                  className="text-xs text-white/40 hover:text-white px-2.5 py-2 transition-colors duration-150 rounded-lg hover:bg-white/5"
                  title="Sign Out"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <>
                <Link
                  to="/login"
                  className="text-sm text-white/60 hover:text-white px-4 py-2 transition-colors duration-150 rounded-lg focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2"
                >
                  Sign in
                </Link>
                <Link
                  to="/membership"
                  className={[
                    'text-sm font-semibold px-5 py-2.5 rounded-lg',
                    'bg-red text-white',
                    'hover:bg-red-hover hover:shadow-[0_0_20px_rgba(229,32,26,0.35)]',
                    'transition-all duration-150',
                    'focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2',
                  ].join(' ')}
                >
                  Join Now
                </Link>
              </>
            )}
          </div>

          {/* Hamburger — Mobile */}
          <button
            ref={hamburgerRef}
            onClick={() => setMenuOpen((prev) => !prev)}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            className={[
              'md:hidden flex flex-col justify-center items-center',
              'w-10 h-10 rounded-lg gap-1.5',
              'text-white/70 hover:text-white hover:bg-white/5',
              'transition-colors duration-150',
              'focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2',
            ].join(' ')}
          >
            <span
              className={[
                'block w-5 h-0.5 bg-current rounded-full transition-all duration-200',
                menuOpen ? 'translate-y-2 rotate-45' : '',
              ].join(' ')}
            />
            <span
              className={[
                'block w-5 h-0.5 bg-current rounded-full transition-all duration-200',
                menuOpen ? 'opacity-0 scale-x-0' : '',
              ].join(' ')}
            />
            <span
              className={[
                'block w-5 h-0.5 bg-current rounded-full transition-all duration-200',
                menuOpen ? '-translate-y-2 -rotate-45' : '',
              ].join(' ')}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      {menuOpen && (
        <div
          id="mobile-menu"
          ref={mobileMenuRef}
          className="md:hidden bg-black/95 backdrop-blur-md border-t border-white/8"
          role="dialog"
          aria-label="Mobile navigation menu"
        >
          <nav
            aria-label="Mobile navigation"
            className="container-dgym py-4 flex flex-col"
          >
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                className={[
                  'py-3 px-4 text-base rounded-lg transition-colors duration-150',
                  'border-b border-white/5 last:border-0',
                  'focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2',
                  isActive(item.href)
                    ? 'text-white font-semibold'
                    : 'text-white/60 hover:text-white',
                ].join(' ')}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ))}

            <div className="flex flex-col gap-3 mt-4 pt-4 border-t border-white/8">
              {isAuthenticated && user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/5 border border-white/10">
                    <div className="w-10 h-10 rounded-full bg-red text-white flex items-center justify-center text-sm font-bold uppercase">
                      {user.full_name.slice(0, 2)}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">{user.full_name}</p>
                      <span className="text-[10px] uppercase tracking-widest text-white/40 font-mono">
                        {user.role} • {user.email}
                      </span>
                    </div>
                  </div>
                  <Link
                    to="/dashboard"
                    className="py-3 px-4 text-base font-semibold text-white bg-red rounded-lg text-center hover:bg-red-hover transition-colors duration-150"
                  >
                    Go to Dashboard
                  </Link>
                  <button
                    onClick={() => logout()}
                    className="py-2.5 px-4 text-sm text-white/50 hover:text-white rounded-lg text-center border border-white/10 transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="py-3 px-4 text-base text-white/60 hover:text-white rounded-lg text-center border border-white/10 hover:border-white/20 transition-colors duration-150"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/membership"
                    className="py-3 px-4 text-base font-semibold text-white bg-red rounded-lg text-center hover:bg-red-hover transition-colors duration-150"
                  >
                    Join Now
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  )
}
