'use client'

import * as React from 'react'
import { ArrowDownLeft, ArrowUpRight, CreditCard, Filter } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import type { TransactionModel } from '@/lib/server/qa-mobile-api'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function useMobileApi<T>(url: string) {
  const [data, setData] = React.useState<T | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
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

export function PortalTransactionsPage() {
  const now = new Date()
  const [year, setYear] = React.useState(now.getFullYear())
  const [month, setMonth] = React.useState(now.getMonth() + 1)
  const [viewAll, setViewAll] = React.useState(true)

  const url = viewAll
    ? '/api/qa/mobile/transactions'
    : `/api/qa/mobile/transactions?year=${year}&month=${month}`

  const { data: transactions, loading } = useMobileApi<TransactionModel[]>(url)

  const totalSpent = React.useMemo(() => {
    if (!transactions) return 0
    return transactions.reduce((sum, t) => sum + t.amount, 0)
  }, [transactions])

  const totalCashback = React.useMemo(() => {
    if (!transactions) return 0
    return transactions.reduce((sum, t) => sum + t.cashback, 0)
  }, [transactions])

  if (loading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
          Loading transactions...
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Transactions"
        description="Your complete purchase history and cashback earnings."
        breadcrumb={[
          { label: 'Wallet', href: '/portal/wallet' },
          { label: 'Transactions' },
        ]}
      />

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setViewAll(true)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
            viewAll
              ? 'bg-brand-600 text-white'
              : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          }`}
        >
          All Time
        </button>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-surface-400" />
          <select
            value={month}
            onChange={(e) => { setMonth(Number(e.target.value)); setViewAll(false) }}
            className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {MONTHS.map((name, idx) => (
              <option key={idx} value={idx + 1}>{name}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setViewAll(false) }}
            className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricCard label="Total Spent" value={formatCurrency(totalSpent)} />
        <MetricCard label="Cashback Earned" value={formatCurrency(totalCashback)} />
        <MetricCard label="Transactions" value={transactions?.length ?? 0} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions || transactions.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-8 w-8" />}
              title="No transactions found"
              description={viewAll ? 'Your transactions will appear here once you make a purchase.' : `No transactions for ${MONTHS[month - 1]} ${year}.`}
            />
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 rounded-xl border border-surface-100 bg-surface-50 px-4 py-3 transition-colors hover:bg-surface-100"
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-lg p-2 ${
                      tx.transactionType === 'Payment' || tx.transactionType === 'purchase'
                        ? 'bg-rose-50 text-rose-500'
                        : 'bg-emerald-50 text-emerald-500'
                    }`}>
                      {tx.transactionType === 'Payment' || tx.transactionType === 'purchase' ? (
                        <ArrowUpRight className="h-4 w-4" />
                      ) : (
                        <ArrowDownLeft className="h-4 w-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-surface-900">{tx.title}</p>
                      <p className="text-xs text-surface-500">{formatDateTime(tx.dateTime)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-right">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{formatCurrency(tx.amount)}</p>
                      {tx.cashback > 0 && (
                        <p className="text-xs text-emerald-600">+{formatCurrency(tx.cashback)} back</p>
                      )}
                    </div>
                    <Badge variant={tx.transactionStatus === 'Completed' || tx.transactionStatus === 'completed' ? 'success' : 'warning'}>
                      {tx.transactionStatus}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-2 p-5">
        <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
        <p className="text-2xl font-bold text-surface-900">{value}</p>
      </CardContent>
    </Card>
  )
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
}

function formatDateTime(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(date))
}
