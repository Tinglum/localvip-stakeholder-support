'use client'

import * as React from 'react'
import type { Profile, UserRole } from '@/lib/types/database'
import {
  getLevelForProfile,
  getStakeholderAccess,
  isAdminProfile,
  isBusinessProfile,
  isFieldProfile,
  type StakeholderShell,
} from '@/lib/stakeholder-access'

interface AuthContextValue {
  profile: Profile
  shell: StakeholderShell
  roleLabel: string
  isAdmin: boolean
  isBusiness: boolean
  isField: boolean
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
  const value = React.useMemo<AuthContextValue>(() => {
    const access = getStakeholderAccess(profile)

    return {
      profile,
      shell: access.shell,
      roleLabel: access.label,
      isAdmin: isAdminProfile(profile),
      isBusiness: isBusinessProfile(profile),
      isField: isFieldProfile(profile),
      businessId: profile.business_id || null,
      hasMinLevel: (level) => getLevelForProfile(profile) >= level,
      hasRole: (roles) => roles.includes(profile.role),
    }
  }, [profile])

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
