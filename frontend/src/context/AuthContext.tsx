import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { AuthContextType, LoginCredentials, RegisterCredentials, User } from '@/types/auth'
import { api, getStoredToken, clearStoredToken } from '@/services/api'

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  // Verify authentication on app mount
  useEffect(() => {
    let isMounted = true

    async function initializeAuth() {
      const token = getStoredToken()
      if (!token) {
        setIsLoading(false)
        return
      }

      try {
        const currentUser = await api.getMe()
        if (isMounted) {
          setUser(currentUser)
        }
      } catch {
        // If token invalid or expired, clear it
        if (isMounted) {
          clearStoredToken()
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

  const login = async (credentials: LoginCredentials): Promise<User> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.login(credentials)
      setUser(response.user)
      return response.user
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (credentials: RegisterCredentials): Promise<User> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.register(credentials)
      setUser(response.user)
      return response.user
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await api.logout()
    } finally {
      setUser(null)
      setIsLoading(false)
    }
  }

  const clearError = () => setError(null)

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        error,
        login,
        register,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
