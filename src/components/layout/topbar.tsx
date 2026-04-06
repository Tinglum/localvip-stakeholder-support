'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Bell, ChevronDown, ChevronLeft, LogOut, Search, Settings, User } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { BRANDS } from '@/lib/constants'
import { getStakeholderAccess, isAdminProfile } from '@/lib/stakeholder-access'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types/database'

// ── Route → human label mapping ──
const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  crm: 'CRM',
  businesses: 'Businesses',
  causes: 'Causes',
  contacts: 'Contacts',
  stakeholders: 'Stakeholders',
  cities: 'Cities',
  scripts: 'Outreach Scripts',
  outreach: 'Outreach',
  tasks: 'Tasks',
  community: 'Community',
  supporters: 'Supporters',
  materials: 'Materials',
  qr: 'QR & Codes',
  share: 'Share',
  activity: 'Activity',
  portal: 'Portal',
  setup: 'Setup',
  business: 'My Business',
  clients: 'My 100 List',
  grow: 'Grow',
  templates: 'Templates',
  campaigns: 'Campaigns',
  analytics: 'Analytics',
  admin: 'Admin',
  users: 'Users',
  audit: 'Audit',
  onboarding: 'Onboarding',
  'material-engine': 'Material Engine',
  settings: 'Settings',
  mine: 'My Materials',
  library: 'Library',
  generator: 'QR Generator',
  partner: 'Partner',
  workspace: 'Workspace',
  influencer: 'Influencer',
  notes: 'Notes',
}

const HISTORY_KEY = 'nav_history'
const MAX_HISTORY = 50 // keep a deeper stack so clicking back still has trail

/** Turn a pathname like /crm/causes/abc-123 into "Causes / Detail" */
function pathnameToLabel(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)
  // Take the last two meaningful segments for a short label
  const meaningful = segments.map(seg => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(seg)) return 'Detail'
    return ROUTE_LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ')
  })
  // Show last 2 segments max for compact display
  return meaningful.slice(-2).join(' / ')
}

function readHistory(): { path: string; label: string }[] {
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function writeHistory(history: { path: string; label: string }[]) {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)))
  } catch { /* quota exceeded — ignore */ }
}

interface TopbarProps {
  profile: Profile
  sidebarCollapsed: boolean
}

export function Topbar({ profile, sidebarCollapsed }: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const supabase = React.useMemo(() => createClient(), [])
  const access = getStakeholderAccess(profile)
  const searchPlaceholder = access.searchPlaceholder
  const [searchValue, setSearchValue] = React.useState('')
  const searchRef = React.useRef<HTMLInputElement>(null)
  const [history, setHistory] = React.useState<{ path: string; label: string }[]>([])

  // On every pathname change, push it to history (deduplicate consecutive)
  React.useEffect(() => {
    const prev = readHistory()
    // Don't push if it's the same as the most recent entry
    if (prev.length > 0 && prev[0].path === pathname) {
      setHistory(prev)
      return
    }
    const next = [{ path: pathname, label: pathnameToLabel(pathname) }, ...prev].slice(0, MAX_HISTORY)
    writeHistory(next)
    setHistory(next)
  }, [pathname])

  // The trail: up to 3 previous pages (not the current one)
  const trail = React.useMemo(() => {
    // history[0] is the current page — skip it, show the next 3 unique paths
    const seen = new Set<string>()
    seen.add(pathname)
    const items: { path: string; label: string }[] = []
    for (const entry of history) {
      if (seen.has(entry.path)) continue
      seen.add(entry.path)
      items.push(entry)
      if (items.length >= 3) break
    }
    return items
  }, [history, pathname])

  function handleTrailClick(targetPath: string) {
    // Trim history back to that point so clicking back "rewinds"
    const idx = history.findIndex(h => h.path === targetPath)
    if (idx > 0) {
      const rewound = history.slice(idx)
      writeHistory(rewound)
      setHistory(rewound)
    }
    router.push(targetPath)
  }

  const handleSignOut = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Ignore QA logout errors and continue clearing demo auth.
    }
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  // Keyboard shortcut: Cmd/Ctrl+K to focus search
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && searchValue.trim()) {
      const query = searchValue.trim().toLowerCase()
      if (isAdminProfile(profile)) {
        router.push(`/crm/businesses?q=${encodeURIComponent(query)}`)
      } else if (access.shell === 'community') {
        router.push(`/community/supporters`)
      } else {
        router.push(`/crm/businesses?q=${encodeURIComponent(query)}`)
      }
      setSearchValue('')
      searchRef.current?.blur()
    }
    if (e.key === 'Escape') {
      setSearchValue('')
      searchRef.current?.blur()
    }
  }

  return (
    <header
      className={cn(
        'fixed top-0 right-0 z-30 flex h-14 items-center gap-3 border-b border-surface-200 bg-surface-0/95 backdrop-blur px-4 no-print transition-all',
        sidebarCollapsed ? 'left-16' : 'left-60'
      )}
    >
      {/* Navigation history trail */}
      {trail.length > 0 && (
        <nav className="flex items-center gap-1 min-w-0 flex-shrink overflow-hidden mr-1">
          {trail.map((entry, idx) => (
            <React.Fragment key={entry.path + idx}>
              {idx > 0 && <ChevronLeft className="h-3 w-3 text-surface-300 shrink-0" />}
              <button
                onClick={() => handleTrailClick(entry.path)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors truncate max-w-[150px] shrink-0"
                title={entry.label}
              >
                {idx === 0 && <ChevronLeft className="h-3 w-3 shrink-0" />}
                <span className="truncate">{entry.label}</span>
              </button>
            </React.Fragment>
          ))}
        </nav>
      )}

      <div className="flex-1" />

      {/* Search */}
      <div className="relative max-w-xs hidden sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <input
          ref={searchRef}
          type="text"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder={searchPlaceholder}
          className="h-8 w-full rounded-lg bg-surface-100 pl-9 pr-14 text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded bg-surface-200 px-1.5 py-0.5 text-[10px] font-medium text-surface-400">
          {typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl+'}K
        </kbd>
      </div>

      {/* Brand switcher (admins only) */}
      {isAdminProfile(profile) && (
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
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="relative rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors">
            <Bell className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            className="z-50 w-72 rounded-lg border border-surface-200 bg-surface-0 p-3 shadow-panel animate-fade-in"
            align="end"
            sideOffset={4}
          >
            <p className="text-sm font-semibold text-surface-800 mb-2">Notifications</p>
            <div className="rounded-lg bg-surface-50 px-4 py-6 text-center">
              <Bell className="mx-auto mb-2 h-5 w-5 text-surface-300" />
              <p className="text-xs text-surface-500">No new notifications</p>
            </div>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      {/* User menu */}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-surface-100 transition-colors">
            <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-surface-800">{profile.full_name}</p>
              <p className="text-[10px] text-surface-400">{access.label}</p>
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
            <DropdownMenu.Item
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-surface-600 outline-none cursor-pointer hover:bg-surface-100"
              onClick={() => router.push('/admin/users')}
            >
              <User className="h-4 w-4" /> Profile
            </DropdownMenu.Item>
            <DropdownMenu.Item
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-surface-600 outline-none cursor-pointer hover:bg-surface-100"
              onClick={() => router.push('/dashboard')}
            >
              <Settings className="h-4 w-4" /> Dashboard
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
