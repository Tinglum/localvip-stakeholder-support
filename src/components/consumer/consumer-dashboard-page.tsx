'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Calendar,
  CreditCard,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Smartphone,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { StatCard } from '@/components/ui/stat-card'

interface ConsumerSummary {
  consumer: {
    id: number
    firstName: string
    lastName: string
    email: string
    phoneNumber: string | null
    city: string | null
    state: string | null
    country: string | null
    referralCode: string | null
    sharedURL: string | null
    createdDate: string
    isEnabled: boolean
    consumerType: string
  }
  wallet: { availableAmount: number; currentAmount: number; walletStatus: string }
  stripeOnboarded: boolean
  lifetimeCashback: number
  lifetimeBonusCash: number
  counts: { transactions: number; friends: number; causes: number; devices: number }
}

interface WalletDetail {
  currentAmount: number
  availableAmount: number
  walletStatus?: string
  hasStripeOnboarding?: boolean
  bank: string | null
}

interface TransactionRow {
  id: number
  amount: number
  tip: number
  cashback: number
  txFee: number
  finalAmount: number
  transactionStatus: string | null
  createdDate: string | null
}

interface CashbackSummary {
  lifetimeTotal: number
  recent: { id: number; amount: number; accountId: number; createdDate: string | null }[]
}

interface FriendRow {
  id: number
  firstName: string
  lastName: string
  email: string
  isActive: boolean
}

interface CauseRow {
  id: number
  name: string
  ownerEmail: string | null
  isActive: boolean
}

interface DeviceRow {
  id: number
  deviceId: string
  createdDate: string | null
}

interface ConsumerDashboardPayload {
  consumerId: number
  summary: ConsumerSummary
  wallet: WalletDetail | null
  transactions: TransactionRow[]
  cashback: CashbackSummary | null
  bonusCash: CashbackSummary | null
  friends: FriendRow[]
  causes: CauseRow[]
  devices: DeviceRow[]
}

function formatMoney(value: number | undefined | null) {
  if (value == null) return '$0.00'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return value
  }
}

export function ConsumerDashboardPage() {
  const { profile } = useAuth()
  const [data, setData] = React.useState<ConsumerDashboardPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/qa/me/consumer-dashboard', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error || 'Failed to load your dashboard.')
        }

        if (!cancelled) {
          setData(payload as ConsumerDashboardPayload)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load your dashboard.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<Wallet className="h-8 w-8" />}
        title="Your client dashboard is still connecting"
        description={error || 'We could not load your wallet, network, and transaction overview yet.'}
      />
    )
  }

  const consumer = data.summary.consumer
  const wallet = data.wallet || data.summary.wallet
  const payoutMethod = data.wallet?.bank || 'Not configured yet'
  const fullName = `${consumer.firstName} ${consumer.lastName}`.trim() || profile.full_name || consumer.email
  const transactionPreview = data.transactions.slice(0, 8)

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${consumer.firstName || fullName}`}
        description="Your LocalVIP client dashboard keeps your wallet, transaction history, referral link, and network all in one place."
        actions={
          <div className="flex flex-wrap gap-2">
            {consumer.sharedURL ? (
              <Button asChild>
                <a href={consumer.sharedURL} target="_blank" rel="noopener noreferrer">
                  Share my link
                  <QrCode className="h-4 w-4" />
                </a>
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link href="/dashboard">
                Refresh overview
              </Link>
            </Button>
          </div>
        }
      />

      <div className="rounded-2xl border border-surface-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-semibold text-surface-900">{fullName}</h2>
              <Badge variant={consumer.isEnabled ? 'success' : 'default'} dot>
                {consumer.isEnabled ? 'active account' : 'inactive account'}
              </Badge>
              <Badge variant={data.summary.stripeOnboarded ? 'success' : 'warning'}>
                {data.summary.stripeOnboarded ? 'wallet ready' : 'wallet setup pending'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
              <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{consumer.email}</span>
              {consumer.phoneNumber ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{consumer.phoneNumber}</span> : null}
              {(consumer.city || consumer.state) ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[consumer.city, consumer.state, consumer.country].filter(Boolean).join(', ')}
                </span>
              ) : null}
              <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Joined {formatDate(consumer.createdDate)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-right sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wider text-surface-500">Referral code</div>
              <div className="mt-1 font-mono text-sm font-semibold text-surface-900">{consumer.referralCode || '—'}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-surface-500">5 friends</div>
              <div className="mt-1 text-lg font-semibold text-surface-900">{data.summary.counts.friends}/5</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-surface-500">10 causes</div>
              <div className="mt-1 text-lg font-semibold text-surface-900">{data.summary.counts.causes}/10</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="Wallet balance" value={formatMoney(wallet?.availableAmount)} icon={<Wallet className="h-5 w-5" />} />
        <StatCard label="Current wallet" value={formatMoney(wallet?.currentAmount)} icon={<CreditCard className="h-5 w-5" />} />
        <StatCard label="Lifetime cashback" value={formatMoney(data.summary.lifetimeCashback)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Bonus cash" value={formatMoney(data.summary.lifetimeBonusCash)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Transactions" value={data.summary.counts.transactions} icon={<CreditCard className="h-5 w-5" />} />
        <StatCard label="Devices" value={data.summary.counts.devices} icon={<Smartphone className="h-5 w-5" />} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" />Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-surface-500">Available now</span>
              <span className="text-2xl font-semibold text-surface-900">{formatMoney(wallet?.availableAmount)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-surface-500">Current balance</span>
              <span className="text-surface-700">{formatMoney(wallet?.currentAmount)}</span>
            </div>
            {wallet?.walletStatus ? (
              <div className="flex items-baseline justify-between">
                <span className="text-surface-500">Status</span>
                <Badge variant="info">{wallet.walletStatus}</Badge>
              </div>
            ) : null}
            <div className="flex items-baseline justify-between">
              <span className="text-surface-500">Payout method</span>
              <span className="text-surface-700">{payoutMethod}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><QrCode className="h-4 w-4" />Share & referral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-surface-500">Referral code</div>
              <div className="mt-1 font-mono text-surface-900">{consumer.referralCode || '—'}</div>
            </div>
            <div>
              <div className="text-surface-500">Share URL</div>
              <div className="mt-1 break-all text-surface-700">
                {consumer.sharedURL ? (
                  <a href={consumer.sharedURL} target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                    {consumer.sharedURL}
                  </a>
                ) : '—'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />Your 5-friends network ({data.friends.length}/5)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.friends.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No friends linked yet.</p>
            ) : (
              <div className="space-y-2">
                {data.friends.map((friend) => (
                  <div key={friend.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3">
                    <div>
                      <div className="font-medium text-surface-900">{friend.firstName} {friend.lastName}</div>
                      <div className="text-xs text-surface-500">{friend.email}</div>
                    </div>
                    <Badge variant={friend.isActive ? 'success' : 'default'} dot>
                      {friend.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Heart className="h-4 w-4" />Your 10-causes network ({data.causes.length}/10)</CardTitle>
          </CardHeader>
          <CardContent>
            {data.causes.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No causes linked yet.</p>
            ) : (
              <div className="space-y-2">
                {data.causes.map((cause) => (
                  <div key={cause.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3">
                    <div>
                      <div className="font-medium text-surface-900">{cause.name}</div>
                      <div className="text-xs text-surface-500">{cause.ownerEmail || 'No owner email available'}</div>
                    </div>
                    <Badge variant={cause.isActive ? 'success' : 'default'} dot>
                      {cause.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Recent transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {transactionPreview.length === 0 ? (
            <p className="py-4 text-center text-sm text-surface-400">No transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wider text-surface-500">
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Amount</th>
                    <th className="px-3 py-2">Tip</th>
                    <th className="px-3 py-2">Cashback</th>
                    <th className="px-3 py-2">Fee</th>
                    <th className="px-3 py-2">Final</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactionPreview.map((transaction) => (
                    <tr key={transaction.id} className="border-b border-surface-100">
                      <td className="px-3 py-2 text-surface-600">{formatDate(transaction.createdDate)}</td>
                      <td className="px-3 py-2 font-medium text-surface-900">{formatMoney(transaction.amount)}</td>
                      <td className="px-3 py-2 text-surface-600">{formatMoney(transaction.tip)}</td>
                      <td className="px-3 py-2 text-emerald-600">{formatMoney(transaction.cashback)}</td>
                      <td className="px-3 py-2 text-surface-600">{formatMoney(transaction.txFee)}</td>
                      <td className="px-3 py-2 font-medium text-surface-900">{formatMoney(transaction.finalAmount)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={transaction.transactionStatus === 'completed' ? 'success' : 'default'}>
                          {transaction.transactionStatus || 'pending'}
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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cashback history</CardTitle>
          </CardHeader>
          <CardContent>
            {(data.cashback?.recent.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No cashback yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {data.cashback!.recent.slice(0, 10).map((row) => (
                  <div key={row.id} className="flex items-center justify-between border-b border-surface-100 py-1.5">
                    <span className="text-surface-600">{formatDate(row.createdDate)} • Account {row.accountId}</span>
                    <span className="font-medium text-emerald-600">+{formatMoney(row.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bonus cash</CardTitle>
          </CardHeader>
          <CardContent>
            {(data.bonusCash?.recent.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No bonus cash yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {data.bonusCash!.recent.slice(0, 10).map((row) => (
                  <div key={row.id} className="flex items-center justify-between border-b border-surface-100 py-1.5">
                    <span className="text-surface-600">{formatDate(row.createdDate)} • Account {row.accountId}</span>
                    <span className="font-medium text-emerald-600">+{formatMoney(row.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Registered devices</CardTitle>
        </CardHeader>
        <CardContent>
          {data.devices.length === 0 ? (
            <p className="py-4 text-center text-sm text-surface-400">No devices registered.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {data.devices.map((device) => (
                <div key={device.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3">
                  <div className="font-mono text-xs text-surface-600">Device {device.deviceId}</div>
                  <span className="text-xs text-surface-500">{formatDate(device.createdDate)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
