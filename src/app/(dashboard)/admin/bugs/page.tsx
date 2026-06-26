'use client'

import * as React from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Bug, Download, Loader2, RefreshCw, Search, Trash2, X, ExternalLink, Link2, ArrowUp, ArrowDown, UserCheck, RotateCcw, Sparkles, FileDown } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import type { BugReport, BugReportSettings, BugReportStats } from '@/lib/bug-center/types'

const PRIORITIES = [
  { value: 'urgent', label: 'URGENT', variant: 'danger' as const, rank: 3 },
  { value: 'need', label: 'Need to have', variant: 'info' as const, rank: 2 },
  { value: 'nice', label: 'Nice to have', variant: 'default' as const, rank: 1 },
]
const CATEGORIES = [
  { value: 'ui_ux', label: 'UI / UX' },
  { value: 'code', label: 'Code' },
  { value: 'functionality', label: 'Functionality' },
]
const STATUSES = [
  { value: 'open', label: 'Open', variant: 'warning' as const },
  { value: 'in_progress', label: 'In progress', variant: 'info' as const },
  { value: 'resolved', label: 'Resolved', variant: 'success' as const },
  { value: 'wont_fix', label: "Won't fix", variant: 'default' as const },
]
const APPS = [
  { value: 'dashboard', label: 'Dashboard' },
  { value: 'webapp', label: 'Webapp' },
]
const lab = (l: { value: string; label: string }[], v: string) => l.find((x) => x.value === v)?.label || v
const priVariant = (p: string) => PRIORITIES.find((x) => x.value === p)?.variant || 'default'
const priRank = (p: string) => PRIORITIES.find((x) => x.value === p)?.rank || 0
const stVariant = (s: string) => STATUSES.find((x) => x.value === s)?.variant || 'default'

// Feature: friendly browser/OS from the user agent.
function parseUA(ua?: string | null) {
  if (!ua) return '—'
  const os = /Windows NT/.test(ua) ? 'Windows' : /Mac OS X/.test(ua) ? 'macOS' : /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'Unknown OS'
  const br = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Unknown browser'
  return `${br} · ${os}`
}

// Build a complete Claude-ready markdown brief for a single bug.
function buildClaudeMd(r: BugReport): string {
  const env = parseUA(r.userAgent)
  const NL = String.fromCharCode(10)
  const join = (raw: string | null | undefined) => safeParse(raw).map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join(NL) || '(none)'
  const shot = r.screenshotUrl ? `https://qa.localvip.com${r.screenshotUrl}` : '(none)'
  return [
    `# Bug #${r.id} — ${(r.whatWrong || '').slice(0, 90)}`,
    '',
    `- **App:** ${lab(APPS, String(r.app))}`,
    `- **Priority:** ${lab(PRIORITIES, String(r.priority))}`,
    `- **Category:** ${lab(CATEGORIES, String(r.category))}`,
    `- **Status:** ${lab(STATUSES, String(r.status))}`,
    `- **Reported by:** ${r.reporterName || '—'}${r.createdAt ? ` on ${r.createdAt}` : ''}`,
    `- **Page:** ${r.pageUrl || '—'}`,
    `- **Environment:** ${env} · ${r.viewport || '—'}`,
    `- **Tags:** ${(r.tags || []).join(', ') || '—'}`,
    '',
    '## What was wrong',
    r.whatWrong || '—',
    '',
    '## What should have happened',
    r.expectedBehavior || '—',
    '',
    '## Console errors',
    '```',
    join(r.consoleErrors),
    '```',
    '',
    '## Failed network requests',
    '```',
    join(r.networkErrors),
    '```',
    '',
    '## Screenshot',
    shot,
    '',
    '---',
    `Please reproduce and fix this in the LocalVIP ${lab(APPS, String(r.app))} (Next.js) — and the QA C# backend if it is server-side. Use the page URL, console/network errors, and screenshot above as evidence.`,
  ].join(NL)
}

type SortKey = 'createdAt' | 'priority' | 'status' | 'category' | 'app'

export default function BugCenterPage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-sm text-surface-400">Loading Bug Center…</div>}>
      <BugCenterInner />
    </React.Suspense>
  )
}

function BugCenterInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [reports, setReports] = React.useState<BugReport[]>([])
  const [stats, setStats] = React.useState<BugReportStats | null>(null)
  const [settings, setSettings] = React.useState<BugReportSettings>({ enabledDashboard: false, enabledWebapp: false })
  const [meId, setMeId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [savingFlag, setSavingFlag] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [detail, setDetail] = React.useState<BugReport | null>(null)
  const [lightbox, setLightbox] = React.useState<string | null>(null)

  // Filters (initialised from the URL → shareable filtered views + deep-link).
  const [fPriority, setFPriority] = React.useState(searchParams.get('priority') || '')
  const [fCategory, setFCategory] = React.useState(searchParams.get('category') || '')
  const [fStatus, setFStatus] = React.useState(searchParams.get('status') || '')
  const [fApp, setFApp] = React.useState(searchParams.get('app') || '')
  const [search, setSearch] = React.useState(searchParams.get('search') || '')
  const [dateFrom, setDateFrom] = React.useState(searchParams.get('from') || '')
  const [dateTo, setDateTo] = React.useState(searchParams.get('to') || '')
  const [sortKey, setSortKey] = React.useState<SortKey>((searchParams.get('sort') as SortKey) || 'createdAt')
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>((searchParams.get('dir') as 'asc' | 'desc') || 'desc')

  // Keep the URL in sync with the server-side filters (shareable views).
  React.useEffect(() => {
    const qs = new URLSearchParams()
    if (fPriority) qs.set('priority', fPriority)
    if (fCategory) qs.set('category', fCategory)
    if (fStatus) qs.set('status', fStatus)
    if (fApp) qs.set('app', fApp)
    if (search.trim()) qs.set('search', search.trim())
    if (dateFrom) qs.set('from', dateFrom)
    if (dateTo) qs.set('to', dateTo)
    if (sortKey !== 'createdAt') qs.set('sort', sortKey)
    if (sortDir !== 'desc') qs.set('dir', sortDir)
    router.replace(`/admin/bugs${qs.toString() ? `?${qs}` : ''}`, { scroll: false })
  }, [fPriority, fCategory, fStatus, fApp, search, dateFrom, dateTo, sortKey, sortDir, router])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (fPriority) qs.set('priority', fPriority)
      if (fCategory) qs.set('category', fCategory)
      if (fStatus) qs.set('status', fStatus)
      if (fApp) qs.set('app', fApp)
      if (search.trim()) qs.set('search', search.trim())
      qs.set('pageSize', '500')
      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/qa/bug-report?${qs}`, { cache: 'no-store' }),
        fetch('/api/qa/bug-report/stats', { cache: 'no-store' }),
      ])
      const list = listRes.ok ? await listRes.json() : { items: [] }
      setReports(Array.isArray(list) ? list : list.items || [])
      if (statsRes.ok) setStats(await statsRes.json())
    } finally {
      setLoading(false)
    }
  }, [fPriority, fCategory, fStatus, fApp, search])

  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    fetch('/api/qa/bug-report/settings', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((s) => s && setSettings(s)).catch(() => {})
    // Current operator id for "assign to me".
    fetch('/api/auth/session', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((s) => {
      const sub = s?.profile?.metadata?.qa_subject
      if (sub) setMeId(String(sub))
    }).catch(() => {})
  }, [])

  // Deep-link: ?id=N opens that report.
  React.useEffect(() => {
    const id = searchParams.get('id')
    if (!id) return
    fetch(`/api/qa/bug-report/${id}`, { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).then((r) => r && setDetail(r)).catch(() => {})
  }, [searchParams])

  async function saveSettings(next: BugReportSettings) {
    setSavingFlag(true); setSettings(next)
    try { await fetch('/api/qa/bug-report/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next) }) }
    finally { setSavingFlag(false) }
  }
  async function patchReport(id: string | number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/qa/bug-report/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) })
    if (res.ok) {
      const u = await res.json().catch(() => null)
      setReports((p) => p.map((r) => (String(r.id) === String(id) ? { ...r, ...(u || patch) } : r)))
      setDetail((d) => (d && String(d.id) === String(id) ? { ...d, ...(u || patch) } : d))
    }
  }
  async function removeReport(id: string | number) {
    if (!confirm('Delete this bug report?')) return
    const res = await fetch(`/api/qa/bug-report/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setReports((p) => p.filter((r) => String(r.id) !== String(id)))
      setDetail((d) => (d && String(d.id) === String(id) ? null : d))
      setSelected((p) => { const n = new Set(p); n.delete(String(id)); return n })
    }
  }
  async function bulkStatus(status: string) {
    const ids = Array.from(selected)
    for (const id of ids) await patchReport(id, { status })
    setSelected(new Set())
  }
  async function bulkDelete() {
    const ids = Array.from(selected)
    if (ids.length === 0 || !confirm(`Delete ${ids.length} report(s)?`)) return
    for (const id of ids) await fetch(`/api/qa/bug-report/${id}`, { method: 'DELETE' })
    setReports((p) => p.filter((r) => !selected.has(String(r.id))))
    setSelected(new Set())
  }
  function exportData(kind: 'csv' | 'json') {
    let blob: Blob
    if (kind === 'json') blob = new Blob([JSON.stringify(visible, null, 2)], { type: 'application/json' })
    else {
      const cols = ['id', 'app', 'priority', 'category', 'status', 'whatWrong', 'expectedBehavior', 'pageUrl', 'reporterName', 'createdAt']
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      blob = new Blob([[cols.join(','), ...visible.map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(','))].join('\n')], { type: 'text/csv' })
    }
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `bug-reports.${kind}`; a.click(); URL.revokeObjectURL(url)
  }
  function clearFilters() {
    setFPriority(''); setFCategory(''); setFStatus(''); setFApp(''); setSearch(''); setDateFrom(''); setDateTo('')
  }
  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  // Client-side date filter + sort (server handles priority/category/status/app/search).
  const visible = React.useMemo(() => {
    let rows = reports
    if (dateFrom) rows = rows.filter((r) => (r.createdAt || '') >= dateFrom)
    if (dateTo) rows = rows.filter((r) => (r.createdAt || '') <= `${dateTo}T23:59:59`)
    const dir = sortDir === 'asc' ? 1 : -1
    return [...rows].sort((a, b) => {
      let av: number | string = '', bv: number | string = ''
      if (sortKey === 'priority') { av = priRank(String(a.priority)); bv = priRank(String(b.priority)) }
      else if (sortKey === 'createdAt') { av = a.createdAt || ''; bv = b.createdAt || '' }
      else { av = String(a[sortKey] || ''); bv = String(b[sortKey] || '') }
      return av < bv ? -1 * dir : av > bv ? 1 * dir : 0
    })
  }, [reports, dateFrom, dateTo, sortKey, sortDir])

  const allSelected = visible.length > 0 && visible.every((r) => selected.has(String(r.id)))
  const filtersActive = Boolean(fPriority || fCategory || fStatus || fApp || search || dateFrom || dateTo)
  const SortHead = ({ k, children }: { k: SortKey; children: React.ReactNode }) => (
    <th className="cursor-pointer select-none px-3 py-2 hover:text-surface-800" onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{children}{sortKey === k && (sortDir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}</span>
    </th>
  )

  return (
    <div className="space-y-6">
      <PageHeader title="Bug Center" description="Reports filed from the in-app bug button on the dashboard and webapp."
        actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh</Button>} />

      {/* Master toggles */}
      <Card className="flex flex-wrap items-center gap-6 p-5">
        <div className="flex items-center gap-2"><Bug className="h-5 w-5 text-brand-600" /><span className="text-sm font-semibold text-surface-900">Floating bug button</span>{savingFlag && <Loader2 className="h-4 w-4 animate-spin text-surface-400" />}</div>
        {(['enabledDashboard', 'enabledWebapp'] as const).map((key) => (
          <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-surface-700">
            <input type="checkbox" checked={settings[key]} onChange={(e) => saveSettings({ ...settings, [key]: e.target.checked })} className="h-4 w-4 rounded border-surface-300" />
            {key === 'enabledDashboard' ? 'On for Dashboard' : 'On for Webapp'}
          </label>
        ))}
      </Card>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {[
            { label: 'Total', value: stats.total ?? reports.length },
            { label: 'Open', value: stats.byStatus?.open ?? 0 },
            { label: 'URGENT', value: stats.byPriority?.urgent ?? 0, danger: true },
            { label: 'In progress', value: stats.byStatus?.in_progress ?? 0 },
            { label: 'Resolved', value: stats.byStatus?.resolved ?? 0 },
            { label: 'UI/UX', value: stats.byCategory?.ui_ux ?? 0 },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-surface-200 bg-white px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-surface-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-semibold ${s.danger ? 'text-danger-600' : 'text-surface-900'}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick-filter chips */}
      <div className="flex flex-wrap items-center gap-2">
        <button onClick={() => { setFStatus('open'); setFPriority('') }} className="rounded-full border border-surface-200 px-3 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50">Open</button>
        <button onClick={() => { setFPriority('urgent'); setFStatus('') }} className="rounded-full border border-danger-200 bg-danger-50 px-3 py-1 text-xs font-medium text-danger-700 hover:bg-danger-100">URGENT</button>
        <button onClick={() => setFStatus('in_progress')} className="rounded-full border border-surface-200 px-3 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50">In progress</button>
        {filtersActive && <button onClick={clearFilters} className="rounded-full px-3 py-1 text-xs font-medium text-brand-600 hover:underline">Clear filters</button>}
        <span className="ml-auto text-xs text-surface-400">{visible.length} shown{filtersActive ? ' (filtered)' : ''}</span>
      </div>

      {/* Filters + date range + export */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports..." className="pl-9" />
        </div>
        <FilterSelect value={fPriority} onChange={setFPriority} placeholder="All priorities" options={PRIORITIES} />
        <FilterSelect value={fCategory} onChange={setFCategory} placeholder="All categories" options={CATEGORIES} />
        <FilterSelect value={fStatus} onChange={setFStatus} placeholder="All statuses" options={STATUSES} />
        <FilterSelect value={fApp} onChange={setFApp} placeholder="All apps" options={APPS} />
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 rounded-lg border border-surface-300 px-2 text-sm text-surface-700" title="From date" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 rounded-lg border border-surface-300 px-2 text-sm text-surface-700" title="To date" />
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => exportData('csv')}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportData('json')}><Download className="h-3.5 w-3.5" /> JSON</Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-2 text-sm">
          <span className="font-medium text-brand-700">{selected.size} selected</span>
          <span className="text-surface-400">Set status:</span>
          {STATUSES.map((s) => <button key={s.value} onClick={() => void bulkStatus(s.value)} className="rounded-lg border border-surface-200 bg-white px-2 py-1 text-xs hover:bg-surface-50">{s.label}</button>)}
          <button onClick={() => void bulkDelete()} className="ml-auto rounded-lg border border-danger-200 bg-white px-2 py-1 text-xs text-danger-600 hover:bg-danger-50">Delete</button>
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-100 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500">
              <tr>
                <th className="w-10 px-3 py-2"><input type="checkbox" checked={allSelected} onChange={(e) => setSelected(e.target.checked ? new Set(visible.map((r) => String(r.id))) : new Set())} className="h-4 w-4 rounded border-surface-300" /></th>
                <th className="px-3 py-2">Shot</th>
                <SortHead k="priority">Priority</SortHead>
                <SortHead k="category">Category</SortHead>
                <SortHead k="status">Status</SortHead>
                <SortHead k="app">App</SortHead>
                <th className="px-3 py-2">What was wrong</th>
                <th className="px-3 py-2">Reporter</th>
                <SortHead k="createdAt">When</SortHead>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-surface-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
              ) : visible.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-surface-400">No bug reports match these filters.</td></tr>
              ) : visible.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-surface-50 hover:bg-surface-50" onClick={() => setDetail(r)}>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(String(r.id))} onChange={(e) => setSelected((p) => { const n = new Set(p); if (e.target.checked) n.add(String(r.id)); else n.delete(String(r.id)); return n })} className="h-4 w-4 rounded border-surface-300" /></td>
                  <td className="px-3 py-2">{r.screenshotUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={toProxiedMaterialUrl(r.screenshotUrl)} alt="" className="h-10 w-14 rounded border border-surface-200 object-cover" onClick={(e) => { e.stopPropagation(); setLightbox(toProxiedMaterialUrl(r.screenshotUrl!)) }} />
                  ) : <span className="text-surface-300">—</span>}</td>
                  <td className="px-3 py-2"><Badge variant={priVariant(String(r.priority))}>{lab(PRIORITIES, String(r.priority))}</Badge></td>
                  <td className="px-3 py-2 text-surface-600">{lab(CATEGORIES, String(r.category))}</td>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    {/* inline quick status change */}
                    <select value={String(r.status)} onChange={(e) => void patchReport(r.id, { status: e.target.value })} className="rounded-md border border-surface-200 bg-white px-1.5 py-0.5 text-xs">
                      {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2 text-surface-500">{lab(APPS, String(r.app))}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-surface-800">{r.whatWrong}</td>
                  <td className="px-3 py-2 text-surface-500">{r.reporterName || '—'}</td>
                  <td className="px-3 py-2 text-surface-400">{r.createdAt ? formatDate(r.createdAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {detail && <BugDetail report={detail} meId={meId} onClose={() => setDetail(null)} onPatch={patchReport} onDelete={removeReport} onLightbox={setLightbox} />}
      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Screenshot" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

function FilterSelect({ value, onChange, placeholder, options }: { value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-surface-300 bg-white px-3 text-sm text-surface-700">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function BugDetail({ report, meId, onClose, onPatch, onDelete, onLightbox }: {
  report: BugReport; meId: string | null
  onClose: () => void
  onPatch: (id: string | number, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string | number) => Promise<void>
  onLightbox: (src: string) => void
}) {
  const [note, setNote] = React.useState('')
  const [tags, setTags] = React.useState((report.tags || []).join(', '))
  const [copied, setCopied] = React.useState(false)
  const [claudeCopied, setClaudeCopied] = React.useState(false)
  const consoleErrors = safeParse(report.consoleErrors)
  const networkErrors = safeParse(report.networkErrors)

  function copyLink() {
    const url = `${window.location.origin}/admin/bugs?id=${report.id}`
    navigator.clipboard.writeText(url).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1500) }).catch(() => {})
  }
  function copyClaude() {
    navigator.clipboard.writeText(buildClaudeMd(report)).then(() => { setClaudeCopied(true); window.setTimeout(() => setClaudeCopied(false), 1500) }).catch(() => {})
  }
  function downloadMd() {
    const blob = new Blob([buildClaudeMd(report)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `bug-${report.id}.md`; a.click(); URL.revokeObjectURL(url)
  }
  // Resolution note: prompt for a fix note when resolving.
  async function changeStatus(v: string) {
    if (v === 'resolved') {
      const fix = window.prompt('How was it fixed? (optional resolution note)')
      if (fix && fix.trim()) await onPatch(report.id, { note: `Resolved: ${fix.trim()}` })
    }
    await onPatch(report.id, { status: v })
  }

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-surface-900"><Bug className="h-5 w-5 text-brand-600" /> Bug #{report.id}</h2>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={copyClaude} title="Copy a Claude-ready brief"><Sparkles className="h-4 w-4" /> {claudeCopied ? 'Copied!' : 'For Claude'}</Button>
            <Button variant="ghost" size="sm" onClick={downloadMd} title="Download .md for Claude"><FileDown className="h-4 w-4" /> .md</Button>
            <Button variant="ghost" size="sm" onClick={copyLink}><Link2 className="h-4 w-4" /> {copied ? 'Copied!' : 'Copy link'}</Button>
            <button onClick={onClose} className="text-surface-400 hover:text-surface-600"><X className="h-5 w-5" /></button>
          </div>
        </div>

        <div className="space-y-5 p-5">
          {report.screenshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={toProxiedMaterialUrl(report.screenshotUrl)} alt="Screenshot" className="w-full cursor-zoom-in rounded-lg border border-surface-200" onClick={() => onLightbox(toProxiedMaterialUrl(report.screenshotUrl!))} />
          )}

          {/* Quick actions */}
          <div className="flex flex-wrap gap-2">
            {meId && <Button variant="outline" size="sm" onClick={() => onPatch(report.id, { assigneeUserId: Number(meId) })}><UserCheck className="h-3.5 w-3.5" /> Assign to me</Button>}
            {(report.status === 'resolved' || report.status === 'wont_fix') && <Button variant="outline" size="sm" onClick={() => onPatch(report.id, { status: 'open' })}><RotateCcw className="h-3.5 w-3.5" /> Reopen</Button>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <DetailSelect label="Status" value={String(report.status)} options={STATUSES} onChange={changeStatus} />
            <DetailSelect label="Priority" value={String(report.priority)} options={PRIORITIES} onChange={(v) => onPatch(report.id, { priority: v })} />
            <DetailSelect label="Category" value={String(report.category)} options={CATEGORIES} onChange={(v) => onPatch(report.id, { category: v })} />
          </div>

          <Field label="What was wrong">{report.whatWrong}</Field>
          <Field label="What should have happened">{report.expectedBehavior || '—'}</Field>

          <div className="grid grid-cols-2 gap-3 text-xs text-surface-500">
            <div><span className="font-medium text-surface-600">App:</span> {lab(APPS, String(report.app))}</div>
            <div><span className="font-medium text-surface-600">Reporter:</span> {report.reporterName || '—'}{report.assigneeUserId ? ` · assigned #${report.assigneeUserId}` : ''}</div>
            <div className="col-span-2 break-all"><span className="font-medium text-surface-600">Page:</span>{' '}{report.pageUrl ? <a href={report.pageUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{report.pageUrl} <ExternalLink className="inline h-3 w-3" /></a> : '—'}</div>
            <div className="col-span-2"><span className="font-medium text-surface-600">Environment:</span> {parseUA(report.userAgent)} · {report.viewport || '—'}</div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-surface-600">Tags (comma-separated)</label>
            <div className="flex gap-2">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. payments, mobile" />
              <Button variant="outline" size="sm" onClick={() => onPatch(report.id, { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })}>Save</Button>
            </div>
          </div>

          {consoleErrors.length > 0 && <ErrorBlock title={`Console errors (${consoleErrors.length})`} items={consoleErrors} />}
          {networkErrors.length > 0 && <ErrorBlock title={`Failed requests (${networkErrors.length})`} items={networkErrors} />}

          <div className="space-y-2">
            <label className="text-xs font-medium text-surface-600">Notes</label>
            {(report.notes || []).map((n, i) => (
              <div key={i} className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-700"><span className="font-medium">{n.authorName || 'Note'}</span> · {n.createdAt ? formatDate(n.createdAt) : ''}<br />{n.text}</div>
            ))}
            <div className="flex gap-2">
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a note..." />
              <Button variant="outline" size="sm" disabled={!note.trim()} onClick={async () => { await onPatch(report.id, { note: note.trim() }); setNote('') }}>Add</Button>
            </div>
          </div>

          <div className="flex justify-end border-t border-surface-100 pt-4">
            <Button variant="ghost" onClick={() => onDelete(report.id)} className="text-danger-600"><Trash2 className="h-4 w-4" /> Delete report</Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function DetailSelect({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-surface-600">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-surface-300 bg-white px-2 text-sm">{options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><p className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</p><p className="whitespace-pre-wrap text-sm text-surface-800">{children}</p></div>
}
function ErrorBlock({ title, items }: { title: string; items: unknown[] }) {
  return <div className="space-y-1"><p className="text-xs font-medium uppercase tracking-wide text-surface-500">{title}</p><pre className="max-h-40 overflow-auto rounded-lg bg-surface-900 p-3 text-[11px] leading-relaxed text-surface-100">{items.map((it) => (typeof it === 'string' ? it : JSON.stringify(it))).join('\n')}</pre></div>
}
function safeParse(raw: string | null | undefined): unknown[] {
  if (!raw) return []
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] } catch { return [] }
}
