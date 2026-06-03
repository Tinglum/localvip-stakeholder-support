'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Mail, Phone, MapPin, Calendar, CreditCard, Wallet, Heart, Users,
  Smartphone, Loader2, CheckCircle, AlertCircle, TrendingUp, ArrowRight,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const TYPE_VARIANT: Record<string, 'default' | 'info' | 'warning' | 'success' | 'danger'> = {
  Normal: 'default',
  Intern: 'info',
  Volunteer: 'warning',
  LaunchTeamPartner: 'success',
  Influencer: 'danger',
}

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
  id?: number
  prevAmount?: number
  addedAmount?: number
  currentAmount: number
  availableAmount: number
  walletStatus?: string
  walletYear?: number
  walletMonth?: number
  walletDay?: number
  hasStripeOnboarding: boolean
  bank: string | null
}

interface TransactionRow {
  id: number
  accountId: number
  amount: number
  tip: number
  cashback: number
  marketing: number
  txFee: number
  finalAmount: number
  transactionId: string | null
  transactionStatus: string | null
  createdDate: string | null
}

interface CashbackSummary {
  lifetimeTotal: number
  recent: { id: number; amount: number; accountId: number; createdDate: string | null }[]
}

interface FriendRow {
  id: number
  friendId: number
  firstName: string
  lastName: string
  email: string
  isActive: boolean
}

interface CauseRow {
  id: number
  accountId: number
  name: string
  ownerEmail: string | null
  isActive: boolean
}

interface DeviceRow {
  id: number
  deviceId: string
  createdDate: string | null
}

function formatTypeName(name: string) {
  return name === 'LaunchTeamPartner' ? 'Launch Team Partner' : name
}

function formatMoney(v: number | undefined | null) {
  if (v == null) return '$0.00'
  return v.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return d
  }
}

export default function ConsumerDetailPage() {
  const params = useParams()
  const router = useRouter()
  const consumerId = params.id as string

  const [summary, setSummary] = React.useState<ConsumerSummary | null>(null)
  const [wallet, setWallet] = React.useState<WalletDetail | null>(null)
  const [transactions, setTransactions] = React.useState<TransactionRow[]>([])
  const [cashback, setCashback] = React.useState<CashbackSummary | null>(null)
  const [bonusCash, setBonusCash] = React.useState<CashbackSummary | null>(null)
  const [friends, setFriends] = React.useState<FriendRow[]>([])
  const [causes, setCauses] = React.useState<CauseRow[]>([])
  const [devices, setDevices] = React.useState<DeviceRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [
          summaryRes,
          walletRes,
          txRes,
          cbRes,
          bcRes,
          friendsRes,
          causesRes,
          devicesRes,
        ] = await Promise.all([
          fetch(`/api/qa/consumers/${consumerId}/summary`),
          fetch(`/api/qa/consumers/${consumerId}/wallet`),
          fetch(`/api/qa/consumers/${consumerId}/transactions`),
          fetch(`/api/qa/consumers/${consumerId}/cashback`),
          fetch(`/api/qa/consumers/${consumerId}/bonuscash`),
          fetch(`/api/qa/consumers/${consumerId}/five-friends`),
          fetch(`/api/qa/consumers/${consumerId}/ten-causes`),
          fetch(`/api/qa/consumers/${consumerId}/devices`),
        ])

        if (cancelled) return
        if (!summaryRes.ok) throw new Error('Failed to load consumer')

        setSummary(await summaryRes.json())
        if (walletRes.ok) setWallet(await walletRes.json())
        if (txRes.ok) setTransactions(await txRes.json())
        if (cbRes.ok) setCashback(await cbRes.json())
        if (bcRes.ok) setBonusCash(await bcRes.json())
        if (friendsRes.ok) setFriends(await friendsRes.json())
        if (causesRes.ok) setCauses(await causesRes.json())
        if (devicesRes.ok) setDevices(await devicesRes.json())
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [consumerId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
      </div>
    )
  }

  if (error || !summary) {
    return (
      <div className="space-y-4">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || 'Consumer not found.'}
        </div>
      </div>
    )
  }

  const c = summary.consumer
  const fullName = `${c.firstName} ${c.lastName}`.trim() || c.email

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      {/* Header */}
      <div className="flex flex-col gap-3 rounded-xl border border-surface-200 bg-surface-0 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold text-surface-900">{fullName}</h1>
            <Badge variant={TYPE_VARIANT[c.consumerType] || 'default'}>
              {formatTypeName(c.consumerType)}
            </Badge>
            {c.isEnabled
              ? <Badge variant="success" dot>active</Badge>
              : <Badge variant="default" dot>inactive</Badge>}
            {summary.stripeOnboarded
              ? <Badge variant="success">Stripe Connected</Badge>
              : <Badge variant="warning">No Stripe</Badge>}
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
            <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{c.email}</span>
            {c.phoneNumber && <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{c.phoneNumber}</span>}
            {(c.city || c.state) && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{[c.city, c.state, c.country].filter(Boolean).join(', ')}</span>}
            <span className="inline-flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Joined {formatDate(c.createdDate)}</span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const res = await fetch('/api/admin/view-as', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ userId: c.id }),
              })
              if (res.ok) {
                router.refresh()
                router.push('/dashboard')
              }
            }}
          >
            View as user
          </Button>
          <Button size="sm">Edit profile</Button>
        </div>
      </div>

      {/* Top metric tiles */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-surface-500">Wallet balance</div>
            <div className="mt-1 text-2xl font-semibold text-surface-900">{formatMoney(summary.wallet.availableAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-surface-500">Lifetime cashback</div>
            <div className="mt-1 text-2xl font-semibold text-surface-900">{formatMoney(summary.lifetimeCashback)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-surface-500">Bonus cash</div>
            <div className="mt-1 text-2xl font-semibold text-surface-900">{formatMoney(summary.lifetimeBonusCash)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-surface-500">Transactions</div>
            <div className="mt-1 text-2xl font-semibold text-surface-900">{summary.counts.transactions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-surface-500">5 friends</div>
            <div className="mt-1 text-2xl font-semibold text-surface-900">{summary.counts.friends}/5</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-surface-500">10 causes</div>
            <div className="mt-1 text-2xl font-semibold text-surface-900">{summary.counts.causes}/10</div>
          </CardContent>
        </Card>
      </div>

      {/* Wallet + Referral */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Wallet className="h-4 w-4" />Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-surface-500">Available</span>
              <span className="text-2xl font-semibold text-surface-900">{formatMoney(wallet?.availableAmount)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-surface-500">Current</span>
              <span className="text-surface-700">{formatMoney(wallet?.currentAmount)}</span>
            </div>
            {wallet?.walletStatus && (
              <div className="flex items-baseline justify-between">
                <span className="text-surface-500">Status</span>
                <Badge variant="info">{wallet.walletStatus}</Badge>
              </div>
            )}
            <div className="flex items-baseline justify-between">
              <span className="text-surface-500">Payout method</span>
              <span className="text-surface-700">{wallet?.bank || 'Not configured'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><CreditCard className="h-4 w-4" />Referral & links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <div className="text-surface-500">Referral code</div>
              <div className="mt-1 font-mono text-surface-900">{c.referralCode || '—'}</div>
            </div>
            <div>
              <div className="text-surface-500">Shared URL</div>
              <div className="mt-1 break-all text-surface-700">
                {c.sharedURL
                  ? <a href={c.sharedURL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{c.sharedURL}</a>
                  : '—'}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Network — 5 Friends + 10 Causes */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Users className="h-4 w-4" />5 Friends Network ({friends.length}/5)</CardTitle>
          </CardHeader>
          <CardContent>
            {friends.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No friends linked yet.</p>
            ) : (
              <div className="space-y-2">
                {friends.map(f => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3">
                    <div>
                      <div className="font-medium text-surface-900">{f.firstName} {f.lastName}</div>
                      <div className="text-xs text-surface-500">{f.email}</div>
                    </div>
                    {f.isActive
                      ? <Badge variant="success" dot>active</Badge>
                      : <Badge variant="default" dot>inactive</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Heart className="h-4 w-4" />10 Causes ({causes.length}/10)</CardTitle>
          </CardHeader>
          <CardContent>
            {causes.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No causes linked yet.</p>
            ) : (
              <div className="space-y-2">
                {causes.map(cz => (
                  <div key={cz.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3">
                    <div>
                      <div className="font-medium text-surface-900">{cz.name}</div>
                      <div className="text-xs text-surface-500">{cz.ownerEmail || '—'}</div>
                    </div>
                    {cz.isActive
                      ? <Badge variant="success" dot>active</Badge>
                      : <Badge variant="default" dot>inactive</Badge>}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transactions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4" />Recent Transactions ({transactions.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
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
                  {transactions.map(t => (
                    <tr key={t.id} className="border-b border-surface-100">
                      <td className="px-3 py-2 text-surface-600">{formatDate(t.createdDate)}</td>
                      <td className="px-3 py-2 font-medium text-surface-900">{formatMoney(t.amount)}</td>
                      <td className="px-3 py-2 text-surface-600">{formatMoney(t.tip)}</td>
                      <td className="px-3 py-2 text-emerald-600">{formatMoney(t.cashback)}</td>
                      <td className="px-3 py-2 text-surface-600">{formatMoney(t.txFee)}</td>
                      <td className="px-3 py-2 font-medium text-surface-900">{formatMoney(t.finalAmount)}</td>
                      <td className="px-3 py-2">
                        <Badge variant={t.transactionStatus === 'completed' ? 'success' : 'default'}>
                          {t.transactionStatus || 'pending'}
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

      {/* Cashback + Bonus history */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Cashback history (lifetime {formatMoney(cashback?.lifetimeTotal)})</CardTitle>
          </CardHeader>
          <CardContent>
            {(cashback?.recent.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No cashback yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {cashback!.recent.slice(0, 10).map(r => (
                  <div key={r.id} className="flex items-center justify-between border-b border-surface-100 py-1.5">
                    <span className="text-surface-600">{formatDate(r.createdDate)} • Account {r.accountId}</span>
                    <span className="font-medium text-emerald-600">+{formatMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bonus cash (lifetime {formatMoney(bonusCash?.lifetimeTotal)})</CardTitle>
          </CardHeader>
          <CardContent>
            {(bonusCash?.recent.length ?? 0) === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No bonus cash yet.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {bonusCash!.recent.slice(0, 10).map(r => (
                  <div key={r.id} className="flex items-center justify-between border-b border-surface-100 py-1.5">
                    <span className="text-surface-600">{formatDate(r.createdDate)} • Account {r.accountId}</span>
                    <span className="font-medium text-emerald-600">+{formatMoney(r.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Devices */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4" />Registered Devices ({devices.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {devices.length === 0 ? (
            <p className="py-4 text-center text-sm text-surface-400">No devices registered.</p>
          ) : (
            <div className="space-y-2 text-sm">
              {devices.map(d => (
                <div key={d.id} className="flex items-center justify-between rounded-lg border border-surface-200 p-3">
                  <div>
                    <div className="font-mono text-xs text-surface-600">Device {d.deviceId}</div>
                  </div>
                  <span className="text-xs text-surface-500">{formatDate(d.createdDate)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
