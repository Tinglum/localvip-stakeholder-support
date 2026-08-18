'use client'

import * as React from 'react'
import { Coins, Network, Sparkles, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatCard } from '@/components/ui/stat-card'
import { RippleBusinessList, type RippleBusiness } from '@/components/cause-ripple/ripple-business-list'

type CauseOption = { id: number; name: string; logoUrl?: string | null }

type RippleImpact = {
  causeAccountId: number
  causeName: string
  totalCauseCents: number
  rippleAttributedCauseCents: number
  rippleAttributedPurchases: number
  supportersFromRipple: number | null
  supportersFromRippleSuppressed: boolean
  topBusinesses: RippleBusiness[]
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const query = new URLSearchParams(params).toString()
  const response = await fetch(`/api/cause-portal/${path}${query ? `?${query}` : ''}`)

  if (!response.ok) {
    throw new Error(
      response.status === 403
        ? 'You do not have access to this cause.'
        : 'Ripple impact could not be loaded.',
    )
  }

  // The middleware matcher covers /api, so an expired session redirects this fetch to
  // the login page. That arrives as a 200 with HTML, which would otherwise reach
  // response.json() and surface as a parse error rather than "sign in again".
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Your session has expired. Sign in again to see this cause.')
  }

  return response.json() as Promise<T>
}

export default function CauseRippleImpactPage() {
  const [causes, setCauses] = React.useState<CauseOption[]>([])
  const [causeId, setCauseId] = React.useState<string>('')
  const [impact, setImpact] = React.useState<RippleImpact | null>(null)
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

    get<RippleImpact>('ripple-impact', { causeAccountId: causeId, limit: '10' })
      .then((next) => {
        if (!cancelled) setImpact(next)
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
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="font-semibold">No cause is linked to this account</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask an administrator to add you to a cause to see what advocacy is worth to it.
          </p>
        </CardContent>
      </Card>
    )
  }

  const sharePercent = impact && impact.totalCauseCents > 0
    ? (impact.rippleAttributedCauseCents / impact.totalCauseCents) * 100
    : 0
  const hasRippleFunding = (impact?.rippleAttributedCauseCents ?? 0) > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {impact?.causeName || 'Ripple impact'}
          </h1>
          <p className="text-sm text-muted-foreground">
            What supporters recommending businesses has been worth to this cause.
          </p>
        </div>
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
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total funding received"
          value={money(impact?.totalCauseCents ?? 0)}
          format="raw"
          icon={<Coins className="h-4 w-4" />}
        />
        <StatCard
          label="From Ripple recommendations"
          value={money(impact?.rippleAttributedCauseCents ?? 0)}
          format="raw"
          subtitle={hasRippleFunding ? `${sharePercent.toFixed(1)}% of total funding` : undefined}
          icon={<Sparkles className="h-4 w-4" />}
        />
        <StatCard
          label="Ripple-attributed purchases"
          value={impact?.rippleAttributedPurchases ?? 0}
          icon={<Network className="h-4 w-4" />}
        />
        <StatCard
          label="Supporters from Ripple"
          value={
            impact?.supportersFromRippleSuppressed
              ? 'Hidden'
              : impact?.supportersFromRipple ?? 0
          }
          subtitle={impact?.supportersFromRippleSuppressed ? 'Too few to show safely' : undefined}
          icon={<Users className="h-4 w-4" />}
        />
      </div>

      {impact && impact.rippleAttributedCauseCents > 0 ? (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{sharePercent.toFixed(1)}%</span> of{' '}
              {impact.causeName || 'this cause'}&apos;s funding came from people recommending
              businesses through LocalVIP.
            </p>
            <Badge variant="info">Ripple</Badge>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            Supporters from Ripple
          </CardTitle>
        </CardHeader>
        <CardContent>
          {impact?.supportersFromRippleSuppressed ? (
            <p className="text-sm text-muted-foreground">
              This count stays hidden until enough supporters came through Ripple that no
              individual can be identified from it. That protects their privacy — it does not
              mean nobody has.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {impact?.supportersFromRipple ?? 0}
              </span>{' '}
              supporter{impact?.supportersFromRipple === 1 ? '' : 's'} made their first purchase
              after a Ripple recommendation.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Businesses producing Ripple funding</CardTitle>
        </CardHeader>
        <CardContent>
          {!impact ? null : !hasRippleFunding ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                No funding has been traced to a Ripple recommendation for this cause yet. This
                grows when a customer recommends a business that supports this cause, and someone
                new makes their first purchase there because of it.
              </p>
            </div>
          ) : (
            <RippleBusinessList businesses={impact.topBusinesses} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
