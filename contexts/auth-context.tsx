"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"
import { TokenManager } from "@/lib/api"

interface User {
  id: string
  email: string
  username: string
  first_name: string
  last_name: string
  is_active: boolean
  date_joined: string
  linkedin_id: string | null
  is_email_verified: boolean
  profile_picture: string | null
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is authenticated on app load
    const checkAuth = () => {
      const isAuth = TokenManager.isAuthenticated()
      if (isAuth) {
        // Restore user data from localStorage
        const userData = TokenManager.getUserData()
        if (userData) {
          setUser(userData)
        } else {
          // Token exists but no user data, clear tokens
          TokenManager.clearTokens()
          setUser(null)
        }
      } else {
        setUser(null)
      }
      setIsLoading(false)
    }

    checkAuth()
  }, [])

  const login = (userData: User, accessToken: string, refreshToken: string) => {
    TokenManager.setTokens(accessToken, refreshToken)
    TokenManager.setUserData(userData)
    setUser(userData)
  }

  const logout = () => {
    TokenManager.clearTokens()
    setUser(null)
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
