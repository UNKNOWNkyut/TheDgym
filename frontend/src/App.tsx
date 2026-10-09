import {
  lazy,
  Suspense,
  useEffect,
  useState,
} from 'react'

import {
  BrowserRouter,
  Route,
  Routes,
} from 'react-router-dom'

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

const AboutPage = lazy(() =>
  import('@/pages/AboutPage').then((module) => ({
    default: module.AboutPage,
  })),
)

const MembershipPage = lazy(() =>
  import('@/pages/MembershipPage').then((module) => ({
    default: module.MembershipPage,
  })),
)

const ClassesPage = lazy(() =>
  import('@/pages/ClassesPage').then((module) => ({
    default: module.ClassesPage,
  })),
)

const TrainersPage = lazy(() =>
  import('@/pages/TrainersPage').then((module) => ({
    default: module.TrainersPage,
  })),
)

const ContactPage = lazy(() =>
  import('@/pages/ContactPage').then((module) => ({
    default: module.ContactPage,
  })),
)

const FAQPage = lazy(() =>
  import('@/pages/FAQPage').then((module) => ({
    default: module.FAQPage,
  })),
)

const LoginPage = lazy(() =>
  import('@/pages/LoginPage').then((module) => ({
    default: module.LoginPage,
  })),
)


const RegisterPage = lazy(() =>
  import('@/pages/RegisterPage').then((module) => ({
    default: module.RegisterPage,
  })),
)


// ─── Portal & Management Pages ────────────────────────────────────────────────

const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
)

const MemberSettingsPage = lazy(() =>
  import('@/pages/MemberSettingsPage').then((module) => ({
    default: module.MemberSettingsPage,
  })),
)

const BookTrainerPage = lazy(() =>
  import('@/pages/manage/BookTrainerPage').then((module) => ({
    default: module.BookTrainerPage,
  })),
)

const ManageOverviewPage = lazy(() =>
  import('@/pages/manage/ManageOverviewPage').then((module) => ({
    default: module.ManageOverviewPage,
  })),
)

const ManageMembersPage = lazy(() =>
  import('@/pages/manage/ManageMembersPage').then((module) => ({
    default: module.ManageMembersPage,
  })),
)

const MemberFormPage = lazy(() =>
  import('@/pages/manage/MemberFormPage').then((module) => ({
    default: module.MemberFormPage,
  })),
)

const MemberDetailPage = lazy(() =>
  import('@/pages/manage/MemberDetailPage').then((module) => ({
    default: module.MemberDetailPage,
  })),
)

const ManagePlansPage = lazy(() =>
  import('@/pages/manage/ManagePlansPage').then((module) => ({
    default: module.ManagePlansPage,
  })),
)

const ManageUsersPage = lazy(() =>
  import('@/pages/manage/ManageUsersPage').then((module) => ({
    default: module.ManageUsersPage,
  })),
)

const ManageVisitsPage = lazy(() =>
  import('@/pages/manage/ManageVisitsPage').then((module) => ({
    default: module.ManageVisitsPage,
  })),
)

const ManageClassesPage = lazy(() =>
  import('@/pages/manage/ManageClassesPage').then((module) => ({
    default: module.ManageClassesPage,
  })),
)

const ManagePTSessionsPage = lazy(() =>
  import('@/pages/manage/ManagePTSessionsPage').then((module) => ({
    default: module.ManagePTSessionsPage,
  })),
)

const ManageFinancePage = lazy(() =>
  import('@/pages/manage/ManageFinancePage').then((module) => ({
    default: module.ManageFinancePage,
  })),
)

const ManageExpensesPage = lazy(() =>
  import('@/pages/manage/ManageExpensesPage').then((module) => ({
    default: module.ManageExpensesPage,
  })),
)

const ManageAnalyticsPage = lazy(() =>
  import('@/pages/manage/ManageAnalyticsPage').then((module) => ({
    default: module.ManageAnalyticsPage,
  })),
)


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
  const [visible, setVisible] = useState(true)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    const fadeTimer = window.setTimeout(() => {
      setFading(true)
    }, 1500)

    const removeTimer = window.setTimeout(() => {
      setVisible(false)
    }, 2000)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(removeTimer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black text-white transition-opacity duration-500 ${
        fading
          ? "opacity-0 pointer-events-none"
          : "opacity-100"
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

      <p className="mt-5 text-sm tracking-widest text-gray-400">
        LOADING...
      </p>
    </div>
  )
}




export function App() {
  return (
    <BrowserRouter>
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
                <ProtectedRoute
                  allowedRoles={['member']}
                >
                  <MemberSettingsPage />
                </ProtectedRoute>
              }
            />


            {/* ============================================================
                PUBLIC WEBSITE
            ============================================================ */}

            <Route element={<RootLayout />}>

              <Route
                path="/"
                element={<HomePage />}
              />

              <Route
                path="/about"
                element={<AboutPage />}
              />

              <Route
                path="/membership"
                element={<MembershipPage />}
              />

              <Route
                path="/classes"
                element={<ClassesPage />}
              />

              <Route
                path="/trainers"
                element={<TrainersPage />}
              />

              <Route
                path="/contact"
                element={<ContactPage />}
              />

              <Route
                path="/faq"
                element={<FAQPage />}
              />

              <Route
                path="/login"
                element={<LoginPage />}
              />

              <Route
                path="/register"
                element={<RegisterPage />}
              />

              <Route
                path="*"
                element={<NotFoundPage />}
              />

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

              <Route
                path="/dashboard"
                element={<DashboardPage />}
              />


              <Route
                path="/dashboard/book"
                element={<BookTrainerPage />}
              />


              <Route
                path="/manage"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                    ]}
                  >
                    <ManageOverviewPage />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/manage/members"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                      'trainer',
                    ]}
                  >
                    <ManageMembersPage />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/manage/members/new"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                    ]}
                  >
                    <MemberFormPage />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/manage/members/:id"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                      'trainer',
                    ]}
                  >
                    <MemberDetailPage />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/manage/plans"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                    ]}
                  >
                    <ManagePlansPage />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/manage/users"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                    ]}
                  >
                    <ManageUsersPage />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/manage/visits"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                      'trainer',
                    ]}
                  >
                    <ManageVisitsPage />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/manage/classes"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                      'trainer',
                    ]}
                  >
                    <ManageClassesPage />
                  </ProtectedRoute>
                }
              />


              <Route
                path="/manage/pt-sessions"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                      'trainer',
                    ]}
                  >
                    <ManagePTSessionsPage />
                  </ProtectedRoute>
                }
              />


              {/* Finance — Admin Only */}

              <Route
                path="/manage/finance"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                    ]}
                  >
                    <ManageFinancePage />
                  </ProtectedRoute>
                }
              />


              {/* Expenses — Admin Only */}

              <Route
                path="/manage/expenses"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                    ]}
                  >
                    <ManageExpensesPage />
                  </ProtectedRoute>
                }
              />


              {/* Analytics & Churn Prediction — Admin, Staff, Trainer */}

              <Route
                path="/manage/analytics"
                element={
                  <ProtectedRoute
                    allowedRoles={[
                      'admin',
                      'staff',
                      'trainer',
                    ]}
                  >
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
    </BrowserRouter>
  )
}


export default App