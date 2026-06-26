'use client'

import { Download, FileText } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import { BRANDS, MATERIAL_TYPES } from '@/lib/constants'
import type { Material } from '@/lib/types/database'

export function MaterialPreviewDialog({
  material,
  open,
  onOpenChange,
}: {
  material: Material | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const previewSource = material?.file_url || material?.thumbnail_url || null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[92vh] max-w-6xl flex-col overflow-hidden p-0">
        <DialogHeader className="border-b border-surface-100 px-6 py-4 pr-14">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <DialogTitle>{material?.title || 'Material preview'}</DialogTitle>
              <div className="flex flex-wrap items-center gap-2">
                {material && (
                  <>
                    <Badge variant={material.brand === 'hato' ? 'hato' : 'info'}>
                      {BRANDS[material.brand]?.label ?? material.brand}
                    </Badge>
                    <Badge variant="default">
                      {MATERIAL_TYPES.find((item) => item.value === material.type)?.label ?? material.type}
                    </Badge>
                  </>
                )}
              </div>
              <DialogDescription>
                Preview the material on screen and close it with the X when you are done.
              </DialogDescription>
            </div>

            {material?.file_url && (
              <Button size="sm" asChild>
                <a href={material.file_url} download>
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 bg-surface-50 p-4">
          {!previewSource ? (
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-surface-300 bg-white text-surface-400">
              <div className="space-y-2 text-center">
                <FileText className="mx-auto h-10 w-10" />
                <p className="text-sm font-medium text-surface-600">No preview file is available.</p>
              </div>
            </div>
          ) : (
            // The browser's native PDF/image viewer in a same-origin iframe is far
            // more reliable than client-side pdf.js (which needs a version-matched
            // worker and was failing across the app). PDFs and images both render
            // here. We make the iframe interactive (no pointer-events-none) so the
            // user gets native page nav / zoom / scroll inside the preview.
            <div className="h-full overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
              <MaterialPreviewFrame
                src={previewSource}
                mimeType={material?.mime_type}
                title={material?.title || 'Material preview'}
                className="h-full w-full"
                fit="contain"
                interactive
                pdfClassName="h-full w-full"
                imageSizes="100vw"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
