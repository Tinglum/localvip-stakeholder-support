'use client'

import * as React from 'react'
import {
  Wallet,
  Coins,
  Network,
  HeartHandshake,
  RefreshCw,
  TrendingUp,
  Sparkles,
  AlertCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type AmountPayload =
  | number
  | { amount?: unknown; Amount?: unknown; availableAmount?: unknown; [key: string]: unknown }
  | null

interface WalletResponse {
  available: AmountPayload
  cashback: AmountPayload
  bonusCash: AmountPayload
  socialImpact: AmountPayload
}

function normalizeAmount(payload: AmountPayload, keys: string[] = ['amount', 'Amount']): number | null {
  if (payload === null || payload === undefined) return null
  if (typeof payload === 'number') return Number.isFinite(payload) ? payload : null
  if (typeof payload === 'object') {
    for (const key of keys) {
      const raw = (payload as Record<string, unknown>)[key]
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw
      if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return Number(raw)
    }
  }
  return null
}

function formatUsd(value: number | null): string {
  if (value === null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

interface WalletTileProps {
  label: string
  value: number | null
  icon: React.ReactNode
  accent: string
  caption: string
  loading?: boolean
  emphasize?: boolean
}

function WalletTile({ label, value, icon, accent, caption, loading, emphasize }: WalletTileProps) {
  return (
    <Card className={cn('relative overflow-hidden', emphasize && 'ring-1 ring-brand-200')}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-caption uppercase tracking-wider text-surface-500">{label}</p>
            {loading ? (
              <div className="mt-2 h-8 w-28 animate-pulse rounded-md bg-surface-100" />
            ) : (
              <p
                className={cn(
                  'mt-1 font-bold text-surface-900',
                  emphasize ? 'text-3xl' : 'text-2xl'
                )}
              >
                {formatUsd(value)}
              </p>
            )}
          </div>
          <div className={cn('rounded-lg p-2', accent)}>{icon}</div>
        </div>
        <p className="mt-3 text-xs text-surface-400">{caption}</p>
      </CardContent>
    </Card>
  )
}

interface BreakdownRowProps {
  label: string
  value: number | null
  description: string
  icon: React.ReactNode
  loading?: boolean
}

function BreakdownRow({ label, value, description, icon, loading }: BreakdownRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-surface-100 py-3 last:border-0">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-surface-100 p-2 text-surface-500">{icon}</div>
        <div>
          <p className="text-sm font-medium text-surface-800">{label}</p>
          <p className="text-xs text-surface-400">{description}</p>
        </div>
      </div>
      {loading ? (
        <div className="h-5 w-20 animate-pulse rounded bg-surface-100" />
      ) : (
        <p className="text-sm font-semibold tabular-nums text-surface-900">{formatUsd(value)}</p>
      )}
    </div>
  )
}

export default function MyWalletPage() {
  const [data, setData] = React.useState<WalletResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/me/wallet', { cache: 'no-store' })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(body?.error || 'Unable to load your wallet right now.')
      }
      const json = (await res.json()) as WalletResponse
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your wallet right now.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const available = normalizeAmount(data?.available ?? null, ['availableAmount', 'amount', 'Amount'])
  const cashback = normalizeAmount(data?.cashback ?? null)
  const bonusCash = normalizeAmount(data?.bonusCash ?? null)
  const socialImpact = normalizeAmount(data?.socialImpact ?? null)

  const lifetimeEarned =
    cashback === null && bonusCash === null
      ? null
      : (cashback ?? 0) + (bonusCash ?? 0)

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="My Wallet & Earnings"
        description="A live snapshot of your balance, lifetime rewards, and the impact you've created."
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Wallet & Earnings' }]}
        actions={
          <Button
            variant="outline"
            onClick={() => void load(true)}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        }
      />

      {error && (
        <Card className="mb-6 border-danger-200 bg-danger-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 shrink-0 text-danger-500" />
            <p className="text-sm text-danger-700">{error}</p>
            <Button
              variant="ghost"
              onClick={() => void load()}
              className="ml-auto text-danger-700 hover:bg-danger-100"
            >
              Try again
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <WalletTile
          label="Available Balance"
          value={available}
          icon={<Wallet className="h-5 w-5 text-brand-600" />}
          accent="bg-brand-50"
          caption="Ready to spend across the network"
          loading={loading}
          emphasize
        />
        <WalletTile
          label="Lifetime Cashback"
          value={cashback}
          icon={<Coins className="h-5 w-5 text-success-600" />}
          accent="bg-success-50"
          caption="Total cashback earned to date"
          loading={loading}
        />
        <WalletTile
          label="Network Earnings"
          value={bonusCash}
          icon={<Network className="h-5 w-5 text-hato-600" />}
          accent="bg-hato-50"
          caption="Lifetime bonus cash from your network"
          loading={loading}
        />
        <WalletTile
          label="Cause Impact"
          value={socialImpact}
          icon={<HeartHandshake className="h-5 w-5 text-warning-600" />}
          accent="bg-warning-50"
          caption="Total directed to causes you support"
          loading={loading}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Earnings breakdown</CardTitle>
                <CardDescription>How your lifetime rewards add up.</CardDescription>
              </div>
              <Badge variant="info" className="gap-1">
                <Sparkles className="h-3 w-3" />
                View only
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <BreakdownRow
              label="Lifetime cashback"
              description="Rewards from your own purchases"
              value={cashback}
              icon={<Coins className="h-4 w-4" />}
              loading={loading}
            />
            <BreakdownRow
              label="Network earnings"
              description="Bonus cash earned through your network"
              value={bonusCash}
              icon={<Network className="h-4 w-4" />}
              loading={loading}
            />
            <BreakdownRow
              label="Cause impact"
              description="Contributions directed to your causes"
              value={socialImpact}
              icon={<HeartHandshake className="h-4 w-4" />}
              loading={loading}
            />
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-surface-800">Total lifetime earned</p>
              </div>
              {loading ? (
                <div className="h-5 w-24 animate-pulse rounded bg-surface-100" />
              ) : (
                <p className="text-base font-bold tabular-nums text-surface-900">
                  {formatUsd(lifetimeEarned)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About your wallet</CardTitle>
            <CardDescription>What these numbers mean.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-sm text-surface-600">
            <p>
              <span className="font-medium text-surface-800">Available balance</span> is what you can
              currently spend. Cashback and network earnings flow into it over time.
            </p>
            <p>
              <span className="font-medium text-surface-800">Cause impact</span> tracks the value
              you've helped direct toward the causes you care about.
            </p>
            <p className="text-xs text-surface-400">
              This page is read-only. Payments, transfers, and donations are managed elsewhere.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
