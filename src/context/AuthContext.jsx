import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { getSession, login as loginService, logout as logoutService, hasPermission as checkPerm } from '../services/authService'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setUser(getSession())
    setLoading(false)
  }, [])

  const login = useCallback(async (username, pin) => {
    const session = await loginService(username, pin)
    setUser(session)
    return session
  }, [])

  const logout = useCallback(() => {
    logoutService()
    setUser(null)
  }, [])

  const hasPermission = useCallback((permission) => {
    return checkPerm(user, permission)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasPermission }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
