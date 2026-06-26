'use client'

import * as React from 'react'
import { Bug, Download, Loader2, RefreshCw, Search, Trash2, X, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import type { BugReport, BugReportSettings, BugReportStats } from '@/lib/bug-center/types'

const PRIORITIES = [
  { value: 'urgent', label: 'URGENT', variant: 'danger' as const },
  { value: 'need', label: 'Need to have', variant: 'info' as const },
  { value: 'nice', label: 'Nice to have', variant: 'default' as const },
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

function labelFor(list: { value: string; label: string }[], value: string) {
  return list.find((x) => x.value === value)?.label || value
}
function priorityBadge(p: string) {
  return PRIORITIES.find((x) => x.value === p)?.variant || 'default'
}
function statusBadge(s: string) {
  return STATUSES.find((x) => x.value === s)?.variant || 'default'
}

export default function BugCenterPage() {
  const [reports, setReports] = React.useState<BugReport[]>([])
  const [stats, setStats] = React.useState<BugReportStats | null>(null)
  const [settings, setSettings] = React.useState<BugReportSettings>({ enabledDashboard: false, enabledWebapp: false })
  const [loading, setLoading] = React.useState(true)
  const [savingFlag, setSavingFlag] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [detail, setDetail] = React.useState<BugReport | null>(null)
  const [lightbox, setLightbox] = React.useState<string | null>(null)

  // Filters (feature: filter by priority/category/status/app + full-text search)
  const [fPriority, setFPriority] = React.useState('')
  const [fCategory, setFCategory] = React.useState('')
  const [fStatus, setFStatus] = React.useState('')
  const [fApp, setFApp] = React.useState('')
  const [search, setSearch] = React.useState('')

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams()
      if (fPriority) qs.set('priority', fPriority)
      if (fCategory) qs.set('category', fCategory)
      if (fStatus) qs.set('status', fStatus)
      if (fApp) qs.set('app', fApp)
      if (search.trim()) qs.set('search', search.trim())
      qs.set('pageSize', '200')
      const [listRes, statsRes] = await Promise.all([
        fetch(`/api/qa/bug-report?${qs.toString()}`, { cache: 'no-store' }),
        fetch('/api/qa/bug-report/stats', { cache: 'no-store' }),
      ])
      const list = listRes.ok ? await listRes.json() : { items: [] }
      setReports(Array.isArray(list) ? list : (list.items || []))
      if (statsRes.ok) setStats(await statsRes.json())
    } finally {
      setLoading(false)
    }
  }, [fPriority, fCategory, fStatus, fApp, search])

  React.useEffect(() => { void load() }, [load])
  React.useEffect(() => {
    fetch('/api/qa/bug-report/settings', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => { if (s) setSettings(s) })
      .catch(() => {})
  }, [])

  async function saveSettings(next: BugReportSettings) {
    setSavingFlag(true)
    setSettings(next)
    try {
      await fetch('/api/qa/bug-report/settings', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next),
      })
    } finally {
      setSavingFlag(false)
    }
  }

  async function patchReport(id: string | number, patch: Record<string, unknown>) {
    const res = await fetch(`/api/qa/bug-report/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch),
    })
    if (res.ok) {
      const updated = await res.json().catch(() => null)
      setReports((prev) => prev.map((r) => (String(r.id) === String(id) ? { ...r, ...(updated || patch) } : r)))
      setDetail((d) => (d && String(d.id) === String(id) ? { ...d, ...(updated || patch) } : d))
    }
  }

  async function removeReport(id: string | number) {
    if (!confirm('Delete this bug report?')) return
    const res = await fetch(`/api/qa/bug-report/${id}`, { method: 'DELETE' })
    if (res.ok) {
      setReports((prev) => prev.filter((r) => String(r.id) !== String(id)))
      setDetail((d) => (d && String(d.id) === String(id) ? null : d))
      setSelected((prev) => { const n = new Set(prev); n.delete(String(id)); return n })
    }
  }

  async function bulk(action: 'resolve' | 'delete') {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    if (action === 'delete' && !confirm(`Delete ${ids.length} report(s)?`)) return
    for (const id of ids) {
      if (action === 'resolve') await patchReport(id, { status: 'resolved' })
      else await fetch(`/api/qa/bug-report/${id}`, { method: 'DELETE' })
    }
    if (action === 'delete') setReports((prev) => prev.filter((r) => !selected.has(String(r.id))))
    setSelected(new Set())
  }

  function exportData(kind: 'csv' | 'json') {
    let blob: Blob
    if (kind === 'json') {
      blob = new Blob([JSON.stringify(reports, null, 2)], { type: 'application/json' })
    } else {
      const cols = ['id', 'app', 'priority', 'category', 'status', 'whatWrong', 'expectedBehavior', 'pageUrl', 'reporterName', 'createdAt']
      const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const rows = [cols.join(','), ...reports.map((r) => cols.map((c) => esc((r as unknown as Record<string, unknown>)[c])).join(','))]
      blob = new Blob([rows.join('\n')], { type: 'text/csv' })
    }
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `bug-reports.${kind}`; a.click()
    URL.revokeObjectURL(url)
  }

  const allSelected = reports.length > 0 && reports.every((r) => selected.has(String(r.id)))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bug Center"
        description="Reports filed from the in-app bug button on the dashboard and webapp."
        actions={
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
          </Button>
        }
      />

      {/* Master toggles (feature 20) */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-5">
          <div className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-brand-600" />
            <span className="text-sm font-semibold text-surface-900">Floating bug button</span>
            {savingFlag && <Loader2 className="h-4 w-4 animate-spin text-surface-400" />}
          </div>
          {(['enabledDashboard', 'enabledWebapp'] as const).map((key) => (
            <label key={key} className="flex cursor-pointer items-center gap-2 text-sm text-surface-700">
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(e) => saveSettings({ ...settings, [key]: e.target.checked })}
                className="h-4 w-4 rounded border-surface-300"
              />
              {key === 'enabledDashboard' ? 'On for Dashboard' : 'On for Webapp'}
            </label>
          ))}
        </CardContent>
      </Card>

      {/* Stats overview (feature 17) */}
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

      {/* Filters + search + export (features 13, 14, 19) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search reports..." className="pl-9" />
        </div>
        <FilterSelect value={fPriority} onChange={setFPriority} placeholder="All priorities" options={PRIORITIES} />
        <FilterSelect value={fCategory} onChange={setFCategory} placeholder="All categories" options={CATEGORIES} />
        <FilterSelect value={fStatus} onChange={setFStatus} placeholder="All statuses" options={STATUSES} />
        <FilterSelect value={fApp} onChange={setFApp} placeholder="All apps" options={APPS} />
        <div className="ml-auto flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={() => void bulk('resolve')}>Resolve {selected.size}</Button>
              <Button variant="outline" size="sm" onClick={() => void bulk('delete')} className="text-danger-600">Delete {selected.size}</Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => exportData('csv')}><Download className="h-3.5 w-3.5" /> CSV</Button>
          <Button variant="outline" size="sm" onClick={() => exportData('json')}><Download className="h-3.5 w-3.5" /> JSON</Button>
        </div>
      </div>

      {/* List table (features 12, 15, 4, 5, 8, 18) */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-surface-100 bg-surface-50 text-left text-xs uppercase tracking-wide text-surface-500">
              <tr>
                <th className="w-10 px-3 py-2">
                  <input type="checkbox" checked={allSelected}
                    onChange={(e) => setSelected(e.target.checked ? new Set(reports.map((r) => String(r.id))) : new Set())}
                    className="h-4 w-4 rounded border-surface-300" />
                </th>
                <th className="px-3 py-2">Shot</th>
                <th className="px-3 py-2">Priority</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">App</th>
                <th className="px-3 py-2">What was wrong</th>
                <th className="px-3 py-2">Reporter</th>
                <th className="px-3 py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="py-10 text-center text-surface-400"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
              ) : reports.length === 0 ? (
                <tr><td colSpan={9} className="py-10 text-center text-surface-400">No bug reports match these filters.</td></tr>
              ) : reports.map((r) => (
                <tr key={r.id} className="cursor-pointer border-b border-surface-50 hover:bg-surface-50" onClick={() => setDetail(r)}>
                  <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(String(r.id))}
                      onChange={(e) => setSelected((prev) => { const n = new Set(prev); if (e.target.checked) n.add(String(r.id)); else n.delete(String(r.id)); return n })}
                      className="h-4 w-4 rounded border-surface-300" />
                  </td>
                  <td className="px-3 py-2">
                    {r.screenshotUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={toProxiedMaterialUrl(r.screenshotUrl)} alt="" className="h-10 w-14 rounded border border-surface-200 object-cover"
                        onClick={(e) => { e.stopPropagation(); setLightbox(toProxiedMaterialUrl(r.screenshotUrl!)) }} />
                    ) : <span className="text-surface-300">—</span>}
                  </td>
                  <td className="px-3 py-2"><Badge variant={priorityBadge(String(r.priority))}>{labelFor(PRIORITIES, String(r.priority))}</Badge></td>
                  <td className="px-3 py-2 text-surface-600">{labelFor(CATEGORIES, String(r.category))}</td>
                  <td className="px-3 py-2"><Badge variant={statusBadge(String(r.status))}>{labelFor(STATUSES, String(r.status))}</Badge></td>
                  <td className="px-3 py-2 text-surface-500">{labelFor(APPS, String(r.app))}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-surface-800">{r.whatWrong}</td>
                  <td className="px-3 py-2 text-surface-500">{r.reporterName || '—'}</td>
                  <td className="px-3 py-2 text-surface-400">{r.createdAt ? formatDate(r.createdAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {detail && (
        <BugDetail
          report={detail}
          onClose={() => setDetail(null)}
          onPatch={patchReport}
          onDelete={removeReport}
          onLightbox={setLightbox}
        />
      )}

      {lightbox && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6" onClick={() => setLightbox(null)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="Screenshot" className="max-h-full max-w-full rounded-lg" />
        </div>
      )}
    </div>
  )
}

function FilterSelect({ value, onChange, placeholder, options }: {
  value: string; onChange: (v: string) => void; placeholder: string; options: { value: string; label: string }[]
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-surface-300 bg-white px-3 text-sm text-surface-700">
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

// Detail drawer: full context + workflow + assignee + tags + notes (features 6,7,8,9,10,11,16)
function BugDetail({ report, onClose, onPatch, onDelete, onLightbox }: {
  report: BugReport
  onClose: () => void
  onPatch: (id: string | number, patch: Record<string, unknown>) => Promise<void>
  onDelete: (id: string | number) => Promise<void>
  onLightbox: (src: string) => void
}) {
  const [note, setNote] = React.useState('')
  const [tags, setTags] = React.useState((report.tags || []).join(', '))
  const consoleErrors = safeParse(report.consoleErrors)
  const networkErrors = safeParse(report.networkErrors)

  return (
    <div className="fixed inset-0 z-[85] flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-surface-900"><Bug className="h-5 w-5 text-brand-600" /> Bug #{report.id}</h2>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-600"><X className="h-5 w-5" /></button>
        </div>

        <div className="space-y-5 p-5">
          {report.screenshotUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={toProxiedMaterialUrl(report.screenshotUrl)} alt="Screenshot" className="w-full cursor-zoom-in rounded-lg border border-surface-200"
              onClick={() => onLightbox(toProxiedMaterialUrl(report.screenshotUrl!))} />
          )}

          <div className="grid grid-cols-3 gap-3">
            <DetailSelect label="Status" value={String(report.status)} options={STATUSES} onChange={(v) => onPatch(report.id, { status: v })} />
            <DetailSelect label="Priority" value={String(report.priority)} options={PRIORITIES} onChange={(v) => onPatch(report.id, { priority: v })} />
            <DetailSelect label="Category" value={String(report.category)} options={CATEGORIES} onChange={(v) => onPatch(report.id, { category: v })} />
          </div>

          <Field label="What was wrong">{report.whatWrong}</Field>
          <Field label="What should have happened">{report.expectedBehavior || '—'}</Field>

          <div className="grid grid-cols-2 gap-3 text-xs text-surface-500">
            <div><span className="font-medium text-surface-600">App:</span> {labelFor(APPS, String(report.app))}</div>
            <div><span className="font-medium text-surface-600">Reporter:</span> {report.reporterName || '—'}</div>
            <div className="col-span-2 break-all"><span className="font-medium text-surface-600">Page:</span>{' '}
              {report.pageUrl ? <a href={report.pageUrl} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{report.pageUrl} <ExternalLink className="inline h-3 w-3" /></a> : '—'}</div>
            <div className="col-span-2"><span className="font-medium text-surface-600">Viewport / Agent:</span> {report.viewport || '—'} · {report.userAgent || '—'}</div>
          </div>

          {/* Tags (feature 10) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-surface-600">Tags (comma-separated)</label>
            <div className="flex gap-2">
              <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. payments, mobile" />
              <Button variant="outline" size="sm" onClick={() => onPatch(report.id, { tags: tags.split(',').map((t) => t.trim()).filter(Boolean) })}>Save</Button>
            </div>
          </div>

          {/* Console + network errors (feature 3) */}
          {consoleErrors.length > 0 && <ErrorBlock title={`Console errors (${consoleErrors.length})`} items={consoleErrors} />}
          {networkErrors.length > 0 && <ErrorBlock title={`Failed requests (${networkErrors.length})`} items={networkErrors} />}

          {/* Notes thread (feature 11) */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-surface-600">Notes</label>
            {(report.notes || []).map((n, i) => (
              <div key={i} className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-700">
                <span className="font-medium">{n.authorName || 'Note'}</span> · {n.createdAt ? formatDate(n.createdAt) : ''}<br />{n.text}
              </div>
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
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-full rounded-lg border border-surface-300 bg-white px-2 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</p>
      <p className="whitespace-pre-wrap text-sm text-surface-800">{children}</p>
    </div>
  )
}
function ErrorBlock({ title, items }: { title: string; items: unknown[] }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{title}</p>
      <pre className="max-h-40 overflow-auto rounded-lg bg-surface-900 p-3 text-[11px] leading-relaxed text-surface-100">{items.map((it) => (typeof it === 'string' ? it : JSON.stringify(it))).join('\n')}</pre>
    </div>
  )
}
function safeParse(raw: string | null | undefined): unknown[] {
  if (!raw) return []
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] } catch { return [] }
}
