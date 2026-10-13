import {
  createContext,
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
  api,
  getStoredToken,
  clearStoredToken,
} from '@/services/api'
import { QuarterRing } from '@/components/ui/quarter-ring'


const AuthContext =
  createContext<
    AuthContextType | undefined
  >(undefined)


export function AuthProvider({
  children,
}: {
  children: ReactNode
}) {
  const [
    user,
    setUser,
  ] =
    useState<User | null>(
      null,
    )

  const [
    isLoading,
    setIsLoading,
  ] =
    useState<boolean>(
      true,
    )

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] =
    useState<boolean>(
      false,
    )

  const [
    error,
    setError,
  ] =
    useState<
      string | null
    >(null)


  useEffect(() => {
    let isMounted = true


    async function initializeAuth() {
      const token =
        getStoredToken()


      if (!token) {
        setIsLoading(false)

        return
      }


      try {
        const currentUser =
          await api.getMe()


        if (isMounted) {
          setUser(
            currentUser,
          )
        }
      } catch {

        if (isMounted) {
          clearStoredToken()

          setUser(null)
        }

      } finally {

        if (isMounted) {
          setIsLoading(
            false,
          )
        }
      }
    }


    initializeAuth()


    return () => {
      isMounted = false
    }

  }, [])


  const refreshUser =
    async ():
      Promise<User | null> => {

      const token =
        getStoredToken()


      if (!token) {
        setUser(null)

        return null
      }


      try {
        const currentUser =
          await api.getMe()

        setUser(
          currentUser,
        )

        return currentUser

      } catch {

        clearStoredToken()

        setUser(null)

        return null
      }
    }


  const login =
    async (
      credentials:
        LoginCredentials,
    ): Promise<User> => {

      setIsLoading(true)

      setError(null)


      try {
        const response =
          await api.login(
            credentials,
          )

        setUser(
          response.user,
        )

        return response.user

      } catch (err) {

        const message =
          err instanceof Error
            ? err.message
            : 'Login failed'

        setError(
          message,
        )

        throw err

      } finally {

        setIsLoading(false)
      }
    }


  const register =
    async (
      credentials:
        RegisterCredentials,
    ): Promise<User> => {

      setIsLoading(true)

      setError(null)


      try {
        const response =
          await api.register(
            credentials,
          )

        setUser(
          response.user,
        )

        return response.user

      } catch (err) {

        const message =
          err instanceof Error
            ? err.message
            : 'Registration failed'

        setError(
          message,
        )

        throw err

      } finally {

        setIsLoading(false)
      }
    }


  const loginWithGoogle = async (credential: string): Promise<User> => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await api.loginWithGoogle(credential)
      setUser(response.user)
      return response.user
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google sign-in failed'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const availPlan = async (planSlug: string): Promise<User> => {
    setIsLoading(true)
    setError(null)
    try {
      const updatedUser = await api.availPlan(planSlug)
      setUser(updatedUser)
      return updatedUser
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to avail plan'
      setError(message)
      throw err
    } finally {
      setIsLoading(false)
    }
  }

  const logout =
    async (): Promise<void> => {
      setIsLoggingOut(true)
      try {
        await api.logout()
        // Brief loading animation duration for smooth feedback
        await new Promise((resolve) => setTimeout(resolve, 750))
      } finally {
        setUser(null)
        setIsLoggingOut(false)
      }
    }


  const clearError =
    () =>
      setError(null)


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