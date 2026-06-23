'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Wallet,
  Coins,
  Network,
  HeartHandshake,
  RefreshCw,
  TrendingUp,
  Sparkles,
  AlertCircle,
  Mail,
  FileText,
  Send,
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

interface SelectedCause {
  accountId: number | string
  name: string | null
  receivedLifetime: number
}

interface CauseImpactPayload {
  yourContributionLifetime?: number
  selectedCausesReceivedLifetime?: number
  usCauseContributionLifetime?: number
  usCauseContributionsLifetime?: number
  totalCauseContributionLifetime?: number
  totalCauseContributionsLifetime?: number
  nationalCauseContributionLifetime?: number
  nationalCauseContributionsLifetime?: number
  allCausesReceivedLifetime?: number
  totalReceivedLifetime?: number
  selectedCauses?: SelectedCause[]
}

interface WalletResponse {
  available: AmountPayload
  cashback: AmountPayload
  bonusCash: AmountPayload
  causeImpact: CauseImpactPayload | null
}

type PayoutMethod = 'paypal' | 'check'

interface PayoutPreference {
  method: PayoutMethod
  paypalEmail: string
  checkPayee: string
  checkMailingAddress: string
  updatedAt: string
}

interface PayoutRequest {
  id: string
  amount: number
  method: PayoutMethod
  status: 'pending_admin_review'
  createdAt: string
}

const PAYOUT_PREFERENCE_KEY = 'localvip-consumer-payout-preference'
const PAYOUT_REQUESTS_KEY = 'localvip-consumer-payout-requests'

const DEFAULT_PAYOUT_PREFERENCE: PayoutPreference = {
  method: 'paypal',
  paypalEmail: '',
  checkPayee: '',
  checkMailingAddress: '',
  updatedAt: '',
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

function pickCauseImpactNumber(payload: CauseImpactPayload | null | undefined, keys: Array<keyof CauseImpactPayload>): number | null {
  if (!payload) return null

  for (const key of keys) {
    const raw = payload[key]
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  }

  return null
}

function formatUsd(value: number | null): string {
  if (value === null) return '-'
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
  const [payoutPreference, setPayoutPreference] = React.useState<PayoutPreference>(DEFAULT_PAYOUT_PREFERENCE)
  const [payoutRequests, setPayoutRequests] = React.useState<PayoutRequest[]>([])
  const [payoutMessage, setPayoutMessage] = React.useState<string | null>(null)

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

  React.useEffect(() => {
    const rawPreference = window.localStorage.getItem(PAYOUT_PREFERENCE_KEY)
    if (rawPreference) {
      try {
        setPayoutPreference({ ...DEFAULT_PAYOUT_PREFERENCE, ...(JSON.parse(rawPreference) as Partial<PayoutPreference>) })
      } catch {
        setPayoutPreference(DEFAULT_PAYOUT_PREFERENCE)
      }
    }

    const rawRequests = window.localStorage.getItem(PAYOUT_REQUESTS_KEY)
    if (rawRequests) {
      try {
        const parsed = JSON.parse(rawRequests)
        setPayoutRequests(Array.isArray(parsed) ? parsed : [])
      } catch {
        setPayoutRequests([])
      }
    }
  }, [])

  const available = normalizeAmount(data?.available ?? null, ['availableAmount', 'amount', 'Amount'])
  const cashback = normalizeAmount(data?.cashback ?? null)
  const bonusCash = normalizeAmount(data?.bonusCash ?? null)
  const usCauseContribution = pickCauseImpactNumber(data?.causeImpact, [
    'usCauseContributionLifetime',
    'usCauseContributionsLifetime',
    'totalCauseContributionLifetime',
    'totalCauseContributionsLifetime',
    'nationalCauseContributionLifetime',
    'nationalCauseContributionsLifetime',
    'allCausesReceivedLifetime',
    'totalReceivedLifetime',
    'selectedCausesReceivedLifetime',
  ])
  const selectedCausesReceived = pickCauseImpactNumber(data?.causeImpact, ['selectedCausesReceivedLifetime'])
  const selectedCauses = data?.causeImpact?.selectedCauses ?? []

  const lifetimeCashback = cashback
  const payoutConfigured = payoutPreference.method === 'paypal'
    ? payoutPreference.paypalEmail.trim().length > 0
    : payoutPreference.checkPayee.trim().length > 0 && payoutPreference.checkMailingAddress.trim().length > 0
  const payoutMethodLabel = payoutPreference.method === 'paypal' ? 'PayPal' : 'Check'
  const canRequestPayout = payoutConfigured && available !== null && available > 0

  function updatePayoutPreference(patch: Partial<PayoutPreference>) {
    setPayoutPreference((prev) => ({ ...prev, ...patch }))
  }

  function savePayoutPreference() {
    const next = { ...payoutPreference, updatedAt: new Date().toISOString() }
    setPayoutPreference(next)
    window.localStorage.setItem(PAYOUT_PREFERENCE_KEY, JSON.stringify(next))
    setPayoutMessage(`${payoutMethodLabel} payout details saved.`)
    window.setTimeout(() => setPayoutMessage(null), 2200)
  }

  function requestPayout() {
    if (!canRequestPayout || available === null) return
    const nextRequest: PayoutRequest = {
      id: `${Date.now()}`,
      amount: available,
      method: payoutPreference.method,
      status: 'pending_admin_review',
      createdAt: new Date().toISOString(),
    }
    const nextRequests = [nextRequest, ...payoutRequests]
    setPayoutRequests(nextRequests)
    window.localStorage.setItem(PAYOUT_REQUESTS_KEY, JSON.stringify(nextRequests))
    setPayoutMessage(`Payout request for ${formatUsd(available)} was queued for admin processing.`)
    window.setTimeout(() => setPayoutMessage(null), 3000)
  }

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="My Wallet & Earnings"
        description="See what money is ready to use, what you have earned over time, and how much support has gone to your causes."
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

      <Card className="mb-6 border-brand-100 bg-brand-50/60">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-surface-900">Start here</p>
            <p className="text-sm text-surface-600">
              Check your cashback balance, choose PayPal or check for payouts, and request a payout when money is ready.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href="#payout-setup">Set payout method</a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/me/network">See network earnings</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <WalletTile
          label="Cashback Available"
          value={available}
          icon={<Wallet className="h-5 w-5 text-brand-600" />}
          accent="bg-brand-50"
          caption="Cashback ready to request"
          loading={loading}
          emphasize
        />
        <WalletTile
          label="Lifetime Cashback"
          value={cashback}
          icon={<Coins className="h-5 w-5 text-success-600" />}
          accent="bg-success-50"
          caption="Money back from your own purchases"
          loading={loading}
        />
        <WalletTile
          label="Lifetime Network Earnings"
          value={bonusCash}
          icon={<Network className="h-5 w-5 text-hato-600" />}
          accent="bg-hato-50"
          caption="Extra earnings from people in your network"
          loading={loading}
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:col-span-2">
          <WalletTile
            label="US Cause Contributions"
            value={usCauseContribution}
            icon={<HeartHandshake className="h-5 w-5 text-warning-600" />}
            accent="bg-warning-50"
            caption="Aggregated cause contribution across the US since LocalVIP started"
            loading={loading}
          />
          <WalletTile
            label="Selected Causes Received"
            value={selectedCausesReceived}
            icon={<Sparkles className="h-5 w-5 text-warning-600" />}
            accent="bg-warning-50"
            caption="Total your selected causes received from everyone (lifetime)"
            loading={loading}
          />
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Your selected causes</CardTitle>
            <CardDescription>What each is supported by, all-time.</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {loading ? (
              <div className="space-y-2">
                <div className="h-5 w-full animate-pulse rounded bg-surface-100" />
                <div className="h-5 w-3/4 animate-pulse rounded bg-surface-100" />
              </div>
            ) : selectedCauses.length === 0 ? (
              <p className="text-sm text-surface-400">
                No causes selected yet.{' '}
                <Link href="/portal/me/causes" className="text-brand-600 underline">
                  Choose your causes
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-2">
                {selectedCauses.map((cause) => (
                  <li
                    key={cause.accountId}
                    className="flex items-center justify-between gap-3 border-b border-surface-100 pb-2 last:border-0 last:pb-0"
                  >
                    <span className="truncate text-sm text-surface-700">{cause.name || 'Cause'}</span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-surface-900">
                      {formatUsd(cause.receivedLifetime)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="payout-setup" className="mt-6 scroll-mt-24 border-brand-100">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle>Payout setup</CardTitle>
              <CardDescription>Choose how LocalVIP should send your available balance. Current options are PayPal and check.</CardDescription>
            </div>
            <Badge variant={payoutConfigured ? 'success' : 'warning'}>
              {payoutConfigured ? `${payoutMethodLabel} ready` : 'Method needed'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {payoutMessage ? (
            <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
              {payoutMessage}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => updatePayoutPreference({ method: 'paypal' })}
              className={cn(
                'rounded-2xl border px-4 py-4 text-left transition-colors',
                payoutPreference.method === 'paypal' ? 'border-brand-300 bg-brand-50' : 'border-surface-200 bg-white hover:border-brand-200',
              )}
            >
              <Mail className="h-5 w-5 text-brand-600" />
              <p className="mt-3 text-sm font-semibold text-surface-900">PayPal</p>
              <p className="mt-1 text-sm text-surface-500">Send payout to a PayPal email address.</p>
            </button>
            <button
              type="button"
              onClick={() => updatePayoutPreference({ method: 'check' })}
              className={cn(
                'rounded-2xl border px-4 py-4 text-left transition-colors',
                payoutPreference.method === 'check' ? 'border-brand-300 bg-brand-50' : 'border-surface-200 bg-white hover:border-brand-200',
              )}
            >
              <FileText className="h-5 w-5 text-brand-600" />
              <p className="mt-3 text-sm font-semibold text-surface-900">Check</p>
              <p className="mt-1 text-sm text-surface-500">Mail a check to the payee and address you provide.</p>
            </button>
          </div>

          {payoutPreference.method === 'paypal' ? (
            <label className="block space-y-1">
              <span className="text-sm font-medium text-surface-700">PayPal email</span>
              <input
                type="email"
                value={payoutPreference.paypalEmail}
                onChange={(event) => updatePayoutPreference({ paypalEmail: event.target.value })}
                placeholder="you@example.com"
                className="h-10 w-full rounded-xl border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </label>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-medium text-surface-700">Check payable to</span>
                <input
                  value={payoutPreference.checkPayee}
                  onChange={(event) => updatePayoutPreference({ checkPayee: event.target.value })}
                  placeholder="Full name"
                  className="h-10 w-full rounded-xl border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-medium text-surface-700">Mailing address</span>
                <input
                  value={payoutPreference.checkMailingAddress}
                  onChange={(event) => updatePayoutPreference({ checkMailingAddress: event.target.value })}
                  placeholder="Street, city, state, ZIP"
                  className="h-10 w-full rounded-xl border border-surface-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </label>
            </div>
          )}

          <div className="flex flex-col gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-surface-900">Available to request: {formatUsd(available)}</p>
              <p className="mt-1 text-sm text-surface-500">
                Requests are queued for admin payout processing until the QA backend exposes a live payout endpoint.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={savePayoutPreference}>
                Save payout method
              </Button>
              <Button onClick={requestPayout} disabled={!canRequestPayout}>
                <Send className="h-4 w-4" />
                Request payout
              </Button>
            </div>
          </div>

          {payoutRequests.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-surface-900">Recent payout requests</p>
              {payoutRequests.slice(0, 3).map((request) => (
                <div key={request.id} className="flex items-center justify-between rounded-xl border border-surface-200 bg-white px-3 py-2 text-sm">
                  <span>{formatUsd(request.amount)} by {request.method === 'paypal' ? 'PayPal' : 'check'}</span>
                  <Badge variant="warning">Pending admin review</Badge>
                </div>
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cashback breakdown</CardTitle>
                <CardDescription>Your own cashback only. Network earnings are shown separately.</CardDescription>
              </div>
              <Badge variant="info" className="gap-1">
                <Sparkles className="h-3 w-3" />
                Summary only
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <BreakdownRow
              label="Lifetime cashback"
              description="Money back you earned from buying through the platform"
              value={cashback}
              icon={<Coins className="h-4 w-4" />}
              loading={loading}
            />
            <BreakdownRow
              label="Lifetime network earnings"
              description="Extra money earned because your network is active"
              value={bonusCash}
              icon={<Network className="h-4 w-4" />}
              loading={loading}
            />
            <BreakdownRow
              label="US cause contributions"
              description="Aggregated cause contribution across the US since LocalVIP started"
              value={usCauseContribution}
              icon={<HeartHandshake className="h-4 w-4" />}
              loading={loading}
            />
            <div className="mt-3 flex items-center justify-between rounded-lg bg-surface-50 px-3 py-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-brand-600" />
                <p className="text-sm font-semibold text-surface-800">Total lifetime cashback</p>
              </div>
              {loading ? (
                <div className="h-5 w-24 animate-pulse rounded bg-surface-100" />
              ) : (
                <p className="text-base font-bold tabular-nums text-surface-900">
                  {formatUsd(lifetimeCashback)}
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>What these numbers mean</CardTitle>
            <CardDescription>Quick answers for first-time users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-2 text-sm text-surface-600">
            <p>
              <span className="font-medium text-surface-800">Cashback available</span> is the cashback amount
              ready for you to request now.
            </p>
            <p>
              <span className="font-medium text-surface-800">Lifetime cashback</span> shows money back from
              your own purchases. Network earnings are shown separately.
            </p>
            <p>
              <span className="font-medium text-surface-800">Cause impact</span> shows the aggregated
              US-wide cause contribution since LocalVIP started.
            </p>
            <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-500">
              This page does not change anything. Use it to check your totals, then head to Network
              or Causes if you want to take the next step.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
