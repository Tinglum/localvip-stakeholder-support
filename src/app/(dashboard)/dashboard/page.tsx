'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckSquare,
  FileDown,
  FileText,
  Heart,
  Megaphone,
  Plus,
  QrCode,
  Rocket,
  ScrollText,
  Send,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import {
  useAdminTasks,
  useBusinesses,
  useCauses,
  useCityAccessRequests,
  useCount,
  useOutreach,
} from '@/lib/supabase/hooks'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatCard } from '@/components/ui/stat-card'
import { StakeholderActionQueue } from '@/components/dashboard/stakeholder-action-queue'
import { BusinessDashboardPage } from '@/components/business/business-dashboard-page'
import { CommunityDashboardPage } from '@/components/community/community-dashboard-page'
import { FieldOutreachDashboardPage } from '@/components/field/field-outreach-dashboard-page'
import { InfluencerDashboardPage } from '@/components/influencer/influencer-dashboard-page'
import { LaunchPartnerDashboardPage } from '@/components/partner/launch-partner-dashboard-page'
import { ROLES, ROLE_THEMES, ROLE_TOOLS } from '@/lib/constants'
import { getStakeholderAccess } from '@/lib/stakeholder-access'
import { formatDate } from '@/lib/utils'

const ICON_MAP: Record<string, React.ElementType> = {
  Store,
  Heart,
  QrCode,
  FileText,
  Send,
  CheckSquare,
  TrendingUp,
  Plus,
  Users,
  Megaphone,
  Rocket,
  BarChart3,
  ScrollText,
  FileDown,
}

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
  const [selectedStage, setSelectedStage] = React.useState<{
    stage: string
    label: string
    count: number
  } | null>(null)

  const roleTools = ROLE_TOOLS[profile.role] || ROLE_TOOLS.volunteer
  const roleTheme = ROLE_THEMES[profile.role]

  const businessCount = useCount('businesses')
  const causeCount = useCount('causes')
  const stakeholderCount = useCount('profiles')
  const qrCodeCount = useCount('qr_codes')

  const { data: outreachData, loading: outreachLoading } = useOutreach()
  const recentOutreach = outreachData.slice(0, 5)

  const { data: businessData, loading: businessLoading } = useBusinesses()
  const { data: causeData } = useCauses()
  const { data: adminTasks } = useAdminTasks()
  const { data: cityRequests } = useCityAccessRequests()

  const pendingCityRequests = React.useMemo(
    () => cityRequests.filter((request) => request.status === 'pending'),
    [cityRequests]
  )
  const materialTasksNeedingSetup = React.useMemo(
    () => adminTasks.filter((task) => task.status === 'needs_setup' || task.status === 'failed'),
    [adminTasks]
  )
  const materialTasksReadyToGenerate = React.useMemo(
    () => adminTasks.filter((task) => task.status === 'ready_to_generate'),
    [adminTasks]
  )
  const openBusinessOnboarding = React.useMemo(
    () => businessData.filter((business) => ['lead', 'contacted', 'interested', 'in_progress'].includes(business.stage)),
    [businessData]
  )
  const openCauseOnboarding = React.useMemo(
    () => causeData.filter((cause) => ['lead', 'contacted', 'interested', 'in_progress'].includes(cause.stage)),
    [causeData]
  )
  const immediateItems = React.useMemo(
    () => {
      const items = [
        pendingCityRequests.length > 0
          ? {
              id: 'admin-city-requests',
              title: 'Review pending city access requests',
              detail: `${pendingCityRequests.length} city access request${pendingCityRequests.length === 1 ? '' : 's'} are waiting on an admin decision.`,
              href: '/admin/users',
              ctaLabel: 'Review requests',
              priority: 'high' as const,
              badge: 'Launch partner growth',
            }
          : null,
        materialTasksNeedingSetup.length > 0
          ? {
              id: 'admin-material-setup',
              title: 'Unblock stakeholder setup and failed generation',
              detail: `${materialTasksNeedingSetup.length} material-engine task${materialTasksNeedingSetup.length === 1 ? '' : 's'} still need setup or failed regeneration.`,
              href: '/admin/material-engine/tasks',
              ctaLabel: 'Open tasks',
              priority: 'high' as const,
              badge: 'Material engine',
            }
          : null,
        materialTasksReadyToGenerate.length > 0
          ? {
              id: 'admin-material-generate',
              title: 'Generate ready stakeholder materials',
              detail: `${materialTasksReadyToGenerate.length} stakeholder setup${materialTasksReadyToGenerate.length === 1 ? '' : 's'} are ready for codes and generated assets.`,
              href: '/admin/material-engine/tasks',
              ctaLabel: 'Generate assets',
              priority: 'medium' as const,
              badge: 'Automation',
            }
          : null,
        openBusinessOnboarding.length > 0
          ? {
              id: 'admin-business-onboarding',
              title: 'Move business onboarding forward',
              detail: `${openBusinessOnboarding.length} businesses are still in the pipeline and need active movement.`,
              href: '/onboarding/business',
              ctaLabel: 'Open business onboarding',
              priority: 'medium' as const,
              badge: 'Businesses',
            }
          : null,
        openCauseOnboarding.length > 0
          ? {
              id: 'admin-cause-onboarding',
              title: 'Move cause onboarding forward',
              detail: `${openCauseOnboarding.length} schools or causes still need active onboarding work.`,
              href: '/onboarding/cause',
              ctaLabel: 'Open cause onboarding',
              priority: 'medium' as const,
              badge: 'Community',
            }
          : null,
      ]

      return items.filter((item): item is NonNullable<(typeof items)[number]> => item !== null)
    },
    [
      materialTasksNeedingSetup.length,
      materialTasksReadyToGenerate.length,
      openBusinessOnboarding.length,
      openCauseOnboarding.length,
      pendingCityRequests.length,
    ]
  )
  const suggestedItems = React.useMemo(
    () => [
      {
        id: 'admin-suggestion-inquiry',
        title: 'Add a new inquiry',
        detail: 'If the urgent queue is clear, seed the next business or cause into CRM so the pipeline keeps growing.',
        href: '/crm/businesses',
        ctaLabel: 'Open CRM',
      },
      {
        id: 'admin-suggestion-oldest',
        title: 'Follow up with the oldest item that needs a next step',
        detail: 'Use onboarding and material tasks to find the oldest stakeholder still waiting on movement and push it forward.',
        href: '/onboarding/business',
        ctaLabel: 'Open onboarding',
      },
      {
        id: 'admin-suggestion-audit',
        title: 'Review audits and weak spots',
        detail: 'Check users, campaigns, and audit history so the next blocker gets caught before it slows the team down.',
        href: '/admin/audit',
        ctaLabel: 'Open audit',
      },
    ],
    []
  )

  const stageCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const biz of businessData) {
      counts[biz.stage] = (counts[biz.stage] || 0) + 1
    }

    const total = businessData.length || 1
    const stages: { stage: string; label: string; count: number; color: string; pct: number }[] = [
      { stage: 'lead', label: 'Lead', count: counts.lead || 0, color: 'bg-surface-300', pct: 0 },
      { stage: 'contacted', label: 'Contacted', count: counts.contacted || 0, color: 'bg-brand-300', pct: 0 },
      { stage: 'interested', label: 'Interested', count: counts.interested || 0, color: 'bg-brand-400', pct: 0 },
      { stage: 'in_progress', label: 'In Progress', count: counts.in_progress || 0, color: 'bg-warning-500', pct: 0 },
      { stage: 'onboarded', label: 'Onboarded', count: counts.onboarded || 0, color: 'bg-success-500', pct: 0 },
      { stage: 'live', label: 'Live', count: counts.live || 0, color: 'bg-success-700', pct: 0 },
    ]

    for (const stage of stages) {
      stage.pct = Math.round((stage.count / total) * 100)
    }

    return stages
  }, [businessData])

  const stageBusinesses = React.useMemo(() => {
    if (!selectedStage) return []

    return businessData
      .filter((business) => business.stage === selectedStage.stage)
      .sort((left, right) => left.name.localeCompare(right.name))
  }, [businessData, selectedStage])

  const greeting = getGreeting()
  const firstName = profile.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-1 flex items-center gap-3">
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
          {isAdmin ? "Here's what still needs movement right now." : "Here's your progress and next steps."}
        </p>
      </div>

      <StakeholderActionQueue
        title="Immediate next steps"
        description="Only work that still needs movement stays here. Once it is done, it drops away and the dashboard suggests the next three smart operating moves."
        items={immediateItems}
        suggestions={suggestedItems}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Businesses" value={businessCount} icon={<Store className="h-5 w-5" />} />
        <StatCard label="Total Causes" value={causeCount} icon={<Heart className="h-5 w-5" />} />
        <StatCard label="Stakeholders" value={stakeholderCount} icon={<Users className="h-5 w-5" />} />
        <StatCard label="QR Codes" value={qrCodeCount} icon={<QrCode className="h-5 w-5" />} />
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold text-surface-800">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {roleTools.map((tool, index) => {
            const Icon = ICON_MAP[tool.icon] || FileText

            return (
              <Link key={index} href={tool.href}>
                <Card className="group cursor-pointer transition-shadow hover:shadow-card-hover">
                  <CardContent className="flex items-start gap-3 py-4">
                    <div
                      className="rounded-lg p-2"
                      style={{ backgroundColor: `${roleTheme?.primary}14`, color: roleTheme?.primary }}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-surface-800 transition-colors group-hover:text-brand-700">
                        {tool.label}
                      </p>
                      <p className="mt-0.5 text-xs text-surface-400">{tool.description}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 text-surface-300 transition-colors group-hover:text-brand-500" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Activity</CardTitle>
              <Link href="/crm/outreach">
                <Button variant="ghost" size="sm">
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </Button>
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
                  <Link
                    key={item.id}
                    href={getOutreachActivityHref(item)}
                    className="group flex items-center justify-between rounded-lg px-2 py-2 transition-colors hover:bg-surface-50"
                  >
                    <div>
                      <p className="text-sm text-surface-700 transition-colors group-hover:text-brand-700">
                        {item.type.replace('_', ' ').replace(/^\w/, (value) => value.toUpperCase())}
                        {item.subject ? `: ${item.subject}` : ''}
                      </p>
                      <p className="text-xs text-surface-400">
                        {item.entity_type} / {formatDate(item.created_at)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          item.outcome === 'positive'
                            ? 'success'
                            : item.outcome === 'negative'
                              ? 'danger'
                              : item.outcome === 'neutral'
                                ? 'warning'
                                : 'default'
                        }
                      >
                        {item.outcome || item.type}
                      </Badge>
                      <ArrowRight className="h-3.5 w-3.5 text-surface-300 transition-colors group-hover:text-brand-500" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{isAdmin ? 'Pipeline Overview' : 'Your Progress'}</CardTitle>
              <Link href={isAdmin ? '/crm/businesses' : '/analytics'}>
                <Button variant="ghost" size="sm">
                  Details <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {businessLoading ? (
              <p className="text-sm text-surface-400">Loading pipeline...</p>
            ) : (
              <div className="space-y-4">
                {stageCounts.map((stage, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedStage({ stage: stage.stage, label: stage.label, count: stage.count })}
                    className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-surface-50"
                  >
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
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {isAdmin ? (
        <Card className="border-l-4 border-l-warning-500">
          <CardContent className="py-4">
            <div className="mb-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning-500" />
              <h3 className="text-sm font-semibold text-surface-800">Duplicate Alerts</h3>
              <Badge variant="warning">Possible duplicates</Badge>
            </div>
            <p className="mb-3 text-xs text-surface-500">
              Review your records periodically to keep the CRM clean.
            </p>
            <Link href="/crm/businesses">
              <Button variant="outline" size="sm">
                Review Businesses <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <Dialog open={Boolean(selectedStage)} onOpenChange={(open) => !open && setSelectedStage(null)}>
        <DialogContent className="max-h-[88vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStage?.label || 'Pipeline stage'} businesses</DialogTitle>
            <DialogDescription>
              {selectedStage
                ? `${selectedStage.count} businesses are currently in ${selectedStage.label.toLowerCase()}. Open any record to continue moving it forward.`
                : 'See the businesses inside this stage.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            {stageBusinesses.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
                No businesses are currently sitting in this stage.
              </div>
            ) : (
              stageBusinesses.map((business) => (
                <div
                  key={business.id}
                  className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-surface-900">{business.name}</p>
                        <Badge variant="default">{selectedStage?.label || business.stage}</Badge>
                        {business.category ? <Badge variant="outline">{business.category}</Badge> : null}
                      </div>
                      <div className="space-y-1 text-sm text-surface-600">
                        {business.address ? <p>{business.address}</p> : null}
                        {business.email || business.phone ? (
                          <p>{[business.email, business.phone].filter(Boolean).join(' / ')}</p>
                        ) : null}
                        {business.avg_ticket ? <p>Average spend: {business.avg_ticket}</p> : null}
                        {business.products_services?.length ? (
                          <p>{business.products_services.slice(0, 3).join(', ')}</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Link href={`/crm/businesses/${business.id}`}>
                        <Button size="sm">
                          Open record
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function getOutreachActivityHref(item: {
  entity_type: string
  entity_id: string
  business_id: string | null
  cause_id: string | null
  contact_id: string | null
}) {
  if (item.business_id) return `/crm/businesses/${item.business_id}`
  if (item.cause_id) return `/crm/causes/${item.cause_id}`
  if (item.entity_type === 'business') return `/crm/businesses/${item.entity_id}`
  if (item.entity_type === 'cause') return `/crm/causes/${item.entity_id}`
  if (item.contact_id || item.entity_type === 'contact') return '/crm/contacts'
  return '/crm/outreach'
}
