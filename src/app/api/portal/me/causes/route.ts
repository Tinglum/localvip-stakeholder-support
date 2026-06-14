import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { parseJsonRequest, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

// Mobile QA endpoints backing the consumer "My Causes" portal page.
const CAUSES_CATALOG_PATH = '/api/mobile/v1/Causes/Catalog'
const CAUSES_SELECTION_PATH = '/api/mobile/v1/Causes/Selection'

// The .NET catalog/selection responses are sometimes wrapped in { items } or a
// { $values } envelope. Normalize either shape into a flat array.
function extractItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (!payload || typeof payload !== 'object') return []

  const record = payload as Record<string, unknown>
  for (const key of ['items', 'Items', '$values', 'value', 'data']) {
    const candidate = record[key]
    if (Array.isArray(candidate)) return candidate
  }
  return []
}

interface CauseCatalogItem {
  causeId: number
  name: string
  city: string | null
  description: string | null
  headline: string | null
}

interface CauseSelectionItem {
  causeId: number
  name: string
  weightBp: number
}

function toNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function toNullableString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}

function mapCatalogItem(entry: unknown): CauseCatalogItem | null {
  if (!entry || typeof entry !== 'object') return null
  const record = entry as Record<string, unknown>
  const causeId = Math.round(toNumber(record.causeId ?? record.CauseId ?? record.id))
  if (!causeId) return null
  return {
    causeId,
    name: toNullableString(record.name ?? record.Name) || 'Cause',
    city: toNullableString(record.city ?? record.City),
    description: toNullableString(record.description ?? record.Description),
    headline: toNullableString(record.headline ?? record.Headline),
  }
}

function mapSelectionItem(entry: unknown): CauseSelectionItem | null {
  if (!entry || typeof entry !== 'object') return null
  const record = entry as Record<string, unknown>
  const causeId = Math.round(toNumber(record.causeId ?? record.CauseId ?? record.id))
  if (!causeId) return null
  return {
    causeId,
    name: toNullableString(record.name ?? record.Name) || 'Cause',
    weightBp: Math.round(toNumber(record.weightBp ?? record.WeightBp)),
  }
}

export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess(['consumer'])
  if ('error' in access) return access.error

  const search = request.nextUrl.searchParams.get('search')?.trim() || ''
  const catalogQuery = new URLSearchParams()
  if (search) catalogQuery.set('search', search)
  catalogQuery.set('pageSize', '500')

  try {
    const [catalogRes, selectionRes] = await Promise.all([
      fetchQaApi(`${CAUSES_CATALOG_PATH}?${catalogQuery.toString()}`),
      fetchQaApi(CAUSES_SELECTION_PATH),
    ])

    const [catalogPayload, selectionPayload] = await Promise.all([
      parseQaResponse<unknown>(catalogRes, 'The causes catalog could not be loaded.'),
      parseQaResponse<unknown>(selectionRes, 'Your selected causes could not be loaded.'),
    ])

    const catalog = extractItems(catalogPayload)
      .map(mapCatalogItem)
      .filter((item): item is CauseCatalogItem => Boolean(item))

    const selection = extractItems(selectionPayload)
      .map(mapSelectionItem)
      .filter((item): item is CauseSelectionItem => Boolean(item))

    return NextResponse.json({ catalog, selection })
  } catch (error) {
    return qaRouteErrorResponse(error, 'Your causes could not be loaded.')
  }
}

interface CausesPutBody {
  selection?: Array<{ causeId?: unknown; weightBp?: unknown }>
}

export async function PUT(request: NextRequest) {
  const access = await requireQaRouteAccess(['consumer'])
  if ('error' in access) return access.error

  const body = await parseJsonRequest<CausesPutBody>(request)
  // Accept either { selection: [...] } or a bare array, then forward the bare
  // array that the mobile endpoint expects.
  const rawSelection = Array.isArray(body)
    ? body
    : Array.isArray(body?.selection)
      ? body.selection
      : null

  if (!rawSelection) {
    return NextResponse.json({ error: 'A causes selection array is required.' }, { status: 400 })
  }

  const selection = rawSelection
    .map((entry) => ({
      causeId: Math.round(toNumber((entry as Record<string, unknown>)?.causeId)),
      weightBp: Math.round(toNumber((entry as Record<string, unknown>)?.weightBp)),
    }))
    .filter((entry) => Number.isFinite(entry.causeId) && entry.causeId > 0)

  try {
    const res = await fetchQaApi(CAUSES_SELECTION_PATH, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(selection),
    })

    const result = await parseQaResponse<unknown>(res, 'Your causes selection could not be saved.')
    return NextResponse.json(result ?? { success: true, activeCount: selection.length })
  } catch (error) {
    return qaRouteErrorResponse(error, 'Your causes selection could not be saved.')
  }
}
