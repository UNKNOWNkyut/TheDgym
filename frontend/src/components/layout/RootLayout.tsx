import { type ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ScrollProgressBar } from '@/components/layout/ScrollProgressBar'
import { BackToTop } from '@/components/layout/BackToTop'
import { useLenis } from '@/hooks/useLenis'

interface RootLayoutProps {
  children?: ReactNode
}

/**
 * RootLayout wraps public pages (Home, About, Membership, Classes, Trainers, Contact).
 * Accessible to both visitors and registered members alike.
 */
export function RootLayout({ children }: RootLayoutProps) {
  useLenis()

  return (
    <>
      {/* Accessibility: skip to main content */}
      <a href="#main-content" className="skip-to-content">
        Skip to content
      </a>

      {/* Scroll progress indicator */}
      <ScrollProgressBar />

      {/* Sticky header */}
      <Header />

      {/* Page content */}
      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-col min-h-screen pt-20 md:pt-24"
        style={{ outline: 'none' }}
      >
        {children || <Outlet />}
      </main>

      {/* Footer */}
      <Footer />

      {/* Back to top */}
      <BackToTop />
    </>
  )
}
