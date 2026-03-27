'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Building2, Store, Heart, Users, UserCheck,
  MapPin, Send, CheckSquare, QrCode, Plus, FolderOpen, BarChart3,
  FileText, Library, FileDown, Megaphone, Rocket, UserPlus,
  TrendingUp, Settings, Shield, ScrollText, ChevronDown,
  PanelLeftClose, PanelLeft, Briefcase,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { type NavItem, BRANDS } from '@/lib/constants'
import { getStakeholderAccess, getThemeForProfile } from '@/lib/stakeholder-access'
import type { Brand, Profile } from '@/lib/types/database'

const ICON_MAP: Record<string, React.ElementType> = {
  LayoutDashboard, Building2, Store, Heart, Users, UserCheck,
  MapPin, Send, CheckSquare, QrCode, Plus, FolderOpen, BarChart3,
  FileText, Library, FileDown, Megaphone, Rocket, UserPlus,
  TrendingUp, Settings, Shield, ScrollText, Briefcase,
}

interface SidebarProps {
  profile: Profile
  brand: Brand
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ profile, brand, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname()
  const access = getStakeholderAccess(profile)
  const roleTheme = getThemeForProfile(profile)
  const visibleItems = access.navItems

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-40 flex h-full flex-col border-r border-surface-200 bg-surface-0 transition-all duration-200 no-print',
        collapsed ? 'w-16' : 'w-60',
        `border-t-4 ${roleTheme?.sidebar || ''}`
      )}
    >
      {/* Logo */}
      <div className={cn(
        'flex h-14 items-center border-b border-surface-100 px-4',
        collapsed ? 'justify-center' : 'gap-3'
      )}>
        <div
          className="h-8 w-8 shrink-0 rounded-lg"
          style={{ backgroundColor: BRANDS[brand].color }}
        />
        {!collapsed && (
          <div>
            <p className="text-sm font-bold text-surface-900">{BRANDS[brand].label}</p>
            <p className="text-[10px] text-surface-400">Support Hub</p>
          </div>
        )}
      </div>

      {/* Role badge */}
      {!collapsed && (
        <div className={cn('mx-3 mb-2 rounded-md px-2.5 py-1 text-xs font-medium text-center', roleTheme?.bg)} style={{ color: roleTheme?.primary }}>
          {access.label}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        <ul className="space-y-0.5">
          {visibleItems.map(item => (
            <SidebarItem
              key={item.href}
              item={item}
              pathname={pathname}
              userLevel={0}
              collapsed={collapsed}
            />
          ))}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-surface-100 p-2">
        <button
          onClick={onToggle}
          className="flex w-full items-center justify-center rounded-lg p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors"
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}

function SidebarItem({
  item,
  pathname,
  userLevel,
  collapsed,
}: {
  item: NavItem
  pathname: string
  userLevel: number
  collapsed: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const Icon = ICON_MAP[item.icon] || LayoutDashboard
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const hasChildren = item.children && item.children.length > 0
  const visibleChildren = React.useMemo(
    () => item.children?.filter(c => userLevel >= c.minLevel) || [],
    [item.children, userLevel]
  )

  // Auto-expand if a child is active
  React.useEffect(() => {
    if (visibleChildren.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))) {
      setOpen(true)
    }
  }, [pathname, visibleChildren])

  if (collapsed) {
    return (
      <li>
        <Link
          href={hasChildren && visibleChildren.length > 0 ? visibleChildren[0].href : item.href}
          className={cn(
            'flex items-center justify-center rounded-lg p-2.5 transition-colors',
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
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
            isActive
              ? 'bg-brand-50 text-brand-700 font-medium'
              : 'text-surface-600 hover:bg-surface-100 hover:text-surface-800'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      </li>
    )
  }

  return (
    <li>
      <button
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-brand-50 text-brand-700 font-medium'
            : 'text-surface-600 hover:bg-surface-100 hover:text-surface-800'
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-surface-100 pl-3">
          {visibleChildren.map(child => {
            const ChildIcon = ICON_MAP[child.icon] || LayoutDashboard
            const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
            return (
              <li key={child.href}>
                <Link
                  href={child.href}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
                    childActive
                      ? 'text-brand-700 font-medium'
                      : 'text-surface-500 hover:text-surface-700'
                  )}
                >
                  <ChildIcon className="h-3.5 w-3.5 shrink-0" />
                  {child.label}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}
