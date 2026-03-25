'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Store, Heart, QrCode, FileText, Send, CheckSquare,
  TrendingUp, ArrowRight, Plus, Users, Megaphone, Rocket,
  AlertTriangle, Clock, BarChart3, Target,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { PageHeader } from '@/components/ui/page-header'
import { ROLES, BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

// ─── Demo data ───────────────────────────────────────────────

const DEMO_STATS = {
  super_admin: {
    stats: [
      { label: 'Total Businesses', value: 247, change: 12.5, icon: <Store className="h-5 w-5" /> },
      { label: 'Total Causes', value: 38, change: 8.3, icon: <Heart className="h-5 w-5" /> },
      { label: 'Active Stakeholders', value: 84, change: 15.2, icon: <Users className="h-5 w-5" /> },
      { label: 'QR Scans (30d)', value: 3842, change: 22.1, icon: <QrCode className="h-5 w-5" /> },
    ],
    actions: [
      { label: 'Review 3 pending stakeholder applications', href: '/admin/users', priority: 'high' as const },
      { label: '12 duplicate warnings need resolution', href: '/crm/businesses?filter=duplicates', priority: 'medium' as const },
      { label: 'Atlanta campaign launch — 5 tasks remaining', href: '/campaigns', priority: 'medium' as const },
    ],
  },
  internal_admin: {
    stats: [
      { label: 'Pipeline Businesses', value: 64, change: 5.3, icon: <Store className="h-5 w-5" /> },
      { label: 'Active Onboarding', value: 18, change: 10.0, icon: <Rocket className="h-5 w-5" /> },
      { label: 'Open Tasks', value: 23, change: -5.1, icon: <CheckSquare className="h-5 w-5" /> },
      { label: 'QR Scans (30d)', value: 3842, change: 22.1, icon: <QrCode className="h-5 w-5" /> },
    ],
    actions: [
      { label: 'Assign 8 new business leads', href: '/crm/businesses?stage=lead', priority: 'high' as const },
      { label: 'Follow up on 5 stalled onboardings', href: '/onboarding/business?stage=in_progress', priority: 'medium' as const },
      { label: 'Update HATO flyer for Q2', href: '/materials/library', priority: 'low' as const },
    ],
  },
  school_leader: {
    stats: [
      { label: 'My Businesses', value: 12, change: 16.7, icon: <Store className="h-5 w-5" /> },
      { label: 'My QR Scans', value: 284, change: 32.0, icon: <QrCode className="h-5 w-5" /> },
      { label: 'Signups Attributed', value: 45, change: 18.5, icon: <TrendingUp className="h-5 w-5" /> },
      { label: 'Pending Tasks', value: 3, change: 0, icon: <CheckSquare className="h-5 w-5" /> },
    ],
    actions: [
      { label: 'Complete 2 business follow-ups this week', href: '/crm/outreach', priority: 'high' as const },
      { label: 'Download your updated HATO materials', href: '/materials/mine', priority: 'medium' as const },
      { label: 'Generate QR codes for spring campaign', href: '/qr/generator', priority: 'medium' as const },
    ],
  },
  volunteer: {
    stats: [
      { label: 'Businesses Contacted', value: 8, change: 25.0, icon: <Send className="h-5 w-5" /> },
      { label: 'QR Scans', value: 47, change: 40.0, icon: <QrCode className="h-5 w-5" /> },
      { label: 'Signups', value: 5, change: 66.7, icon: <TrendingUp className="h-5 w-5" /> },
      { label: 'Tasks Done', value: 6, change: 0, icon: <CheckSquare className="h-5 w-5" /> },
    ],
    actions: [
      { label: 'Contact 3 assigned businesses today', href: '/crm/outreach', priority: 'high' as const },
      { label: 'Grab your outreach script', href: '/materials/mine', priority: 'medium' as const },
      { label: 'Log your visit to Main Street Bakery', href: '/crm/outreach', priority: 'medium' as const },
    ],
  },
}

function getStatsForRole(role: string) {
  return DEMO_STATS[role as keyof typeof DEMO_STATS] || DEMO_STATS.volunteer
}

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

// ─── Component ───────────────────────────────────────────────

export default function DashboardPage() {
  const { profile, isAdmin, hasMinLevel } = useAuth()
  const roleData = getStatsForRole(profile.role)
  const quickActions = hasMinLevel(40) ? ADMIN_QUICK_ACTIONS : FIELD_QUICK_ACTIONS

  const greeting = getGreeting()

  return (
    <div className="space-y-8">
      {/* Header with greeting */}
      <div>
        <h1 className="text-display text-surface-900">
          {greeting}, {profile.full_name.split(' ')[0]}
        </h1>
        <p className="mt-1 text-body text-surface-500">
          {isAdmin
            ? "Here's what needs your attention today."
            : "Here's your progress and next steps."}
        </p>
      </div>

      {/* Priority Actions — always at the top */}
      {roleData.actions.length > 0 && (
        <Card className="border-l-4 border-l-brand-500">
          <CardContent className="py-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-brand-600" />
              <h3 className="text-sm font-semibold text-surface-800">Your Next Steps</h3>
            </div>
            <ul className="space-y-2">
              {roleData.actions.map((action, idx) => (
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

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {roleData.stats.map((stat, idx) => (
          <StatCard
            key={idx}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            changePeriod="vs last 30 days"
            icon={stat.icon}
          />
        ))}
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

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Outreach */}
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
                { action: 'Called Main Street Bakery', user: 'Alex Rivera', time: '2h ago', status: 'Interested' },
                { action: 'Emailed Community Church', user: 'Casey Adams', time: '4h ago', status: 'Contacted' },
                { action: 'Visited Oak Hill School', user: 'Dr. Sarah Johnson', time: '1d ago', status: 'In Progress' },
                { action: 'Signed up River Cafe', user: 'Jordan Taylor', time: '1d ago', status: 'Onboarded' },
                { action: 'QR code scanned 12 times', user: 'System', time: '2d ago', status: 'Tracking' },
              ].map((item, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-surface-50">
                  <div>
                    <p className="text-sm text-surface-700">{item.action}</p>
                    <p className="text-xs text-surface-400">{item.user} &middot; {item.time}</p>
                  </div>
                  <Badge variant={
                    item.status === 'Onboarded' ? 'success' :
                    item.status === 'In Progress' ? 'warning' :
                    item.status === 'Interested' ? 'info' :
                    'default'
                  }>
                    {item.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Pipeline Summary (admin) or My Progress (field) */}
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
                { stage: 'Lead', count: 42, color: 'bg-surface-300', width: '40%' },
                { stage: 'Contacted', count: 28, color: 'bg-brand-300', width: '27%' },
                { stage: 'Interested', count: 18, color: 'bg-brand-400', width: '17%' },
                { stage: 'In Progress', count: 12, color: 'bg-warning-500', width: '12%' },
                { stage: 'Onboarded', count: 8, color: 'bg-success-500', width: '8%' },
                { stage: 'Live', count: 4, color: 'bg-success-700', width: '4%' },
              ].map((stage, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="w-24 text-xs text-surface-500">{stage.stage}</span>
                  <div className="flex-1">
                    <div className="h-2 rounded-full bg-surface-100">
                      <div
                        className={`h-2 rounded-full ${stage.color} transition-all`}
                        style={{ width: stage.width }}
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
              <Badge variant="warning">3 potential duplicates</Badge>
            </div>
            <p className="text-xs text-surface-500 mb-3">
              These records may be duplicates. Review and merge to keep your CRM clean.
            </p>
            <div className="space-y-2">
              {[
                { name: 'Main Street Bakery', match: 'Main St. Bakery & Cafe', confidence: 87 },
                { name: 'Community Strong Foundation', match: 'CommunityStrong', confidence: 72 },
                { name: 'Oak Hill Elementary', match: 'Oakhill Elementary School', confidence: 91 },
              ].map((dup, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2">
                  <div className="text-sm">
                    <span className="text-surface-700">{dup.name}</span>
                    <span className="mx-2 text-surface-300">&harr;</span>
                    <span className="text-surface-700">{dup.match}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-surface-400">{dup.confidence}% match</span>
                    <Button variant="outline" size="sm">Review</Button>
                  </div>
                </div>
              ))}
            </div>
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
