'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Network,
  Search,
  Users,
  Layers,
  MapPin,
  CalendarDays,
  TrendingUp,
  UserCircle2,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { cn, formatDate, formatNumber } from '@/lib/utils'

interface NetworkNode {
  id: number | string
  parentId: number | string | null
  level: number
  name: string
  city: string | null
  state: string | null
  joinedAt: string | null
}

interface EarningsEntry {
  id: number | string
  earnings: number
}

interface NetworkResponse {
  nodes: NetworkNode[]
  branchSizes?: Record<string, number> | null
  earningsById?: EarningsEntry[]
  totalNetworkEarnings?: number
  totalNodes?: number
}

interface DecoratedNode extends NetworkNode {
  earnings: number
  location: string
}

interface LevelGroup {
  level: number
  members: DecoratedNode[]
  earnings: number
}

const MAX_LEVELS = 10

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

export default function MyNetworkPage() {
  const [data, setData] = React.useState<NetworkResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState('')
  const [expandedLevels, setExpandedLevels] = React.useState<Record<number, boolean>>({})

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/me/network', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as (NetworkResponse & { error?: string }) | null
      if (!res.ok || !json) {
        throw new Error(json?.error || 'We could not load your network right now.')
      }
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'We could not load your network right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const earningsMap = React.useMemo(() => {
    const map = new Map<string, number>()
    for (const entry of data?.earningsById ?? []) {
      map.set(String(entry.id), Number(entry.earnings) || 0)
    }
    return map
  }, [data?.earningsById])

  const decoratedNodes = React.useMemo<DecoratedNode[]>(() => {
    return (data?.nodes ?? []).map((node) => ({
      ...node,
      earnings: earningsMap.get(String(node.id)) ?? 0,
      location: buildLocation(node),
    }))
  }, [data?.nodes, earningsMap])

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
      const members = (byLevel.get(level) ?? []).sort((a, b) => a.level - b.level || b.earnings - a.earnings)
      groups.push({
        level,
        members,
        earnings: members.reduce((sum, member) => sum + member.earnings, 0),
      })
    }
    return groups
  }, [decoratedNodes])

  const totalMembers = data?.totalNodes ?? decoratedNodes.length
  const totalEarnings = React.useMemo(() => {
    if (typeof data?.totalNetworkEarnings === 'number') return data.totalNetworkEarnings
    return decoratedNodes.reduce((sum, node) => sum + node.earnings, 0)
  }, [data?.totalNetworkEarnings, decoratedNodes])
  const activeLevels = levelGroups.filter((group) => group.members.length > 0).length
  const directReferrals = levelGroups.find((group) => group.level === 1)?.members.length ?? 0

  const normalizedQuery = query.trim().toLowerCase()
  const searchResults = React.useMemo<DecoratedNode[]>(() => {
    if (!normalizedQuery) return []
    return decoratedNodes
      .filter((node) => {
        const haystack = `${node.name} ${node.location}`.toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .sort((a, b) => a.level - b.level || b.earnings - a.earnings)
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

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your network...
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="My Network"
          description="See the people connected to you and the earnings they help create over time."
        />
        <EmptyState
          icon={<Network className="h-8 w-8" />}
          title="We hit a snag loading your network"
          description={error}
          action={{ label: 'Try again', onClick: () => void load() }}
        />
      </div>
    )
  }

  const hasNetwork = decoratedNodes.length > 0

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Network"
        description="See the people connected to you and the earnings they help create over time."
        actions={
          <Button variant="outline" onClick={() => void load()}>
            <TrendingUp className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <Card className="border-brand-100 bg-brand-50/60">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-surface-900">Start here</p>
            <p className="text-sm leading-6 text-surface-600">
              This page shows your people in levels. Level 1 means people directly connected to you. Higher levels are
              people connected through them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/portal/me">Back to my home</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/me/wallet">Check my money</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Total network earnings"
          value={formatCurrency(totalEarnings)}
          icon={<Coins className="h-5 w-5" />}
          accent="text-success-600"
          hint="All network-related earnings so far"
        />
        <SummaryCard
          label="Network members"
          value={formatNumber(totalMembers)}
          icon={<Users className="h-5 w-5" />}
          hint="Everyone currently visible in your network"
        />
        <SummaryCard
          label="Active levels"
          value={`${activeLevels} / ${MAX_LEVELS}`}
          icon={<Layers className="h-5 w-5" />}
          hint="How many of your 10 levels currently have people in them"
        />
        <SummaryCard
          label="Direct referrals"
          value={formatNumber(directReferrals)}
          icon={<UserCircle2 className="h-5 w-5" />}
          hint="People directly connected to you"
        />
      </div>

      {!hasNetwork ? (
        <EmptyState
          icon={<Network className="h-8 w-8" />}
          title="Your network is just getting started"
          description="When people begin joining through you, they will appear here. Start by sharing your link from your dashboard."
        />
      ) : (
        <>
          <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
            <Card>
              <CardHeader>
                <CardTitle>Find a person</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-surface-500">
                  Search by name or location if you want to quickly find someone without opening every level.
                </p>
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
                      <p className="text-sm text-surface-500">
                        No people match &quot;{query}&quot;.
                      </p>
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

            <Card>
              <CardHeader>
                <CardTitle>What the levels mean</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm leading-6 text-surface-600">
                <p><strong className="text-surface-900">Level 1:</strong> people directly connected to you.</p>
                <p><strong className="text-surface-900">Level 2 and above:</strong> people connected through someone else in your network.</p>
                <p><strong className="text-surface-900">Earnings:</strong> the value currently attributed to that person or level.</p>
                <p className="rounded-xl bg-surface-50 px-3 py-2 text-xs text-surface-500">
                  You do not need to open every level every time. Start with Level 1 if you only want the most direct view.
                </p>
              </CardContent>
            </Card>
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
                        <ChevronIcon
                          className={cn('h-4 w-4 text-surface-400', isEmpty && 'opacity-0')}
                        />
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
                          {formatCurrency(group.earnings)}
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
        <p className="text-sm font-semibold text-success-600">{formatCurrency(node.earnings)}</p>
        <p className="text-[11px] uppercase tracking-wide text-surface-400">earned</p>
      </div>
    </div>
  )
}
