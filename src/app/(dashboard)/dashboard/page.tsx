'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Store, Heart, QrCode, FileText, Send, CheckSquare,
  TrendingUp, ArrowRight, Plus, Users, Megaphone, Rocket,
  AlertTriangle, Clock, BarChart3, Target,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { useCount } from '@/lib/supabase/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { ROLES, BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

// ─── Quick Actions ───────────────────────────────────────────

interface QuickAction {
  label: string
  description: string
  href: string
  icon: React.ReactNode
  color: string
}

const ADMIN_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Add Business', description: 'Start onboarding a new business', href: '/crm/businesses?action=new', icon: <Store className="h-5 w-5" />, color: 'bg-brand-50 text-brand-600' },
  { label: 'Add Cause', description: 'Register a school or nonprofit', href: '/crm/causes?action=new', icon: <Heart className="h-5 w-5" />, color: 'bg-hato-50 text-hato-600' },
  { label: 'Generate QR Code', description: 'Create a trackable QR code', href: '/qr/generator', icon: <QrCode className="h-5 w-5" />, color: 'bg-purple-50 text-purple-600' },
  { label: 'Upload Material', description: 'Add a flyer, script, or template', href: '/materials/library?action=upload', icon: <FileText className="h-5 w-5" />, color: 'bg-emerald-50 text-emerald-600' },
]

const FIELD_QUICK_ACTIONS: QuickAction[] = [
  { label: 'Log Outreach', description: 'Record a business visit or call', href: '/crm/outreach?action=new', icon: <Send className="h-5 w-5" />, color: 'bg-brand-50 text-brand-600' },
  { label: 'Get QR Code', description: 'Your personalized QR codes', href: '/qr/mine', icon: <QrCode className="h-5 w-5" />, color: 'bg-purple-50 text-purple-600' },
  { label: 'View Materials', description: 'Download flyers and scripts', href: '/materials/mine', icon: <FileText className="h-5 w-5" />, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'See My Stats', description: 'Track your impact', href: '/analytics', icon: <BarChart3 className="h-5 w-5" />, color: 'bg-amber-50 text-amber-600' },
]

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
  const { profile, isAdmin, hasMinLevel } = useAuth()
  const quickActions = hasMinLevel(40) ? ADMIN_QUICK_ACTIONS : FIELD_QUICK_ACTIONS
  const actions = getActionsForRole(profile.role)

  // Real counts from Supabase
  const businessCount = useCount('businesses')
  const causeCount = useCount('causes')
  const stakeholderCount = useCount('profiles')
  const qrCodeCount = useCount('qr_codes')

  const greeting = getGreeting()
  const firstName = profile.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      {/* Header with greeting */}
      <div>
        <h1 className="text-display text-surface-900">
          {greeting}, {firstName}
        </h1>
        <p className="mt-1 text-body text-surface-500">
          {isAdmin
            ? "Here's what needs your attention today."
            : "Here's your progress and next steps."}
        </p>
      </div>

      {/* Priority Actions */}
      {actions.length > 0 && (
        <Card className="border-l-4 border-l-brand-500">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-brand-600" />
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

      {/* Quick Actions */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-surface-800">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {quickActions.map((action, idx) => (
            <Link key={idx} href={action.href}>
              <Card className="group cursor-pointer transition-shadow hover:shadow-card-hover">
                <CardContent className="flex items-start gap-3 py-4">
                  <div className={`rounded-lg p-2 ${action.color}`}>
                    {action.icon}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-surface-800 group-hover:text-brand-700 transition-colors">
                      {action.label}
                    </p>
                    <p className="mt-0.5 text-xs text-surface-400">{action.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 text-surface-300 group-hover:text-brand-500 transition-colors" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity & Pipeline */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity (placeholder data for now) */}
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
            <div className="space-y-3">
              {[
                { action: 'New business lead added', user: 'System', time: '2h ago', status: 'Lead' },
                { action: 'Outreach call logged', user: 'Team member', time: '4h ago', status: 'Contacted' },
                { action: 'Cause onboarding started', user: 'Team member', time: '1d ago', status: 'In Progress' },
                { action: 'Business signed up', user: 'System', time: '1d ago', status: 'Onboarded' },
                { action: 'QR code generated', user: 'System', time: '2d ago', status: 'Tracking' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-surface-50">
                  <div>
                    <p className="text-sm text-surface-700">{item.action}</p>
                    <p className="text-xs text-surface-400">{item.user} &middot; {item.time}</p>
                  </div>
                  <Badge variant={
                    item.status === 'Onboarded' ? 'success' :
                    item.status === 'In Progress' ? 'warning' :
                    item.status === 'Contacted' ? 'info' :
                    'default'
                  }>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Overview (placeholder data for now) */}
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
            <div className="space-y-4">
              {[
                { stage: 'Lead', count: 12, color: 'bg-surface-300', pct: 40 },
                { stage: 'Contacted', count: 8, color: 'bg-brand-300', pct: 27 },
                { stage: 'Interested', count: 5, color: 'bg-brand-400', pct: 17 },
                { stage: 'In Progress', count: 3, color: 'bg-warning-500', pct: 12 },
                { stage: 'Onboarded', count: 2, color: 'bg-success-500', pct: 8 },
                { stage: 'Live', count: 1, color: 'bg-success-700', pct: 4 },
              ].map((stage, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-surface-500">{stage.stage}</span>
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
