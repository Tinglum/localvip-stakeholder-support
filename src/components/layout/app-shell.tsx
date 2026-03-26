'use client'

import * as React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { cn } from '@/lib/utils'
import { canBusinessAccessPath, isBusinessRole } from '@/lib/business-portal'
import type { Profile } from '@/lib/types/database'

interface AppShellProps {
  profile: Profile
  children: React.ReactNode
}

export function AppShell({ profile, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const blockedBusinessPath = isBusinessRole(profile.role) && !canBusinessAccessPath(pathname)

  React.useEffect(() => {
    if (blockedBusinessPath) {
      router.replace('/dashboard')
    }
  }, [blockedBusinessPath, router])

  return (
    <div className="min-h-screen bg-surface-50">
      <Sidebar
        role={profile.role}
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
          {blockedBusinessPath ? (
            <div className="flex min-h-[60vh] items-center justify-center">
              <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                Redirecting to your business dashboard...
              </div>
            </div>
          ) : children}
        </div>
      </main>
    </div>
  )
}
