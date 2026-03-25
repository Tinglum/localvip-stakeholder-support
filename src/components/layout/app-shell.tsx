'use client'

import * as React from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'

interface AppShellProps {
  profile: Profile
  children: React.ReactNode
}

export function AppShell({ profile, children }: AppShellProps) {
  const [collapsed, setCollapsed] = React.useState(false)

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
          {children}
        </div>
      </main>
    </div>
  )
}
