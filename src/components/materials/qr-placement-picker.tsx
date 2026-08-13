'use client'
/* eslint-disable @next/next/no-img-element */

import * as React from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Move,
  QrCode,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createQrPlacementId, type QrPlacement } from '@/lib/materials/qr-placement'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'

// Placements use the QR square's top-left corner. Size is always measured
// against page width so the preview and every export path share one contract.
// The square is a bounding box: the QR image is contained inside it and
// centred, mirroring getQrRenderRect so the preview matches the stamped output.
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
  qrImageUrl,
}: {
  previewUrl: string
  previewMimeType?: string | null
  placements: QrPlacement[]
  onChange: (placements: QrPlacement[]) => void
  /** Optional real QR asset, so the preview uses its true aspect ratio. */
  qrImageUrl?: string | null
}) {
  const isPdf = isPdfSource(previewUrl, previewMimeType)
  const pageFrameRef = React.useRef<HTMLDivElement>(null)
  const sizeHostRef = React.useRef<HTMLDivElement>(null)
  const [pageCount, setPageCount] = React.useState(1)
  const [currentPage, setCurrentPage] = React.useState(1)
  const [activePlacementId, setActivePlacementId] = React.useState<string | null>(null)
  const [containerWidth, setContainerWidth] = React.useState(0)
  const [renderedSize, setRenderedSize] = React.useState({ width: 0, height: 0 })
  const [imageLoaded, setImageLoaded] = React.useState(false)
  // Height / width of the real QR asset. 1 (square) until we know better.
  const [qrAspect, setQrAspect] = React.useState(1)
  const draggingIdRef = React.useRef<string | null>(null)
  const dragOffsetRef = React.useRef({ x: 0, y: 0 })

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
    setImageLoaded(false)
    setRenderedSize({ width: 0, height: 0 })
  }, [previewUrl])

  React.useEffect(() => {
    if (!qrImageUrl) {
      setQrAspect(1)
      return
    }

    let cancelled = false
    const image = new Image()
    image.onload = () => {
      if (cancelled || !image.naturalWidth || !image.naturalHeight) return
      setQrAspect(image.naturalHeight / image.naturalWidth)
    }
    image.src = qrImageUrl

    return () => {
      cancelled = true
    }
  }, [qrImageUrl])

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

  function updatePlacement(id: string, updates: Partial<QrPlacement>) {
    onChange(
      placements.map((placement) => (
        placement.id === id ? { ...placement, ...updates } : placement
      ))
    )
  }

  // The bounding box is square in pixels, so its height as a percentage of the
  // page height is the width percentage rescaled by the page's aspect ratio.
  function qrHeightPercent(size: number) {
    if (!renderedSize.width || !renderedSize.height) return size
    return (size * renderedSize.width) / renderedSize.height
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
    const defaultSize = activePlacement?.size || 18
    const qrHeight = qrHeightPercent(defaultSize)
    const x = clamp(((event.clientX - rect.left) / rect.width) * 100, 0, 100 - defaultSize)
    const y = clamp(((event.clientY - rect.top) / rect.height) * 100, 0, 100 - qrHeight)

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
    const placement = placements.find((item) => item.id === id)
    const pageRect = pageFrameRef.current?.getBoundingClientRect()
    if (placement && pageRect) {
      dragOffsetRef.current = {
        x: ((event.clientX - pageRect.left) / pageRect.width) * 100 - placement.x,
        y: ((event.clientY - pageRect.top) / pageRect.height) * 100 - placement.y,
      }
    }
    draggingIdRef.current = id
    setActivePlacementId(id)
  }

  function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (!pageFrameRef.current || !draggingIdRef.current) return

    const currentPlacement = placements.find((placement) => placement.id === draggingIdRef.current)
    if (!currentPlacement) return

    const rect = pageFrameRef.current.getBoundingClientRect()
    const qrHeight = qrHeightPercent(currentPlacement.size)
    const x = clamp(
      ((event.clientX - rect.left) / rect.width) * 100 - dragOffsetRef.current.x,
      0,
      100 - currentPlacement.size,
    )
    const y = clamp(
      ((event.clientY - rect.top) / rect.height) * 100 - dragOffsetRef.current.y,
      0,
      100 - qrHeight,
    )

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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr),280px]">
        <div className="rounded-xl border-2 border-dashed border-surface-300 bg-surface-50 p-4">
          <div
            ref={sizeHostRef}
            className="flex max-h-[70vh] min-h-[26rem] justify-center overflow-auto"
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
                  {/* Render the actual PDF page so the overlay has the same
                      pixel origin and aspect ratio as exported output. */}
                  <PdfPagePreview
                    src={toProxiedMaterialUrl(previewUrl)}
                    page={currentPage}
                    width={clamp(containerWidth - 48, 240, 460)}
                    onRenderedSize={setRenderedSize}
                    onPageCount={setPageCount}
                  />
                  {showPdfBadge()}
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
                    left: `${placement.x}%`,
                    top: `${placement.y}%`,
                    width: `${placement.size}%`,
                    aspectRatio: '1 / 1',
                  }}
                >
                  {/* Contained QR rect: same fit-and-centre rule as
                      getQrRenderRect, expressed relative to the square box. */}
                  <span
                    className="flex items-center justify-center rounded-sm bg-brand-500/25"
                    style={
                      qrAspect >= 1
                        ? { height: '100%', width: `${100 / qrAspect}%` }
                        : { width: '100%', height: `${100 * qrAspect}%` }
                    }
                  >
                    <QrCode className="h-6 w-6 text-brand-700 opacity-70" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-surface-200 bg-white p-4 shadow-sm">
          <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Preview</p>
            <p className="mt-2 text-sm text-surface-700">
              The full page is scaled to fit inside this modal. Click on the page to add a QR zone.
            </p>
          </div>

          {isPdf && (
            <div className="rounded-lg border border-surface-200 bg-surface-50 p-2">
              <div className="flex items-center gap-1 rounded-lg border border-surface-200 bg-surface-0 p-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage((page) => clamp(page - 1, 1, pageCount))}
                  disabled={currentPage === 1}
                  className="rounded p-1 text-surface-500 transition-colors hover:bg-surface-100 disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-20 flex-1 text-center text-xs font-medium text-surface-700">
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
            </div>
          )}

          <div className="rounded-lg border border-surface-200 bg-surface-50 px-3 py-3 text-xs text-surface-500">
            <div className="flex items-center justify-between gap-2">
              <span>{placements.length} zone{placements.length !== 1 ? 's' : ''}</span>
              <span>{activePlacement ? placementLabel(placements, activePlacement) : 'No zone selected'}</span>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-surface-200 bg-surface-50 px-3 py-3">
            <div className="flex items-center gap-2 text-xs text-surface-500">
              <Move className="h-3 w-3" />
              <span>
                {activePlacement
                  ? `Left: ${activePlacement.x.toFixed(1)}% Top: ${activePlacement.y.toFixed(1)}%`
                  : 'Select a zone to adjust it'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-surface-500">QR width:</label>
              <input
                type="range"
                min={8}
                max={40}
                value={activePlacement?.size || 18}
                disabled={!activePlacement}
                onChange={(event) => {
                  if (!activePlacement) return
                  const nextSize = Number(event.target.value)
                  updatePlacement(activePlacement.id, {
                    size: nextSize,
                    x: Math.min(activePlacement.x, 100 - nextSize),
                    y: Math.min(activePlacement.y, 100 - qrHeightPercent(nextSize)),
                  })
                }}
                className="h-1 flex-1 accent-brand-500 disabled:opacity-40"
              />
              <span className="w-9 text-xs text-surface-500">
                {activePlacement ? `${activePlacement.size}%` : '--'}
              </span>
            </div>
            <p className="text-xs text-surface-400">
              Measured against page width. The square is a bounding box — the QR and any call-to-action are contained inside it.
            </p>
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
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Zones</p>
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
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function PdfPagePreview({
  src,
  page,
  width,
  onRenderedSize,
  onPageCount,
}: {
  src: string
  page: number
  width: number
  onRenderedSize: React.Dispatch<React.SetStateAction<{ width: number; height: number }>>
  onPageCount: React.Dispatch<React.SetStateAction<number>>
}) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  React.useEffect(() => {
    if (!src || !width || !canvasRef.current) return

    let cancelled = false
    let loadingTask: { destroy: () => Promise<void>; promise: Promise<any> } | null = null
    let renderTask: { cancel: () => void; promise: Promise<void> } | null = null

    async function renderPdfPage() {
      const response = await fetch(src)
      if (!response.ok) throw new Error('The PDF preview could not be loaded.')

      const pdfjs = await import('pdfjs-dist')
      if (!pdfjs.GlobalWorkerOptions.workerSrc) {
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
      }

      loadingTask = pdfjs.getDocument({ data: await response.arrayBuffer() })
      const document = await loadingTask.promise
      const safePage = clamp(page, 1, document.numPages)
      const pdfPage = await document.getPage(safePage)
      const baseViewport = pdfPage.getViewport({ scale: 1 })
      const viewport = pdfPage.getViewport({ scale: width / baseViewport.width })
      const canvas = canvasRef.current
      if (!canvas || cancelled) return

      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      canvas.style.width = `${viewport.width}px`
      canvas.style.height = `${viewport.height}px`
      const context = canvas.getContext('2d')
      if (!context) return

      const currentRenderTask = pdfPage.render({ canvasContext: context, viewport })
      renderTask = currentRenderTask
      await currentRenderTask.promise
      if (!cancelled) {
        onRenderedSize({ width: viewport.width, height: viewport.height })
        onPageCount(document.numPages)
      }
    }

    renderPdfPage().catch(() => {
      if (!cancelled) {
        onRenderedSize({ width, height: width / (8.5 / 11) })
        onPageCount(1)
      }
    })

    return () => {
      cancelled = true
      renderTask?.cancel()
      void loadingTask?.destroy()
    }
  }, [onPageCount, onRenderedSize, page, src, width])

  return <canvas ref={canvasRef} className="pointer-events-none block bg-white" />
}

function showPdfBadge() {
  return (
    <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-surface-900/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white">
      PDF
    </div>
  )
}
