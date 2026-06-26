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
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { BugReporter } from '@/components/bug-center/bug-reporter'

interface AppShellProps {
  profile: Profile
  children: React.ReactNode
}

export function AppShell({ profile, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false)
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

  React.useEffect(() => {
    setMobileNavOpen(false)
  }, [pathname])

  const bannerOffset = impersonating ? 'pt-10' : ''

  return (
    <div className={cn('min-h-screen bg-surface-50', bannerOffset)}>
      <ImpersonationBanner />
      <BugReporter />
      <Sidebar
        profile={profile}
        brand={profile.brand_context}
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
      />
      <Dialog open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <DialogContent className="left-0 top-0 h-full w-auto max-w-none translate-x-0 translate-y-0 rounded-none border-r border-surface-200 p-0 sm:max-w-none">
          <Sidebar
            profile={profile}
            brand={profile.brand_context}
            collapsed={false}
            onToggle={() => {}}
            mobile
            onNavigate={() => setMobileNavOpen(false)}
          />
        </DialogContent>
      </Dialog>
      <Topbar
        profile={profile}
        sidebarCollapsed={collapsed}
        onOpenMobileNav={() => setMobileNavOpen(true)}
      />
      <main
        className={cn(
          'pt-16 transition-all duration-200 md:pt-14',
          collapsed ? 'md:pl-16' : 'md:pl-60'
        )}
      >
        <div className="p-4 sm:p-6 lg:p-8">
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
