'use client'

import * as React from 'react'
import { Loader2, Search, Receipt, ChevronRight, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/lib/auth/context'
import { isSuperAdminRole } from '@/lib/auth/display-name'

// Types mirror the QA DTOs. Redefined here (not imported from lib/auth/qa-api)
// because that module pulls in next/headers and must not reach the client bundle.
interface TransactionListItem {
  id: number
  date: string | null
  status: string | null
  fromName: string
  fromCity: string
  fromState: string
  toName: string
  toCity: string
  toState: string
  paymentIntentId: string | null
  transferId: string | null
  customerId: string | null
  destinationAccountId: string | null
  purchaseCents: number
  tipCents: number
  totalCents: number
  cashbackCents: number
  marketingCents: number
  txFeeCents: number
  totalFeeCents: number
  netReceivedCents: number
}

interface TransactionListResponse {
  items: TransactionListItem[]
  page: number
  pageSize: number
  totalCount: number
}

interface BreakdownRow {
  level: number
  item: string
  amountCents: number
  percent: number
  key: string
}

interface Breakdown {
  transactionId: number
  paymentId: string | null
  paymentIntentId: string | null
  businessName: string
  totalPaymentCents: number
  tipCents: number
  applicationFeePct: number
  businessPct: number
  economicsVersion: number
  isGiveBackDay: boolean
  rows: BreakdownRow[]
}

const PAGE_SIZE = 100

function usd(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)
}

function formatWhen(iso: string | null) {
  if (!iso) return { date: '—', time: '' }
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return { date: iso, time: '' }
  return {
    date: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }),
    time: d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
  }
}

function StatusBadge({ status }: { status: string | null }) {
  const s = (status || '').toLowerCase()
  const ok = s === 'succeeded' || s === 'completed' || s === 'paid'
  return (
    <Badge variant="outline" className={ok ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'text-surface-500'}>
      {status || 'unknown'}
    </Badge>
  )
}

function IdField({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-surface-400">{label}</p>
      <p className="truncate font-mono text-xs text-surface-700" title={value}>{value}</p>
    </div>
  )
}

export default function TransactionsPage() {
  const { profile } = useAuth()
  const isSysAdmin = isSuperAdminRole(profile?.role, profile?.role_subtype)

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [page, setPage] = React.useState(1)
  const [data, setData] = React.useState<TransactionListResponse | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<TransactionListItem | null>(null)

  React.useEffect(() => {
    const t = setTimeout(() => { setDebounced(search); setPage(1) }, 350)
    return () => clearTimeout(t)
  }, [search])

  React.useEffect(() => {
    if (!isSysAdmin) return
    let cancelled = false
    setLoading(true)
    setError(null)
    const params = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) })
    if (debounced.trim()) params.set('search', debounced.trim())
    fetch(`/api/qa/transactions?${params.toString()}`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || 'Failed to load transactions.')
        return body as TransactionListResponse
      })
      .then((body) => { if (!cancelled) setData(body) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load transactions.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isSysAdmin, debounced, page])

  if (!isSysAdmin) {
    return (
      <div className="space-y-6">
        <PageHeader title="Transactions" description="Payments, fees, and per-transaction allocation breakdown." />
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <ShieldAlert className="h-8 w-8 text-surface-400" />
            <p className="font-semibold text-surface-900">SysAdmin access required</p>
            <p className="max-w-md text-sm text-surface-500">
              This page shows every payment across the platform, so it is limited to SysAdmins.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const items = data?.items ?? []
  const totalPages = data ? Math.max(1, Math.ceil(data.totalCount / data.pageSize)) : 1

  return (
    <div className="space-y-6">
      <PageHeader title="Transactions" description="Payments, fees, and per-transaction allocation breakdown." />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by business or customer name, city, or state…"
            className="pl-9"
          />
        </div>
        {data ? (
          <p className="text-sm text-surface-500">{data.totalCount.toLocaleString()} transactions</p>
        ) : null}
      </div>

      {error ? (
        <Card><CardContent className="py-6 text-sm text-red-600">{error}</CardContent></Card>
      ) : loading && !data ? (
        <Card><CardContent className="flex items-center justify-center gap-2 py-16 text-surface-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading transactions…
        </CardContent></Card>
      ) : items.length === 0 ? (
        <EmptyState icon={<Receipt className="h-8 w-8 text-surface-400" />} title="No transactions" description="No transactions match your search." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-sm">
                <thead>
                  <tr className="border-b border-surface-100 text-left text-[11px] uppercase tracking-wide text-surface-400">
                    <th className="px-4 py-3 font-semibold">ID &amp; Date</th>
                    <th className="px-4 py-3 font-semibold">Stripe IDs</th>
                    <th className="px-4 py-3 font-semibold">Transfer</th>
                    <th className="px-4 py-3 text-right font-semibold">Amounts</th>
                    <th className="px-4 py-3 text-right font-semibold">Fees &amp; Net</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((t) => {
                    const when = formatWhen(t.date)
                    return (
                      <tr key={t.id} className="border-b border-surface-50 align-top hover:bg-surface-50/60">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-primary">#{t.id}</p>
                          <p className="text-xs text-surface-500">{when.date}</p>
                          <p className="text-xs text-surface-400">{when.time}</p>
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            <IdField label="Payment Intent" value={t.paymentIntentId} />
                            <IdField label="Transfer" value={t.transferId} />
                            <IdField label="Destination" value={t.destinationAccountId} />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs text-surface-400">FROM</p>
                          <p className="font-medium text-surface-800">{t.fromName || '—'}</p>
                          <p className="mt-1 text-xs text-surface-400">TO</p>
                          <p className="font-medium text-surface-800">{t.toName || '—'}</p>
                          <p className="text-xs text-surface-500">{[t.toCity, t.toState].filter(Boolean).join(', ')}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-between gap-6"><span className="text-surface-500">Purchase</span><span>{usd(t.purchaseCents)}</span></div>
                          <div className="flex justify-between gap-6"><span className="text-surface-500">Tip</span><span>{usd(t.tipCents)}</span></div>
                          <div className="mt-1 flex justify-between gap-6 border-t border-surface-100 pt-1 font-semibold"><span>Total</span><span>{usd(t.totalCents)}</span></div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-between gap-6"><span className="text-surface-500">Cashback</span><span>{usd(t.cashbackCents)}</span></div>
                          <div className="flex justify-between gap-6"><span className="text-surface-500">Total fee</span><span className="text-red-600">{usd(t.totalFeeCents)}</span></div>
                          <div className="mt-1 flex justify-between gap-6 border-t border-surface-100 pt-1 font-semibold"><span>Net recv.</span><span className="text-emerald-600">{usd(t.netReceivedCents)}</span></div>
                        </td>
                        <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
                        <td className="px-4 py-3">
                          <Button variant="outline" size="sm" onClick={() => setSelected(t)}>
                            Breakdown <ChevronRight className="ml-1 h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {data && totalPages > 1 ? (
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
          <span className="text-sm text-surface-500">Page {page} of {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => setPage((p) => p + 1)}>Next</Button>
        </div>
      ) : null}

      <BreakdownDialog transaction={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function BreakdownDialog({ transaction, onClose }: { transaction: TransactionListItem | null; onClose: () => void }) {
  const [breakdown, setBreakdown] = React.useState<Breakdown | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!transaction) { setBreakdown(null); setError(null); return }
    let cancelled = false
    setLoading(true)
    setError(null)
    setBreakdown(null)
    fetch(`/api/qa/transactions/${transaction.id}/breakdown`, { cache: 'no-store' })
      .then(async (res) => {
        const body = await res.json().catch(() => null)
        if (!res.ok) throw new Error(body?.error || 'The payment breakdown is unavailable.')
        return body as Breakdown
      })
      .then((body) => { if (!cancelled) setBreakdown(body) })
      .catch((e) => { if (!cancelled) setError(e instanceof Error ? e.message : 'The payment breakdown is unavailable.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [transaction])

  const indent = ['', 'pl-4', 'pl-8', 'pl-12']

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Payment Breakdown</DialogTitle>
          <DialogDescription>Detailed view of payment distribution</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-12 text-surface-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading breakdown…
          </div>
        ) : error ? (
          <div className="py-8 text-center text-sm text-surface-500">{error}</div>
        ) : breakdown ? (
          <div className="space-y-4">
            <div className="flex items-start justify-between rounded-2xl bg-surface-50 p-4">
              <div>
                <p className="text-xs text-surface-400">Purchase (split basis)</p>
                <p className="text-2xl font-bold text-surface-900">{usd(breakdown.totalPaymentCents)} <span className="text-sm font-normal text-surface-400">USD</span></p>
                {breakdown.tipCents > 0 ? (
                  <p className="mt-1 text-xs text-surface-500">+ {usd(breakdown.tipCents)} tip · paid in full to the business, not part of the split</p>
                ) : null}
              </div>
              <div className="text-right">
                <p className="text-xs text-surface-400">Payment ID</p>
                <p className="font-mono text-xs text-surface-700">{breakdown.paymentId || breakdown.paymentIntentId || '—'}</p>
                <p className="mt-1 text-xs text-surface-400">Business</p>
                <p className="text-sm font-medium text-surface-800">{breakdown.businessName}</p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-surface-400">Distribution</p>
              <div className="flex h-5 overflow-hidden rounded-full text-[10px] font-medium leading-5 text-white">
                <div className="bg-primary text-center" style={{ width: `${Math.max(breakdown.applicationFeePct, 0)}%` }}>
                  {breakdown.applicationFeePct >= 8 ? `App ${breakdown.applicationFeePct}%` : ''}
                </div>
                <div className="bg-emerald-500 text-center" style={{ width: `${Math.max(breakdown.businessPct, 0)}%` }}>
                  {breakdown.businessPct >= 8 ? `Business ${breakdown.businessPct}%` : ''}
                </div>
              </div>
            </div>

            <div className="overflow-hidden rounded-2xl border border-surface-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50 text-left text-[11px] uppercase tracking-wide text-surface-400">
                    <th className="px-4 py-2 font-semibold">Item</th>
                    <th className="px-4 py-2 text-right font-semibold">Amount</th>
                    <th className="px-4 py-2 text-right font-semibold">Percent</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.rows.map((r, i) => (
                    <tr key={`${r.key}-${i}`} className={`border-b border-surface-50 ${r.level === 1 ? 'font-semibold text-surface-900' : 'text-surface-700'}`}>
                      <td className={`px-4 py-2 ${indent[Math.min(r.level - 1, 3)]}`}>{r.level > 1 ? '↳ ' : ''}{r.item}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{usd(r.amountCents)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{r.percent.toFixed(2)}%</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-50 font-semibold text-surface-900">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right tabular-nums">{usd(breakdown.totalPaymentCents)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">100%</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {breakdown.isGiveBackDay ? (
              <p className="text-xs text-surface-400">Give Back Day pricing · economics v{breakdown.economicsVersion}</p>
            ) : (
              <p className="text-xs text-surface-400">Economics v{breakdown.economicsVersion}</p>
            )}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
