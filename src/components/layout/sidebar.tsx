'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  BarChart3,
  Briefcase,
  Building2,
  CheckSquare,
  ChevronDown,
  FileDown,
  FileText,
  FolderKanban,
  FolderOpen,
  Heart,
  LayoutDashboard,
  LayoutTemplate,
  Library,
  ListChecks,
  MapPin,
  Megaphone,
  PanelLeft,
  PanelLeftClose,
  Plus,
  QrCode,
  Rocket,
  ScrollText,
  Send,
  Settings,
  Shield,
  Store,
  TrendingUp,
  UserCheck,
  UserPlus,
  Users,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type NavItem, BRANDS } from '@/lib/constants'
import { getStakeholderAccess, getThemeForProfile } from '@/lib/stakeholder-access'
import type { Brand, Profile } from '@/lib/types/database'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard,
  Building2,
  Store,
  Heart,
  Users,
  UserCheck,
  MapPin,
  Send,
  CheckSquare,
  QrCode,
  Plus,
  FolderOpen,
  BarChart3,
  FileText,
  Library,
  FileDown,
  Megaphone,
  Rocket,
  UserPlus,
  TrendingUp,
  Settings,
  Shield,
  ScrollText,
  Briefcase,
  FolderKanban,
  ListChecks,
  LayoutTemplate,
}

interface SidebarProps {
  profile: Profile
  brand: Brand
  collapsed: boolean
  onToggle: () => void
  mobile?: boolean
  onNavigate?: () => void
}

export function Sidebar({
  profile,
  brand,
  collapsed,
  onToggle,
  mobile = false,
  onNavigate,
}: SidebarProps) {
  const pathname = usePathname()
  const access = getStakeholderAccess(profile)
  const roleTheme = getThemeForProfile(profile)

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-surface-200 bg-surface-0',
        mobile
          ? 'w-[min(22rem,84vw)] border-r'
          : 'fixed left-0 top-0 z-40 hidden border-r border-t-4 transition-all duration-200 md:flex',
        !mobile && (collapsed ? 'w-16' : 'w-60'),
        !mobile && `border-t-4 ${roleTheme?.sidebar || ''}`
      )}
    >
      <div
        className={cn(
          'flex h-16 items-center border-b border-surface-100 px-4',
          collapsed && !mobile ? 'justify-center' : 'gap-3'
        )}
      >
        <div
          className="h-9 w-9 shrink-0 rounded-2xl shadow-sm"
          style={{ backgroundColor: BRANDS[brand].color }}
        />
        {collapsed && !mobile ? null : (
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-surface-900">{BRANDS[brand].label}</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-surface-400">Support Hub</p>
          </div>
        )}
      </div>

      {collapsed && !mobile ? null : (
        <div className="border-b border-surface-100 px-3 py-3">
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-center text-xs font-medium shadow-sm',
              roleTheme?.bg
            )}
            style={{ color: roleTheme?.primary }}
          >
            {access.label}
          </div>
          <p className="mt-2 px-1 text-xs leading-5 text-surface-500">
            Pick one task, finish it, then come back here for the next simple step.
          </p>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <ul className="space-y-0.5">
          {access.navItems.map((item) => (
            <SidebarItem
              key={item.href}
              item={item}
              pathname={pathname}
              userLevel={0}
              collapsed={collapsed && !mobile}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      </nav>

      {!mobile ? (
        <div className="border-t border-surface-100 p-2">
          <button
            onClick={onToggle}
            className="flex w-full items-center justify-center rounded-xl p-2 text-surface-400 transition-colors hover:bg-surface-100 hover:text-surface-600"
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>
      ) : null}
    </aside>
  )
}

function SidebarItem({
  item,
  pathname,
  userLevel,
  collapsed,
  onNavigate,
}: {
  item: NavItem
  pathname: string
  userLevel: number
  collapsed: boolean
  onNavigate?: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const Icon = ICON_MAP[item.icon] || LayoutDashboard
  const visibleChildren = React.useMemo(
    () => item.children?.filter((child) => userLevel >= child.minLevel) || [],
    [item.children, userLevel]
  )
  const childActive = visibleChildren.some(
    (child) => pathname === child.href || pathname.startsWith(`${child.href}/`)
  )
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`) || childActive
  const hasChildren = item.children && item.children.length > 0

  React.useEffect(() => {
    if (childActive) {
      setOpen(true)
    }
  }, [childActive])

  if (collapsed) {
    return (
      <li>
        <Link
          href={hasChildren && visibleChildren.length > 0 ? visibleChildren[0].href : item.href}
          onClick={onNavigate}
          className={cn(
            'flex items-center justify-center rounded-xl p-2.5 transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700'
              : 'text-surface-500 hover:bg-surface-100 hover:text-surface-700'
          )}
          title={item.label}
        >
          <Icon className="h-5 w-5" />
        </Link>
      </li>
    )
  }

  if (!hasChildren || visibleChildren.length === 0) {
    return (
      <li>
        <Link
          href={item.href}
          onClick={onNavigate}
          className={cn(
            'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700 font-medium'
              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-800'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
        </Link>
      </li>
    )
  }

  return (
    <li>
      <button
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700 font-medium'
            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-800'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open ? (
        <ul className="ml-4 mt-1 space-y-0.5 border-l border-surface-100 pl-3">
          {visibleChildren.map((child) => {
            const ChildIcon = ICON_MAP[child.icon] || LayoutDashboard
            const isChildActive = pathname === child.href || pathname.startsWith(`${child.href}/`)

            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors',
                    isChildActive
                      ? 'bg-surface-100 text-brand-700 font-medium'
                      : 'text-surface-500 hover:bg-surface-50 hover:text-surface-700'
                  )}
                >
                  <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{child.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
    </li>
  )
}
