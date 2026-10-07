import { type ReactNode } from 'react'
import { Outlet, Navigate } from 'react-router-dom'
import { Header } from '@/components/layout/Header'
import { Footer } from '@/components/layout/Footer'
import { ScrollProgressBar } from '@/components/layout/ScrollProgressBar'
import { BackToTop } from '@/components/layout/BackToTop'
import { useLenis } from '@/hooks/useLenis'
import { useAuth } from '@/context/AuthContext'

interface RootLayoutProps {
  children?: ReactNode
}

/**
 * RootLayout wraps public pages.
 * If user is authenticated, it redirects immediately to the user's dedicated dashboard portal.
 * Public website & marketing tabs are NOT visible to authenticated users.
 */
export function RootLayout({ children }: RootLayoutProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  useLenis()

  // Authenticated users are prevented from seeing the public website
  if (!isLoading && isAuthenticated && user) {
    const destination = user.role === 'admin' || user.role === 'staff' ? '/manage' : '/dashboard'
    return <Navigate to={destination} replace />
  }

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
