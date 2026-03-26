'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  GraduationCap,
  Loader2,
  MapPin,
  MessageSquareText,
  Send,
  Sparkles,
  Target,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'
import { useAuth } from '@/lib/auth/context'
import {
  useBusinesses,
  useCauses,
  useCities,
  useOutreach,
  useOutreachScripts,
  useStakeholderAssignments,
  useTasks,
} from '@/lib/supabase/hooks'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { formatDateTime } from '@/lib/utils'
import { normalizeBusinessCategory, OUTREACH_SCRIPT_STATUS_OPTIONS } from '@/lib/outreach-script-engine'
import type { Business, OutreachActivity, OutreachScript, Task } from '@/lib/types/database'

const STAGE_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  lead: 'default',
  contacted: 'info',
  interested: 'info',
  in_progress: 'warning',
  onboarded: 'success',
  live: 'success',
  paused: 'warning',
  declined: 'danger',
}

function getBusinessField(metadata: Record<string, unknown> | null, keys: string[]) {
  if (!metadata) return ''
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function relativeTime(date: string | null | undefined) {
  if (!date) return 'Not yet logged'
  const now = Date.now()
  const target = new Date(date).getTime()
  const diffHours = Math.floor((now - target) / (1000 * 60 * 60))
  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) return `${diffHours}h ago`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDateTime(date)
}

function toTimestamp(value: string | null | undefined) {
  if (!value) return 0
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? 0 : time
}

function scriptHref(businessId: string) {
  return `/crm/scripts?business=${encodeURIComponent(businessId)}`
}

export function FieldOutreachDashboardPage() {
  const { profile } = useAuth()
  const { data: businesses, loading: businessesLoading } = useBusinesses()
  const { data: assignments } = useStakeholderAssignments({ entity_type: 'business', stakeholder_id: profile.id })
  const { data: tasks, loading: tasksLoading } = useTasks({ assigned_to: profile.id })
  const { data: outreach, loading: outreachLoading } = useOutreach({ performed_by: profile.id })
  const { data: scripts, loading: scriptsLoading } = useOutreachScripts({ created_by: profile.id })
  const { data: cities } = useCities()
  const { data: causes } = useCauses()

  const cityMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const city of cities) map[city.id] = `${city.name}, ${city.state}`
    return map
  }, [cities])

  const causeMap = React.useMemo(() => {
    const map: Record<string, string> = {}
    for (const cause of causes) map[cause.id] = cause.name
    return map
  }, [causes])

  const tasksByBusiness = React.useMemo(() => {
    const map: Record<string, Task[]> = {}
    for (const task of tasks) {
      if (task.entity_type !== 'business' || !task.entity_id) continue
      if (!map[task.entity_id]) map[task.entity_id] = []
      map[task.entity_id].push(task)
    }
    Object.values(map).forEach((items) => {
      items.sort((left, right) => {
        const leftTime = toTimestamp(left.due_date || left.created_at)
        const rightTime = toTimestamp(right.due_date || right.created_at)
        return leftTime - rightTime
      })
    })
    return map
  }, [tasks])

  const latestOutreachByBusiness = React.useMemo(() => {
    const map: Record<string, OutreachActivity> = {}
    for (const item of outreach) {
      if (!item.business_id) continue
      const current = map[item.business_id]
      if (!current || toTimestamp(item.created_at) > toTimestamp(current.created_at)) {
        map[item.business_id] = item
      }
    }
    return map
  }, [outreach])

  const latestScriptByBusiness = React.useMemo(() => {
    const map: Record<string, OutreachScript> = {}
    for (const item of scripts) {
      const current = map[item.business_id]
      if (!current || toTimestamp(item.created_at) > toTimestamp(current.created_at)) {
        map[item.business_id] = item
      }
    }
    return map
  }, [scripts])

  const workspaceBusinessIds = React.useMemo(() => {
    const ids = new Set<string>()
    assignments.forEach((assignment) => ids.add(assignment.entity_id))
    businesses.forEach((business) => {
      if (business.owner_id === profile.id) ids.add(business.id)
    })
    tasks.forEach((task) => {
      if (task.entity_type === 'business' && task.entity_id) ids.add(task.entity_id)
    })
    outreach.forEach((item) => {
      if (item.business_id) ids.add(item.business_id)
    })
    scripts.forEach((item) => ids.add(item.business_id))
    return ids
  }, [assignments, businesses, outreach, profile.id, scripts, tasks])

  const focusBusinesses = React.useMemo(() => {
    return businesses
      .filter((business) => workspaceBusinessIds.has(business.id))
      .map((business) => {
        const pendingTasks = (tasksByBusiness[business.id] || []).filter((task) => task.status !== 'completed' && task.status !== 'cancelled')
        const lastOutreach = latestOutreachByBusiness[business.id] || null
        const lastScript = latestScriptByBusiness[business.id] || null
        const categoryKey = normalizeBusinessCategory(business.category)
        const lastTouch = Math.max(
          toTimestamp(lastOutreach?.created_at),
          toTimestamp(lastScript?.created_at),
        )

        return {
          ...business,
          avgTicket: getBusinessField(business.metadata, ['avg_ticket', 'average_ticket', 'avg_spend']) || 'Use category default',
          cityLabel: business.city_id ? cityMap[business.city_id] || 'No city set' : 'No city set',
          linkedCauseName: business.linked_cause_id ? causeMap[business.linked_cause_id] || 'Linked cause' : 'No cause linked yet',
          lastOutreach,
          lastScript,
          lastTouch,
          pendingTasks,
          primaryProduct: getBusinessField(business.metadata, ['specific_product', 'offer_title', 'primary_product']) || normalizeBusinessCategory(business.category).replace(/_/g, ' '),
          categoryKey,
        }
      })
      .sort((left, right) => {
        if (right.pendingTasks.length !== left.pendingTasks.length) {
          return right.pendingTasks.length - left.pendingTasks.length
        }
        return right.lastTouch - left.lastTouch
      })
  }, [businesses, causeMap, cityMap, latestOutreachByBusiness, latestScriptByBusiness, tasksByBusiness, workspaceBusinessIds])

  const pendingBusinessTasks = React.useMemo(
    () => tasks
      .filter((task) => task.entity_type === 'business' && task.status !== 'completed' && task.status !== 'cancelled')
      .sort((left, right) => toTimestamp(left.due_date || left.created_at) - toTimestamp(right.due_date || right.created_at)),
    [tasks]
  )

  const recentScripts = React.useMemo(
    () => [...scripts]
      .sort((left, right) => toTimestamp(right.created_at) - toTimestamp(left.created_at))
      .slice(0, 4),
    [scripts]
  )

  const todayPositiveSignals = React.useMemo(
    () => outreach.filter((item) => item.outreach_status === 'interested' || item.outreach_status === 'replied').length,
    [outreach]
  )

  const loading = businessesLoading || tasksLoading || outreachLoading || scriptsLoading
  const primaryBusiness = focusBusinesses[0] || null
  const myCityLabel = profile.city_id ? cityMap[profile.city_id] || 'Your city' : 'Your city'

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
        <span className="ml-3 text-sm text-surface-500">Loading your outreach workspace...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Outreach Workspace"
        description="Generate local scripts fast, stay on top of follow-ups, and keep every business touchpoint moving."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={primaryBusiness ? scriptHref(primaryBusiness.id) : '/crm/scripts'}>
                Open Script Engine
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/crm/outreach">
                View Outreach Log
                <Send className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden border-indigo-100 bg-[radial-gradient(circle_at_top_left,_rgba(99,102,241,0.14),_transparent_42%),linear-gradient(135deg,rgba(255,255,255,0.96),rgba(238,242,255,0.92))] shadow-panel">
        <CardContent className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-7">
          <div className="space-y-4">
            <Badge variant="info" className="w-fit">Intern Outreach Script Engine</Badge>
            <div className="space-y-2">
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight text-surface-900">
                Start with the businesses you already have in motion and turn each conversation into a stronger local ask.
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-surface-600">
                You are working from {myCityLabel}. Pick a business, add the real school or cause connection, choose Good, Better, or Best,
                then copy the script and log the result without leaving the support system.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-400">1. Pick a Business</p>
                <p className="mt-2 text-sm text-surface-800">Search the CRM or jump into one of your active businesses below.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-400">2. Add Real Context</p>
                <p className="mt-2 text-sm text-surface-800">Use your school, city, neighborhood, and personal connection so it sounds believable.</p>
              </div>
              <div className="rounded-2xl border border-white/80 bg-white/70 px-4 py-4 shadow-sm backdrop-blur">
                <p className="text-xs font-medium uppercase tracking-wide text-surface-400">3. Copy + Log</p>
                <p className="mt-2 text-sm text-surface-800">Every script you use can be copied, edited, and pushed straight back into CRM history.</p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-indigo-100 bg-white/85 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center gap-2 text-sm font-medium text-indigo-700">
              <Target className="h-4 w-4" />
              Best Next Move
            </div>

            {primaryBusiness ? (
              <div className="mt-4 space-y-4">
                <div>
                  <p className="text-xl font-semibold text-surface-900">{primaryBusiness.name}</p>
                  <p className="mt-1 text-sm text-surface-500">{primaryBusiness.cityLabel} / {primaryBusiness.category || 'Local business'}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={STAGE_VARIANT[primaryBusiness.stage] || 'default'}>
                    {ONBOARDING_STAGES[primaryBusiness.stage]?.label || primaryBusiness.stage}
                  </Badge>
                  <Badge variant="outline">{primaryBusiness.linkedCauseName}</Badge>
                </div>

                <div className="rounded-2xl bg-surface-50 px-4 py-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Why this is first</p>
                  <p className="mt-2 text-sm leading-6 text-surface-700">
                    {primaryBusiness.pendingTasks.length > 0
                      ? `${primaryBusiness.pendingTasks.length} follow-up item${primaryBusiness.pendingTasks.length > 1 ? 's are' : ' is'} waiting on this business.`
                      : 'This is one of your most active businesses right now, so it is the fastest way to keep momentum going.'}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button asChild className="flex-1">
                    <Link href={scriptHref(primaryBusiness.id)}>
                      Generate Script
                      <Sparkles className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="flex-1">
                    <Link href={`/crm/businesses/${primaryBusiness.id}`}>
                      Open Business
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={<FileText className="h-6 w-6" />}
                title="Start from the full script engine"
                description="You can still search the central CRM, pick any business, and generate a tailored script right away."
                action={{
                  label: 'Open Outreach Scripts',
                  onClick: () => { window.location.href = '/crm/scripts' },
                }}
                className="py-10"
              />
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Businesses In Play" value={focusBusinesses.length} icon={<Building2 className="h-5 w-5" />} />
        <StatCard label="Scripts Used" value={scripts.length} icon={<FileText className="h-5 w-5" />} />
        <StatCard label="Follow-Ups Due" value={pendingBusinessTasks.length} icon={<Clock3 className="h-5 w-5" />} />
        <StatCard label="Positive Signals" value={todayPositiveSignals} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Businesses In Play</CardTitle>
              <CardDescription>The businesses currently tied to your scripts, follow-ups, assignments, or outreach history.</CardDescription>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href="/crm/scripts">
                Search Full CRM
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {focusBusinesses.length === 0 ? (
              <EmptyState
                icon={<MessageSquareText className="h-6 w-6" />}
                title="No active businesses yet"
                description="Open the script engine, search the CRM, and start building outreach around the businesses you want to move first."
                action={{
                  label: 'Open Script Engine',
                  onClick: () => { window.location.href = '/crm/scripts' },
                }}
                className="py-12"
              />
            ) : (
              focusBusinesses.slice(0, 6).map((business) => (
                <div key={business.id} className="rounded-2xl border border-surface-200 bg-surface-0 p-4 shadow-sm transition-shadow hover:shadow-card-hover">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-base font-semibold text-surface-900">{business.name}</p>
                        <Badge variant={STAGE_VARIANT[business.stage] || 'default'}>
                          {ONBOARDING_STAGES[business.stage]?.label || business.stage}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-surface-500">{business.category || 'Local business'} / {business.cityLabel}</p>
                    </div>
                    <Badge variant="outline">{business.linkedCauseName}</Badge>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-3">
                    <div className="rounded-xl bg-surface-50 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Product Focus</p>
                      <p className="mt-2 text-sm font-medium text-surface-800">{business.primaryProduct}</p>
                    </div>
                    <div className="rounded-xl bg-surface-50 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Average Spend</p>
                      <p className="mt-2 text-sm font-medium text-surface-800">{business.avgTicket}</p>
                    </div>
                    <div className="rounded-xl bg-surface-50 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-surface-400">Last Touch</p>
                      <p className="mt-2 text-sm font-medium text-surface-800">{relativeTime((business.lastOutreach || business.lastScript)?.created_at)}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-surface-500">
                    <span className="inline-flex items-center gap-1.5">
                      <ClipboardList className="h-3.5 w-3.5" />
                      {business.pendingTasks.length} pending task{business.pendingTasks.length === 1 ? '' : 's'}
                    </span>
                    {business.lastScript && (
                      <span className="inline-flex items-center gap-1.5">
                        <FileText className="h-3.5 w-3.5" />
                        Last script: {business.lastScript.script_tier.toUpperCase()} / {OUTREACH_SCRIPT_STATUS_OPTIONS.find((item) => item.value === business.lastScript.status)?.label || business.lastScript.status}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5">
                      <GraduationCap className="h-3.5 w-3.5" />
                      {normalizeBusinessCategory(business.category).replace(/_/g, ' ')}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={scriptHref(business.id)}>
                        Generate Script
                        <Sparkles className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/crm/businesses/${business.id}`}>
                        Open Business
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Today&apos;s Queue</CardTitle>
              <CardDescription>Stay close to the businesses already waiting on a follow-up or next action.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pendingBusinessTasks.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-surface-500">
                  No business follow-ups are assigned to you right now. Use the script engine to start a new touchpoint.
                </div>
              ) : (
                pendingBusinessTasks.slice(0, 5).map((task) => {
                  const business = businesses.find((item) => item.id === task.entity_id) || null
                  return (
                    <div key={task.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-surface-900">{task.title}</p>
                          <p className="mt-1 text-xs text-surface-500">{business?.name || 'Business'} / {task.due_date ? formatDateTime(task.due_date) : 'No due date set'}</p>
                        </div>
                        {business && (
                          <Button asChild size="sm" variant="ghost">
                            <Link href={scriptHref(business.id)}>
                              Continue
                              <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Script Activity</CardTitle>
              <CardDescription>What you have already copied, edited, or logged most recently.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {recentScripts.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-surface-200 px-4 py-6 text-sm text-surface-500">
                  Once you copy or log scripts, your recent activity will show up here.
                </div>
              ) : (
                recentScripts.map((item) => {
                  const business = businesses.find((entry) => entry.id === item.business_id)
                  return (
                    <div key={item.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-surface-900">{business?.name || 'Business'} / {item.script_tier.toUpperCase()}</p>
                          <p className="mt-1 text-xs text-surface-500">
                            {item.script_type.replace(/_/g, ' ')} / {relativeTime(item.created_at)}
                          </p>
                        </div>
                        <Badge variant={item.status === 'follow_up_needed' ? 'warning' : item.status === 'interested' ? 'success' : 'info'}>
                          {OUTREACH_SCRIPT_STATUS_OPTIONS.find((option) => option.value === item.status)?.label || item.status}
                        </Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Outreach Playbook</CardTitle>
              <CardDescription>Keep the scripts local, specific, and easy to say out loud.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-sm font-medium text-surface-900">Lead with real local context</p>
                <p className="mt-1 text-xs leading-5 text-surface-500">Use your city, school, neighborhood, or a real connection to the business before you talk about LocalVIP.</p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-sm font-medium text-surface-900">Choose the right tier</p>
                <p className="mt-1 text-xs leading-5 text-surface-500">Good is fast. Better adds context. Best should feel like a believable conversation opener for that exact business.</p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-sm font-medium text-surface-900">Always log the touchpoint</p>
                <p className="mt-1 text-xs leading-5 text-surface-500">Copying is helpful, but logging the outcome keeps the CRM clean and prevents duplicate outreach across the team.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
