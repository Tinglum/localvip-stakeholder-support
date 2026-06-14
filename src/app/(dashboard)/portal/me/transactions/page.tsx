'use client'

import * as React from 'react'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Receipt,
  RefreshCw,
  Search,
  TriangleAlert,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface PortalTransaction {
  id: number
  title: string | null
  amount: number
  tip: number
  cashback: number
  walletAmount: number
  transactionStatus: string | null
  transactionType: string | null
  dateTime: string | null
}

interface TransactionsResponse {
  ok?: boolean
  endpoint?: string
  count?: number
  transactions?: PortalTransaction[]
  error?: string
}

type SortKey = 'dateTime' | 'title' | 'amount' | 'tip' | 'cashback' | 'transactionType' | 'transactionStatus'
type SortDir = 'asc' | 'desc'

const ALL = '__all__'

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

function formatDate(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function statusVariant(status: string | null): React.ComponentProps<typeof Badge>['variant'] {
  const s = (status || '').toLowerCase()
  if (/(complete|completed|succeeded|paid|success)/.test(s)) return 'success'
  if (/(pending|processing)/.test(s)) return 'warning'
  if (/(cancel|fail|declined|error)/.test(s)) return 'danger'
  return 'default'
}

function csvCell(value: string | number | null): string {
  const str = value == null ? '' : String(value)
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export default function MyTransactionsPage() {
  const [rows, setRows] = React.useState<PortalTransaction[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [search, setSearch] = React.useState('')
  const [typeFilter, setTypeFilter] = React.useState<string>(ALL)
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [sortKey, setSortKey] = React.useState<SortKey>('dateTime')
  const [sortDir, setSortDir] = React.useState<SortDir>('desc')

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/me/transactions', { cache: 'no-store' })
      const json = (await res.json().catch(() => null)) as TransactionsResponse | null
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error || 'Unable to load your transactions.')
      }
      setRows(Array.isArray(json.transactions) ? json.transactions : [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load your transactions.')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  const types = React.useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      if (r.transactionType) set.add(r.transactionType)
    }
    return Array.from(set).sort()
  }, [rows])

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    const fromTs = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toTs = to ? new Date(`${to}T23:59:59`).getTime() : null

    const result = rows.filter((r) => {
      if (typeFilter !== ALL && r.transactionType !== typeFilter) return false

      if (fromTs != null || toTs != null) {
        const ts = r.dateTime ? new Date(r.dateTime).getTime() : NaN
        if (Number.isNaN(ts)) return false
        if (fromTs != null && ts < fromTs) return false
        if (toTs != null && ts > toTs) return false
      }

      if (term) {
        const haystack = [
          r.title,
          r.transactionType,
          r.transactionStatus,
          String(r.amount),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(term)) return false
      }

      return true
    })

    const dir = sortDir === 'asc' ? 1 : -1
    result.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'title':
        case 'transactionType':
        case 'transactionStatus':
          cmp = (a[sortKey] || '').localeCompare(b[sortKey] || '')
          break
        case 'dateTime': {
          const ta = a.dateTime ? new Date(a.dateTime).getTime() : 0
          const tb = b.dateTime ? new Date(b.dateTime).getTime() : 0
          cmp = ta - tb
          break
        }
        default:
          cmp = (a[sortKey] as number) - (b[sortKey] as number)
      }
      return cmp * dir
    })

    return result
  }, [rows, search, typeFilter, from, to, sortKey, sortDir])

  const totals = React.useMemo(() => {
    return filtered.reduce(
      (acc, r) => {
        acc.amount += r.amount
        acc.tip += r.tip
        acc.cashback += r.cashback
        return acc
      },
      { amount: 0, tip: 0, cashback: 0 },
    )
  }, [filtered])

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir(key === 'title' || key === 'transactionType' || key === 'transactionStatus' ? 'asc' : 'desc')
    }
  }

  const hasFilters = search.trim() !== '' || typeFilter !== ALL || from !== '' || to !== ''
  const clearFilters = () => {
    setSearch('')
    setTypeFilter(ALL)
    setFrom('')
    setTo('')
  }

  const exportCsv = () => {
    const headers = [
      'Date',
      'Title',
      'Type',
      'Status',
      'Amount',
      'Tip',
      'Cashback',
      'Wallet Amount',
    ]
    const lines = [headers.join(',')]
    for (const r of filtered) {
      lines.push(
        [
          csvCell(r.dateTime ? formatDate(r.dateTime) : ''),
          csvCell(r.title),
          csvCell(r.transactionType),
          csvCell(r.transactionStatus),
          csvCell(r.amount.toFixed(2)),
          csvCell(r.tip.toFixed(2)),
          csvCell(r.cashback.toFixed(2)),
          csvCell(r.walletAmount.toFixed(2)),
        ].join(','),
      )
    }
    // Totals row
    lines.push(
      [
        csvCell('TOTALS'),
        '',
        '',
        '',
        csvCell(totals.amount.toFixed(2)),
        csvCell(totals.tip.toFixed(2)),
        csvCell(totals.cashback.toFixed(2)),
        '',
      ].join(','),
    )

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `my-transactions-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeader
        title="My Transactions"
        description="Review your purchases, tips, and cashback. Filter, sort, and export anything you see."
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'My Transactions' }]}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              Refresh
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={exportCsv}
              disabled={loading || filtered.length === 0}
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </>
        }
      />

      {/* Summary stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryTile label="Transactions" value={String(filtered.length)} />
        <SummaryTile label="Total spent" value={currency.format(totals.amount)} />
        <SummaryTile label="Total tips" value={currency.format(totals.tip)} />
        <SummaryTile label="Total cashback" value={currency.format(totals.cashback)} accent />
      </div>

      {/* Filters */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-surface-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search title, type, status, amount…"
                className="pl-9"
              />
            </div>
          </div>

          <div className="w-full lg:w-44">
            <label className="mb-1 block text-xs font-medium text-surface-500">Type</label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All types</SelectItem>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full lg:w-40">
            <label className="mb-1 block text-xs font-medium text-surface-500">From</label>
            <Input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>

          <div className="w-full lg:w-40">
            <label className="mb-1 block text-xs font-medium text-surface-500">To</label>
            <Input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="shrink-0">
              Clear
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Error */}
      {error && !loading && (
        <Card className="mb-4 border-danger-200">
          <CardContent className="flex items-start gap-3">
            <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-danger-500" />
            <div className="flex-1">
              <p className="text-sm font-medium text-surface-900">Couldn’t load your transactions</p>
              <p className="mt-0.5 text-sm text-surface-500">{error}</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        {loading ? (
          <TableSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-8 w-8" />}
            title={rows.length === 0 ? 'No transactions yet' : 'No matching transactions'}
            description={
              rows.length === 0
                ? 'When you make a purchase, it will show up here.'
                : 'Try adjusting your search or filters.'
            }
            action={hasFilters ? { label: 'Clear filters', onClick: clearFilters } : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-surface-200 text-left text-xs uppercase tracking-wide text-surface-500">
                  <SortableTh label="Date" col="dateTime" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Title" col="title" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Type" col="transactionType" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Status" col="transactionStatus" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} />
                  <SortableTh label="Amount" col="amount" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="Tip" col="tip" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                  <SortableTh label="Cashback" col="cashback" sortKey={sortKey} sortDir={sortDir} onSort={toggleSort} align="right" />
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr key={r.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50">
                    <td className="whitespace-nowrap px-4 py-2.5 text-surface-600">{formatDate(r.dateTime)}</td>
                    <td className="px-4 py-2.5 font-medium text-surface-900">{r.title || '—'}</td>
                    <td className="px-4 py-2.5 text-surface-600">{r.transactionType || '—'}</td>
                    <td className="px-4 py-2.5">
                      {r.transactionStatus ? (
                        <Badge variant={statusVariant(r.transactionStatus)}>{r.transactionStatus}</Badge>
                      ) : (
                        <span className="text-surface-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-surface-900">{currency.format(r.amount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-surface-600">{currency.format(r.tip)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-medium text-success-700">
                      {currency.format(r.cashback)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-surface-200 bg-surface-50 font-semibold text-surface-900">
                  <td className="px-4 py-3" colSpan={4}>
                    Totals ({filtered.length} {filtered.length === 1 ? 'row' : 'rows'})
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{currency.format(totals.amount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{currency.format(totals.tip)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-success-700">{currency.format(totals.cashback)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}

function SummaryTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="py-4">
        <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</p>
        <p className={cn('mt-1 text-xl font-semibold tabular-nums', accent ? 'text-success-700' : 'text-surface-900')}>
          {value}
        </p>
      </CardContent>
    </Card>
  )
}

function SortableTh({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  align = 'left',
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  align?: 'left' | 'right'
}) {
  const active = sortKey === col
  return (
    <th className={cn('px-4 py-3 font-medium', align === 'right' && 'text-right')}>
      <button
        type="button"
        onClick={() => onSort(col)}
        className={cn(
          'inline-flex items-center gap-1 transition-colors hover:text-surface-800',
          align === 'right' && 'flex-row-reverse',
          active && 'text-surface-900',
        )}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ArrowUp className="h-3 w-3" />
          ) : (
            <ArrowDown className="h-3 w-3" />
          )
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </th>
  )
}

function TableSkeleton() {
  return (
    <div className="divide-y divide-surface-100">
      <div className="flex gap-4 px-4 py-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="h-3 flex-1 animate-pulse rounded bg-surface-200" />
        ))}
      </div>
      {Array.from({ length: 8 }).map((_, row) => (
        <div key={row} className="flex gap-4 px-4 py-3.5">
          {Array.from({ length: 7 }).map((_, i) => (
            <div key={i} className="h-4 flex-1 animate-pulse rounded bg-surface-100" />
          ))}
        </div>
      ))}
    </div>
  )
}
