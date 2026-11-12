import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

import type {
  AuthContextType,
  LoginCredentials,
  RegisterCredentials,
  User,
} from '@/types/auth'

import {
  ApiError,
  api,
  clearSessionHint,
  hasSessionHint,
  onAuthExpired,
} from '@/services/api'
import { QuarterRing } from '@/components/ui/quarter-ring'


const AuthContext = createContext<AuthContextType | undefined>(undefined)

function isAuthRejection(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 401 || err.status === 403)
}


export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isLoggingOut, setIsLoggingOut] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return onAuthExpired(() => {
      setUser(null)
      setError(null)
      setIsLoading(false)
    })
  }, [])

  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      if (!hasSessionHint()) {
        setIsLoading(false)
        return
      }

      try {
        const currentUser = await api.getMe()
        if (isMounted) {
          setUser(currentUser)
        }
      } catch (err) {
        if (isMounted && isAuthRejection(err)) {
          clearSessionHint()
          setUser(null)
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    initializeAuth()

    return () => {
      isMounted = false
    }
  }, [])

  const refreshUser = useCallback(async (): Promise<User | null> => {
    if (!hasSessionHint()) {
      setUser(null)
      return null
    }

    try {
      const currentUser = await api.getMe()
      setUser(currentUser)
      return currentUser
    } catch (err) {
      if (isAuthRejection(err)) {
        clearSessionHint()
        setUser(null)
      }
      return null
    }
  }, [])

  const runAuthAction = useCallback(
    async (action: () => Promise<User>, fallbackMessage: string): Promise<User> => {
      setIsLoading(true)
      setError(null)
      try {
        const nextUser = await action()
        setUser(nextUser)
        return nextUser
      } catch (err) {
        const message = err instanceof Error ? err.message : fallbackMessage
        setError(message)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  const login = useCallback(
    (credentials: LoginCredentials): Promise<User> =>
      runAuthAction(async () => (await api.login(credentials)).user, 'Login failed'),
    [runAuthAction],
  )

  const register = useCallback(
    (credentials: RegisterCredentials): Promise<User> =>
      runAuthAction(
        async () => (await api.register(credentials)).user,
        'Registration failed',
      ),
    [runAuthAction],
  )

  const loginWithGoogle = useCallback(
    (credential: string): Promise<User> =>
      runAuthAction(
        async () => (await api.loginWithGoogle(credential)).user,
        'Google sign-in failed',
      ),
    [runAuthAction],
  )

  const availPlan = useCallback(
    (planSlug: string): Promise<User> =>
      runAuthAction(() => api.availPlan(planSlug), 'Failed to avail plan'),
    [runAuthAction],
  )

  const logout = useCallback(async (): Promise<void> => {
    setIsLoggingOut(true)
    try {
      await api.logout()
      // Brief loading animation duration for smooth feedback
      await new Promise((resolve) => setTimeout(resolve, 750))
    } finally {
      setUser(null)
      setError(null)
      setIsLoggingOut(false)
    }
  }, [])

  const clearError = useCallback(() => setError(null), [])


  return (
    <AuthContext.Provider
      value={{
        user,

        isAuthenticated:
          !!user,

        isLoading,

        isLoggingOut,

        error,

        login,

        register,

        loginWithGoogle,

        availPlan,

        logout,

        refreshUser,

        clearError,
      }}
    >
      {children}
      {isLoggingOut && (
        <div
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/90 backdrop-blur-md text-white transition-opacity duration-300 animate-fade-in"
          role="status"
          aria-live="polite"
        >
          <img
            src="/assets/logos/thedgym.png"
            alt="The DGym"
            className="mb-6 h-20 w-auto object-contain drop-shadow-[0_4px_16px_rgba(229,32,26,0.25)]"
          />
          <QuarterRing className="size-10 text-red" />
          <p className="mt-4 font-mono text-xs font-bold tracking-widest uppercase text-white/80">
            SIGNING OUT...
          </p>
          <p className="text-[11px] text-white/40 mt-1 font-mono">
            Securing your athlete session
          </p>
        </div>
      )}
    </AuthContext.Provider>
  )
}


export function useAuth():
  AuthContextType {

  const context =
    useContext(
      AuthContext,
    )


  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider',
    )
  }


  return context
}