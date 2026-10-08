import {
  useState,
  type ReactNode,
} from 'react'

import {
  Link,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'

import { useAuth } from '@/context/AuthContext'
import { Badge } from '@/components/ui/Badge'

import type {
  UserRole,
} from '@/types/auth'


interface NavConfig {
  label: string
  href: string
  roles?: UserRole[]
  icon: ReactNode
}


const NAV_ITEMS: NavConfig[] = [
  {
    label: 'Management Hub',
    href: '/manage',
    roles: [
      'admin',
      'staff',
    ],
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },

  {
    label: 'Members',
    href: '/manage/members',
    roles: [
      'admin',
      'staff',
      'trainer',
    ],
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },

  {
    label: '+ Register Member',
    href: '/manage/members/new',
    roles: [
      'admin',
      'staff',
    ],
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
        />
      </svg>
    ),
  },

  {
    label: 'Plans',
    href: '/manage/plans',
    roles: [
      'admin',
      'staff',
    ],
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },

  {
    label: 'Visits',
    href: '/manage/visits',
    roles: ['admin', 'staff', 'trainer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Classes',
    href: '/manage/classes',
    roles: ['admin', 'staff', 'trainer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    label: 'PT Sessions',
    href: '/manage/pt-sessions',
    roles: ['admin', 'staff', 'trainer'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    label: 'Users',
    href: '/manage/users',
    roles: [
      'admin',
    ],
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z"
        />
      </svg>
    ),
  },


  // ─── NEW FINANCE ITEM ────────────────────────────────────────────────────

  {
    label: 'Finance',
    href: '/manage/finance',
    roles: [
      'admin',
    ],
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },


  // ─── NEW EXPENSE ITEM ────────────────────────────────────────────────────

  {
    label: 'Expenses',
    href: '/manage/expenses',
    roles: [
      'admin',
    ],
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z"
        />
      </svg>
    ),
  },


  {
    label: 'My Dashboard',
    href: '/dashboard',
    roles: [
      'trainer',
      'member',
    ],
    icon: (
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
        />
      </svg>
    ),
  },
  {
    label: 'Book a Coach',
    href: '/dashboard/book',
    roles: ['member'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
]


function getRoleBadgeVariant(
  role: string,
) {
  switch (role) {
    case 'admin':
      return 'danger' as const

    case 'staff':
      return 'info' as const

    case 'trainer':
      return 'warning' as const

    default:
      return 'success' as const
  }
}


export function ManagementLayout() {
  const {
    user,
    logout,
  } = useAuth()

  const location =
    useLocation()

  const navigate =
    useNavigate()

  const [
    sidebarOpen,
    setSidebarOpen,
  ] = useState(false)


  const handleLogout = async () => {
    await logout()

    navigate(
      '/login',
    )
  }


  const filteredNav =
    NAV_ITEMS.filter(
      (item) => {
        if (!item.roles) {
          return true
        }

        return (
          user &&
          item.roles.includes(
            user.role,
          )
        )
      },
    )


  return (
    <div className="min-h-screen bg-background flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/70 z-40 md:hidden backdrop-blur-sm"
          onClick={() =>
            setSidebarOpen(
              false,
            )
          }
        />
      )}


      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-surface border-r border-white/8 flex flex-col z-50 transform transition-transform duration-300 md:translate-x-0 md:static md:flex ${
          sidebarOpen
            ? 'translate-x-0'
            : '-translate-x-full'
        }`}
      >
        <div className="p-5 border-b border-white/8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/logos/thedgym.png"
              alt="The DGym"
              className="h-10 w-auto object-contain drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            />

            <div>
              <p className="text-xs font-bold text-white uppercase tracking-wider leading-none">
                The DGym
              </p>

              <p className="text-[10px] text-white/40 mt-1 uppercase tracking-widest font-mono">
                {user?.role === 'admin'
                  ? 'Admin Portal'
                  : user?.role === 'staff'
                  ? 'Staff Portal'
                  : user?.role === 'trainer'
                  ? 'Coach Portal'
                  : 'Member Portal'}
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              setSidebarOpen(
                false,
              )
            }
            className="md:hidden p-1 text-white/40 hover:text-white"
          >
            ✕
          </button>
        </div>


        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          <p className="text-[10px] uppercase tracking-widest text-white/30 px-3 py-1.5 font-mono">
            Navigation
          </p>

          {filteredNav.map(
            (item) => {
              const isExact =
                location.pathname ===
                item.href

              const isSub =
                item.href !==
                  '/manage' &&
                item.href !==
                  '/dashboard' &&
                location.pathname.startsWith(
                  item.href,
                )

              const isActive =
                isExact ||
                isSub

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() =>
                    setSidebarOpen(
                      false,
                    )
                  }
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    isActive
                      ? 'bg-red/10 text-red border border-red/20 font-semibold'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <span
                    className={
                      isActive
                        ? 'text-red'
                        : 'text-white/40'
                    }
                  >
                    {item.icon}
                  </span>

                  {item.label}
                </Link>
              )
            },
          )}
        </nav>


        {user && (
          <div className="p-4 border-t border-white/8 bg-surface-2/40">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-full bg-red text-white flex items-center justify-center font-bold text-xs uppercase shrink-0 shadow-sm">
                {user.full_name.slice(
                  0,
                  2,
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate leading-tight">
                  {user.full_name}
                </p>

                <div className="mt-1">
                  <Badge
                    variant={
                      getRoleBadgeVariant(
                        user.role,
                      )
                    }
                  >
                    {user.role}
                  </Badge>
                </div>
              </div>
            </div>


            <button
              onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-lg text-xs font-medium text-white/60 hover:text-red hover:bg-white/5 transition-colors flex items-center gap-2 border border-white/5"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>

              Sign Out
            </button>
          </div>
        )}
      </aside>


      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-white/8 bg-surface">
          <button
            onClick={() =>
              setSidebarOpen(
                true,
              )
            }
            className="p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/5 transition-colors"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          </button>

          <img
            src="/assets/logos/thedgym.png"
            alt="The DGym"
            className="h-8 w-auto object-contain"
          />

          <div className="w-8" />
        </header>


        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}