'use client'

import * as React from 'react'
import { CalendarDays, Clock3, Loader2, Pencil, Plus, Power, Repeat2, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useDealInsert, useDeals, useDealUpdate, type QaDealRow } from '@/lib/supabase/hooks'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function minutesToTime(minutes: number | null | undefined): string {
  if (minutes == null) return ''
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
}

function timeToMinutes(value: string): number | null {
  if (!value) return null
  const [hours, minutes] = value.split(':').map(Number)
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  return hours * 60 + minutes
}

function maskToDays(mask: number | null | undefined): boolean[] {
  const resolvedMask = mask == null ? 127 : mask
  return Array.from({ length: 7 }, (_, index) => (resolvedMask & (1 << index)) !== 0)
}

function daysToMask(days: boolean[]): number {
  return days.reduce((mask, selected, index) => mask + (selected ? (1 << index) : 0), 0)
}

function parseDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return Number.isNaN(date.getTime()) ? null : date
}

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function durationBetween(startDate: string, endDate: string): number | null {
  const start = parseDate(startDate)
  const end = parseDate(endDate)
  if (!start || !end || end < start) return null
  return Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1
}

function endDateFromDuration(startDate: string, durationDays: number): string {
  const start = parseDate(startDate)
  if (!start || durationDays < 1) return ''
  start.setUTCDate(start.getUTCDate() + durationDays - 1)
  return formatDate(start)
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
  durationDays: string
}

const emptyForm: DealForm = {
  id: null,
  cashBack: '10',
  description: '',
  active: true,
  isRecurring: false,
  days: [false, true, true, true, true, true, false],
  startTime: '',
  endTime: '',
  startDate: '',
  endDate: '',
  durationDays: '',
}

function dealToForm(deal: QaDealRow): DealForm {
  const startDate = (deal.start_date || '').slice(0, 10)
  const endDate = (deal.end_date || '').slice(0, 10)
  return {
    id: deal.id,
    cashBack: String(deal.cash_back ?? 10),
    description: deal.description || '',
    active: !!deal.active,
    isRecurring: !!deal.is_recurring,
    days: maskToDays(deal.days_of_week_mask),
    startTime: minutesToTime(deal.daily_start_minutes),
    endTime: minutesToTime(deal.daily_end_minutes),
    startDate,
    endDate,
    durationDays: durationBetween(startDate, endDate)?.toString() || '',
  }
}

function validateDeal(form: DealForm): string[] {
  const errors: string[] = []
  const cashback = Number(form.cashBack)
  const duration = Number(form.durationDays)
  const start = parseDate(form.startDate)
  const end = parseDate(form.endDate)

  if (!Number.isFinite(cashback) || cashback < 1 || cashback > 36) {
    errors.push('Cashback must be between 1% and 36%.')
  }
  if (!form.description.trim()) {
    errors.push('Describe what customers receive with this offer.')
  }
  if (!start) errors.push('Choose a valid start date.')
  if (!Number.isInteger(duration) || duration < 1) {
    errors.push('Duration must be at least 1 day.')
  }
  if (!end) {
    errors.push('Choose a valid end date.')
  } else if (start && end < start) {
    errors.push('The end date cannot be before the start date.')
  }
  if (start && end && Number.isInteger(duration) && duration > 0 && durationBetween(form.startDate, form.endDate) !== duration) {
    errors.push('Duration must match the selected start and end dates.')
  }
  if (form.isRecurring && !form.days.some(Boolean)) {
    errors.push('Choose at least one weekday for a recurring offer.')
  }
  if (Boolean(form.startTime) !== Boolean(form.endTime)) {
    errors.push('Add both a start time and an end time, or leave both blank for an all-day offer.')
  } else if (form.startTime && form.endTime) {
    const startMinutes = timeToMinutes(form.startTime)
    const endMinutes = timeToMinutes(form.endTime)
    if (startMinutes == null || endMinutes == null || endMinutes <= startMinutes) {
      errors.push('The end time must be later than the start time.')
    }
  }
  return errors
}

export interface DealManagerProps {
  businessAccountId: string
  mode?: 'crm' | 'portal'
}

export function DealManager({ businessAccountId, mode = 'crm' }: DealManagerProps) {
  const isPortal = mode === 'portal'
  const { data: deals, loading, error: loadError, refetch } = useDeals({
    business_account_id: businessAccountId,
  })
  const { insert } = useDealInsert()
  const { update } = useDealUpdate()

  const [form, setForm] = React.useState<DealForm | null>(null)
  const [saving, setSaving] = React.useState(false)
  const [changingStatusId, setChangingStatusId] = React.useState<string | null>(null)
  const [errors, setErrors] = React.useState<string[]>([])

  function openNew() {
    setErrors([])
    setForm({ ...emptyForm, days: [...emptyForm.days] })
  }

  function openEdit(deal: QaDealRow) {
    setErrors([])
    setForm(dealToForm(deal))
  }

  function updateStartDate(startDate: string) {
    if (!form) return
    const duration = Number(form.durationDays)
    setForm({
      ...form,
      startDate,
      endDate: Number.isInteger(duration) && duration > 0
        ? endDateFromDuration(startDate, duration)
        : form.endDate,
    })
  }

  function updateDuration(durationDays: string) {
    if (!form) return
    const duration = Number(durationDays)
    setForm({
      ...form,
      durationDays,
      endDate: form.startDate && Number.isInteger(duration) && duration > 0
        ? endDateFromDuration(form.startDate, duration)
        : form.endDate,
    })
  }

  function updateEndDate(endDate: string) {
    if (!form) return
    const duration = durationBetween(form.startDate, endDate)
    setForm({ ...form, endDate, durationDays: duration?.toString() || form.durationDays })
  }

  async function save() {
    if (!form) return
    const validationErrors = validateDeal(form)
    if (validationErrors.length) {
      setErrors(validationErrors)
      return
    }

    setSaving(true)
    setErrors([])
    try {
      const payload: Partial<QaDealRow> = {
        business_account_id: businessAccountId,
        cash_back: Number(form.cashBack),
        description: form.description.trim() || null,
        active: form.active,
        is_recurring: form.isRecurring,
        days_of_week_mask: form.isRecurring ? daysToMask(form.days) : null,
        daily_start_minutes: timeToMinutes(form.startTime),
        daily_end_minutes: timeToMinutes(form.endTime),
        start_date: new Date(`${form.startDate}T00:00:00Z`).toISOString(),
        end_date: new Date(`${form.endDate}T23:59:59Z`).toISOString(),
      }
      const result = form.id ? await update(form.id, payload) : await insert(payload)
      if (!result) {
        setErrors(['The offer could not be saved. Check that it does not overlap another active offer, then try again.'])
        return
      }
      toast.success(form.id ? 'Offer updated' : 'Offer created')
      setForm(null)
      refetch()
    } catch (error) {
      setErrors([error instanceof Error ? error.message : 'The offer could not be saved. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  async function changeActiveStatus(deal: QaDealRow) {
    setChangingStatusId(deal.id)
    setErrors([])
    try {
      const result = await update(deal.id, {
        business_account_id: businessAccountId,
        cash_back: deal.cash_back,
        description: deal.description,
        active: !deal.active,
        is_recurring: deal.is_recurring,
        days_of_week_mask: deal.days_of_week_mask,
        daily_start_minutes: deal.daily_start_minutes,
        daily_end_minutes: deal.daily_end_minutes,
        start_date: deal.start_date,
        end_date: deal.end_date,
      })
      if (!result) {
        setErrors([
          deal.active
            ? 'This offer could not be deactivated. Please try again.'
            : 'This offer could not be activated. Check that it does not overlap another active offer.',
        ])
        return
      }
      toast.success(deal.active ? 'Offer deactivated' : 'Offer activated')
      refetch()
    } finally {
      setChangingStatusId(null)
    }
  }

  function describeSchedule(deal: QaDealRow): string {
    const startDate = (deal.start_date || '').slice(0, 10)
    const endDate = (deal.end_date || '').slice(0, 10)
    const duration = durationBetween(startDate, endDate)
    const dateSummary = startDate && endDate
      ? `${startDate} to ${endDate}${duration ? ` (${duration} ${duration === 1 ? 'day' : 'days'})` : ''}`
      : 'Dates not set'

    if (!deal.is_recurring) {
      const time = deal.daily_start_minutes != null && deal.daily_end_minutes != null
        ? `, ${minutesToTime(deal.daily_start_minutes)}-${minutesToTime(deal.daily_end_minutes)}`
        : ''
      return `One-time offer: ${dateSummary}${time}`
    }

    const days = maskToDays(deal.days_of_week_mask)
      .map((selected, index) => selected ? DAY_LABELS[index] : null)
      .filter(Boolean)
      .join(', ')
    const time = deal.daily_start_minutes != null && deal.daily_end_minutes != null
      ? `${minutesToTime(deal.daily_start_minutes)}-${minutesToTime(deal.daily_end_minutes)}`
      : 'all day'
    return `Repeats ${days || 'on selected days'}, ${time}. ${dateSummary}`
  }

  return (
    <Card className={isPortal ? 'overflow-hidden border-brand-200 shadow-sm' : undefined}>
      <CardHeader className={isPortal ? 'border-b border-brand-100 bg-gradient-to-r from-brand-50 via-white to-success-50' : undefined}>
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="max-w-3xl">
            <div className="mb-2 flex items-center gap-2 text-brand-700">
              <Tag className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs font-semibold uppercase tracking-[0.16em]">
                {isPortal ? 'Bring customers in on your quieter days' : 'Customer deal'}
              </span>
            </div>
            <CardTitle>{isPortal ? 'Your LocalVIP offers' : 'LocalVIP Deals'}</CardTitle>
            <p className="mt-2 text-sm leading-6 text-surface-600">
              {isPortal
                ? 'Choose the cashback, dates, days, and times when customers can use each offer. You stay in control and can deactivate an offer whenever you need to.'
                : 'Create and schedule the cashback deals shown to customers. Overlapping active schedules are blocked.'}
            </p>
          </div>
          {!form ? (
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create offer
            </Button>
          ) : null}
        </div>
      </CardHeader>

      <CardContent className="space-y-5 pt-6">
        {form ? (
          <div className="space-y-6 rounded-2xl border border-brand-200 bg-surface-50 p-4 sm:p-6">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div>
                <h3 className="text-lg font-semibold text-surface-900">
                  {form.id ? 'Edit LocalVIP offer' : 'Create a LocalVIP offer'}
                </h3>
                <p className="text-sm text-surface-500">Set exactly when this offer is available to customers.</p>
              </div>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-surface-200 bg-white px-3 py-2">
                <span className="text-sm font-medium text-surface-700">Offer active</span>
                <input
                  type="checkbox"
                  role="switch"
                  aria-label="Offer active"
                  aria-checked={form.active}
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  className="h-4 w-4 accent-brand-600"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr),180px]">
              <div>
                <label htmlFor="deal-description" className="mb-1.5 block text-sm font-medium text-surface-700">
                  What is the offer? <span className="text-danger-600">*</span>
                </label>
                <Textarea
                  id="deal-description"
                  rows={3}
                  value={form.description}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder="Example: Enjoy lunch with 15% cashback on Tuesdays and Wednesdays."
                />
                <p className="mt-1 text-xs text-surface-500">Customers see this description with your offer.</p>
              </div>
              <div>
                <label htmlFor="deal-cashback" className="mb-1.5 block text-sm font-medium text-surface-700">
                  Cashback %
                </label>
                <Input
                  id="deal-cashback"
                  type="number"
                  inputMode="decimal"
                  min={1}
                  max={36}
                  step={1}
                  value={form.cashBack}
                  onChange={(event) => setForm({ ...form, cashBack: event.target.value })}
                  aria-describedby="deal-cashback-help"
                />
                <p id="deal-cashback-help" className="mt-1 text-xs text-surface-500">Choose 1% to 36%.</p>
              </div>
            </div>

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-surface-700">How often does it run?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`cursor-pointer rounded-xl border p-4 ${!form.isRecurring ? 'border-brand-500 bg-brand-50' : 'border-surface-200 bg-white'}`}>
                  <input
                    type="radio"
                    name="deal-schedule-type"
                    checked={!form.isRecurring}
                    onChange={() => setForm({ ...form, isRecurring: false })}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 font-semibold text-surface-900">
                    <CalendarDays className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    One-time date range
                  </span>
                  <span className="mt-1 block text-sm text-surface-500">Runs continuously for the selected number of days.</span>
                </label>
                <label className={`cursor-pointer rounded-xl border p-4 ${form.isRecurring ? 'border-brand-500 bg-brand-50' : 'border-surface-200 bg-white'}`}>
                  <input
                    type="radio"
                    name="deal-schedule-type"
                    checked={form.isRecurring}
                    onChange={() => setForm({ ...form, isRecurring: true })}
                    className="sr-only"
                  />
                  <span className="flex items-center gap-2 font-semibold text-surface-900">
                    <Repeat2 className="h-4 w-4 text-brand-600" aria-hidden="true" />
                    Recurring weekly
                  </span>
                  <span className="mt-1 block text-sm text-surface-500">Runs only on the weekdays you choose during the date range.</span>
                </label>
              </div>
            </fieldset>

            {form.isRecurring ? (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-surface-700">Which weekdays?</legend>
                <div className="flex flex-wrap gap-2">
                  {DAY_LABELS.map((label, index) => (
                    <button
                      key={label}
                      type="button"
                      aria-pressed={form.days[index]}
                      onClick={() => {
                        const days = [...form.days]
                        days[index] = !days[index]
                        setForm({ ...form, days })
                      }}
                      className={`min-w-12 rounded-full border px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                        form.days[index]
                          ? 'border-brand-500 bg-brand-600 text-white'
                          : 'border-surface-300 bg-white text-surface-600 hover:bg-surface-50'
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </fieldset>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="deal-start-date" className="mb-1.5 block text-sm font-medium text-surface-700">Start date</label>
                <Input id="deal-start-date" type="date" value={form.startDate} onChange={(event) => updateStartDate(event.target.value)} />
              </div>
              <div>
                <label htmlFor="deal-duration" className="mb-1.5 block text-sm font-medium text-surface-700">Duration in days</label>
                <Input
                  id="deal-duration"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={form.durationDays}
                  onChange={(event) => updateDuration(event.target.value)}
                  placeholder="7"
                />
              </div>
              <div>
                <label htmlFor="deal-end-date" className="mb-1.5 block text-sm font-medium text-surface-700">End date</label>
                <Input
                  id="deal-end-date"
                  type="date"
                  min={form.startDate || undefined}
                  value={form.endDate}
                  onChange={(event) => updateEndDate(event.target.value)}
                />
              </div>
            </div>
            <p className="-mt-4 text-xs text-surface-500">
              Enter a start date and duration to calculate the end date automatically, or change the end date to update the duration.
            </p>

            <fieldset className="rounded-xl border border-surface-200 bg-white p-4">
              <legend className="px-1 text-sm font-medium text-surface-700">Time window (optional)</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="deal-start-time" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    Start time
                  </label>
                  <Input id="deal-start-time" type="time" value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} />
                </div>
                <div>
                  <label htmlFor="deal-end-time" className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-surface-700">
                    <Clock3 className="h-4 w-4" aria-hidden="true" />
                    End time
                  </label>
                  <Input id="deal-end-time" type="time" value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} />
                </div>
              </div>
              <p className="mt-2 text-xs text-surface-500">Leave both blank for an all-day offer. Times use the business&apos;s local timezone.</p>
            </fieldset>

            {errors.length ? (
              <div role="alert" aria-live="polite" className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                <p className="font-semibold">Please fix the following:</p>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  {errors.map((error) => <li key={error}>{error}</li>)}
                </ul>
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void save()} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {form.id ? 'Save changes' : 'Create offer'}
              </Button>
              <Button variant="outline" onClick={() => { setForm(null); setErrors([]) }} disabled={saving}>Cancel</Button>
            </div>
          </div>
        ) : null}

        {errors.length && !form ? (
          <div role="alert" aria-live="polite" className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {errors[0]}
          </div>
        ) : null}

        {loadError ? (
          <div role="alert" className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            Your offers could not be loaded. Please refresh the page and try again.
          </div>
        ) : null}

        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-surface-500">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              Loading offers...
            </div>
          ) : (deals || []).length === 0 ? (
            <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 px-5 py-8 text-center">
              <p className="font-semibold text-surface-900">No LocalVIP offers yet</p>
              <p className="mx-auto mt-1 max-w-xl text-sm text-surface-500">
                Create an offer for the days and times when you want more customers.
              </p>
              {!form ? <Button className="mt-4" onClick={openNew}><Plus className="h-4 w-4" /> Create your first offer</Button> : null}
            </div>
          ) : (
            (deals || []).map((deal) => (
              <article key={deal.id} className="rounded-2xl border border-surface-200 bg-white p-4 sm:p-5">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xl font-bold text-surface-900">{Number(deal.cash_back)}% cashback</span>
                      <Badge variant={deal.active ? 'success' : 'default'}>{deal.active ? 'Active' : 'Inactive'}</Badge>
                      <Badge variant="info">{deal.is_recurring ? 'Recurring weekly' : 'One-time'}</Badge>
                    </div>
                    <p className="mt-2 text-sm font-medium text-surface-700">
                      {deal.description || 'LocalVIP cashback offer'}
                    </p>
                    <p className="mt-1 text-sm text-surface-500">{describeSchedule(deal)}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => openEdit(deal)}>
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={deal.active ? 'outline' : 'success'}
                      onClick={() => void changeActiveStatus(deal)}
                      disabled={changingStatusId === deal.id}
                      aria-label={`${deal.active ? 'Deactivate' : 'Activate'} ${Number(deal.cash_back)}% cashback offer`}
                    >
                      {changingStatusId === deal.id
                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                        : <Power className="h-3.5 w-3.5" aria-hidden="true" />}
                      {deal.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
