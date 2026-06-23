'use client'

/**
 * NetworkTreeView
 * ───────────────
 * Read-only downline / level-breakdown view for ANY node (customer, business,
 * or cause). Mirrors the consumer "My Network" page layout. Either:
 *   - pass `accountId` to fetch GET /api/dashboard/network/tree?accountId=…, or
 *   - pass `fetchUrl` to fetch a pre-scoped endpoint (e.g. /api/portal/me/network).
 */

import * as React from 'react'
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Network,
  Layers,
  MapPin,
  CalendarDays,
  TrendingUp,
  UserCircle2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { cn, formatDate, formatNumber } from '@/lib/utils'

type NodeType = 'customer' | 'business' | 'cause'

interface NetworkNode {
  id: number | string
  parentId: number | string | null
  level: number
  name: string
  type?: NodeType | string
  city: string | null
  state: string | null
  joinedAt: string | null
}

interface EarningsEntry {
  id: number | string
  earnings: number
}

interface SpendEntry {
  id: number | string
  spend: number
}

interface NetworkResponse {
  nodes: NetworkNode[]
  period?: NetworkPeriod
  startDate?: string | null
  endDate?: string | null
  branchSizes?: Array<{ id: number | string; directReferrals: number }> | null
  earningsById?: EarningsEntry[]
  totalNetworkEarnings?: number
  spendById?: SpendEntry[] | Record<string, number> | null
  totalNetworkSpend?: number
  projection?: NetworkProjection | null
  totalNodes?: number
}

interface NetworkProjectionPoint {
  monthLabel: string
  projectedSpend: number
  projectedIncome: number | null
}

interface NetworkProjection {
  basis: 'all_time_average' | 'selected_period'
  period: NetworkPeriod
  startDate: string | null
  endDate: string | null
  currentWindowSpend: number
  previousWindowSpend: number | null
  currentMonthlySpendRate: number
  currentMonthlyIncomeRate: number | null
  previousMonthlySpendRate: number | null
  observedGrowthRate: number
  incomeConversionRate: number | null
  projected12MonthSpend: number
  projected12MonthIncome: number | null
  next12Months: NetworkProjectionPoint[]
}

interface DecoratedNode extends NetworkNode {
  spend: number
  location: string
}

interface LevelGroup {
  level: number
  members: DecoratedNode[]
  spend: number
}

type NetworkPeriod = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'

const MAX_LEVELS = 10
const NETWORK_PERIOD_OPTIONS: Array<{ value: NetworkPeriod; label: string }> = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom' },
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0)
}

function buildLocation(node: NetworkNode): string {
  const parts = [node.city, node.state].filter((part): part is string => Boolean(part && part.trim()))
  return parts.join(', ')
}

interface NetworkTreeViewProps {
  accountId?: number | string | null
  fetchUrl?: string
  /** Plain-language label for the node type, e.g. "business" or "cause". */
  nodeLabel?: string
}

export function NetworkTreeView({ accountId, fetchUrl, nodeLabel = 'node' }: NetworkTreeViewProps) {
  const [data, setData] = React.useState<NetworkResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState('')
  const [period, setPeriod] = React.useState<NetworkPeriod>('all')
  const [startDate, setStartDate] = React.useState('')
  const [endDate, setEndDate] = React.useState('')
  const [expandedLevels, setExpandedLevels] = React.useState<Record<number, boolean>>({})

  const url = React.useMemo(() => {
    let nextUrl: string | null = null
    if (fetchUrl) {
      nextUrl = fetchUrl
    } else if (accountId !== null && accountId !== undefined && accountId !== '') {
      nextUrl = `/api/dashboard/network/tree?accountId=${encodeURIComponent(String(accountId))}&depth=10`
    }

    if (!nextUrl) return null

    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
    const resolved = new URL(nextUrl, origin)
    resolved.searchParams.set('period', period)
    if (period === 'custom') {
      if (startDate) resolved.searchParams.set('startDate', startDate)
      else resolved.searchParams.delete('startDate')
      if (endDate) resolved.searchParams.set('endDate', endDate)
      else resolved.searchParams.delete('endDate')
    } else {
      resolved.searchParams.delete('startDate')
      resolved.searchParams.delete('endDate')
    }

    return `${resolved.pathname}${resolved.search}`
  }, [accountId, endDate, fetchUrl, period, startDate])

  const load = React.useCallback(async () => {
    if (!url) {
      setLoading(false)
      setError(null)
      setData(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(url, { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as (NetworkResponse & { error?: string }) | null
      if (!res.ok || !json) {
        throw new Error(json?.error || 'We could not load this network right now.')
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load this network right now.')
    } finally {
      setLoading(false)
    }
  }, [url])

  React.useEffect(() => {
    void load()
  }, [load])

  const spendMap = React.useMemo(() => {
    const map = new Map<string, number>()
    const rawSpend = data?.spendById

    if (Array.isArray(rawSpend)) {
      for (const entry of rawSpend) {
        map.set(String(entry.id), Number(entry.spend) || 0)
      }
      return map
    }

    if (rawSpend && typeof rawSpend === 'object') {
      for (const [id, spend] of Object.entries(rawSpend)) {
        map.set(String(id), Number(spend) || 0)
      }
      return map
    }

    for (const entry of data?.earningsById ?? []) {
      map.set(String(entry.id), Number(entry.earnings) || 0)
    }
    return map
  }, [data?.earningsById, data?.spendById])

  const decoratedNodes = React.useMemo<DecoratedNode[]>(() => {
    return (data?.nodes ?? []).map((node) => ({
      ...node,
      spend: spendMap.get(String(node.id)) ?? 0,
      location: buildLocation(node),
    }))
  }, [data?.nodes, spendMap])

  const levelGroups = React.useMemo<LevelGroup[]>(() => {
    const byLevel = new Map<number, DecoratedNode[]>()
    for (const node of decoratedNodes) {
      const level = Number(node.level) || 0
      if (level < 1 || level > MAX_LEVELS) continue
      const bucket = byLevel.get(level) ?? []
      bucket.push(node)
      byLevel.set(level, bucket)
    }

    const groups: LevelGroup[] = []
    for (let level = 1; level <= MAX_LEVELS; level += 1) {
      const members = (byLevel.get(level) ?? []).sort((a, b) => a.level - b.level || b.spend - a.spend)
      groups.push({
        level,
        members,
        spend: members.reduce((sum, member) => sum + member.spend, 0),
      })
    }
    return groups
  }, [decoratedNodes])

  const totalMembers = data?.totalNodes ?? decoratedNodes.length
  const totalSpend = React.useMemo(() => {
    if (typeof data?.totalNetworkSpend === 'number') return data.totalNetworkSpend
    if (typeof data?.totalNetworkEarnings === 'number') return data.totalNetworkEarnings
    return decoratedNodes.reduce((sum, node) => sum + node.spend, 0)
  }, [data?.totalNetworkEarnings, data?.totalNetworkSpend, decoratedNodes])
  const activeLevels = levelGroups.filter((group) => group.members.length > 0).length
  const directReferrals = levelGroups.find((group) => group.level === 1)?.members.length ?? 0

  // Break the network down by node type so businesses and causes are called
  // out separately from customers in the overview.
  const typeBreakdown = React.useMemo(() => {
    const make = () => ({ count: 0, spend: 0 })
    const totals: Record<NodeType, { count: number; spend: number }> = {
      customer: make(),
      business: make(),
      cause: make(),
    }
    for (const node of decoratedNodes) {
      const type: NodeType = node.type === 'business' || node.type === 'cause' ? node.type : 'customer'
      totals[type].count += 1
      totals[type].spend += node.spend
    }
    return totals
  }, [decoratedNodes])

  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = React.useMemo<DecoratedNode[]>(() => {
    if (!normalizedQuery) return []
    return decoratedNodes
      .filter((node) => {
        const haystack = `${node.name} ${node.location}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .sort((a, b) => a.level - b.level || b.spend - a.spend)
  }, [decoratedNodes, normalizedQuery])

  const toggleLevel = (level: number) => {
    setExpandedLevels((prev) => ({ ...prev, [level]: !prev[level] }))
  }

  const expandAll = () => {
    const next: Record<number, boolean> = {}
    for (const group of levelGroups) {
      if (group.members.length > 0) next[group.level] = true
    }
    setExpandedLevels(next)
  }

  const collapseAll = () => setExpandedLevels({})
  const activeRangeLabel = React.useMemo(() => {
    if (period === 'all') return 'All time'
    if (period === 'custom') {
      if (startDate && endDate) return `${formatDate(startDate)} to ${formatDate(endDate)}`
      if (startDate) return `From ${formatDate(startDate)}`
      if (endDate) return `Up to ${formatDate(endDate)}`
      return 'Custom range'
    }
    const option = NETWORK_PERIOD_OPTIONS.find((entry) => entry.value === period)
    if (data?.startDate && data?.endDate) {
      return `${option?.label || 'Selected period'}: ${formatDate(data.startDate)} to ${formatDate(data.endDate)}`
    }
    return option?.label || 'Selected period'
  }, [data?.endDate, data?.startDate, endDate, period, startDate])

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading the network...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <EmptyState
        icon={<Network className="h-8 w-8" />}
        title="We hit a snag loading this network"
        description={error}
        action={{ label: 'Try again', onClick: () => void load() }}
      />
    )
  }

  const hasNetwork = decoratedNodes.length > 0

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-surface-900">Time period</p>
            <p className="text-sm text-surface-500">
              Switch between recent periods or set your own date range to inspect this network.
            </p>
            <div className="flex flex-wrap gap-2">
              {NETWORK_PERIOD_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={period === option.value ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setPeriod(option.value)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-3 xl:items-end">
            {period === 'custom' ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <label className="space-y-1 text-sm text-surface-600">
                  <span className="block text-xs font-medium uppercase tracking-[0.16em] text-surface-500">From</span>
                  <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
                </label>
                <label className="space-y-1 text-sm text-surface-600">
                  <span className="block text-xs font-medium uppercase tracking-[0.16em] text-surface-500">To</span>
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
                </label>
              </div>
            ) : null}
            <div className="flex items-center gap-3">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{activeRangeLabel}</p>
              <Button variant="outline" size="sm" onClick={() => void load()}>
                <TrendingUp className="h-4 w-4" /> Refresh
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total network spend"
          value={formatCurrency(totalSpend)}
          icon={<Coins className="h-5 w-5" />}
          accent="text-success-600"
          hint="All tracked member spend across this network so far"
        />
        <SummaryCard
          label="Network members"
          value={formatNumber(totalMembers)}
          icon={<UserCircle2 className="h-5 w-5" />}
          hint="Everyone currently visible in this network"
        />
        <SummaryCard
          label="Active levels"
          value={`${activeLevels} / ${MAX_LEVELS}`}
          icon={<Layers className="h-5 w-5" />}
          hint="How many of the 10 levels currently have people in them"
        />
        <SummaryCard
          label="Direct referrals"
          value={formatNumber(directReferrals)}
          icon={<Network className="h-5 w-5" />}
          hint={`People directly connected to this ${nodeLabel}`}
        />
      </div>

      {(typeBreakdown.business.count > 0 || typeBreakdown.cause.count > 0) ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-slate-700">Network make-up</p>
          <div className="grid gap-3 sm:grid-cols-3">
            {([
              { type: 'customer' as NodeType, label: 'Customers', helper: 'Tracked spend', icon: <UserCircle2 className="h-4 w-4" /> },
              { type: 'business' as NodeType, label: 'Businesses', helper: 'Connected partners', icon: <Network className="h-4 w-4" /> },
              { type: 'cause' as NodeType, label: 'Causes & schools', helper: 'Connected causes', icon: <Coins className="h-4 w-4" /> },
            ]).map(({ type, label, helper, icon }) => {
              const spend = typeBreakdown[type].spend
              const secondary = type === 'customer' || spend > 0 ? formatCurrency(spend) : helper

              return (
                <div key={type} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2 text-slate-600">
                    {icon}
                    <span className="text-sm font-medium">{label}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold text-slate-900">{formatNumber(typeBreakdown[type].count)}</div>
                    <div className="text-xs text-slate-500">{secondary}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      {!hasNetwork ? (
        <EmptyState
          icon={<Network className="h-8 w-8" />}
          title="This network is just getting started"
          description={`When people begin joining through this ${nodeLabel}, they will appear here. Start by sharing the join link and QR.`}
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[0.9fr,1.1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Find a person</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by name or location..."
                />
                {normalizedQuery ? (
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.16em] text-surface-500">
                      {searchResults.length} {searchResults.length === 1 ? 'match' : 'matches'}
                    </p>
                    {searchResults.length === 0 ? (
                      <p className="text-sm text-surface-500">No people match &quot;{query}&quot;.</p>
                    ) : (
                      <div className="space-y-2">
                        {searchResults.slice(0, 50).map((node) => (
                          <MemberRow key={`search-${node.id}`} node={node} showLevel />
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <ProjectionCard projection={data?.projection ?? null} activeRangeLabel={activeRangeLabel} />
          </div>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 pb-4">
              <CardTitle className="flex items-center gap-2">
                <Layers className="h-4 w-4 text-surface-400" /> Level breakdown
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={expandAll}>
                  Expand all
                </Button>
                <Button variant="ghost" size="sm" onClick={collapseAll}>
                  Collapse all
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {levelGroups.map((group) => {
                const isExpanded = Boolean(expandedLevels[group.level])
                const isEmpty = group.members.length === 0
                const ChevronIcon = isExpanded ? ChevronDown : ChevronRight
                return (
                  <div
                    key={group.level}
                    className={cn(
                      'overflow-hidden rounded-2xl border border-surface-200',
                      isEmpty && 'opacity-60',
                    )}
                  >
                    <button
                      type="button"
                      disabled={isEmpty}
                      onClick={() => toggleLevel(group.level)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 bg-surface-50 px-4 py-3 text-left transition-colors',
                        !isEmpty && 'hover:bg-surface-100',
                        isEmpty && 'cursor-default',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <ChevronIcon className={cn('h-4 w-4 text-surface-400', isEmpty && 'opacity-0')} />
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-sm font-semibold text-brand-700">
                          {group.level}
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-surface-900">Level {group.level}</p>
                          <p className="text-xs text-surface-500">
                            {group.members.length} {group.members.length === 1 ? 'person' : 'people'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="info">{formatNumber(group.members.length)}</Badge>
                        <span className="text-sm font-semibold text-success-600">
                          {formatCurrency(group.spend)}
                        </span>
                      </div>
                    </button>
                    {isExpanded && !isEmpty ? (
                      <div className="space-y-2 bg-surface-0 p-3">
                        {group.members.map((node) => (
                          <MemberRow key={`level-${group.level}-${node.id}`} node={node} />
                        ))}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  accent,
  hint,
}: {
  label: string
  value: string
  icon: React.ReactNode
  accent?: string
  hint: string
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-caption uppercase tracking-wider text-surface-500">{label}</p>
            <p className={cn('mt-1 text-2xl font-bold text-surface-900', accent)}>{value}</p>
            <p className="mt-2 text-xs leading-5 text-surface-400">{hint}</p>
          </div>
          <div className="rounded-lg bg-surface-100 p-2 text-surface-500">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

function MemberRow({ node, showLevel = false }: { node: DecoratedNode; showLevel?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-200 bg-surface-50 px-4 py-3">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
          <UserCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold text-surface-900">{node.name || 'Member'}</p>
            {node.type === 'business' || node.type === 'cause' ? (
              <Badge
                variant="outline"
                className={cn(
                  'shrink-0',
                  node.type === 'business' ? 'border-blue-300 text-blue-700' : 'border-purple-300 text-purple-700',
                )}
              >
                {node.type === 'business' ? 'Business' : 'Cause'}
              </Badge>
            ) : null}
            {showLevel ? (
              <Badge variant="outline" className="shrink-0">
                L{node.level}
              </Badge>
            ) : null}
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-surface-500">
            {node.location ? (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" /> {node.location}
              </span>
            ) : null}
            {node.joinedAt ? (
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> Joined {formatDate(node.joinedAt)}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold text-success-600">{formatCurrency(node.spend)}</p>
        <p className="text-[11px] uppercase tracking-wide text-surface-400">spent</p>
      </div>
    </div>
  )
}

function ProjectionCard({
  projection,
  activeRangeLabel,
}: {
  projection: NetworkProjection | null
  activeRangeLabel: string
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>12-month projection</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!projection ? (
          <p className="text-sm text-surface-500">
            Projection data will appear here once we can calculate a trend from the selected network period.
          </p>
        ) : (
          <>
            <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Projection basis</p>
              <p className="mt-2 text-sm leading-6 text-surface-700">
                {projection.basis === 'all_time_average'
                  ? `Using the all-time average pace from ${projection.startDate ? formatDate(projection.startDate) : 'the earliest tracked date'} through ${projection.endDate ? formatDate(projection.endDate) : 'today'}.`
                  : `Using the selected period (${activeRangeLabel}) and assuming that monthly activity stays at the current pace.`}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Current monthly pace</p>
                <p className="mt-2 text-2xl font-bold text-surface-900">{formatCurrency(projection.currentMonthlySpendRate)}</p>
                <p className="mt-2 text-xs text-surface-500">
                  Monthly income at this pace:{' '}
                  {projection.currentMonthlyIncomeRate == null ? 'Waiting on income ratio' : formatCurrency(projection.currentMonthlyIncomeRate)}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-white p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Projected 12-month income</p>
                <p className="mt-2 text-2xl font-bold text-surface-900">
                  {projection.projected12MonthIncome == null ? 'Waiting on income ratio' : formatCurrency(projection.projected12MonthIncome)}
                </p>
                <p className="mt-2 text-xs text-surface-500">
                  {projection.incomeConversionRate == null
                    ? 'This estimate appears once network earnings establish a real conversion ratio.'
                    : `Assumes the current month pace continues unchanged for the next 12 months.`}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-surface-200 bg-white p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">What this means</p>
              <p className="mt-2 text-sm leading-6 text-surface-700">
                This is a simple hold-steady forecast, not a growth forecast. If the current monthly activity continues as-is,
                this is the estimated income over the next 12 months.
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
