'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { AuthProvider } from '@/lib/auth/context'
import { ImpersonationProvider } from '@/lib/impersonation-context'
import { normalizeBusinessProfile } from '@/lib/business-portal'
import type { Profile } from '@/lib/types/database'
import { createClient } from '@/lib/supabase/client'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])
  const [profile, setProfile] = React.useState<Profile | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function resolvePortalProfile(baseProfile: Profile) {
      const { data: ownedBusinesses, error: ownedBusinessesError } = await supabase
        .from('businesses')
        .select('id,email,website,owner_id')
        .eq('owner_id', baseProfile.id)

      if (ownedBusinessesError) {
        console.error('Failed to load owned businesses for profile normalization:', ownedBusinessesError)
        return baseProfile
      }

      return normalizeBusinessProfile(baseProfile, ownedBusinesses || [])
    }

    async function loadProfile() {
      // Check Supabase auth session
      const { data: { user }, error } = await supabase.auth.getUser()

      if (error || !user) {
        router.push('/login')
        return
      }

      // Fetch profile from profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError || !profileData) {
        // Profile not found — might need seeding
        console.error('Profile not found for user:', user.id)
        // Create a basic profile from auth metadata
        const meta = user.user_metadata || {}
        const fallbackProfile: Profile = {
          id: user.id,
          email: user.email || '',
          full_name: meta.full_name || user.email?.split('@')[0] || 'User',
          avatar_url: null,
          role: meta.role || 'volunteer',
          brand_context: 'localvip',
          organization_id: null,
          city_id: null,
          business_id: (meta.business_id as string | null) || null,
          phone: null,
          referral_code: null,
          status: 'active',
          metadata: null,
          created_at: user.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setProfile(await resolvePortalProfile(fallbackProfile))
        setLoading(false)
        return
      }

      setProfile(await resolvePortalProfile(profileData as Profile))
      setLoading(false)
    }

    loadProfile()

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event) => {
        if (event === 'SIGNED_OUT') {
          router.push('/login')
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [supabase, router])

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
