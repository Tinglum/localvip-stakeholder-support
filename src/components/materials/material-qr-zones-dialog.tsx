'use client'

import * as React from 'react'
import { Loader2, QrCode } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QrPlacementPicker } from '@/components/materials/qr-placement-picker'
import { getQrPlacements, qrPlacementMetadata, type QrPlacement } from '@/lib/materials/qr-placement'
import { useMaterialUpdate } from '@/lib/supabase/hooks'
import type { Material } from '@/lib/types/database'

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value)
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : null
    } catch {
      return null
    }
  }
  return null
}

function samePlacements(left: QrPlacement[], right: QrPlacement[]) {
  if (left.length !== right.length) return false
  return left.every((placement, index) => {
    const saved = right[index]
    return saved
      && placement.page === saved.page
      && placement.x === saved.x
      && placement.y === saved.y
      && placement.size === saved.size
  })
}

export function MaterialQrZonesDialog({
  material,
  open,
  onOpenChange,
  onSaved,
}: {
  material: Material | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
}) {
  const { update, loading, error } = useMaterialUpdate()
  const [placements, setPlacements] = React.useState<QrPlacement[]>([])
  const [saveError, setSaveError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!material || !open) return
    setPlacements(getQrPlacements(material.metadata as Record<string, unknown> | null))
    setSaveError(null)
  }, [material, open])

  async function handleSave() {
    if (!material) return

    setSaveError(null)

    const nextMetadata = {
      ...((material.metadata as Record<string, unknown> | null) || {}),
      ...qrPlacementMetadata(placements),
    }

    const result = await update(material.id, {
      metadata: nextMetadata,
    })

    if (!result) {
      setSaveError('QR zones could not be saved.')
      return
    }

    const savedPlacements = getQrPlacements(result.metadata as Record<string, unknown> | null)
    if (!samePlacements(placements, savedPlacements)) {
      setSaveError('The saved QR position could not be verified. Please try again.')
      return
    }

    // Also sync the zone to the matching template's qr_position_json, so when a
    // business generates this template the QR is stamped where it was placed (the
    // template is keyed by its source design file = this material's file_url).
    try {
      const tplRes = await fetch('/api/qa/dashboard/material_templates?is_active=true', { cache: 'no-store' })
      if (!tplRes.ok) throw new Error('Template list could not be loaded.')

      const tj = await tplRes.json()
      const items: Array<Record<string, unknown>> = Array.isArray(tj) ? tj : (tj?.items || [])
      const match = items.find((template) => {
        const sourcePath = template.sourcePath ?? template.source_path
        const position = asRecord(template.qr_position ?? template.qr_position_json)
        return sourcePath === material.file_url
          || String(position?.source_material_id || '') === String(material.id)
      })

      if (match) {
        const templatePlacement = {
          source_material_id: material.id,
          ...qrPlacementMetadata(placements),
        }
        const syncResponse = await fetch(`/api/qa/dashboard/material_templates/${match.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qr_position_json: JSON.stringify(templatePlacement) }),
        })
        if (!syncResponse.ok) throw new Error('Template position update failed.')
      }
    } catch {
      setSaveError('The material position was saved, but its generated-material template could not be synchronized.')
      return
    }

    onSaved()
    onOpenChange(false)
  }

  const previewUrl = material?.file_url || material?.thumbnail_url || ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-brand-500" />
            Edit QR Zones
          </DialogTitle>
          <DialogDescription>
            {material
              ? `Set the saved QR placement zones for ${material.title}. PDFs export as stamped PDFs, and images export as stamped PNGs.`
              : 'Set QR placement zones for this material.'}
          </DialogDescription>
        </DialogHeader>

        {material && previewUrl ? (
          <div className="space-y-4">
            <QrPlacementPicker
              previewUrl={previewUrl}
              previewMimeType={material.mime_type}
              placements={placements}
              onChange={setPlacements}
            />

            {(saveError || error) && (
              <div className="rounded-lg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {saveError || error}
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
            This material does not have a previewable file attached yet.
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setPlacements([])}
            disabled={loading || !material}
          >
            Clear All Zones
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="button" onClick={handleSave} disabled={loading || !material}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : (
                <>
                  <QrCode className="h-4 w-4" /> Save QR Zones
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
