'use client'

import * as React from 'react'
import { Plus, Loader2, Save } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useOutreachInsert } from '@/lib/supabase/hooks'
import type { OutreachActivity, OutreachType } from '@/lib/types/database'

// No `useOutreachUpdate` exists in src/lib/supabase/hooks.ts (only
// `useOutreachInsert`). This project's edit convention (see e.g. the
// generic `useQaUpdate` factory in hooks.ts) is a PUT to
// `/api/qa/dashboard/<table>/<id>`, which IS wired for `outreach_activities`
// (see src/lib/qa/dashboard-entity-map.ts -> `/api/dashboard/v1/Outreach/{id}`).
// hooks.ts is out of scope for this change, so the same call is made here
// directly rather than adding a hook there.
async function updateOutreachActivity(
  id: string,
  changes: Partial<OutreachActivity>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/qa/dashboard/outreach_activities/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(changes),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      let msg = `Update failed with ${res.status}`
      try {
        const parsed = JSON.parse(text)
        msg = parsed?.error || msg
      } catch {
        if (text) msg = text
      }
      return { ok: false, error: msg }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Failed to update outreach activity.' }
  }
}

function SearchableSelect({ options, value, onChange, placeholder }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  const [search, setSearch] = React.useState('')
  const [open, setOpen] = React.useState(false)
  const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
  const selected = options.find(o => o.value === value)

  return (
    <div className="relative">
      <input
        type="text"
        value={open ? search : (selected?.label || '')}
        onChange={e => { setSearch(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      />
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-surface-200 bg-surface-0 py-1 shadow-lg">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-surface-400">No results</p>
            ) : filtered.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setSearch(''); setOpen(false) }}
                className="flex w-full items-center px-3 py-1.5 text-sm text-left hover:bg-surface-50 text-surface-700"
              >
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export interface OutreachEntityOption { value: string; label: string }

export interface OutreachActivityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The activity being edited, or null/undefined to create a new one. */
  activity?: OutreachActivity | null
  performedByName?: string
  performedById?: string
  businesses: OutreachEntityOption[]
  causes: OutreachEntityOption[]
  contacts: OutreachEntityOption[]
  onSaved: () => void
}

export function OutreachActivityDialog({
  open, onOpenChange, activity, performedByName, performedById,
  businesses, causes, contacts, onSaved,
}: OutreachActivityDialogProps) {
  const isEdit = !!activity
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const { insert } = useOutreachInsert()

  const [type, setType] = React.useState<OutreachType | ''>('')
  const [subject, setSubject] = React.useState('')
  const [entityType, setEntityType] = React.useState<'business' | 'cause' | 'contact'>('business')
  const [entityId, setEntityId] = React.useState('')
  const [outcome, setOutcome] = React.useState('')
  const [nextStep, setNextStep] = React.useState('')
  const [nextStepDate, setNextStepDate] = React.useState('')

  const resetForm = React.useCallback(() => {
    setType('')
    setSubject('')
    setEntityType('business')
    setEntityId('')
    setOutcome('')
    setNextStep('')
    setNextStepDate('')
    setError(null)
  }, [])

  // Pre-fill from the activity being edited whenever the dialog opens for it.
  React.useEffect(() => {
    if (!open) return
    if (activity) {
      setType(activity.type)
      setSubject(activity.subject || '')
      setEntityType(activity.entity_type)
      setEntityId(activity.entity_id)
      setOutcome(activity.outcome || '')
      setNextStep(activity.next_step || '')
      setNextStepDate(activity.next_step_date ? activity.next_step_date.slice(0, 10) : '')
      setError(null)
    } else {
      resetForm()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity])

  const entityOptions = React.useMemo(() => {
    if (entityType === 'business') return businesses
    if (entityType === 'cause') return causes
    if (entityType === 'contact') return contacts
    return []
  }, [entityType, businesses, causes, contacts])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!type) return
    setSubmitting(true)
    setError(null)

    if (isEdit && activity) {
      const result = await updateOutreachActivity(activity.id, {
        type,
        subject: subject || null,
        entity_type: entityType,
        entity_id: entityId,
        outcome: outcome || null,
        next_step: nextStep || null,
        next_step_date: nextStepDate || null,
      })
      setSubmitting(false)
      if (result.ok) {
        onOpenChange(false)
        onSaved()
      } else {
        setError(result.error)
      }
      return
    }

    const result = await insert({
      type,
      subject: subject || null,
      entity_type: entityType,
      entity_id: entityId,
      performed_by: performedById,
      outcome: outcome || null,
      next_step: nextStep || null,
      next_step_date: nextStepDate || null,
    } as Partial<OutreachActivity>)

    setSubmitting(false)

    if (result) {
      onOpenChange(false)
      resetForm()
      onSaved()
    } else {
      setError('Failed to log outreach activity.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) resetForm() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Outreach Activity' : 'Log Outreach Activity'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this call, visit, email, or message.'
              : 'Record a call, visit, email, or message. This builds the relationship history.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              {error}
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Type *</label>
              <select
                className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                required
                value={type}
                onChange={e => setType(e.target.value as OutreachType)}
              >
                <option value="">Select type</option>
                <option value="call">Phone Call</option>
                <option value="email">Email</option>
                <option value="in_person">In Person</option>
                <option value="text">Text Message</option>
                <option value="social_media">Social Media</option>
                <option value="referral">Referral</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Performed By</label>
              <input
                type="text"
                readOnly
                value={performedByName || ''}
                className="h-9 w-full rounded-lg border border-surface-300 bg-surface-50 px-3 text-sm text-surface-500 cursor-not-allowed"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">Subject</label>
            <Input placeholder="Brief subject line" value={subject} onChange={e => setSubject(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Entity Type *</label>
              <select
                className="h-9 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                required
                value={entityType}
                onChange={e => { setEntityType(e.target.value as 'business' | 'cause' | 'contact'); setEntityId('') }}
              >
                <option value="business">Business</option>
                <option value="cause">Cause</option>
                <option value="contact">Contact</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Entity *</label>
              <SearchableSelect
                options={entityOptions}
                value={entityId}
                onChange={setEntityId}
                placeholder={`Search ${entityType}s...`}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">Outcome</label>
            <Textarea placeholder="What happened? Be specific — this is the relationship record." value={outcome} onChange={e => setOutcome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Next Step</label>
              <Input placeholder="What should happen next?" value={nextStep} onChange={e => setNextStep(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-surface-700">Next Step Date</label>
              <Input type="date" value={nextStepDate} onChange={e => setNextStepDate(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => { onOpenChange(false); resetForm() }}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : isEdit ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {submitting ? (isEdit ? 'Saving...' : 'Logging...') : (isEdit ? 'Save Changes' : 'Log Activity')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
