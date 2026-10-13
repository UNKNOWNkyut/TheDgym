import { useState, useRef, useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { gsap } from 'gsap'
import { useGSAP } from '@gsap/react'
import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/Badge'
import type { NavItem } from '@/types'

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Membership', href: '/membership' },
  { label: 'Classes', href: '/classes' },
  { label: 'Trainers', href: '/trainers' },
  { label: 'Contact', href: '/contact' },
]

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false)

  const { user, isAuthenticated, logout } = useAuth()
  const location = useLocation()
  const mobileMenuRef = useRef<HTMLDivElement>(null)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const profileDropdownRef = useRef<HTMLDivElement>(null)

  // Detect scroll for header background
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close menus on route change
  useEffect(() => {
    setMenuOpen(false)
    setProfileDropdownOpen(false)
  }, [location.pathname])

  // Click outside listener for profile dropdown
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setProfileDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
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

  const isStaffOrAdmin = user?.role === 'admin' || user?.role === 'staff'
  const isGymMember = Boolean(user?.has_active_membership) || isStaffOrAdmin

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

          {/* Desktop CTA / User Profile Area */}
          <div className="hidden md:flex items-center gap-4">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-3">
                {/* Action button next to avatar */}
                {isGymMember ? (
                  <Link
                    to={isStaffOrAdmin ? '/manage' : '/dashboard'}
                    className="text-xs font-semibold px-4 py-2 rounded-lg border border-white/15 bg-white/5 hover:bg-white/10 hover:border-white/30 text-white transition-all duration-150 flex items-center gap-1.5"
                  >
                    <span>{isStaffOrAdmin ? 'Management Hub' : 'Dashboard'}</span>
                    <span className="text-white/40">→</span>
                  </Link>
                ) : (
                  <Link
                    to="/membership"
                    className="text-xs font-semibold px-4 py-2 rounded-lg bg-red text-white hover:bg-red-hover hover:shadow-[0_0_20px_rgba(229,32,26,0.35)] transition-all duration-150"
                  >
                    Join Now
                  </Link>
                )}

                {/* Round Profile Avatar with Dropdown */}
                <div ref={profileDropdownRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setProfileDropdownOpen((prev) => !prev)}
                    className="w-10 h-10 rounded-full border-2 border-white/20 hover:border-white/50 focus:border-red focus:outline-none transition-all duration-150 overflow-hidden flex items-center justify-center bg-[#17171a] shadow-md group cursor-pointer"
                    aria-expanded={profileDropdownOpen}
                    aria-label="User profile menu"
                  >
                    {user.profile_picture_url ? (
                      <img
                        src={user.profile_picture_url}
                        alt={user.full_name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-xs font-bold text-white uppercase group-hover:text-red transition-colors">
                        {getInitials(user.full_name)}
                      </span>
                    )}
                  </button>

                  {/* Dropdown Menu */}
                  {profileDropdownOpen && (
                    <div className="absolute right-0 mt-3 w-64 rounded-2xl border border-white/10 bg-[#111114]/95 backdrop-blur-xl shadow-2xl p-2 z-50 animate-fade-in">
                      {/* User Header */}
                      <div className="p-3 border-b border-white/8 mb-1">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-9 h-9 rounded-full bg-red/15 border border-red/30 flex items-center justify-center text-xs font-bold text-white shrink-0 overflow-hidden">
                            {user.profile_picture_url ? (
                              <img
                                src={user.profile_picture_url}
                                alt={user.full_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              getInitials(user.full_name)
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-semibold text-white truncate leading-tight">
                              {user.full_name}
                            </p>
                            <p className="text-[11px] text-white/40 truncate mt-0.5">
                              {user.email}
                            </p>
                          </div>
                        </div>

                        <div className="mt-2">
                          {isGymMember ? (
                            <Badge variant="success" dot size="sm">
                              ACTIVE MEMBER
                            </Badge>
                          ) : (
                            <Badge variant="default" dot size="sm">
                              REGISTERED USER
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Menu Links */}
                      <div className="space-y-0.5 text-xs">
                        {isGymMember ? (
                          <Link
                            to={isStaffOrAdmin ? '/manage' : '/dashboard'}
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                          >
                            <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                            </svg>
                            <span>{isStaffOrAdmin ? 'Management Hub' : 'Member Dashboard'}</span>
                          </Link>
                        ) : (
                          <Link
                            to="/membership"
                            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-red hover:bg-red/10 transition-colors font-medium"
                          >
                            <svg className="w-4 h-4 text-red" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <span>Avail a Training Plan</span>
                          </Link>
                        )}

                        <Link
                          to="/settings"
                          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-white/80 hover:text-white hover:bg-white/5 transition-colors"
                        >
                          <svg className="w-4 h-4 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>Account Settings</span>
                        </Link>

                        <div className="border-t border-white/8 my-1 pt-1">
                          <button
                            type="button"
                            onClick={() => logout()}
                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/50 hover:text-red hover:bg-red/5 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span>Sign Out</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                  className="text-sm font-semibold px-5 py-2.5 rounded-lg bg-red text-white hover:bg-red-hover hover:shadow-[0_0_20px_rgba(229,32,26,0.35)] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2"
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
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg gap-1.5 text-white/70 hover:text-white hover:bg-white/5 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-white/50 focus-visible:outline-offset-2"
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
                  <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-white/5 border border-white/10">
                    <div className="w-10 h-10 rounded-full border border-white/20 overflow-hidden bg-red flex items-center justify-center text-xs font-bold text-white shrink-0">
                      {user.profile_picture_url ? (
                        <img
                          src={user.profile_picture_url}
                          alt={user.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getInitials(user.full_name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white truncate">{user.full_name}</p>
                      <div className="mt-1">
                        {isGymMember ? (
                          <Badge variant="success" dot size="sm">ACTIVE MEMBER</Badge>
                        ) : (
                          <Badge variant="default" dot size="sm">REGISTERED USER</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {isGymMember ? (
                    <Link
                      to={isStaffOrAdmin ? '/manage' : '/dashboard'}
                      className="py-3 px-4 text-base font-semibold text-white bg-red rounded-lg text-center hover:bg-red-hover transition-colors duration-150"
                    >
                      {isStaffOrAdmin ? 'Go to Management Hub' : 'Go to Member Dashboard'}
                    </Link>
                  ) : (
                    <Link
                      to="/membership"
                      className="py-3 px-4 text-base font-semibold text-white bg-red rounded-lg text-center hover:bg-red-hover transition-colors duration-150"
                    >
                      Avail a Training Plan
                    </Link>
                  )}

                  <Link
                    to="/settings"
                    className="py-2.5 px-4 text-sm text-white/70 hover:text-white rounded-lg text-center border border-white/10 hover:border-white/20 transition-colors"
                  >
                    Account Settings
                  </Link>

                  <button
                    onClick={() => logout()}
                    className="py-2.5 px-4 text-sm text-white/50 hover:text-red rounded-lg text-center border border-white/10 transition-colors"
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
