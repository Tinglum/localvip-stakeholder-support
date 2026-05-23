'use client'

import * as React from 'react'
import { ArrowRight, CreditCard, DollarSign, Heart, TrendingUp, Users, Wallet } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { WalletMobile, CashbackModel, BonusCashModel } from '@/lib/server/qa-mobile-api'

type WalletData = {
  wallet: WalletMobile | null
  cashbackLifetime: number
  bonuscashLifetime: number
  recentCashback: CashbackModel[]
  recentBonuscash: BonusCashModel[]
}

function useMobileApi<T>(url: string) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`)
        return res.json()
      })
      .then((json) => { if (!cancelled) setData(json) })
      .catch((err) => { if (!cancelled) setError(err.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [url])

  return { data, loading, error }
}

export function PortalWalletPage() {
  const { data: wallet, loading: walletLoading } = useMobileApi<WalletMobile>('/api/qa/mobile/wallet')
  const { data: cashbackLifetime, loading: cbLoading } = useMobileApi<number>('/api/qa/mobile/cashback?scope=lifetime')
  const { data: bonuscashLifetime, loading: bcLoading } = useMobileApi<number>('/api/qa/mobile/bonuscash?scope=lifetime')
  const { data: recentCashback } = useMobileApi<CashbackModel[]>('/api/qa/mobile/cashback')
  const { data: recentBonuscash } = useMobileApi<BonusCashModel[]>('/api/qa/mobile/bonuscash')

  const loading = walletLoading || cbLoading || bcLoading

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading your wallet...
        </div>
      </div>
    )
  }

  const walletBalance = wallet?.availableAmount ?? 0
  const lifetimeCashback = typeof cashbackLifetime === 'number' ? cashbackLifetime : 0
  const lifetimeBonuscash = typeof bonuscashLifetime === 'number' ? bonuscashLifetime : 0

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Wallet"
        description="Your earnings, cashback, and network gains at a glance."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Available Balance"
          value={formatCurrency(walletBalance)}
          icon={<Wallet className="h-5 w-5" />}
          accent="brand"
        />
        <SummaryCard
          label="Lifetime Cashback"
          value={formatCurrency(lifetimeCashback)}
          icon={<DollarSign className="h-5 w-5" />}
          accent="success"
        />
        <SummaryCard
          label="Network Gains"
          value={formatCurrency(lifetimeBonuscash)}
          icon={<TrendingUp className="h-5 w-5" />}
          accent="info"
        />
        <SummaryCard
          label="Wallet Status"
          value={wallet?.walletStatus || 'N/A'}
          icon={<CreditCard className="h-5 w-5" />}
          accent="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <QuickAccessCard
          title="Transactions"
          description="View your full purchase history and payment details."
          icon={<CreditCard className="h-5 w-5 text-brand-600" />}
          href="/portal/transactions"
        />
        <QuickAccessCard
          title="My Network"
          description="See your friends and the bonus cash earned from your network."
          icon={<Users className="h-5 w-5 text-indigo-600" />}
          href="/portal/network"
        />
        <QuickAccessCard
          title="Cashback"
          description="Track your cashback earnings across all purchases."
          icon={<DollarSign className="h-5 w-5 text-emerald-600" />}
          href="/portal/transactions"
        />
        <QuickAccessCard
          title="Contributions"
          description="Your charitable impact and the causes you support."
          icon={<Heart className="h-5 w-5 text-rose-600" />}
          href="/portal/contributions"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Cashback</CardTitle>
              <Link href="/portal/transactions" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                View all <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!recentCashback || recentCashback.length === 0 ? (
              <p className="text-sm text-surface-500">No cashback earned yet.</p>
            ) : (
              <div className="space-y-2">
                {recentCashback.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-surface-900">{item.title}</p>
                      <p className="text-xs text-surface-500">{formatShortDate(item.date)}</p>
                    </div>
                    <Badge variant="success">+{formatCurrency(item.amount)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Network Gains</CardTitle>
              <Link href="/portal/network" className="text-xs font-medium text-brand-600 hover:text-brand-700">
                View all <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {!recentBonuscash || recentBonuscash.length === 0 ? (
              <p className="text-sm text-surface-500">No network gains yet. Invite friends to start earning.</p>
            ) : (
              <div className="space-y-2">
                {recentBonuscash.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium text-surface-900">Network Bonus</p>
                      <p className="text-xs text-surface-500">{formatShortDate(item.date)}</p>
                    </div>
                    <Badge variant="info">+{formatCurrency(item.amount)}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {wallet?.bank && (
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-surface-100 p-2">
                <CreditCard className="h-5 w-5 text-surface-500" />
              </div>
              <div>
                <p className="text-sm font-medium text-surface-900">Linked Bank</p>
                <p className="text-xs text-surface-500">{wallet.bank}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-surface-500">Min. withdraw</p>
              <p className="text-sm font-semibold text-surface-900">{formatCurrency(wallet.minimumWithdraw)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ label, value, icon, accent }: {
  label: string
  value: string
  icon: React.ReactNode
  accent: 'brand' | 'success' | 'info' | 'neutral'
}) {
  const bgMap = {
    brand: 'bg-brand-50 text-brand-600',
    success: 'bg-emerald-50 text-emerald-600',
    info: 'bg-indigo-50 text-indigo-600',
    neutral: 'bg-surface-100 text-surface-600',
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-surface-900">{value}</p>
          </div>
          <div className={`rounded-lg p-2 ${bgMap[accent]}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QuickAccessCard({ title, description, icon, href }: {
  title: string
  description: string
  icon: React.ReactNode
  href: string
}) {
  return (
    <Link href={href}>
      <Card className="group cursor-pointer transition-all hover:border-brand-200 hover:shadow-md">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="rounded-xl bg-surface-50 p-3 transition-colors group-hover:bg-brand-50">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-surface-900">{title}</p>
            <p className="text-xs text-surface-500">{description}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-surface-300 transition-colors group-hover:text-brand-500" />
        </CardContent>
      </Card>
    </Link>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatShortDate(date: string) {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(date))
}
