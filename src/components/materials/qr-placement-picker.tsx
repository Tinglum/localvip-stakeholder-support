'use client'
/* eslint-disable @next/next/no-img-element */

import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Move,
  QrCode,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createQrPlacementId, type QrPlacement } from '@/lib/materials/qr-placement'

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

function isPdfSource(src: string, mimeType?: string | null) {
  return mimeType === 'application/pdf'
    || mimeType?.includes('pdf')
    || src.startsWith('data:application/pdf')
    || src.toLowerCase().includes('.pdf')
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function placementLabel(placements: QrPlacement[], placement: QrPlacement) {
  const pagePlacements = placements.filter((item) => item.page === placement.page)
  const index = pagePlacements.findIndex((item) => item.id === placement.id)
  return `Page ${placement.page} / Zone ${index + 1}`
}

export function QrPlacementPicker({
  previewUrl,
  previewMimeType,
  placements,
  onChange,
}: {
  previewUrl: string
  previewMimeType?: string | null
  placements: QrPlacement[]
  onChange: (placements: QrPlacement[]) => void
}) {
  const isPdf = isPdfSource(previewUrl, previewMimeType)
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const pageFrameRef = React.useRef<HTMLDivElement>(null)
  const sizeHostRef = React.useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = React.useState(1)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [activePlacementId, setActivePlacementId] = React.useState<string | null>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const [renderedSize, setRenderedSize] = React.useState({ width: 0, height: 0 })
  const [loadingPdf, setLoadingPdf] = React.useState(false)
  const [pdfError, setPdfError] = React.useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = React.useState(false)
  const pdfDocumentRef = React.useRef<any>(null)
  const draggingIdRef = React.useRef<string | null>(null)

  const placementsOnCurrentPage = React.useMemo(
    () => placements.filter((placement) => placement.page === currentPage),
    [currentPage, placements],
  )

  const activePlacement = React.useMemo(
    () => placements.find((placement) => placement.id === activePlacementId) || null,
    [activePlacementId, placements],
  )

  React.useEffect(() => {
    setCurrentPage(1)
    setPdfError(null)
    setImageLoaded(false)
  }, [previewUrl])

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
    if (!placements.length) {
      setActivePlacementId(null)
      return
    }

    const active = placements.find((placement) => placement.id === activePlacementId)
    if (active?.page === currentPage) return

    const onCurrentPage = placements.find((placement) => placement.page === currentPage)
    setActivePlacementId(onCurrentPage?.id || null)
  }, [activePlacementId, currentPage, placements])

  React.useEffect(() => {
    if (!isPdf) {
      setPageCount(1)
      pdfDocumentRef.current = null
      return
    }

    let disposed = false
    setLoadingPdf(true)
    setPdfError(null)

    ;(async () => {
      try {
        const pdfjs = await loadPdfModule()
        const loadingTask = pdfjs.getDocument(previewUrl)
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
  }, [isPdf, previewUrl])

  React.useEffect(() => {
    if (!isPdf || !pdfDocumentRef.current || !canvasRef.current || !containerWidth) return

    let disposed = false
    setLoadingPdf(true)
    setPdfError(null)

    ;(async () => {
      try {
        const page = await pdfDocumentRef.current.getPage(currentPage)
        if (disposed) return

        const baseViewport = page.getViewport({ scale: 1 })
        const availableWidth = Math.max(containerWidth - 32, 240)
        const scale = availableWidth / baseViewport.width
        const cssWidth = baseViewport.width * scale
        const cssHeight = baseViewport.height * scale
        const outputScale = window.devicePixelRatio || 1
        const renderViewport = page.getViewport({ scale: scale * outputScale })
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')

        if (!canvas || !context) return

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
  }, [containerWidth, currentPage, isPdf])

  function updatePlacement(id: string, updates: Partial<QrPlacement>) {
    onChange(
      placements.map((placement) => (
        placement.id === id ? { ...placement, ...updates } : placement
      ))
    )
  }

  function removePlacement(id: string) {
    onChange(placements.filter((placement) => placement.id !== id))
    if (activePlacementId === id) {
      setActivePlacementId(null)
    }
  }

  function handleCanvasClick(event: React.MouseEvent<HTMLDivElement>) {
    if (!pageFrameRef.current || draggingIdRef.current) return

    const rect = pageFrameRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 100
    const y = ((event.clientY - rect.top) / rect.height) * 100
    const defaultSize = activePlacement?.size || 18

    const nextPlacement: QrPlacement = {
      id: createQrPlacementId(),
      page: currentPage,
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
      size: defaultSize,
    }

    onChange([...placements, nextPlacement])
    setActivePlacementId(nextPlacement.id)
  }

  function handlePlacementPointerDown(id: string, event: React.MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    draggingIdRef.current = id
    setActivePlacementId(id)
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!pageFrameRef.current || !draggingIdRef.current) return

    const currentPlacement = placements.find((placement) => placement.id === draggingIdRef.current)
    if (!currentPlacement) return

    const rect = pageFrameRef.current.getBoundingClientRect()
    const half = currentPlacement.size / 2
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, half, 100 - half)
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, half, 100 - half)

    updatePlacement(currentPlacement.id, {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    })
  }

  function stopDragging() {
    draggingIdRef.current = null
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <label className="block text-xs font-medium text-surface-600">
            <QrCode className="mr-1 inline h-3.5 w-3.5" />
            QR Code Placement Zones
          </label>
          <p className="mt-1 text-xs text-surface-400">
            Click on the current page to add another QR zone. Click a zone to select it, then drag to reposition.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-surface-500">
          <span>{placements.length} zone{placements.length !== 1 ? 's' : ''}</span>
          {isPdf && (
            <div className="flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-0 p-1">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => clamp(page - 1, 1, pageCount))}
                disabled={currentPage === 1}
                className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="min-w-20 text-center font-medium text-surface-700">
                Page {currentPage} of {pageCount}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => clamp(page + 1, 1, pageCount))}
                disabled={currentPage === pageCount}
                className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      <div ref={sizeHostRef} className="rounded-xl border-2 border-dashed border-surface-300 bg-surface-50 p-4">
        <div
          className="flex justify-center overflow-auto"
          onMouseMove={handleMouseMove}
          onMouseUp={stopDragging}
          onMouseLeave={stopDragging}
        >
          <div
            ref={pageFrameRef}
            className={cn(
              'relative cursor-crosshair overflow-hidden rounded-lg border border-surface-200 bg-white shadow-sm',
              !imageLoaded && !isPdf && 'min-h-[18rem] min-w-[12rem]',
            )}
            style={renderedSize.width && renderedSize.height ? { width: renderedSize.width, height: renderedSize.height } : undefined}
            onClick={handleCanvasClick}
          >
            {isPdf ? (
              <>
                <canvas ref={canvasRef} className="block" />
                {showPdfBadge()}
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
              </>
            ) : (
              <>
                <img
                  src={previewUrl}
                  alt="Material preview"
                  className="block h-auto max-w-full"
                  onLoad={(event) => {
                    const element = event.currentTarget
                    setImageLoaded(true)
                    setRenderedSize({
                      width: element.clientWidth,
                      height: element.clientHeight,
                    })
                  }}
                />
              </>
            )}

            {placementsOnCurrentPage.map((placement) => (
              <button
                key={placement.id}
                type="button"
                onMouseDown={(event) => handlePlacementPointerDown(placement.id, event)}
                onClick={(event) => {
                  event.stopPropagation()
                  setActivePlacementId(placement.id)
                }}
                className={cn(
                  'absolute flex items-center justify-center rounded border-2 transition-colors',
                  activePlacementId === placement.id
                    ? 'border-brand-600 bg-brand-500/15'
                    : 'border-brand-400 bg-brand-500/10 hover:bg-brand-500/15',
                )}
                style={{
                  left: `${placement.x - placement.size / 2}%`,
                  top: `${placement.y - placement.size / 2}%`,
                  width: `${placement.size}%`,
                  height: `${placement.size}%`,
                }}
              >
                <QrCode className="h-6 w-6 text-brand-700 opacity-70" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-4 text-xs text-surface-500">
          <div className="flex items-center gap-2">
            <Move className="h-3 w-3" />
            <span>
              {activePlacement
                ? `X: ${activePlacement.x.toFixed(1)}% Y: ${activePlacement.y.toFixed(1)}%`
                : 'Select a zone to adjust it'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-surface-500">Size:</label>
            <input
              type="range"
              min={8}
              max={40}
              value={activePlacement?.size || 18}
              disabled={!activePlacement}
              onChange={(event) => {
                if (!activePlacement) return
                updatePlacement(activePlacement.id, { size: Number(event.target.value) })
              }}
              className="h-1 w-28 accent-brand-500 disabled:opacity-40"
            />
            <span className="w-9 text-xs text-surface-500">
              {activePlacement ? `${activePlacement.size}%` : '--'}
            </span>
          </div>
          {activePlacement && (
            <button
              type="button"
              onClick={() => removePlacement(activePlacement.id)}
              className="inline-flex items-center gap-1 rounded-lg border border-danger-200 bg-danger-50 px-2.5 py-1 text-danger-700 transition-colors hover:bg-danger-100"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove selected
            </button>
          )}
        </div>

        {placements.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {placements.map((placement) => (
              <button
                key={placement.id}
                type="button"
                onClick={() => {
                  setCurrentPage(placement.page)
                  setActivePlacementId(placement.id)
                }}
                className={cn(
                  'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  activePlacementId === placement.id
                    ? 'border-brand-500 bg-brand-50 text-brand-700'
                    : 'border-surface-200 bg-surface-0 text-surface-600 hover:bg-surface-50',
                )}
              >
                {placementLabel(placements, placement)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function showPdfBadge() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-surface-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
      PDF
    </div>
  )
}
