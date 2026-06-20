'use client'

import * as React from 'react'
import { Plus, Copy, Send, Users, CheckCircle2, Link2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { resolveScopedBusiness } from '@/lib/business-portal'
import { useBusinesses } from '@/lib/supabase/hooks'
import { formatDate } from '@/lib/utils'

function getBusinessQaAccountId(business: { external_id?: string | null; metadata?: Record<string, unknown> | null } | null): string | null {
  if (!business) return null
  if (business.external_id && /^\d+$/.test(business.external_id.trim())) return business.external_id.trim()
  const meta = (business.metadata ?? {}) as Record<string, unknown>
  const candidate = meta.qaAccountId ?? meta.qaBusinessId ?? meta.qa_account_id
  return typeof candidate === 'string' && /^\d+$/.test(candidate.trim()) ? candidate.trim() : null
}

interface BoomerangEntry {
  id: number
  firstName: string | null
  phone: string | null
  email: string | null
  status: string
  createdAt: string
}
interface BoomerangMetrics {
  slug?: string | null
  businessName?: string | null
  total: number
  added: number
  invited: number
  converted: number
  addedToday: number
  cap: number
  remaining: number
}

function statusBadge(status: string) {
  if (status === 'converted') return <Badge className="bg-emerald-100 text-emerald-700">Customer</Badge>
  if (status === 'invited' || status === 'ready_for_conversion') return <Badge className="bg-amber-100 text-amber-700">Invited</Badge>
  return <Badge variant="outline">On list</Badge>
}

export function BusinessBoomerang100ListPage() {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(() => {
    const f: Record<string, string> = {}
    if (profile.business_id) f.id = profile.business_id
    else f.owner_id = profile.id
    return f
  }, [profile.business_id, profile.id])
  const { data: businesses, loading: businessesLoading } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  const accountId = getBusinessQaAccountId(business)

  const [metrics, setMetrics] = React.useState<BoomerangMetrics | null>(null)
  const [entries, setEntries] = React.useState<BoomerangEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [form, setForm] = React.useState({ firstName: '', phone: '', email: '' })
  const [adding, setAdding] = React.useState(false)
  const [convertLink, setConvertLink] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<number | null>(null)
  const [copied, setCopied] = React.useState(false)

  const load = React.useCallback(async () => {
    if (!accountId) { setLoading(false); return }
    setLoading(true)
    try {
      const [m, l] = await Promise.all([
        fetch(`/api/dashboard/boomerang/${accountId}/metrics`, { cache: 'no-store' }).then((r) => r.json()).catch(() => null),
        fetch(`/api/dashboard/boomerang/${accountId}`, { cache: 'no-store' }).then((r) => r.json()).catch(() => ({ items: [] })),
      ])
      setMetrics(m)
      setEntries(Array.isArray(l?.items) ? l.items : [])
    } finally {
      setLoading(false)
    }
  }, [accountId])

  React.useEffect(() => { void load() }, [load])

  const joinUrl = React.useMemo(() => {
    if (typeof window === 'undefined' || !metrics?.slug) return null
    return `${window.location.origin}/boomerang/${metrics.slug}`
  }, [metrics?.slug])

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!accountId || (!form.phone.trim() && !form.email.trim())) return
    setAdding(true)
    try {
      await fetch(`/api/dashboard/boomerang/${accountId}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName: form.firstName, phone: form.phone, email: form.email, source: 'manual' }),
      })
      setForm({ firstName: '', phone: '', email: '' })
      await load()
    } finally {
      setAdding(false)
    }
  }

  const convert = async (entryId: number) => {
    if (!accountId) return
    setBusyId(entryId)
    setConvertLink(null)
    try {
      const res = await fetch(`/api/dashboard/boomerang/${accountId}/convert`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ entryId }),
      })
      const data = await res.json().catch(() => ({}))
      if (data?.conversionUrl) setConvertLink(data.conversionUrl)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  if (businessesLoading || loading) {
    return <div className="p-8 text-sm text-surface-500">Loading your 100-list…</div>
  }
  if (!accountId) {
    return (
      <EmptyState
        icon={<Users className="h-8 w-8" />}
        title="Your 100-list will show up here"
        description="We couldn't find your business details for this account yet."
      />
    )
  }

  const total = metrics?.total ?? entries.length
  const pct = Math.min(100, Math.round((total / (metrics?.cap || 100)) * 100))

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="My 100 List"
        description="Your pre-launch list. People here are NOT customers yet — they only become customers when they accept your invite."
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: '100 List' }]}
      />

      {/* progress + metrics */}
      <Card>
        <CardContent className="p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-surface-800">{total} of {metrics?.cap ?? 100} on your list</span>
            <span className="text-surface-500">{metrics?.remaining ?? Math.max(0, 100 - total)} to go</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-100">
            <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="On list" value={metrics?.added ?? 0} />
            <Metric label="Invited" value={metrics?.invited ?? 0} />
            <Metric label="Became customers" value={metrics?.converted ?? 0} />
            <Metric label="Added today" value={metrics?.addedToday ?? 0} />
          </div>
        </CardContent>
      </Card>

      {/* dedicated 100-list QR/link */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base"><Link2 className="h-4 w-4" /> Your 100-list link</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-surface-500">
            Share this dedicated link (or its QR). Anyone who joins is added to your 100-list only — it never
            creates a customer account.
          </p>
          {joinUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="rounded-lg bg-surface-100 px-3 py-2 text-sm">{joinUrl}</code>
              <Button variant="outline" size="sm" className="gap-1" onClick={() => { void navigator.clipboard.writeText(joinUrl); setCopied(true); setTimeout(() => setCopied(false), 1500) }}>
                <Copy className="h-4 w-4" /> {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={joinUrl} target="_blank" rel="noreferrer">Open</a>
              </Button>
            </div>
          ) : (
            <p className="text-sm text-surface-400">Link unavailable (business slug not found).</p>
          )}
        </CardContent>
      </Card>

      {/* add */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Add someone manually</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={add} className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input placeholder="First name" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <Button type="submit" disabled={adding} className="gap-1"><Plus className="h-4 w-4" /> Add</Button>
          </form>
        </CardContent>
      </Card>

      {convertLink ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <Send className="h-4 w-4 text-amber-700" />
            <span className="text-amber-800">Send this activation link to the person — they finish it themselves:</span>
            <code className="rounded bg-white px-2 py-1 text-xs">{convertLink}</code>
            <Button variant="outline" size="sm" onClick={() => void navigator.clipboard.writeText(convertLink)}>Copy</Button>
          </CardContent>
        </Card>
      ) : null}

      {/* list */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">People on your list</CardTitle></CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-surface-400">No one on your 100-list yet. Share your link above.</p>
          ) : (
            <div className="divide-y divide-surface-100">
              {entries.map((e) => (
                <div key={e.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-surface-900">{e.firstName || e.phone || e.email || 'Member'}</p>
                    <p className="truncate text-xs text-surface-500">
                      {[e.phone, e.email].filter(Boolean).join(' · ')} · added {formatDate(e.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {statusBadge(e.status)}
                    {e.status === 'converted' ? (
                      <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> Joined</span>
                    ) : (
                      <Button variant="outline" size="sm" disabled={busyId === e.id} onClick={() => convert(e.id)}>
                        {busyId === e.id ? '…' : (e.status === 'invited' || e.status === 'ready_for_conversion') ? 'Resend invite' : 'Invite to convert'}
                      </Button>
                    )}
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-surface-50 px-3 py-2">
      <div className="text-lg font-bold text-surface-900">{value}</div>
      <div className="text-xs text-surface-500">{label}</div>
    </div>
  )
}
