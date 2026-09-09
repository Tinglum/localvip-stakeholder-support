'use client'

import * as React from 'react'
import { Loader2, Lock, Plus, RefreshCw, Tag as TagIcon, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { MaterialTagFormDialog } from '@/components/material-tags/material-tag-form-dialog'
import { DIMENSION_LABELS, type MaterialAudienceTag, type MaterialAudienceTagDimension } from '@/components/material-tags/types'

const DIMENSION_ORDER: MaterialAudienceTagDimension[] = ['audience', 'scope']

export default function MaterialTagsPage() {
  const [tags, setTags] = React.useState<MaterialAudienceTag[]>([])
  const [loading, setLoading] = React.useState(true)
  const [includeInactive, setIncludeInactive] = React.useState(true)
  const [formTag, setFormTag] = React.useState<MaterialAudienceTag | null | undefined>(undefined) // undefined = closed
  const [deleteBlocked, setDeleteBlocked] = React.useState<{ tag: MaterialAudienceTag; materialCount: number } | null>(null)
  const [busyId, setBusyId] = React.useState<number | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ includeInactive: includeInactive ? 'true' : 'false' })
      const res = await fetch(`/api/admin/material-tags?${qs}`, { cache: 'no-store' })
      const body = res.ok ? await res.json() : { items: [] }
      setTags(Array.isArray(body?.items) ? body.items : [])
    } finally {
      setLoading(false)
    }
  }, [includeInactive])

  React.useEffect(() => { void load() }, [load])

  async function toggleActive(tag: MaterialAudienceTag) {
    setBusyId(tag.id)
    try {
      const res = await fetch(`/api/admin/material-tags/${tag.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          label: tag.label,
          slug: tag.slug,
          dimension: tag.dimension,
          description: tag.description,
          matchesBusinessType: tag.matchesBusinessType,
          matchesAllCauses: tag.matchesAllCauses,
          matchesAllBusinesses: tag.matchesAllBusinesses,
          sortOrder: tag.sortOrder,
          isActive: !tag.isActive,
        }),
      })
      if (res.ok) {
        const updated = await res.json()
        setTags((prev) => prev.map((t) => (t.id === tag.id ? updated : t)))
      }
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(tag: MaterialAudienceTag) {
    if (tag.isSystem) {
      // Built-ins can never be deleted server-side either; explain instead of trying.
      setDeleteBlocked({ tag, materialCount: -1 })
      return
    }
    if (!confirm(`Delete the "${tag.label}" tag?`)) return

    setBusyId(tag.id)
    try {
      const res = await fetch(`/api/admin/material-tags/${tag.id}`, { method: 'DELETE' })
      if (res.ok) {
        setTags((prev) => prev.filter((t) => t.id !== tag.id))
        return
      }
      const body = await res.json().catch(() => null)
      if (res.status === 409 && typeof body?.materialCount === 'number') {
        setDeleteBlocked({ tag, materialCount: body.materialCount })
      } else if (res.status === 409) {
        setDeleteBlocked({ tag, materialCount: -1 })
      } else {
        alert(body?.error || 'The audience tag could not be deleted.')
      }
    } finally {
      setBusyId(null)
    }
  }

  function handleSaved(saved: MaterialAudienceTag) {
    setTags((prev) => {
      const exists = prev.some((t) => t.id === saved.id)
      return exists ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved]
    })
  }

  const grouped = React.useMemo(() => {
    const byDimension = new Map<MaterialAudienceTagDimension, MaterialAudienceTag[]>()
    for (const tag of tags) {
      const list = byDimension.get(tag.dimension) || []
      list.push(tag)
      byDimension.set(tag.dimension, list)
    }
    for (const list of byDimension.values()) list.sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
    return byDimension
  }, [tags])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Audience Tags"
        description="Tags that drive who a generated material is matched to (audience) and where it applies (scope)."
        actions={
          <>
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
            </Button>
            <Button onClick={() => setFormTag(null)}>
              <Plus className="h-4 w-4" /> New tag
            </Button>
          </>
        }
      />

      <div className="flex items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-surface-700">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="h-4 w-4 rounded border-surface-300"
          />
          Show inactive tags
        </label>
      </div>

      {loading ? (
        <Card className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </Card>
      ) : tags.length === 0 ? (
        <Card>
          <EmptyState
            icon={<TagIcon className="h-6 w-6" />}
            title="No audience tags yet"
            description="Create the first tag to start driving material generation targeting."
            action={{ label: 'New tag', onClick: () => setFormTag(null) }}
          />
        </Card>
      ) : (
        DIMENSION_ORDER.filter((d) => grouped.has(d)).map((dimension) => (
          <Card key={dimension} className="overflow-hidden">
            <div className="border-b border-surface-100 bg-surface-50 px-5 py-3">
              <p className="text-sm font-semibold text-surface-900">{DIMENSION_LABELS[dimension]}</p>
            </div>
            <div className="divide-y divide-surface-100">
              {(grouped.get(dimension) || []).map((tag) => (
                <div key={tag.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-surface-900">{tag.label}</p>
                      <code className="rounded bg-surface-100 px-1.5 py-0.5 text-xs text-surface-500">{tag.slug}</code>
                      {tag.isSystem && (
                        <Badge variant="info" title="Generation rules reference this tag's slug directly.">
                          <Lock className="h-3 w-3" /> Built-in
                        </Badge>
                      )}
                      <Badge variant={tag.isActive ? 'success' : 'default'}>{tag.isActive ? 'Active' : 'Inactive'}</Badge>
                      <Badge variant="outline">{tag.materialCount} material{tag.materialCount === 1 ? '' : 's'}</Badge>
                    </div>
                    {tag.description && <p className="mt-1 text-sm text-surface-500">{tag.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setFormTag(tag)} disabled={busyId === tag.id}>
                      Edit
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void toggleActive(tag)}
                      disabled={busyId === tag.id}
                    >
                      {busyId === tag.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : tag.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                    <Button
                      variant="danger"
                      size="icon-sm"
                      onClick={() => void handleDelete(tag)}
                      disabled={busyId === tag.id}
                      title={tag.isSystem ? "Built-in tags can't be deleted — deactivate instead" : 'Delete'}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        ))
      )}

      <MaterialTagFormDialog
        tag={formTag ?? null}
        open={formTag !== undefined}
        onOpenChange={(open) => !open && setFormTag(undefined)}
        onSaved={handleSaved}
      />

      {deleteBlocked && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-6" onClick={() => setDeleteBlocked(null)}>
          <Card className="max-w-md p-5" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-semibold text-surface-900">Can&apos;t delete &quot;{deleteBlocked.tag.label}&quot;</p>
            {deleteBlocked.tag.isSystem ? (
              <p className="mt-2 text-sm text-surface-600">
                This is a built-in tag — material generation rules reference its slug directly, so removing it would
                break generation. Deactivate it instead to hide it from new assignments while leaving existing
                references intact.
              </p>
            ) : (
              <p className="mt-2 text-sm text-surface-600">
                This tag is currently assigned to{' '}
                <strong>
                  {deleteBlocked.materialCount} material{deleteBlocked.materialCount === 1 ? '' : 's'}
                </strong>
                . Remove it from those materials first, then delete it — or deactivate it instead to stop it from
                being assigned to new materials.
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              {deleteBlocked.tag.isActive && (
                <Button variant="secondary" onClick={() => { void toggleActive(deleteBlocked.tag); setDeleteBlocked(null) }}>
                  Deactivate instead
                </Button>
              )}
              <Button variant="outline" onClick={() => setDeleteBlocked(null)}>Close</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
