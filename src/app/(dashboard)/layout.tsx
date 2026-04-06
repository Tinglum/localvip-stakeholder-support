'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { AuthProvider } from '@/lib/auth/context'
import { ImpersonationProvider } from '@/lib/impersonation-context'
import { normalizeBusinessProfile } from '@/lib/business-portal'
import type { Profile } from '@/lib/types/database'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false

    async function loadProfile() {
      const response = await fetch('/api/auth/session', {
        credentials: 'include',
        cache: 'no-store',
      }).catch(() => null)

      if (!response || !response.ok) {
        router.push('/login')
        return
      }

      const session = await response.json().catch(() => null)
      if (!session?.authenticated || !session?.profile) {
        router.push('/login')
        return
      }

      if (!cancelled) {
        setProfile(normalizeBusinessProfile(session.profile as Profile, []))
        setLoading(false)
      }
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [router])

  if (loading || !profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (profile.role === 'affiliate') {
    return (
      <div className="flex h-screen items-center justify-center px-6">
        <div className="max-w-lg rounded-3xl border border-surface-200 bg-white p-8 text-center shadow-xl">
          <h1 className="text-2xl font-bold text-surface-900">This account type has been retired</h1>
          <p className="mt-3 text-sm leading-6 text-surface-600">
            Affiliate access is no longer part of the active LocalVIP stakeholder system. Please contact an admin if this account should be reassigned to a current stakeholder role.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ImpersonationProvider>
      <AuthProvider profile={profile}>
        <AppShell profile={profile}>
          {children}
        </AppShell>
      </AuthProvider>
    </ImpersonationProvider>
  )
}
