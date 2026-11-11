import { useState, useCallback, useEffect, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ScrollProgressBar } from '@/components/layout/ScrollProgressBar'
import { BackToTop } from '@/components/layout/BackToTop'
import { DotPattern, DotThemeContext, type DotThemeMode } from '@/components/ui/dot-pattern'
import { useLenis } from '@/hooks/useLenis'

interface RootLayoutProps {
  children?: ReactNode
}

/**
 * RootLayout wraps public pages (Home, About, Membership, Classes, Trainers, Contact).
 * Provides the global DotPattern background and Light/Dark DotThemeContext.
 */
export function RootLayout({ children }: RootLayoutProps) {
  useLenis()
  const location = useLocation()
  const hideFooter = location.pathname === '/login'

  const [theme, setTheme] = useState<DotThemeMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('dgym_dot_theme')
      if (saved === 'light' || saved === 'dark') return saved
    }
    return 'dark'
  })

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.setAttribute('data-dot-theme', theme)
    document.documentElement.classList.toggle('dark', theme === 'dark')
    return () => {
      document.documentElement.setAttribute('data-dot-theme', 'dark')
      document.documentElement.classList.add('dark')
    }
  }, [theme])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: DotThemeMode = prev === 'dark' ? 'light' : 'dark'
      if (typeof window !== 'undefined') {
        window.localStorage.setItem('dgym_dot_theme', next)
      }
      return next
    })
  }, [])

  return (
    <DotThemeContext.Provider value={{ theme, toggleTheme }}>
      <div
        data-dot-theme={theme}
        className={[
          'relative min-h-screen transition-colors duration-500',
          theme === 'light' ? 'bg-[#f4f4f6] text-zinc-900' : 'bg-[#09090b] text-white',
        ].join(' ')}
      >
        {/* Subtle Global DotPattern Background across /, /about, /membership, /classes, /trainers, /contact */}
        <div
          className={[
            'pointer-events-none fixed inset-0 z-0 transition-opacity duration-500',
            theme === 'light' ? 'opacity-70' : 'opacity-25',
          ].join(' ')}
          aria-hidden="true"
        >
          <DotPattern
            width={24}
            height={24}
            cx={1}
            cy={1}
            cr={1}
            className={
              theme === 'light'
                ? 'fill-zinc-400/75 md:fill-zinc-500/70'
                : 'fill-slate-500/40 md:fill-slate-400/50'
            }
          />
        </div>

        {/* Accessibility: skip to main content */}
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>

        {/* Scroll progress indicator */}
        <ScrollProgressBar />

        {/* Staggered GSAP Header & Side Navigation */}
        <Header />

        {/* Page content */}
        <main
          id="main-content"
          tabIndex={-1}
          className="relative z-10 flex flex-col min-h-screen pt-20 md:pt-24"
          style={{ outline: 'none' }}
        >
          {children || <Outlet />}
        </main>

        {/* Footer (hidden on /login) */}
        {!hideFooter && (
          <div className="relative z-10">
            <Footer />
          </div>
        )}

        {/* Back to top */}
        <BackToTop />
      </div>
    </DotThemeContext.Provider>
  )
}
