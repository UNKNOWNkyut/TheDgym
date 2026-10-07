import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AuthProvider } from '@/context/AuthContext'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { RootLayout } from '@/components/layout/RootLayout'
import { ManagementLayout } from '@/components/layout/ManagementLayout'
import { CookieBanner } from '@/components/ui/CookieBanner'
import { Skeleton } from '@/components/ui/Skeleton'
import { HomePage } from '@/pages/HomePage'
import { NotFoundPage } from '@/pages/NotFoundPage'

// Route-level code splitting for public pages
const AboutPage          = lazy(() => import('@/pages/AboutPage').then(m => ({ default: m.AboutPage })))
const MembershipPage     = lazy(() => import('@/pages/MembershipPage').then(m => ({ default: m.MembershipPage })))
const ClassesPage        = lazy(() => import('@/pages/ClassesPage').then(m => ({ default: m.ClassesPage })))
const TrainersPage       = lazy(() => import('@/pages/TrainersPage').then(m => ({ default: m.TrainersPage })))
const ContactPage        = lazy(() => import('@/pages/ContactPage').then(m => ({ default: m.ContactPage })))
const FAQPage            = lazy(() => import('@/pages/FAQPage').then(m => ({ default: m.FAQPage })))
const LoginPage          = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const RegisterPage       = lazy(() => import('@/pages/RegisterPage').then(m => ({ default: m.RegisterPage })))

// Authenticated portal pages
const DashboardPage      = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const ManageOverviewPage  = lazy(() => import('@/pages/manage/ManageOverviewPage').then(m => ({ default: m.ManageOverviewPage })))
const ManageMembersPage   = lazy(() => import('@/pages/manage/ManageMembersPage').then(m => ({ default: m.ManageMembersPage })))
const MemberFormPage      = lazy(() => import('@/pages/manage/MemberFormPage').then(m => ({ default: m.MemberFormPage })))
const MemberDetailPage    = lazy(() => import('@/pages/manage/MemberDetailPage').then(m => ({ default: m.MemberDetailPage })))
const ManagePlansPage     = lazy(() => import('@/pages/manage/ManagePlansPage').then(m => ({ default: m.ManagePlansPage })))
const ManageUsersPage     = lazy(() => import('@/pages/manage/ManageUsersPage').then(m => ({ default: m.ManageUsersPage })))

// Page-level loading fallback
function PageFallback() {
  return (
    <div className="container-dgym py-20 space-y-6">
      <Skeleton className="h-8 w-1/3" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="h-4 w-2/5" />
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Public Marketing Section (RootLayout with header & footer — hidden once logged in) */}
            <Route element={<RootLayout />}>
              <Route path="/"           element={<HomePage />} />
              <Route path="/about"      element={<AboutPage />} />
              <Route path="/membership" element={<MembershipPage />} />
              <Route path="/classes"    element={<ClassesPage />} />
              <Route path="/trainers"   element={<TrainersPage />} />
              <Route path="/contact"    element={<ContactPage />} />
              <Route path="/faq"        element={<FAQPage />} />
              <Route path="/login"      element={<LoginPage />} />
              <Route path="/register"   element={<RegisterPage />} />
              <Route path="*"           element={<NotFoundPage />} />
            </Route>

            {/* Dedicated Authenticated Portal (ManagementLayout sidebar with role-specific navigation) */}
            <Route
              element={
                <ProtectedRoute>
                  <ManagementLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route
                path="/manage"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'staff']}>
                    <ManageOverviewPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/members"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'staff', 'trainer']}>
                    <ManageMembersPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/members/new"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'staff']}>
                    <MemberFormPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/members/:id"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'staff']}>
                    <MemberDetailPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage/plans"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'staff']}>
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
            </Route>
          </Routes>
        </Suspense>

        {/* Cookie consent banner */}
        <CookieBanner />
      </AuthProvider>
    </BrowserRouter>
  )
}
