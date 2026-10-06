import axios from 'axios'
import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getApiErrorMessage } from '../services/apiError'
import * as authService from '../services/auth'
import type { AuthUser, RegistrationData } from '../services/auth'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  error: string | null
  login: (email: string, password: string) => Promise<AuthUser | null>
  register: (input: RegistrationData) => Promise<AuthUser | null>
  logout: () => Promise<boolean>
  clearError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    authService.getCurrentUser()
      .then((currentUser) => {
        if (active) setUser(currentUser)
      })
      .catch((requestError: unknown) => {
        if (!active) return

        if (axios.isAxiosError(requestError) && requestError.response?.status === 401) {
          setUser(null)
        } else {
          setError(getApiErrorMessage(requestError))
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    error,
    clearError: () => setError(null),
    login: async (email, password) => {
      setError(null)
      try {
        const authenticatedUser = await authService.login(email, password)
        setUser(authenticatedUser)
        return authenticatedUser
      } catch (requestError: unknown) {
        setError(getApiErrorMessage(requestError))
        return null
      }
    },
    register: async (input) => {
      setError(null)
      try {
        const authenticatedUser = await authService.register(input)
        setUser(authenticatedUser)
        return authenticatedUser
      } catch (requestError: unknown) {
        setError(getApiErrorMessage(requestError))
        return null
      }
    },
    logout: async () => {
      setError(null)
      try {
        await authService.logout()
        setUser(null)
        return true
      } catch (requestError: unknown) {
        setError(getApiErrorMessage(requestError))
        return false
      }
    },
  }), [user, loading, error])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within an AuthProvider')
  return context
}
