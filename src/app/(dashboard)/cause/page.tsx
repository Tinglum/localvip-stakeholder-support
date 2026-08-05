'use client'

import * as React from 'react'
import { Coins, FileDown, HeartHandshake, Network, Store, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'

type CauseOption = { id: number; name: string; logoUrl?: string | null }

type Totals = { direct: number; network: number; total: number }

type Overview = {
  causeId: number
  causeName: string
  logoUrl?: string | null
  lifetime: Totals
  thisMonth: Totals
  window: (Totals & { fromUtc?: string; toUtc?: string }) | null
  pendingTotal: number
  walletDonationsReceived: number
  supporterCount: number
  supporterCountSuppressed: boolean
  transactionCount: number
  businessCount: number
  directPoolMaxPercent: number
  networkLevelPercent: number
}

type TrendPoint = { month: string; direct: number; network: number; total: number }

type Contribution = {
  transactionId: number
  businessName: string
  supporterDisplayName: string
  transactionType: string
  date: string | null
  purchaseAmount: number
  directAmount: number
  networkAmount: number
  totalContribution: number
  status: string
}

type Supporters =
  | { suppressed: true }
  | {
      suppressed: false
      supporterCount: number
      repeatSupporterCount: number
      businesses: { businessAccountId: number; businessName: string; total: number; transactionCount: number }[]
    }

const money = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0)

async function get<T>(resource: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams(params).toString()
  const response = await fetch(`/api/cause-portal/${resource}${query ? `?${query}` : ''}`)
  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? 'You do not have access to this cause.'
        : 'The cause portal could not be loaded.',
    )
  }
  return response.json() as Promise<T>
}

export default function CauseDashboardPage() {
  const [causes, setCauses] = React.useState<CauseOption[]>([])
  const [causeId, setCauseId] = React.useState<string>('')
  const [overview, setOverview] = React.useState<Overview | null>(null)
  const [trend, setTrend] = React.useState<TrendPoint[]>([])
  const [contributions, setContributions] = React.useState<Contribution[]>([])
  const [supporters, setSupporters] = React.useState<Supporters | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState('')

  React.useEffect(() => {
    get<CauseOption[]>('Causes')
      .then((list) => {
        setCauses(list)
        setCauseId(list[0] ? String(list[0].id) : '')
        if (list.length === 0) setLoading(false)
      })
      .catch((cause: Error) => {
        setError(cause.message)
        setLoading(false)
      })
  }, [])

  React.useEffect(() => {
    if (!causeId) return
    let cancelled = false
    setLoading(true)
    setError('')
    const params = { causeAccountId: causeId }

    Promise.all([
      get<Overview>('Overview', params),
      get<{ series: TrendPoint[] }>('Trend', { ...params, months: '12' }),
      get<{ items: Contribution[] }>('Contributions', { ...params, pageSize: '25' }),
      get<Supporters>('Supporters', params),
    ])
      .then(([nextOverview, nextTrend, nextContributions, nextSupporters]) => {
        if (cancelled) return
        setOverview(nextOverview)
        setTrend(nextTrend.series || [])
        setContributions(nextContributions.items || [])
        setSupporters(nextSupporters)
      })
      .catch((cause: Error) => {
        if (!cancelled) setError(cause.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [causeId])

  const peak = Math.max(1, ...trend.map((point) => point.total))

  if (error) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="font-semibold">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!loading && causes.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <HeartHandshake className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">No cause is linked to this account</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask an administrator to add you to a cause to see its contributions.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {overview?.causeName || 'Cause dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Everything supporters have contributed through LocalVIP.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {causes.length > 1 ? (
            <select
              aria-label="Cause"
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={causeId}
              onChange={(event) => setCauseId(event.target.value)}
            >
              {causes.map((cause) => (
                <option key={cause.id} value={cause.id}>
                  {cause.name}
                </option>
              ))}
            </select>
          ) : null}
          <Button variant="outline" asChild>
            <a href={`/api/cause-portal/Contributions.csv?causeAccountId=${causeId}`}>
              <FileDown className="mr-2 h-4 w-4" />
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Received all time"
          value={money(overview?.lifetime.total ?? 0)}
          format="raw"
          subtitle={`${money(overview?.thisMonth.total ?? 0)} this month`}
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="From purchases"
          value={money(overview?.lifetime.direct ?? 0)}
          format="raw"
          subtitle={`Up to ${overview?.directPoolMaxPercent ?? 2}% of each purchase`}
          icon={<HeartHandshake className="h-4 w-4" />}
        />
        <StatCard
          label="From supporter networks"
          value={money(overview?.lifetime.network ?? 0)}
          format="raw"
          subtitle={`${overview?.networkLevelPercent ?? 0.5}% per network level`}
          icon={<Network className="h-4 w-4" />}
        />
        <StatCard
          label="Businesses"
          value={overview?.businessCount ?? 0}
          subtitle={`${overview?.transactionCount ?? 0} purchases`}
          icon={<Store className="h-4 w-4" />}
        />
      </div>

      {overview && overview.pendingTotal > 0 ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-muted-foreground">
              {money(overview.pendingTotal)} is still settling and is not counted above.
            </p>
            <Badge variant="warning">Pending</Badge>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Last 12 months</CardTitle>
        </CardHeader>
        <CardContent>
          {trend.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributions yet.</p>
          ) : (
            <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Monthly contributions">
              {trend.map((point) => (
                <div key={point.month} className="flex flex-1 flex-col items-center gap-1.5">
                  <div
                    className="w-full rounded-t bg-primary/80"
                    style={{ height: `${Math.round((point.total / peak) * 100)}%` }}
                    title={`${point.month}: ${money(point.total)}`}
                  />
                  <span className="text-[10px] text-muted-foreground">{point.month.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Supporters
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!supporters ? null : supporters.suppressed ? (
            <p className="text-sm text-muted-foreground">
              Supporter details stay hidden until this cause has enough supporters that no
              individual can be identified from them.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Supporters</p>
                  <p className="text-xl font-bold tabular-nums">{supporters.supporterCount}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Came back</p>
                  <p className="text-xl font-bold tabular-nums">{supporters.repeatSupporterCount}</p>
                </div>
              </div>
              <div className="space-y-1.5">
                {supporters.businesses.slice(0, 8).map((business) => (
                  <div
                    key={business.businessAccountId}
                    className="flex items-center justify-between gap-4 text-sm"
                  >
                    <span className="truncate">{business.businessName || 'A business'}</span>
                    <span className="shrink-0 font-semibold tabular-nums">{money(business.total)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent contributions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {contributions.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Nothing yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Date</th>
                    <th className="px-4 py-2 font-medium">Business</th>
                    <th className="px-4 py-2 font-medium">Supporter</th>
                    <th className="px-4 py-2 text-right font-medium">Contribution</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {contributions.map((row) => (
                    <tr key={`${row.transactionType}-${row.transactionId}`} className="border-b last:border-0">
                      <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">
                        {row.date ? new Date(row.date).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-2">{row.businessName || 'A business'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{row.supporterDisplayName}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">
                        {money(row.totalContribution)}
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={row.status === 'settled' ? 'success' : row.status === 'pending' ? 'warning' : 'danger'}>
                          {row.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
