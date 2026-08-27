import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { ensureCoreCampaignStructuredTemplates } from '@/lib/server/core-campaign-templates'
import { createServiceClient } from '@/lib/supabase/server'
import {
  EMPTY_FALLBACK_TABLES,
  FIELD_ALIASES,
  QA_ENTITY_MAP,
  QaEntityKey,
  toCamelCase,
  toBackendShape,
  toFrontendShape,
} from '@/lib/qa/dashboard-entity-map'

function isMappedEntity(table: string): table is QaEntityKey {
  return table in QA_ENTITY_MAP
}

function safeErrorHeader(message: string) {
  return message
    .replace(/[\r\n]+/g, ' ')
    .replace(/[^\x20-\x7E]/g, '')
    .slice(0, 200)
}

function buildBackendSearch(table: QaEntityKey, request: NextRequest) {
  const aliases = FIELD_ALIASES[table] || {}
  const params = new URLSearchParams()

  for (const [key, value] of request.nextUrl.searchParams.entries()) {
    if (!key) continue
    const backendKey = aliases[key] || toCamelCase(key)
    params.append(backendKey, value)
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

/**
 * GET /api/qa/dashboard/{table}
 *
 * Lists records for the given table. Returns the JSON array directly so the
 * existing Supabase-shaped hooks work unchanged.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { table: string } },
) {
  const { table } = params

  if (table === 'material_templates') {
    try {
      const supabase = createServiceClient()
      await ensureCoreCampaignStructuredTemplates(supabase)
    } catch {
      // If template seeding fails, keep the read path alive and fall through to
      // the backend fetch rather than breaking the template list entirely.
    }
  }

  // Frontend-only tables that have no QA backend equivalent: return empty
  if (EMPTY_FALLBACK_TABLES.has(table)) {
    return NextResponse.json([])
  }

  if (!isMappedEntity(table)) {
    return NextResponse.json(
      { error: `Unknown QA entity: ${table}` },
      { status: 400 },
    )
  }

  const config = QA_ENTITY_MAP[table]
  const search = buildBackendSearch(table, request)

  try {
    const res = await fetchQaApi(config.endpoint + (search || ''))
    const json = await parseQaResponse<unknown>(res, `Failed to load ${table}.`)

    // Some endpoints wrap their data in { items: [...], totalCount }
    // Auto-detect: if the response is an object with an `items` array, unwrap it.
    let items: unknown = json
    if (
      json &&
      typeof json === 'object' &&
      !Array.isArray(json) &&
      Array.isArray((json as Record<string, unknown>).items)
    ) {
      items = (json as Record<string, unknown>).items
    } else if (
      json &&
      typeof json === 'object' &&
      config.listWrapperKey &&
      config.listWrapperKey in (json as Record<string, unknown>)
    ) {
      items = (json as Record<string, unknown>)[config.listWrapperKey]
    }

    // The envelope's totalCount is the only honest row count: the backend pages
    // (User/list defaults to 50), so counting the returned array under-reports any
    // table bigger than one page. Unwrapping to a bare array is load-bearing for
    // every existing caller, so the total rides along as a header instead.
    const totalCount =
      json && typeof json === 'object' && !Array.isArray(json)
        ? (json as Record<string, unknown>).totalCount
        : undefined

    const shaped = toFrontendShape(table, items)
    const headers =
      typeof totalCount === 'number' && Number.isFinite(totalCount)
        ? { 'x-qa-total-count': String(totalCount) }
        : undefined
    return NextResponse.json(shaped ?? [], headers ? { headers } : undefined)
  } catch (error) {
    if (error instanceof QaApiError) {
      if (table === 'stakeholder_assignments' || table === 'generated_materials') {
        return NextResponse.json(
          { error: error.message },
          { status: error.status, headers: { 'x-qa-error': safeErrorHeader(error.message) } },
        )
      }
      // Backend returned an error — surface as empty list to keep pages functional
      // but log via status header for debugging
      return NextResponse.json([], {
        headers: { 'x-qa-error': safeErrorHeader(error.message) },
      })
    }
    const message = error instanceof Error ? error.message : `Failed to load ${table}.`
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'x-qa-error': safeErrorHeader(message) } },
    )
  }
}

/**
 * POST /api/qa/dashboard/{table}
 *
 * Creates a new record. Accepts frontend-shape (snake_case) payload, converts
 * to backend shape, and returns the created record in frontend shape.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { table: string } },
) {
  const { table } = params

  if (EMPTY_FALLBACK_TABLES.has(table)) {
    return NextResponse.json(
      { error: `${table} cannot be created — no QA backend yet.` },
      { status: 501 },
    )
  }

  if (!isMappedEntity(table)) {
    return NextResponse.json(
      { error: `Unknown QA entity: ${table}` },
      { status: 400 },
    )
  }

  const config = QA_ENTITY_MAP[table]
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 })
  }

  const backendPayload = toBackendShape(table, body as Record<string, unknown>)

  try {
    const res = await fetchQaApi(config.endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(backendPayload),
    })
    const json = await parseQaResponse<unknown>(res, `Failed to create ${table}.`)
    const shaped = toFrontendShape(table, json)
    return NextResponse.json(shaped)
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : `Failed to create ${table}.`
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
