'use client'

import * as React from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

// Minimal searchable dropdown, same pattern used in the outreach dialog.
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

export interface CityLinkEntityDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** "business" or "cause" — only affects copy, the caller supplies the matching options/handler. */
  entityLabel: string
  options: { value: string; label: string }[]
  onLink: (id: string) => Promise<boolean>
}

export function CityLinkEntityDialog({ open, onOpenChange, entityLabel, options, onLink }: CityLinkEntityDialogProps) {
  const [selectedId, setSelectedId] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) { setSelectedId(''); setError(null) }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedId) return
    setSaving(true)
    setError(null)
    const ok = await onLink(selectedId)
    setSaving(false)
    if (ok) {
      onOpenChange(false)
      setSelectedId('')
    } else {
      setError(`Could not link this ${entityLabel} to the city.`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Link a {entityLabel} to this city</DialogTitle>
          <DialogDescription>
            Choose an existing {entityLabel} to move into this city. It will show up in the {entityLabel} list below immediately.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg border border-danger-200 bg-danger-50 p-3 text-sm text-danger-700">
              {error}
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700 capitalize">{entityLabel} *</label>
            <SearchableSelect
              options={options}
              value={selectedId}
              onChange={setSelectedId}
              placeholder={`Search ${entityLabel}s...`}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving || !selectedId}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? 'Linking...' : 'Link'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
