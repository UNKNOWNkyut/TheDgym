import { Component, lazy, Suspense, useEffect, useState, type ErrorInfo, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom'

import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RootLayout } from '@/components/layout/RootLayout'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { CookieBanner } from '@/components/ui/CookieBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { QuarterRing } from '@/components/ui/quarter-ring'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// ─── Public Pages ─────────────────────────────────────────────────────────────
const AboutPage = lazy(() => import('@/pages/AboutPage').then((m) => ({ default: m.AboutPage })))
const MembershipPage = lazy(() => import('@/pages/MembershipPage').then((m) => ({ default: m.MembershipPage })))
const ClassesPage = lazy(() => import('@/pages/ClassesPage').then((m) => ({ default: m.ClassesPage })))
const TrainersPage = lazy(() => import('@/pages/TrainersPage').then((m) => ({ default: m.TrainersPage })))
const ContactPage = lazy(() => import('@/pages/ContactPage').then((m) => ({ default: m.ContactPage })))
const FAQPage = lazy(() => import('@/pages/FAQPage').then((m) => ({ default: m.FAQPage })))
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage').then((m) => ({ default: m.PrivacyPolicyPage })))
const TermsOfUsePage = lazy(() => import('@/pages/TermsOfUsePage').then((m) => ({ default: m.TermsOfUsePage })))
const LoginPage = lazy(() => import('@/pages/LoginPage').then((m) => ({ default: m.LoginPage })))
const RegisterPage = lazy(() => import('@/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })))
const PaymentPage = lazy(() => import('@/pages/PaymentPage').then((m) => ({ default: m.PaymentPage })))

// ─── Portal & Management Pages ────────────────────────────────────────────────
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const MemberSettingsPage = lazy(() => import('@/pages/MemberSettingsPage').then((m) => ({ default: m.MemberSettingsPage })))
const YourPlanPage = lazy(() => import('@/pages/YourPlanPage').then((m) => ({ default: m.YourPlanPage })))
const BookTrainerPage = lazy(() => import('@/pages/manage/BookTrainerPage').then((m) => ({ default: m.BookTrainerPage })))
const ManageOverviewPage = lazy(() => import('@/pages/manage/ManageOverviewPage').then((m) => ({ default: m.ManageOverviewPage })))
const ManageMembersPage = lazy(() => import('@/pages/manage/ManageMembersPage').then((m) => ({ default: m.ManageMembersPage })))
const MemberFormPage = lazy(() => import('@/pages/manage/MemberFormPage').then((m) => ({ default: m.MemberFormPage })))
const MemberDetailPage = lazy(() => import('@/pages/manage/MemberDetailPage').then((m) => ({ default: m.MemberDetailPage })))
const ManagePlansPage = lazy(() => import('@/pages/manage/ManagePlansPage').then((m) => ({ default: m.ManagePlansPage })))
const ManageUsersPage = lazy(() => import('@/pages/manage/ManageUsersPage').then((m) => ({ default: m.ManageUsersPage })))
const ManageVisitsPage = lazy(() => import('@/pages/manage/ManageVisitsPage').then((m) => ({ default: m.ManageVisitsPage })))
const MobileScannerPage = lazy(() => import('@/pages/manage/MobileScannerPage').then((m) => ({ default: m.MobileScannerPage })))
const ManageClassesPage = lazy(() => import('@/pages/manage/ManageClassesPage').then((m) => ({ default: m.ManageClassesPage })))
const ManagePTSessionsPage = lazy(() => import('@/pages/manage/ManagePTSessionsPage').then((m) => ({ default: m.ManagePTSessionsPage })))
const ManageFinancePage = lazy(() => import('@/pages/manage/ManageFinancePage').then((m) => ({ default: m.ManageFinancePage })))
const ManageExpensesPage = lazy(() => import('@/pages/manage/ManageExpensesPage').then((m) => ({ default: m.ManageExpensesPage })))
const ManageAnalyticsPage = lazy(() => import('@/pages/manage/ManageAnalyticsPage').then((m) => ({ default: m.ManageAnalyticsPage })))

function PageFallback() {
  return (
    <div className="container-dgym py-20 space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/5" />
    </div>
  )
}

function IntroLoader() {
  const [visible, setVisible] = useState(() => {
    try {
      return !sessionStorage.getItem('dgym_intro_shown')
    } catch {
      return true
    }
  })
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!visible) return

    try {
      sessionStorage.setItem('dgym_intro_shown', 'true')
    } catch {
      // Ignore sessionStorage restrictions in private browsing
    }

    const fadeTimer = window.setTimeout(() => setFading(true), 1200)
    const removeTimer = window.setTimeout(() => setVisible(false), 1600)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(removeTimer)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white transition-opacity duration-500 ${
        fading ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      role="status"
      aria-label="Loading DGym"
    >
      <img
        src="/assets/logos/thedgym.png"
        alt="The DGym"
        className="mb-8 h-32 w-auto object-contain"
      />
      <QuarterRing className="size-12 text-red-600" />
      <p className="mt-5 text-sm tracking-widest text-gray-400">LOADING...</p>
    </div>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
  resetKey: string
}

interface ErrorBoundaryState {
  hasError: boolean
  isChunkError: boolean
  lastResetKey: string
}

function isChunkLoadError(error: Error): boolean {
  return (
    error.name === 'ChunkLoadError' ||
    /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
      error.message,
    )
  )
}

class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, isChunkError: false, lastResetKey: '' }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, isChunkError: isChunkLoadError(error) }
  }

  static getDerivedStateFromProps(
    nextProps: ErrorBoundaryProps,
    prevState: ErrorBoundaryState,
  ): Partial<ErrorBoundaryState> | null {
    if (nextProps.resetKey !== prevState.lastResetKey) {
      return { hasError: false, isChunkError: false, lastResetKey: nextProps.resetKey }
    }
    return null
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application error boundary caught an error:', error, info.componentStack)
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    this.setState({ hasError: false, isChunkError: false })
    window.location.assign('/')
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="min-h-screen bg-[#070709] text-white flex items-center justify-center px-4 py-16"
        >
          <div className="max-w-md w-full rounded-2xl border border-white/10 bg-[#0d0d11] p-8 text-center space-y-5">
            <p className="text-xs font-mono uppercase tracking-widest text-red-400">
              {this.state.isChunkError ? 'App Update Available' : 'Unexpected Error'}
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {this.state.isChunkError ? 'A new version was loaded' : 'Something went wrong'}
            </h1>
            <p className="text-sm font-light text-white/60 leading-relaxed">
              {this.state.isChunkError
                ? 'This page bundle is out of date or failed to download. Reload to fetch the latest view.'
                : 'An unexpected rendering error interrupted this page. Reload or return to the home page to continue.'}
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="px-4 py-2.5 rounded-xl bg-red hover:bg-red-hover text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Reload Page
              </button>
              <button
                type="button"
                onClick={this.handleGoHome}
                className="px-4 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white text-xs font-mono font-bold uppercase tracking-wider transition-colors cursor-pointer"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation()
  return <AppErrorBoundary resetKey={pathname}>{children}</AppErrorBoundary>
}

function App() {
  return (
    <BrowserRouter>
      <RoutedErrorBoundary>
        <AuthProvider>
          <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* ============================================================
                STANDALONE MEMBER SETTINGS
                No ManagementLayout = no left sidebar
            ============================================================ */}
            <Route
              path="/settings"
              element={
                <ProtectedRoute allowedRoles={['member']}>
                  <MemberSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* ============================================================
                PUBLIC WEBSITE
            ============================================================ */}
            <Route element={<RootLayout />}>
              <Route path="/" element={<HomePage />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/membership" element={<MembershipPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/trainers" element={<TrainersPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/faq" element={<FAQPage />} />
              <Route path="/privacy" element={<PrivacyPolicyPage />} />
              <Route path="/terms" element={<TermsOfUsePage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
              <Route path="/payment" element={<PaymentPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>

            {/* ============================================================
                AUTHENTICATED DASHBOARD / MANAGEMENT PORTAL
            ============================================================ */}
            <Route
              element={
                <ProtectedRoute>
                  <ManagementLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/book" element={<BookTrainerPage />} />
              <Route
                path="/dashboard/plan"
                element={
                  <ProtectedRoute allowedRoles={['member']}>
                    <YourPlanPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ManageOverviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/members"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'trainer']}>
                    <ManageMembersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/members/new"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <MemberFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/members/:id"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'trainer']}>
                    <MemberDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/plans"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ManagePlansPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/users"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ManageUsersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/visits"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'trainer']}>
                    <ManageVisitsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/scanner"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'staff']}>
                    <MobileScannerPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/classes"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'trainer']}>
                    <ManageClassesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/pt-sessions"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'trainer']}>
                    <ManagePTSessionsPage />
                  </ProtectedRoute>
                }
              />

              {/* Finance — Admin Only */}
              <Route
                path="/manage/finance"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ManageFinancePage />
                  </ProtectedRoute>
                }
              />

              {/* Expenses — Admin Only */}
              <Route
                path="/manage/expenses"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ManageExpensesPage />
                  </ProtectedRoute>
                }
              />

              {/* Analytics & Churn Prediction — Admin Only */}
              <Route
                path="/manage/analytics"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <ManageAnalyticsPage />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
          </Suspense>

          <IntroLoader />
          <CookieBanner />
        </AuthProvider>
      </RoutedErrorBoundary>
    </BrowserRouter>
  )
}

export default App
