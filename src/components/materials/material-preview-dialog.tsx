'use client'

import * as React from 'react'
import DOMPurify from 'dompurify'
import mammoth from 'mammoth'
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
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import type { Material } from '@/lib/types/database'

// Office formats a browser genuinely cannot render inline. No <iframe>/<object>
// trick fixes this, and we deliberately don't route these through a third-party
// viewer (Google/Microsoft) since that would send a customer's private document
// off-platform. The honest answer is: tell the user, offer the download.
const UNPREVIEWABLE_EXTENSIONS = ['doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx']
const UNPREVIEWABLE_MIME_TYPES = [
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]

function getFileExtension(name: string | null | undefined, url: string | null | undefined): string | null {
  const source = name || url || ''
  const match = source.split('?')[0].split('#')[0].match(/\.([a-z0-9]+)$/i)
  return match ? match[1].toLowerCase() : null
}

function isUnpreviewableOfficeFile(material: Material | null): boolean {
  if (!material) return false
  const extension = getFileExtension(material.file_name, material.file_url)
  if (extension && UNPREVIEWABLE_EXTENSIONS.includes(extension)) return true
  if (material.mime_type && UNPREVIEWABLE_MIME_TYPES.includes(material.mime_type)) return true
  return false
}

function isWordDocument(material: Material | null): boolean {
  if (!material) return false
  const extension = getFileExtension(material.file_name, material.file_url)
  return extension === 'docx'
    || material.mime_type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

function WordDocumentPreview({ source, title }: { source: string; title: string }) {
  const [html, setHtml] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setHtml(null)
    setError(null)

    async function render() {
      try {
        const response = await fetch(toProxiedMaterialUrl(source), { cache: 'no-store' })
        if (!response.ok) throw new Error(`Document returned ${response.status}.`)
        const result = await mammoth.convertToHtml({ arrayBuffer: await response.arrayBuffer() })
        const safeHtml = DOMPurify.sanitize(result.value, {
          USE_PROFILES: { html: true },
          ADD_ATTR: ['target'],
        })
        if (!cancelled) setHtml(safeHtml)
      } catch {
        if (!cancelled) setError('The Word preview could not be generated. You can still download the document.')
      }
    }

    void render()
    return () => { cancelled = true }
  }, [source])

  if (error) {
    return <div className="flex h-full items-center justify-center p-8 text-center text-sm text-surface-600">{error}</div>
  }
  if (html === null) {
    return <div className="flex h-full items-center justify-center text-sm text-surface-500">Preparing Word preview…</div>
  }
  return (
    <div className="h-full overflow-auto bg-surface-100 p-4 sm:p-8">
      <article
        aria-label={`${title} Word preview`}
        className="prose prose-sm mx-auto min-h-full max-w-4xl bg-white p-8 text-surface-900 shadow-sm sm:p-12"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function formatFileSize(bytes: number | null | undefined): string | null {
  if (!bytes || bytes <= 0) return null
  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  const precision = unitIndex === 0 ? 0 : 1
  return `${value.toFixed(precision)} ${units[unitIndex]}`
}

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
  const isWord = isWordDocument(material)
  const isUnpreviewable = !isWord && isUnpreviewableOfficeFile(material)

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
          ) : isWord ? (
            <div className="h-full overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-sm">
              <WordDocumentPreview source={previewSource} title={material?.title || 'Material'} />
            </div>
          ) : isUnpreviewable ? (
            // Word/PowerPoint/Excel files cannot be rendered inline by a browser.
            // that's a real platform limitation, not something an iframe trick
            // fixes. Say so plainly and hand over the download instead of leaving
            // a blank/broken preview frame, which reads as a failure.
            <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-surface-300 bg-white text-surface-400">
              <div className="max-w-sm space-y-3 text-center">
                <FileText className="mx-auto h-10 w-10" />
                <div className="space-y-1">
                  <p className="text-sm font-medium text-surface-700 break-words">
                    {material?.file_name || material?.title || 'This document'}
                  </p>
                  <p className="text-xs text-surface-500">
                    {[
                      MATERIAL_TYPES.find((item) => item.value === material?.type)?.label,
                      formatFileSize(material?.file_size),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <p className="text-sm text-surface-600">
                  This file format can&apos;t be previewed in the browser. Download it to view it.
                </p>
                {material?.file_url && (
                  <Button size="sm" asChild>
                    <a href={material.file_url} download>
                      <Download className="h-4 w-4" />
                      Download
                    </a>
                  </Button>
                )}
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
