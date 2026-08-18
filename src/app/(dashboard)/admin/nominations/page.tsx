'use client'

import * as React from 'react'
import { AlertTriangle, Loader2, RefreshCw, Search, Store } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { NominationCard, NOMINATION_STATUSES, type Nomination } from '@/components/nominations/nomination-card'

export default function AdminNominationsPage() {
  const [items, setItems] = React.useState<Nomination[]>([])
  const [total, setTotal] = React.useState(0)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [savingId, setSavingId] = React.useState<string | null>(null)
  const [status, setStatus] = React.useState('received')
  const [search, setSearch] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const qs = new URLSearchParams({ limit: '100' })
      if (status) qs.set('status', status)
      const res = await fetch(`/api/admin/nominations?${qs}`, { cache: 'no-store' })
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        setItems([])
        setTotal(0)
        setError(body?.error || 'Business nominations could not be loaded.')
        return
      }
      const list: Nomination[] = Array.isArray(body?.items) ? body.items : []
      setItems(list)
      setTotal(typeof body?.total === 'number' ? body.total : list.length)
    } catch {
      setItems([])
      setTotal(0)
      setError('Business nominations could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [status])

  React.useEffect(() => { void load() }, [load])

  async function changeStatus(id: string | number, next: string) {
    setSavingId(String(id))
    try {
      const res = await fetch(`/api/admin/nominations/${encodeURIComponent(String(id))}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error || 'That nomination could not be updated.')
        return
      }
      setError(null)
      // A filtered view drops the row once it leaves that stage; the all-stages view keeps it.
      setItems((prev) => (status
        ? prev.filter((n) => String(n.id) !== String(id))
        : prev.map((n) => (String(n.id) === String(id) ? { ...n, status: next } : n))))
      setTotal((t) => (status ? Math.max(0, t - 1) : t))
    } catch {
      setError('That nomination could not be updated.')
    } finally {
      setSavingId(null)
    }
  }

  // Warmest lead first: most people asking, then most recent.
  const visible = React.useMemo(() => {
    const term = search.trim().toLowerCase()
    const rows = term
      ? items.filter((n) => [n.businessName, n.city, n.contactName, n.contactEmail, n.reason, n.nominatedByName]
          .some((v) => String(v || '').toLowerCase().includes(term)))
      : items
    return [...rows].sort((a, b) => {
      const diff = Number(b.nominationCount || 1) - Number(a.nominationCount || 1)
      if (diff !== 0) return diff
      return String(b.createdAtUtc || '').localeCompare(String(a.createdAtUtc || ''))
    })
  }, [items, search])

  const counts = React.useMemo(() => ({
    shown: visible.length,
    multi: visible.filter((n) => Number(n.nominationCount || 1) > 1).length,
    hot: visible.filter((n) => Number(n.nominationCount || 1) >= 3).length,
  }), [visible])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business nominations"
        description="Local businesses that customers and owners asked us to bring onto LocalVIP. Every row is a warm lead — someone who shops there vouched for it."
        actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh</Button>}
      />

      {/* Pipeline counters */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'In this view', value: counts.shown },
          { label: 'Total in stage', value: total },
          { label: 'Asked twice+', value: counts.multi },
          { label: 'Asked 3+ times', value: counts.hot, danger: true },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-surface-500">{s.label}</p>
            <p className={`mt-1 text-2xl font-semibold ${s.danger ? 'text-danger-600' : 'text-surface-900'}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pipeline stage chips */}
      <div className="flex flex-wrap items-center gap-2">
        {NOMINATION_STATUSES.map((s) => (
          <button
            key={s.value}
            onClick={() => setStatus(s.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${status === s.value ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:bg-surface-50'}`}
          >
            {s.label}
          </button>
        ))}
        <button
          onClick={() => setStatus('')}
          className={`rounded-full border px-3 py-1 text-xs font-medium ${status === '' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-600 hover:bg-surface-50'}`}
        >
          All stages
        </button>
        <div className="relative ml-auto min-w-[200px] max-w-xs flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search nominations..." className="pl-9" />
        </div>
      </div>

      {error && (
        <Card className="flex items-start gap-3 border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0">
            <p className="font-medium">{error}</p>
            <button onClick={() => void load()} className="mt-1 text-xs underline">Try again</button>
          </div>
        </Card>
      )}

      {loading ? (
        <Card className="flex items-center justify-center py-16 text-surface-400"><Loader2 className="h-6 w-6 animate-spin" /></Card>
      ) : visible.length === 0 && !error ? (
        <Card>
          <EmptyState
            icon={<Store className="h-6 w-6" />}
            title="No nominations in this stage"
            description={search.trim()
              ? 'No nomination matches that search. Try a different name or city.'
              : 'When a customer nominates a business that is not on LocalVIP yet, it lands here as a warm lead.'}
            action={{ label: 'Refresh', onClick: () => void load() }}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((n) => (
            <NominationCard
              key={String(n.id)}
              nomination={n}
              saving={savingId === String(n.id)}
              onStatusChange={changeStatus}
            />
          ))}
        </div>
      )}
    </div>
  )
}
