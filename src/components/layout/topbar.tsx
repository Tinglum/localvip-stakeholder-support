'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ArrowRight,
  Bell,
  ChevronDown,
  ChevronLeft,
  Home,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
} from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Avatar } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { BRANDS } from '@/lib/constants'
import { getStakeholderAccess, isAdminProfile } from '@/lib/stakeholder-access'
import type { Profile } from '@/lib/types/database'
import { ViewAsPicker } from '@/components/layout/view-as-picker'
import { TopbarSearch } from '@/components/layout/topbar-search'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

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
  qr: 'QR and Codes',
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
const MAX_HISTORY = 50

function pathnameToLabel(pathname: string): string {
  const segments = pathname.split('/').filter(Boolean)

  const meaningful = segments.map((segment) => {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}/.test(segment)) return 'Detail'
    return ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
  })

  return meaningful.slice(-2).join(' / ') || 'Dashboard'
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
  } catch {
    // Ignore storage failures and keep navigation working.
  }
}

function getPageContext(pathname: string) {
  const segments = pathname.split('/').filter(Boolean)
  const pageTitle = pathnameToLabel(pathname)
  const section = segments[0] ? ROUTE_LABELS[segments[0]] || 'Workspace' : 'Workspace'

  return {
    title: pageTitle,
    section,
  }
}

function getProfileHref(profile: Profile, shell: string) {
  if (isAdminProfile(profile)) return '/admin/users'
  if (shell === 'business') return '/portal/business'
  if (shell === 'consumer') return '/portal/me'
  if (shell === 'community') return '/community/share'
  if (shell === 'influencer') return '/influencer/share'
  return '/dashboard'
}

function getActionCenterContent(shell: string, pathname: string) {
  if (shell === 'business') {
    return {
      title: 'Keep business setup simple',
      description: 'Pick one task, finish it, then come back for the next step.',
      items: [
        { label: 'Open my next business step', href: '/dashboard' },
        { label: 'Open my 100 list', href: '/portal/clients' },
        { label: 'Check my business profile', href: '/portal/business' },
      ],
    }
  }

  if (shell === 'consumer') {
    return {
      title: 'Your easiest next move',
      description: 'Start with your money, then your people, then your causes.',
      items: [
        { label: 'Check my money', href: '/portal/me/wallet' },
        { label: 'See my network', href: '/portal/me/network' },
        { label: 'Choose my causes', href: '/portal/me/causes' },
      ],
    }
  }

  if (shell === 'community') {
    return {
      title: 'Community work in order',
      description: 'Check supporters first, then share tools, then business activity.',
      items: [
        { label: 'See supporters', href: '/community/supporters' },
        { label: 'Open share tools', href: '/community/share' },
        { label: 'Review community businesses', href: '/community/businesses' },
      ],
    }
  }

  return {
    title: pathname.startsWith('/admin') ? 'Admin action center' : 'Workspace shortcuts',
    description: 'Use these links to jump to the next useful area without hunting through the menu.',
    items: [
      { label: 'Go to dashboard home', href: '/dashboard' },
      { label: 'Open businesses', href: '/crm/businesses' },
      { label: 'Open onboarding', href: '/onboarding/business' },
    ],
  }
}

interface TopbarProps {
  profile: Profile
  sidebarCollapsed: boolean
  onOpenMobileNav: () => void
}

export function Topbar({ profile, sidebarCollapsed, onOpenMobileNav }: TopbarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const access = getStakeholderAccess(profile)
  const searchPlaceholder = access.searchPlaceholder
  const [searchValue, setSearchValue] = React.useState('')
  const [mobileSearchOpen, setMobileSearchOpen] = React.useState(false)
  const searchRef = React.useRef<HTMLInputElement>(null)
  const mobileSearchRef = React.useRef<HTMLInputElement>(null)
  const [history, setHistory] = React.useState<{ path: string; label: string }[]>([])
  const pageContext = React.useMemo(() => getPageContext(pathname), [pathname])
  const profileHref = getProfileHref(profile, access.shell)
  const actionCenter = React.useMemo(
    () => getActionCenterContent(access.shell, pathname),
    [access.shell, pathname]
  )

  React.useEffect(() => {
    const prev = readHistory()
    if (prev.length > 0 && prev[0].path === pathname) {
      setHistory(prev)
      return
    }

    const next = [{ path: pathname, label: pathnameToLabel(pathname) }, ...prev].slice(0, MAX_HISTORY)
    writeHistory(next)
    setHistory(next)
  }, [pathname])

  React.useEffect(() => {
    setMobileSearchOpen(false)
  }, [pathname])

  const trail = React.useMemo(() => {
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
    const idx = history.findIndex((entry) => entry.path === targetPath)
    if (idx > 0) {
      const rewound = history.slice(idx)
      writeHistory(rewound)
      setHistory(rewound)
    }
    router.push(targetPath)
  }

  const handleSignOut = async () => {
    let redirectTo: string | null = null

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      })
      const payload = await response.json().catch(() => null)
      redirectTo = payload && typeof payload.redirectTo === 'string' ? payload.redirectTo : null
    } catch {
      // Keep local sign-out fallback if the server response fails.
    }

    window.location.assign(redirectTo ?? '/login?signout=1')
  }

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        if (window.innerWidth < 640) {
          setMobileSearchOpen(true)
          window.setTimeout(() => mobileSearchRef.current?.focus(), 50)
        } else {
          searchRef.current?.focus()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function handleSearchSubmit(query: string) {
    if (!query.trim()) return

    const q = query.trim().toLowerCase()
    if (isAdminProfile(profile)) {
      router.push(`/crm/businesses?q=${encodeURIComponent(q)}`)
    } else if (access.shell === 'consumer') {
      router.push('/portal/me')
    } else if (access.shell === 'community') {
      router.push('/community/supporters')
    } else if (access.shell === 'business') {
      router.push('/portal/clients')
    } else {
      router.push(`/crm/businesses?q=${encodeURIComponent(q)}`)
    }

    setSearchValue('')
    setMobileSearchOpen(false)
    searchRef.current?.blur()
    mobileSearchRef.current?.blur()
  }

  return (
    <>
      <header
        className={cn(
          'fixed right-0 top-0 z-30 flex h-16 items-center gap-3 border-b border-surface-200 bg-surface-0/95 px-3 backdrop-blur transition-all sm:px-4 md:h-14',
          sidebarCollapsed ? 'left-0 md:left-16' : 'left-0 md:left-60'
        )}
      >
        <button
          onClick={onOpenMobileNav}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-600 shadow-sm transition-colors hover:bg-surface-50 md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-4 w-4" />
        </button>

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-surface-400">
            <span>{pageContext.section}</span>
            {trail.length > 0 ? <span className="hidden sm:inline">/</span> : null}
            {trail.length > 0 ? (
              <button
                onClick={() => handleTrailClick(trail[0].path)}
                className="hidden items-center gap-1 text-surface-500 transition-colors hover:text-surface-700 sm:inline-flex"
                title={`Back to ${trail[0].label}`}
              >
                <ChevronLeft className="h-3 w-3" />
                <span className="truncate">{trail[0].label}</span>
              </button>
            ) : null}
          </div>
          <p className="truncate text-sm font-semibold text-surface-900 sm:text-base">{pageContext.title}</p>
        </div>

        <div className="hidden min-w-0 flex-1 px-2 sm:block">
          <TopbarSearch
            ref={searchRef}
            value={searchValue}
            onChange={setSearchValue}
            placeholder={searchPlaceholder}
            onSubmit={handleSearchSubmit}
            className="max-w-md"
          />
        </div>

        <button
          onClick={() => {
            setMobileSearchOpen(true)
            window.setTimeout(() => mobileSearchRef.current?.focus(), 50)
          }}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-surface-200 bg-white text-surface-600 shadow-sm transition-colors hover:bg-surface-50 sm:hidden"
          aria-label="Open search"
        >
          <Search className="h-4 w-4" />
        </button>

        {isAdminProfile(profile) ? (
          <div className="hidden items-center gap-1.5 rounded-xl bg-surface-50 px-2 py-1 md:flex">
            <div
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: BRANDS[profile.brand_context].color }}
            />
            <span className="text-xs font-medium text-surface-600">
              {BRANDS[profile.brand_context].label}
            </span>
          </div>
        ) : null}

        {isAdminProfile(profile) ? <ViewAsPicker /> : null}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="relative rounded-xl p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600">
              <Bell className="h-4 w-4" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 w-80 rounded-xl border border-surface-200 bg-surface-0 p-3 shadow-panel animate-fade-in"
              align="end"
              sideOffset={4}
            >
              <p className="mb-2 text-sm font-semibold text-surface-800">Action Center</p>
              <div className="space-y-2">
                <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
                  <p className="text-sm font-medium text-surface-800">{actionCenter.title}</p>
                  <p className="mt-1 text-xs leading-5 text-surface-500">
                    {actionCenter.description}
                  </p>
                </div>
                <div className="space-y-2">
                  {actionCenter.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center justify-between rounded-xl border border-surface-200 px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-50 hover:text-brand-700"
                    >
                      <span>{item.label}</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href="/dashboard">
                    <Home className="h-3.5 w-3.5" />
                    Back to dashboard home
                  </Link>
                </Button>
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button className="flex items-center gap-2 rounded-xl px-2 py-1 transition-colors hover:bg-surface-100">
              <Avatar name={profile.full_name} src={profile.avatar_url} size="sm" />
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium text-surface-800">{profile.full_name}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-surface-400">{access.label}</p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-surface-400" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="z-50 min-w-[220px] rounded-xl border border-surface-200 bg-surface-0 p-1 shadow-panel animate-fade-in"
              align="end"
              sideOffset={4}
            >
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-600 outline-none hover:bg-surface-100"
                onClick={() => router.push(profileHref)}
              >
                <User className="h-4 w-4" /> My page
              </DropdownMenu.Item>
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-surface-600 outline-none hover:bg-surface-100"
                onClick={() => router.push('/dashboard')}
              >
                <Settings className="h-4 w-4" /> Dashboard home
              </DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-surface-100" />
              <DropdownMenu.Item
                className="flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger-500 outline-none hover:bg-danger-50"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <Dialog open={mobileSearchOpen} onOpenChange={setMobileSearchOpen}>
        <DialogContent className="max-w-md rounded-3xl p-5">
          <DialogHeader>
            <DialogTitle>Search the workspace</DialogTitle>
            <DialogDescription>
              Type a name or keyword and jump straight to the right record.
            </DialogDescription>
          </DialogHeader>
          <TopbarSearch
            ref={mobileSearchRef}
            value={searchValue}
            onChange={setSearchValue}
            placeholder={searchPlaceholder}
            onSubmit={handleSearchSubmit}
            className="max-w-none"
            inputClassName="h-11 rounded-2xl"
            showShortcut={false}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
