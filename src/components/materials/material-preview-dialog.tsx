'use client'
/* eslint-disable @next/next/no-img-element */

import * as React from 'react'
import { ChevronLeft, ChevronRight, Download, FileText, Loader2 } from 'lucide-react'
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

let pdfModulePromise: Promise<any> | null = null

async function loadPdfModule() {
  if (!pdfModulePromise) {
    pdfModulePromise = import('pdfjs-dist').then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      }
      return pdfjs
    })
  }

  return pdfModulePromise
}

function isPdfSource(src: string | null, mimeType?: string | null) {
  if (!src) return false

  return mimeType === 'application/pdf'
    || mimeType?.includes('pdf')
    || src.startsWith('data:application/pdf')
    || src.toLowerCase().includes('.pdf')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function PdfPreviewPane({
  src,
  title,
}: {
  src: string
  title: string
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const sizeHostRef = React.useRef<HTMLDivElement>(null)
  const pdfDocumentRef = React.useRef<any>(null)
  const [pageCount, setPageCount] = React.useState(1)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const [renderedSize, setRenderedSize] = React.useState({ width: 0, height: 0 })
  const [loadingPdf, setLoadingPdf] = React.useState(false)
  const [pdfError, setPdfError] = React.useState<string | null>(null)

  React.useEffect(() => {
    setCurrentPage(1)
    setPdfError(null)
  }, [src])

  React.useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      setContainerWidth(entry.contentRect.width)
    })

    if (sizeHostRef.current) observer.observe(sizeHostRef.current)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    let disposed = false

    setLoadingPdf(true)
    setPdfError(null)

    ;(async () => {
      try {
        const pdfjs = await loadPdfModule()
        const loadingTask = pdfjs.getDocument(src)
        const document = await loadingTask.promise

        if (disposed) {
          await document.destroy()
          return
        }

        pdfDocumentRef.current = document
        setPageCount(document.numPages || 1)
        setCurrentPage((value) => clamp(value, 1, document.numPages || 1))
      } catch (error) {
        console.error('Failed to load PDF preview', error)
        if (!disposed) {
          setPdfError('PDF preview could not be rendered.')
          pdfDocumentRef.current = null
          setPageCount(1)
        }
      } finally {
        if (!disposed) setLoadingPdf(false)
      }
    })()

    return () => {
      disposed = true
    }
  }, [src])

  React.useEffect(() => {
    if (!pdfDocumentRef.current || !canvasRef.current || !containerWidth) return

    let disposed = false

    setLoadingPdf(true)
    setPdfError(null)

    ;(async () => {
      try {
        const page = await pdfDocumentRef.current.getPage(currentPage)
        if (disposed) return

        const baseViewport = page.getViewport({ scale: 1 })
        const availableWidth = Math.max(containerWidth - 48, 260)
        const scale = availableWidth / baseViewport.width
        const cssWidth = baseViewport.width * scale
        const cssHeight = baseViewport.height * scale
        const outputScale = window.devicePixelRatio || 1
        const renderViewport = page.getViewport({ scale: scale * outputScale })
        const canvas = canvasRef.current
        if (!canvas) return
        const context = canvas.getContext('2d')

        if (!context) return

        canvas.width = Math.floor(renderViewport.width)
        canvas.height = Math.floor(renderViewport.height)
        canvas.style.width = `${cssWidth}px`
        canvas.style.height = `${cssHeight}px`

        const renderTask = page.render({
          canvasContext: context,
          viewport: renderViewport,
        })

        await renderTask.promise

        if (!disposed) {
          setRenderedSize({ width: cssWidth, height: cssHeight })
        }
      } catch (error) {
        console.error('Failed to render PDF page', error)
        if (!disposed) setPdfError('PDF page could not be rendered.')
      } finally {
        if (!disposed) setLoadingPdf(false)
      }
    })()

    return () => {
      disposed = true
    }
  }, [containerWidth, currentPage])

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-surface-200 bg-surface-0 px-3 py-2">
        <div className="flex items-center gap-2">
          <Badge variant="default">PDF</Badge>
          <span className="text-sm font-medium text-surface-700">
            Page {currentPage} of {pageCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentPage((page) => clamp(page - 1, 1, pageCount))}
            disabled={currentPage === 1}
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCurrentPage((page) => clamp(page + 1, 1, pageCount))}
            disabled={currentPage === pageCount}
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div ref={sizeHostRef} className="min-h-0 flex-1 overflow-auto rounded-2xl border border-surface-200 bg-surface-100 p-4">
        <div className="flex min-h-full items-start justify-center">
          <div
            className="relative overflow-hidden rounded-xl border border-surface-200 bg-white shadow-sm"
            style={renderedSize.width && renderedSize.height ? { width: renderedSize.width, height: renderedSize.height } : undefined}
          >
            <canvas ref={canvasRef} className="block" aria-label={`${title} PDF preview`} />
            {loadingPdf && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/80">
                <Loader2 className="h-5 w-5 animate-spin text-surface-400" />
              </div>
            )}
            {pdfError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-white text-surface-400">
                <FileText className="h-8 w-8" />
                <span className="text-xs font-medium">{pdfError}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
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
  const pdf = isPdfSource(previewSource, material?.mime_type)

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
          ) : pdf ? (
            <PdfPreviewPane src={previewSource} title={material?.title || 'Material preview'} />
          ) : (
            <div className="h-full overflow-auto rounded-2xl border border-surface-200 bg-surface-100 p-4">
              <div className="flex min-h-full items-center justify-center">
                <MaterialPreviewFrame
                  src={previewSource}
                  mimeType={material?.mime_type}
                  title={material?.title || 'Material preview'}
                  className="h-[78vh] w-full max-w-5xl rounded-xl border border-surface-200 bg-white shadow-sm"
                  fit="contain"
                  showPdfBadge={false}
                  pdfClassName="h-full w-full"
                  imageSizes="100vw"
                />
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
