'use client'

import * as React from 'react'
import { Loader2, Users2 } from 'lucide-react'
import { DIMENSION_LABELS, type MaterialAudienceTag } from './types'

/**
 * "Who is this for?" tag picker used from the material edit dialog.
 *
 * Loads the full active tag catalog plus (when editing an existing material) the
 * material's currently-assigned tags, and lets the user toggle them grouped by
 * dimension. The parent owns the selected id set and is responsible for persisting
 * it — see material-edit-dialog.tsx for save sequencing on brand-new materials.
 */
export function MaterialTagPicker({
  materialId,
  selectedTagIds,
  onChange,
}: {
  materialId: string | null
  selectedTagIds: number[]
  onChange: (ids: number[]) => void
}) {
  const [tags, setTags] = React.useState<MaterialAudienceTag[]>([])
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const loadedForMaterialId = React.useRef<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    async function load() {
      try {
        const [tagsRes, currentRes] = await Promise.all([
          fetch('/api/admin/material-tags', { cache: 'no-store' }),
          materialId
            ? fetch(`/api/admin/material-tags/material/${encodeURIComponent(materialId)}`, { cache: 'no-store' })
            : Promise.resolve(null),
        ])

        if (cancelled) return

        if (!tagsRes.ok) {
          setError('Audience tags could not be loaded.')
          return
        }
        const tagsPayload = await tagsRes.json()
        setTags(Array.isArray(tagsPayload?.items) ? tagsPayload.items : [])

        // Only seed the current selection from the server the first time we load
        // this material — after that the parent's state (from user toggles) wins.
        if (currentRes && currentRes.ok && loadedForMaterialId.current !== materialId) {
          const currentPayload = await currentRes.json()
          const ids = Array.isArray(currentPayload?.items)
            ? currentPayload.items.map((item: { id: number }) => item.id)
            : []
          onChange(ids)
        }
        loadedForMaterialId.current = materialId
      } catch {
        if (!cancelled) setError('Audience tags could not be loaded.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialId])

  function toggle(id: number) {
    onChange(selectedTagIds.includes(id) ? selectedTagIds.filter((x) => x !== id) : [...selectedTagIds, id])
  }

  const grouped = React.useMemo(() => {
    const active = tags.filter((t) => t.isActive)
    const byDimension = new Map<string, MaterialAudienceTag[]>()
    for (const tag of active) {
      const list = byDimension.get(tag.dimension) || []
      list.push(tag)
      byDimension.set(tag.dimension, list)
    }
    for (const list of byDimension.values()) list.sort((a, b) => a.sortOrder - b.sortOrder)
    return byDimension
  }, [tags])

  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
      <div className="flex items-center gap-2">
        <Users2 className="h-4 w-4 text-brand-600" />
        <p className="text-sm font-semibold text-surface-900">Who is this for?</p>
        {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-surface-400" />}
      </div>
      <p className="mt-1 text-xs text-surface-500">
        Audience tags drive automatic material generation and library filtering. These run alongside the legacy
        visibility tags above — assign both for now.
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-danger-200 bg-danger-50 px-3 py-2 text-xs text-danger-700">
          {error}
        </div>
      )}

      {!error && !loading && tags.length === 0 && (
        <p className="mt-3 text-xs text-surface-400">No audience tags have been created yet.</p>
      )}

      {!error && grouped.size > 0 && (
        <div className="mt-4 space-y-4">
          {Array.from(grouped.entries()).map(([dimension, list]) => (
            <div key={dimension}>
              <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-surface-500">
                {DIMENSION_LABELS[dimension as keyof typeof DIMENSION_LABELS] || dimension}
              </p>
              <div className="flex flex-wrap gap-2">
                {list.map((tag) => {
                  const active = selectedTagIds.includes(tag.id)
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggle(tag.id)}
                      title={tag.description || undefined}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                        active
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-700'
                      }`}
                    >
                      {tag.label}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
