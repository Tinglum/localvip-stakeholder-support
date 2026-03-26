'use client'

import * as React from 'react'
import type { Profile, UserRole } from '@/lib/types/database'
import { ROLES } from '@/lib/constants'

interface AuthContextValue {
  profile: Profile
  isAdmin: boolean
  isBusiness: boolean
  businessId: string | null
  hasMinLevel: (level: number) => boolean
  hasRole: (roles: UserRole[]) => boolean
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({
  profile,
  children,
}: {
  profile: Profile
  children: React.ReactNode
}) {
  const value = React.useMemo<AuthContextValue>(() => ({
    profile,
    isAdmin: ROLES[profile.role].level >= 90,
    isBusiness: profile.role === 'business',
    businessId: profile.business_id || null,
    hasMinLevel: (level) => ROLES[profile.role].level >= level,
    hasRole: (roles) => roles.includes(profile.role),
  }), [profile])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
