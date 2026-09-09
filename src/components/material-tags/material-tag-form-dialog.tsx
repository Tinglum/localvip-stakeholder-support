'use client'

import * as React from 'react'
import { Loader2, Tag as TagIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { MaterialAudienceTag, MaterialAudienceTagDimension, MaterialAudienceTagInput } from './types'

export function MaterialTagFormDialog({
  tag,
  open,
  onOpenChange,
  onSaved,
}: {
  /** null = create new tag */
  tag: MaterialAudienceTag | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (tag: MaterialAudienceTag) => void
}) {
  const isEdit = Boolean(tag)
  const [label, setLabel] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [dimension, setDimension] = React.useState<MaterialAudienceTagDimension>('audience')
  const [description, setDescription] = React.useState('')
  const [matchesBusinessType, setMatchesBusinessType] = React.useState('')
  const [matchesAllCauses, setMatchesAllCauses] = React.useState(false)
  const [matchesAllBusinesses, setMatchesAllBusinesses] = React.useState(false)
  const [sortOrder, setSortOrder] = React.useState(0)
  const [isActive, setIsActive] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setLabel(tag?.label || '')
    setSlug(tag?.slug || '')
    setDimension(tag?.dimension || 'audience')
    setDescription(tag?.description || '')
    setMatchesBusinessType(tag?.matchesBusinessType || '')
    setMatchesAllCauses(tag?.matchesAllCauses ?? false)
    setMatchesAllBusinesses(tag?.matchesAllBusinesses ?? false)
    setSortOrder(tag?.sortOrder ?? 0)
    setIsActive(tag?.isActive ?? true)
    setError(null)
  }, [tag, open])

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const payload: MaterialAudienceTagInput = {
      label: label.trim(),
      slug: slug.trim() || undefined,
      dimension,
      description: description.trim() || null,
      matchesBusinessType: matchesBusinessType.trim() || null,
      matchesAllCauses,
      matchesAllBusinesses,
      sortOrder,
      isActive,
    }

    try {
      const res = await fetch(
        isEdit ? `/api/admin/material-tags/${tag!.id}` : '/api/admin/material-tags',
        {
          method: isEdit ? 'PUT' : 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        },
      )
      const body = await res.json().catch(() => null)
      if (!res.ok) {
        if (res.status === 409) {
          setError(body?.error || 'A tag with that slug already exists.')
        } else {
          setError(body?.error || 'The audience tag could not be saved.')
        }
        return
      }
      onSaved(body as MaterialAudienceTag)
      onOpenChange(false)
    } catch {
      setError('The audience tag could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TagIcon className="h-5 w-5 text-brand-600" />
            {isEdit ? 'Edit audience tag' : 'New audience tag'}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Update this tag. Built-in tags cannot change dimension.'
              : 'Audience tags drive who a generated material is matched to and where it applies.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} required placeholder="School Club/Sports" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Slug (optional)</label>
              <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="auto-generated from label" disabled={tag?.isSystem} />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Dimension</label>
              <select
                value={dimension}
                onChange={(e) => setDimension(e.target.value as MaterialAudienceTagDimension)}
                disabled={tag?.isSystem}
                className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm disabled:opacity-50"
              >
                <option value="audience">Audience — who receives it</option>
                <option value="scope">Scope — where it applies</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Sort order</label>
              <Input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What this tag matches and when to use it" />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-surface-700">Matches business type (optional)</label>
            <Input value={matchesBusinessType} onChange={(e) => setMatchesBusinessType(e.target.value)} placeholder="e.g. restaurant" />
          </div>

          <div className="flex flex-wrap gap-4">
            <label className="flex cursor-pointer items-center gap-2 text-sm text-surface-700">
              <input type="checkbox" checked={matchesAllCauses} onChange={(e) => setMatchesAllCauses(e.target.checked)} className="h-4 w-4 rounded border-surface-300" />
              Matches all causes
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-surface-700">
              <input type="checkbox" checked={matchesAllBusinesses} onChange={(e) => setMatchesAllBusinesses(e.target.checked)} className="h-4 w-4 rounded border-surface-300" />
              Matches all businesses
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-surface-700">
              <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="h-4 w-4 rounded border-surface-300" />
              Active
            </label>
          </div>

          {error && (
            <div className="rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <TagIcon className="h-4 w-4" />}
              {isEdit ? 'Save changes' : 'Create tag'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
