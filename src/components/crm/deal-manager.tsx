'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Loader2, Plus, Trash2, Calendar, Clock, Repeat } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useDeals, useDealInsert, useDealUpdate, useDealDelete, type QaDealRow } from '@/lib/supabase/hooks'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function minutesToTime(min: number | null | undefined): string {
  if (min == null) return ''
  const h = Math.floor(min / 60); const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
function timeToMinutes(s: string): number | null {
  if (!s) return null
  const [h, m] = s.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  return h * 60 + m
}
function maskToDays(mask: number | null | undefined): boolean[] {
  const m = mask == null ? 127 : mask
  return Array.from({ length: 7 }, (_, i) => (m & (1 << i)) !== 0)
}
function daysToMask(days: boolean[]): number {
  return days.reduce((acc, on, i) => acc + (on ? (1 << i) : 0), 0)
}

interface DealForm {
  id: string | null
  cashBack: string
  description: string
  active: boolean
  isRecurring: boolean
  days: boolean[]
  startTime: string
  endTime: string
  startDate: string
  endDate: string
}

const emptyForm: DealForm = {
  id: null, cashBack: '10', description: '', active: true, isRecurring: false,
  days: [true, true, true, true, true, true, true], startTime: '', endTime: '', startDate: '', endDate: '',
}

function dealToForm(d: QaDealRow): DealForm {
  return {
    id: d.id,
    cashBack: String(d.cash_back ?? 10),
    description: d.description || '',
    active: !!d.active,
    isRecurring: !!d.is_recurring,
    days: maskToDays(d.days_of_week_mask),
    startTime: minutesToTime(d.daily_start_minutes),
    endTime: minutesToTime(d.daily_end_minutes),
    startDate: (d.start_date || '').slice(0, 10),
    endDate: (d.end_date || '').slice(0, 10),
  }
}

export function DealManager({ businessAccountId }: { businessAccountId: string }) {
  const { data: deals, loading, refetch } = useDeals({ business_account_id: businessAccountId })
  const { insert } = useDealInsert()
  const { update } = useDealUpdate()
  const { remove } = useDealDelete()

  const [form, setForm] = React.useState<DealForm | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function openNew() { setError(null); setForm({ ...emptyForm }) }
  function openEdit(d: QaDealRow) { setError(null); setForm(dealToForm(d)) }

  async function save() {
    if (!form) return
    setSaving(true); setError(null)
    try {
      const payload: Record<string, unknown> = {
        business_account_id: businessAccountId,
        cash_back: Number(form.cashBack) || 0,
        description: form.description.trim() || null,
        active: form.active,
        is_recurring: form.isRecurring,
        days_of_week_mask: form.isRecurring ? daysToMask(form.days) : null,
        daily_start_minutes: form.isRecurring ? timeToMinutes(form.startTime) : null,
        daily_end_minutes: form.isRecurring ? timeToMinutes(form.endTime) : null,
        start_date: form.startDate ? new Date(`${form.startDate}T00:00:00Z`).toISOString() : null,
        end_date: form.endDate ? new Date(`${form.endDate}T23:59:59Z`).toISOString() : null,
      }
      const result = form.id ? await update(form.id, payload) : await insert(payload)
      if (!result) {
        // hook surfaces the backend message (e.g. overlap Conflict) via its error
        setError('Could not save the deal. It may overlap another active deal — only one deal can be live at a time.')
        return
      }
      toast.success(form.id ? 'Deal updated' : 'Deal created')
      setForm(null)
      refetch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the deal.')
    } finally {
      setSaving(false)
    }
  }

  async function deactivate(id: string) {
    await remove(id)
    toast.success('Deal deactivated')
    refetch()
  }

  function describeSchedule(d: QaDealRow): string {
    if (!d.is_recurring) {
      const s = (d.start_date || '').slice(0, 10); const e = (d.end_date || '').slice(0, 10)
      return s || e ? `Runs ${s || '—'} → ${e || '—'}` : 'Always on (date range)'
    }
    const days = maskToDays(d.days_of_week_mask).map((on, i) => on ? DAY_LABELS[i] : null).filter(Boolean).join(', ')
    const time = d.daily_start_minutes != null ? `${minutesToTime(d.daily_start_minutes)}–${minutesToTime(d.daily_end_minutes)}` : 'all day'
    return `${days || 'every day'} · ${time} (business local time)`
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle>LocalVIP Deal</CardTitle>
          <p className="text-sm text-surface-500">
            The cashback deal shown in the app. Schedule it by weekday + time in the business&apos;s local time.
            Only one deal can be live at any moment — overlapping schedules are blocked.
          </p>
        </div>
        {!form ? (
          <Button size="sm" onClick={openNew}><Plus className="h-4 w-4" /> New deal</Button>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-4">
        {form ? (
          <div className="space-y-4 rounded-xl border border-surface-200 bg-surface-50 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Cashback %</label>
                <Input type="number" min={1} max={36} value={form.cashBack}
                  onChange={(e) => setForm({ ...form, cashBack: e.target.value })} />
              </div>
              <div className="flex items-end gap-4">
                <label className="flex items-center gap-2 text-sm font-medium text-surface-700">
                  <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
                  Active
                </label>
                <label className="flex items-center gap-2 text-sm font-medium text-surface-700">
                  <input type="checkbox" checked={form.isRecurring} onChange={(e) => setForm({ ...form, isRecurring: e.target.checked })} />
                  <Repeat className="h-3.5 w-3.5" /> Recurring weekly
                </label>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            {form.isRecurring ? (
              <div className="space-y-3 rounded-lg border border-surface-200 bg-white p-3">
                <div>
                  <p className="mb-1.5 text-sm font-medium text-surface-700 flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Active days</p>
                  <div className="flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((label, i) => (
                      <button key={label} type="button"
                        onClick={() => { const d = [...form.days]; d[i] = !d[i]; setForm({ ...form, days: d }) }}
                        className={`rounded-full border px-3 py-1 text-xs font-medium ${form.days[i] ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-surface-200 text-surface-500'}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Start time</label>
                    <Input type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-surface-700 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> End time</label>
                    <Input type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} />
                  </div>
                </div>
                <p className="text-[11px] text-surface-400">Times are in the business&apos;s local timezone. Leave times blank for all-day.</p>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">{form.isRecurring ? 'Campaign starts' : 'Starts'}</label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">{form.isRecurring ? 'Campaign ends' : 'Ends'}</label>
                <Input type="date" value={form.endDate} min={form.startDate || undefined} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
              </div>
            </div>

            {error ? <div className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</div> : null}

            <div className="flex gap-2">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save deal
              </Button>
              <Button variant="outline" onClick={() => { setForm(null); setError(null) }}>Cancel</Button>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          {loading ? (
            <p className="text-sm text-surface-500">Loading deals…</p>
          ) : (deals || []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-300 bg-surface-50 px-4 py-6 text-center text-sm text-surface-500">
              No deals yet. Create one to make this business live in the app.
            </div>
          ) : (
            (deals || []).map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-surface-900">{Number(d.cash_back)}% cashback</span>
                    <Badge variant={d.active ? 'success' : 'default'}>{d.active ? 'Active' : 'Inactive'}</Badge>
                    {d.is_recurring ? <Badge variant="info">Recurring</Badge> : null}
                  </div>
                  {d.description ? <p className="truncate text-sm text-surface-600">{d.description}</p> : null}
                  <p className="text-xs text-surface-500">{describeSchedule(d)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(d)}>Edit</Button>
                  {d.active ? (
                    <Button size="sm" variant="ghost" onClick={() => void deactivate(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
