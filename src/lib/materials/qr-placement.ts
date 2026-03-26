export interface QrPlacement {
  id: string
  page: number
  x: number
  y: number
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
    x,
    y,
    size,
  }
}

export function createQrPlacementId() {
  return `qr_${Math.random().toString(36).slice(2, 10)}`
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
