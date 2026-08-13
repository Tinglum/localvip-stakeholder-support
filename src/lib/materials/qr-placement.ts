export interface QrPlacement {
  id: string
  page: number
  /** Left edge as a percentage of the page width. */
  x: number
  /** Top edge as a percentage of the page height. */
  y: number
  /** QR square width as a percentage of the page width. */
  size: number
}

function normalizePlacement(value: unknown, fallbackPage = 1): QrPlacement | null {
  if (!value || typeof value !== 'object') return null

  const candidate = value as Partial<QrPlacement> & {
    x?: unknown
    y?: unknown
    size?: unknown
    id?: unknown
    page?: unknown
  }

  const x = typeof candidate.x === 'number' ? candidate.x : null
  const y = typeof candidate.y === 'number' ? candidate.y : null
  const size = typeof candidate.size === 'number' ? candidate.size : null
  const page = typeof candidate.page === 'number' && candidate.page > 0 ? candidate.page : fallbackPage

  if (x === null || y === null || size === null) return null

  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : createQrPlacementId(),
    page,
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y)),
    size: Math.min(100, Math.max(1, size)),
  }
}

export function createQrPlacementId() {
  return `qr_${Math.random().toString(36).slice(2, 10)}`
}

/**
 * The placement is a square BOUNDING BOX whose side is `size`% of the page
 * width, anchored at (`x`% of width, `y`% of height) — its top-left corner.
 * The QR image is contained inside that box (fit by the limiting dimension)
 * and centred, so the rendered rect never spills past the square the user
 * positioned no matter what aspect ratio the QR asset has (frames and
 * "GET MY OFFER" caption strips make it taller than wide).
 */
export function getQrRenderRect(
  placement: QrPlacement,
  pageWidth: number,
  pageHeight: number,
  imageWidth = 1,
  imageHeight = 1,
) {
  // Square in absolute units: the same length in both dimensions, both derived
  // from page width so the box does not stretch with the page's aspect ratio.
  const box = (placement.size / 100) * pageWidth
  const safeImageWidth = imageWidth > 0 ? imageWidth : 1
  const safeImageHeight = imageHeight > 0 ? imageHeight : safeImageWidth

  const scale = Math.min(box / safeImageWidth, box / safeImageHeight)
  const width = safeImageWidth * scale
  const height = safeImageHeight * scale

  const boxLeft = (placement.x / 100) * pageWidth
  const boxTop = (placement.y / 100) * pageHeight

  return {
    left: boxLeft + (box - width) / 2,
    top: boxTop + (box - height) / 2,
    width,
    height,
  }
}

export function getQrPlacements(metadata: Record<string, unknown> | null | undefined) {
  if (!metadata) return [] as QrPlacement[]

  const fromArray = Array.isArray(metadata.qr_placements)
    ? metadata.qr_placements
        .map((value) => normalizePlacement(value))
        .filter((value): value is QrPlacement => !!value)
    : []

  if (fromArray.length) return fromArray

  const legacy = normalizePlacement(metadata.qr_placement)
  return legacy ? [legacy] : []
}

export function hasQrPlacements(metadata: Record<string, unknown> | null | undefined) {
  return getQrPlacements(metadata).length > 0
}

export function qrPlacementMetadata(placements: QrPlacement[]) {
  const normalized = placements
    .map((placement) => normalizePlacement(placement, placement.page))
    .filter((value): value is QrPlacement => !!value)

  return {
    qr_placement: normalized[0] || null,
    qr_placements: normalized,
  }
}
