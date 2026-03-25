'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bell, LogOut, User, ChevronDown, Search } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { ROLES, BRANDS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database'

interface TopbarProps {
  profile: Profile
  sidebarCollapsed: boolean
}

export function Topbar({ profile, sidebarCollapsed }: TopbarProps) {
  const router = useRouter()
  const supabase = React.useMemo(() => createClient(), [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 flex h-14 items-center gap-4 border-b border-surface-200 bg-surface-0/95 backdrop-blur px-4 no-print transition-all',
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <input
          type="text"
          placeholder="Search anything..."
          className="h-8 w-full rounded-lg bg-surface-100 pl-9 pr-3 text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>

      {/* Brand switcher (admins only) */}
      {ROLES[profile.role].level >= 90 && (
        <div className="flex items-center gap-1.5 rounded-lg bg-surface-50 px-2 py-1">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: BRANDS[profile.brand_context].color }}
          />
          <span className="text-xs font-medium text-surface-600">
            {BRANDS[profile.brand_context].label}
          </span>
        </div>
      )}

      {/* Notifications */}
      <button className="relative rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
        <Bell className="h-4 w-4" />
        <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500" />
      </button>

      {/* User menu */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-100 transition-colors">
            <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-surface-800">{profile.full_name}</p>
              <p className="text-[10px] text-surface-400">{ROLES[profile.role].label}</p>
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 min-w-[180px] rounded-lg border border-surface-200 bg-surface-0 p-1 shadow-panel animate-fade-in"
            align="end"
            sideOffset={4}
          >
            <DropdownMenu.Item className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-surface-600 outline-none cursor-pointer hover:bg-surface-100">
              <User className="h-4 w-4" /> Profile
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-surface-100" />
            <DropdownMenu.Item
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-danger-500 outline-none cursor-pointer hover:bg-danger-50"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4" /> Sign out
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </header>
  )
}
