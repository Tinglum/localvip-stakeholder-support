'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Store, Heart, QrCode, FileText, Send, CheckSquare,
  TrendingUp, ArrowRight, Plus, Users, Megaphone, Rocket,
  AlertTriangle, Clock, BarChart3, Target, ScrollText, FileDown,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useCount, useOutreach, useBusinesses } from '@/lib/supabase/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { BusinessDashboardPage } from '@/components/business/business-dashboard-page'
import { CommunityDashboardPage } from '@/components/community/community-dashboard-page'
import { FieldOutreachDashboardPage } from '@/components/field/field-outreach-dashboard-page'
import { InfluencerDashboardPage } from '@/components/influencer/influencer-dashboard-page'
import { LaunchPartnerDashboardPage } from '@/components/partner/launch-partner-dashboard-page'
import { ROLES, ROLE_TOOLS, ROLE_THEMES } from '@/lib/constants'
import { getStakeholderAccess } from '@/lib/stakeholder-access'
import { formatDate } from '@/lib/utils'

// Icon map for dynamic role tools
const ICON_MAP: Record<string, React.ElementType> = {
  Store, Heart, QrCode, FileText, Send, CheckSquare,
  TrendingUp, Plus, Users, Megaphone, Rocket, BarChart3,
  ScrollText, FileDown,
}

// ─── Priority actions by role ────────────────────────────────

function getActionsForRole(role: string) {
  switch (role) {
    case 'super_admin':
    case 'internal_admin':
      return [
        { label: 'Review pending stakeholder applications', href: '/admin/users', priority: 'high' as const },
        { label: 'Check for duplicate business records', href: '/crm/businesses', priority: 'medium' as const },
        { label: 'Review active campaigns', href: '/campaigns', priority: 'medium' as const },
      ]
    case 'school_leader':
    case 'cause_leader':
      return [
        { label: 'Complete business follow-ups this week', href: '/crm/outreach', priority: 'high' as const },
        { label: 'Download your updated HATO materials', href: '/materials/mine', priority: 'medium' as const },
        { label: 'Generate QR codes for current campaign', href: '/qr/generator', priority: 'medium' as const },
      ]
    default:
      return [
        { label: 'Contact your assigned businesses', href: '/crm/outreach', priority: 'high' as const },
        { label: 'Grab your outreach script', href: '/materials/mine', priority: 'medium' as const },
        { label: 'Log your latest outreach activity', href: '/crm/outreach', priority: 'medium' as const },
      ]
  }
}

// ─── Component ───────────────────────────────────────────────

export default function DashboardPage() {
  const { profile } = useAuth()
  const access = getStakeholderAccess(profile)

  if (access.shell === 'business') {
    return <BusinessDashboardPage />
  }

  if (access.shell === 'field') {
    return <FieldOutreachDashboardPage />
  }

  if (access.shell === 'launch_partner') {
    return <LaunchPartnerDashboardPage />
  }

  if (access.shell === 'community') {
    return <CommunityDashboardPage />
  }

  if (access.shell === 'influencer') {
    return <InfluencerDashboardPage />
  }

  return <TeamDashboardPage />
}

function TeamDashboardPage() {
  const { profile, isAdmin } = useAuth()

  const actions = getActionsForRole(profile.role)

  // Role-specific tools and theme
  const roleTools = ROLE_TOOLS[profile.role] || ROLE_TOOLS.volunteer
  const roleTheme = ROLE_THEMES[profile.role]

  // Real counts from Supabase
  const businessCount = useCount('businesses')
  const causeCount = useCount('causes')
  const stakeholderCount = useCount('profiles')
  const qrCodeCount = useCount('qr_codes')

  // Real outreach activities
  const { data: outreachData, loading: outreachLoading } = useOutreach()
  const recentOutreach = outreachData.slice(0, 5)

  // Real business data for pipeline
  const { data: businessData, loading: businessLoading } = useBusinesses()
  const stageCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const biz of businessData) {
      counts[biz.stage] = (counts[biz.stage] || 0) + 1
    }
    const total = businessData.length || 1
    const stages: { stage: string; label: string; count: number; color: string; pct: number }[] = [
      { stage: 'lead', label: 'Lead', count: counts['lead'] || 0, color: 'bg-surface-300', pct: 0 },
      { stage: 'contacted', label: 'Contacted', count: counts['contacted'] || 0, color: 'bg-brand-300', pct: 0 },
      { stage: 'interested', label: 'Interested', count: counts['interested'] || 0, color: 'bg-brand-400', pct: 0 },
      { stage: 'in_progress', label: 'In Progress', count: counts['in_progress'] || 0, color: 'bg-warning-500', pct: 0 },
      { stage: 'onboarded', label: 'Onboarded', count: counts['onboarded'] || 0, color: 'bg-success-500', pct: 0 },
      { stage: 'live', label: 'Live', count: counts['live'] || 0, color: 'bg-success-700', pct: 0 },
    ]
    for (const s of stages) {
      s.pct = Math.round((s.count / total) * 100)
    }
    return stages
  }, [businessData])

  const greeting = getGreeting()
  const firstName = profile.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      {/* Header with role-themed greeting */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-display text-surface-900">
            {greeting}, {firstName}
          </h1>
          <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${roleTheme?.bg || ''}`}
            style={{ color: roleTheme?.primary }}
          >
            {roleTheme?.label || ROLES[profile.role]?.label}
          </span>
        </div>
        <p className="mt-1 text-body text-surface-500">
          {isAdmin
            ? "Here's what needs your attention today."
            : "Here's your progress and next steps."}
        </p>
      </div>

      {/* Priority Actions */}
      {actions.length > 0 && (
        <Card className="border-l-4" style={{ borderLeftColor: roleTheme?.primary }}>
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4" style={{ color: roleTheme?.primary }} />
              <h3 className="text-sm font-semibold text-surface-800">Your Next Steps</h3>
            </div>
            <ul className="space-y-2">
              {actions.map((action, idx) => (
                <li key={idx}>
                  <Link
                    href={action.href}
                    className="group flex items-center justify-between rounded-lg px-3 py-2 hover:bg-surface-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2 w-2 rounded-full ${
                        action.priority === 'high' ? 'bg-danger-500' :
                        action.priority === 'medium' ? 'bg-warning-500' :
                        'bg-surface-300'
                      }`} />
                      <span className="text-sm text-surface-700">{action.label}</span>
                    </div>
                    <ArrowRight className="h-4 w-4 text-surface-300 group-hover:text-brand-500 transition-colors" />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Stats — real counts from Supabase */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Businesses"
          value={businessCount}
          icon={<Store className="h-5 w-5" />}
        />
        <StatCard
          label="Total Causes"
          value={causeCount}
          icon={<Heart className="h-5 w-5" />}
        />
        <StatCard
          label="Stakeholders"
          value={stakeholderCount}
          icon={<Users className="h-5 w-5" />}
        />
        <StatCard
          label="QR Codes"
          value={qrCodeCount}
          icon={<QrCode className="h-5 w-5" />}
        />
      </div>

      {/* Role-Specific Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-surface-800">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roleTools.map((tool, idx) => {
            const Icon = ICON_MAP[tool.icon] || FileText
            return (
              <Link key={idx} href={tool.href}>
                <Card className="group cursor-pointer transition-shadow hover:shadow-card-hover">
                  <CardContent className="flex items-start gap-3 py-4">
                    <div
                      className="rounded-lg p-2"
                      style={{ backgroundColor: `${roleTheme?.primary}14`, color: roleTheme?.primary }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-surface-800 group-hover:text-brand-700 transition-colors">
                        {tool.label}
                      </p>
                      <p className="mt-0.5 text-xs text-surface-400">{tool.description}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-surface-300 group-hover:text-brand-500 transition-colors" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Recent Activity & Pipeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity — real data from outreach_activities */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Link href="/crm/outreach">
                <Button variant="ghost" size="sm">View all <ArrowRight className="h-3.5 w-3.5" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {outreachLoading ? (
              <p className="text-sm text-surface-400">Loading activities...</p>
            ) : recentOutreach.length === 0 ? (
              <p className="text-sm text-surface-400">No recent outreach activity yet.</p>
            ) : (
              <div className="space-y-3">
                {recentOutreach.map((item) => (
                  <div key={item.id} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-surface-50">
                    <div>
                      <p className="text-sm text-surface-700">
                        {item.type.replace('_', ' ').replace(/^\w/, c => c.toUpperCase())}
                        {item.subject ? `: ${item.subject}` : ''}
                      </p>
                      <p className="text-xs text-surface-400">
                        {item.entity_type} &middot; {formatDate(item.created_at)}
                      </p>
                    </div>
                    <Badge variant={
                      item.outcome === 'positive' ? 'success' :
                      item.outcome === 'negative' ? 'danger' :
                      item.outcome === 'neutral' ? 'warning' :
                      'default'
                    }>
                      {item.outcome || item.type}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pipeline Overview — real stage counts from businesses */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{isAdmin ? 'Pipeline Overview' : 'Your Progress'}</CardTitle>
              <Link href={isAdmin ? '/crm/businesses' : '/analytics'}>
                <Button variant="ghost" size="sm">Details <ArrowRight className="h-3.5 w-3.5" /></Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {businessLoading ? (
              <p className="text-sm text-surface-400">Loading pipeline...</p>
            ) : (
              <div className="space-y-4">
                {stageCounts.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="w-24 text-xs text-surface-500">{stage.label}</span>
                    <div className="flex-1">
                      <div className="h-2 rounded-full bg-surface-100">
                        <div
                          className={`h-2 rounded-full ${stage.color} transition-all`}
                          style={{ width: `${stage.pct}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-8 text-right text-xs font-medium text-surface-600">{stage.count}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Duplicate Warnings (admin only) */}
      {isAdmin && (
        <Card className="border-l-4 border-l-warning-500">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4 text-warning-500" />
              <h3 className="text-sm font-semibold text-surface-800">Duplicate Alerts</h3>
              <Badge variant="warning">Possible duplicates</Badge>
            </div>
            <p className="text-xs text-surface-500 mb-3">
              Review your records periodically to keep the CRM clean.
            </p>
            <Link href="/crm/businesses">
              <Button variant="outline" size="sm">
                Review Businesses <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
