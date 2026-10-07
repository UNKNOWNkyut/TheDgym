import { type ReactNode } from 'react'
import { Navigate, useLocation, Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import type { UserRole } from '@/types/auth'
import { Button } from '@/components/ui/Button'

interface ProtectedRouteProps {
  children: ReactNode
  allowedRoles?: UserRole[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8">
        <div className="w-10 h-10 border-2 border-red border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm text-white/40 uppercase tracking-widest font-mono">
          Verifying session...
        </p>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="container-dgym py-20 flex flex-col items-center justify-center text-center">
        <div className="w-16 h-16 rounded-2xl bg-danger/10 border border-danger/20 flex items-center justify-center text-danger mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-bold uppercase text-white mb-2">
          Access Restricted
        </h1>
        <p className="text-sm text-white/50 max-w-md mb-8 leading-relaxed">
          Your current role (<span className="text-red uppercase font-semibold">{user.role}</span>) does not have permission to view this section.
        </p>
        <Link to="/dashboard">
          <Button variant="secondary">Go to My Dashboard</Button>
        </Link>
      </div>
    )
  }

  return <>{children}</>
}
