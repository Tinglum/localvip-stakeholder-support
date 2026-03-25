'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { AuthProvider } from '@/lib/auth/context'
import type { Profile } from '@/lib/types/database'
import { DEMO_PROFILES } from '@/lib/auth/demo-profiles'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [profile, setProfile] = React.useState<Profile | null>(null)

  React.useEffect(() => {
    // TODO: Replace with Supabase auth session check
    const stored = localStorage.getItem('demo_profile')
    if (stored) {
      setProfile(JSON.parse(stored))
    } else {
      router.push('/login')
    }
  }, [router])

  if (!profile) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <AuthProvider profile={profile}>
      <AppShell profile={profile}>
        {children}
      </AppShell>
    </AuthProvider>
  )
}
