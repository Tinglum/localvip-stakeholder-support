'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { ImpersonationBanner } from './impersonation-banner'
import { useImpersonation } from '@/lib/impersonation-context'
import { cn } from '@/lib/utils'
import { canAccessPath, getStakeholderAccess } from '@/lib/stakeholder-access'
import type { Profile } from '@/lib/types/database'

interface AppShellProps {
  profile: Profile
  children: React.ReactNode
}

export function AppShell({ profile, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const access = getStakeholderAccess(profile)
  const { active: impersonating } = useImpersonation()
  const blockedPath = !canAccessPath(profile, pathname)

  React.useEffect(() => {
    if (blockedPath) {
      router.replace(access.fallbackPath)
    }
  }, [access.fallbackPath, blockedPath, router])

  const bannerOffset = impersonating ? 'pt-10' : ''

  return (
    <div className={cn('min-h-screen bg-surface-50', bannerOffset)}>
      <ImpersonationBanner />
      <Sidebar
        profile={profile}
        brand={profile.brand_context}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      <Topbar profile={profile} sidebarCollapsed={collapsed} />
      <main
        className={cn(
          'pt-14 transition-all duration-200',
          collapsed ? 'pl-16' : 'pl-60'
        )}
      >
        <div className="p-6 lg:p-8">
          {blockedPath ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Redirecting to your {access.label.toLowerCase()} dashboard...
              </div>
            </div>
          ) : children}
        </div>
      </main>
    </div>
  )
}
