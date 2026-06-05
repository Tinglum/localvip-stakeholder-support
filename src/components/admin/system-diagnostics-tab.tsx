'use client'

import * as React from 'react'
import {
  Activity,
  AlertTriangle,
  Clock3,
  RefreshCw,
  ServerCrash,
  ShieldCheck,
  Stethoscope,
  UserRoundCog,
  Wifi,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { cn } from '@/lib/utils'

type DiagnosticStatus = 'healthy' | 'warning' | 'critical'

interface DiagnosticMetric {
  label: string
  value: string | number | boolean | null
}

interface DiagnosticCheck {
  id: string
  title: string
  category: string
  status: DiagnosticStatus
  endpoint?: string
  latencyMs: number
  message: string
  detail?: string
  metrics?: DiagnosticMetric[]
}

interface SystemDiagnosticsResponse {
  generatedAt: string
  profile: {
    email: string
    role: string
    shell: string
    source: string
  }
  overallStatus: DiagnosticStatus
  summary: {
    healthy: number
    warning: number
    critical: number
    averageLatencyMs: number
  }
  checks: DiagnosticCheck[]
}

const STATUS_VARIANTS = {
  healthy: 'success',
  warning: 'warning',
  critical: 'danger',
} as const

const STATUS_LABELS: Record<DiagnosticStatus, string> = {
  healthy: 'Healthy',
  warning: 'Warning',
  critical: 'Critical',
}

const CATEGORY_ORDER = [
  'Configuration',
  'Identity & Access',
  'Hybrid CRM',
  'QA Bridges',
]

function formatMetricValue(value: DiagnosticMetric['value']) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (value == null || value === '') return 'n/a'
  return String(value)
}

function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString()
}

function getCategoryDescription(category: string) {
  switch (category) {
    case 'Configuration':
      return 'Environment variables and app-level settings that need to be present.'
    case 'Identity & Access':
      return 'Session, role, and QA identity bridge checks.'
    case 'Hybrid CRM':
      return 'Business and cause routes that stitch local and QA-backed data together.'
    case 'QA Bridges':
      return 'Direct QA-powered routes used across materials, search, outreach, and QR flows.'
    default:
      return 'Runtime cooperation checks for this part of the platform.'
  }
}

function getCardAccent(status: DiagnosticStatus) {
  if (status === 'critical') return 'border-danger-200 bg-danger-50/40'
  if (status === 'warning') return 'border-warning-200 bg-warning-50/30'
  return 'border-success-200 bg-success-50/30'
}

export function SystemDiagnosticsTab({ active }: { active: boolean }) {
  const [data, setData] = React.useState<SystemDiagnosticsResponse | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [refreshing, setRefreshing] = React.useState(false)
  const abortRef = React.useRef<AbortController | null>(null)
  const hasLoadedRef = React.useRef(false)

  const loadDiagnostics = React.useCallback(async (mode: 'initial' | 'refresh') => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    if (mode === 'initial') {
      setLoading(true)
    } else {
      setRefreshing(true)
    }

    try {
      const response = await fetch('/api/admin/system-diagnostics', {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })

      const payload = await response.json().catch(() => null)
      if (!response.ok) {
        throw new Error(
          payload && typeof payload === 'object' && 'error' in payload
            ? String((payload as { error?: unknown }).error || 'Failed to load diagnostics.')
            : 'Failed to load diagnostics.',
        )
      }

      setData(payload as SystemDiagnosticsResponse)
      setError(null)
    } catch (fetchError) {
      if (controller.signal.aborted) return
      setError(fetchError instanceof Error ? fetchError.message : 'Failed to load diagnostics.')
    } finally {
      if (controller.signal.aborted) return
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    if (!active) return

    void loadDiagnostics(hasLoadedRef.current ? 'refresh' : 'initial')
    hasLoadedRef.current = true

    const interval = window.setInterval(() => {
      void loadDiagnostics('refresh')
    }, 30000)

    return () => {
      window.clearInterval(interval)
      abortRef.current?.abort()
    }
  }, [active, loadDiagnostics])

  const groupedChecks = React.useMemo(() => {
    const groups = new Map<string, DiagnosticCheck[]>()
    for (const check of data?.checks || []) {
      const current = groups.get(check.category) || []
      current.push(check)
      groups.set(check.category, current)
    }

    return Array.from(groups.entries()).sort((left, right) => {
      const leftIndex = CATEGORY_ORDER.indexOf(left[0])
      const rightIndex = CATEGORY_ORDER.indexOf(right[0])
      const safeLeftIndex = leftIndex === -1 ? CATEGORY_ORDER.length : leftIndex
      const safeRightIndex = rightIndex === -1 ? CATEGORY_ORDER.length : rightIndex
      return safeLeftIndex - safeRightIndex || left[0].localeCompare(right[0])
    })
  }, [data])

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-16 text-surface-500">
          <RefreshCw className="mr-3 h-5 w-5 animate-spin" />
          Running system diagnostics...
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card className={cn('border-2', data ? getCardAccent(data.overallStatus) : 'border-surface-200')}>
        <CardHeader className="gap-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={data ? STATUS_VARIANTS[data.overallStatus] : 'outline'} dot>
                {data ? `${STATUS_LABELS[data.overallStatus]} System State` : 'Diagnostics'}
              </Badge>
              <Badge variant="outline">Auto refresh every 30s</Badge>
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-surface-500" />
                System Diagnostics
              </CardTitle>
              <CardDescription>
                Live health checks across authentication, CRM bridges, QA integrations, and shared admin infrastructure.
              </CardDescription>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {data && (
              <p className="text-xs text-surface-500">
                Last updated {formatTimestamp(data.generatedAt)}
              </p>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDiagnostics(data ? 'refresh' : 'initial')}
              disabled={loading || refreshing}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', (loading || refreshing) && 'animate-spin')} />
              Refresh
            </Button>
          </div>
        </CardHeader>

        {data && (
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-surface-200 bg-surface-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Active Admin</p>
              <p className="mt-2 text-sm font-semibold text-surface-900">{data.profile.email}</p>
              <p className="mt-1 text-sm text-surface-600">
                {data.profile.role.replace(/_/g, ' ')} via {data.profile.source}
              </p>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Access Shell</p>
              <p className="mt-2 text-sm font-semibold capitalize text-surface-900">{data.profile.shell}</p>
              <p className="mt-1 text-sm text-surface-600">Diagnostics are running against the live admin session.</p>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-0 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Coverage</p>
              <p className="mt-2 text-sm font-semibold text-surface-900">{data.checks.length} coordinated checks</p>
              <p className="mt-1 text-sm text-surface-600">Each check exercises a real route or dependency used by the admin product.</p>
            </div>
          </CardContent>
        )}
      </Card>

      {error && (
        <Card className="border-danger-200 bg-danger-50/40">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="text-sm font-semibold text-danger-800">Diagnostics refresh failed</p>
              <p className="mt-1 text-sm text-danger-700">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void loadDiagnostics(data ? 'refresh' : 'initial')}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {data && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Healthy Checks" value={data.summary.healthy} icon={<ShieldCheck className="h-5 w-5" />} />
            <StatCard label="Warnings" value={data.summary.warning} icon={<AlertTriangle className="h-5 w-5" />} />
            <StatCard label="Critical" value={data.summary.critical} icon={<ServerCrash className="h-5 w-5" />} />
            <StatCard label="Avg Latency" value={`${data.summary.averageLatencyMs} ms`} format="raw" icon={<Clock3 className="h-5 w-5" />} />
          </div>

          {groupedChecks.map(([category, checks]) => (
            <Card key={category}>
              <CardHeader>
                <CardTitle>{category}</CardTitle>
                <CardDescription>{getCategoryDescription(category)}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 xl:grid-cols-2">
                {checks.map((check) => (
                  <div
                    key={check.id}
                    className={cn(
                      'rounded-2xl border p-4 transition-colors',
                      getCardAccent(check.status),
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-semibold text-surface-900">{check.title}</p>
                          <Badge variant={STATUS_VARIANTS[check.status]} dot>
                            {STATUS_LABELS[check.status]}
                          </Badge>
                        </div>
                        <p className="text-sm text-surface-700">{check.message}</p>
                      </div>
                      <Badge variant="outline">
                        <Activity className="h-3 w-3" />
                        {check.latencyMs} ms
                      </Badge>
                    </div>

                    {(check.endpoint || check.detail) && (
                      <div className="mt-3 space-y-2 text-xs text-surface-600">
                        {check.endpoint && (
                          <p className="rounded-xl bg-surface-0/70 px-3 py-2 font-mono text-[11px] text-surface-700">
                            {check.endpoint}
                          </p>
                        )}
                        {check.detail && (
                          <div className="rounded-xl border border-surface-200 bg-surface-0/80 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">
                              Returned Detail
                            </p>
                            <p className="mt-1 whitespace-pre-wrap text-xs text-surface-700">{check.detail}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {check.metrics && check.metrics.length > 0 && (
                      <div className="mt-4 grid gap-2 sm:grid-cols-2">
                        {check.metrics.map((metric) => (
                          <div key={`${check.id}-${metric.label}`} className="rounded-xl border border-surface-200 bg-surface-0/80 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">
                              {metric.label}
                            </p>
                            <p className="mt-1 text-sm font-semibold text-surface-900">{formatMetricValue(metric.value)}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}

          {data.summary.critical === 0 && data.summary.warning === 0 && (
            <Card className="border-success-200 bg-success-50/40">
              <CardContent className="flex items-center gap-3 py-5 text-success-800">
                <Wifi className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">Everything currently cooperating</p>
                  <p className="text-sm text-success-700">
                    The admin session, CRM routes, QA bridges, and supporting diagnostics checks are all reporting healthy.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>What This Covers</CardTitle>
              <CardDescription>
                This panel is meant to show whether the major live admin flows are cooperating, not just whether a page rendered.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                  <UserRoundCog className="h-4 w-4 text-surface-500" />
                  Identity and session
                </p>
                <p className="mt-2 text-sm text-surface-600">
                  Confirms the current admin session can resolve local auth state and QA-backed identity in the same request path.
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-surface-900">
                  <Activity className="h-4 w-4 text-surface-500" />
                  CRM and dependency bridges
                </p>
                <p className="mt-2 text-sm text-surface-600">
                  Exercises the list, detail, workspace, materials, notifications, search, QR, and outreach routes that admins depend on day to day.
                </p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
