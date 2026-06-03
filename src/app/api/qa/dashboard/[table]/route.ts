import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import {
  EMPTY_FALLBACK_TABLES,
  QA_ENTITY_MAP,
  QaEntityKey,
  toBackendShape,
  toFrontendShape,
} from '@/lib/qa/dashboard-entity-map'

function isMappedEntity(table: string): table is QaEntityKey {
  return table in QA_ENTITY_MAP
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
  const search = new URL(request.url).search

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

    const shaped = toFrontendShape(table, items)
    return NextResponse.json(shaped ?? [])
  } catch (error) {
    if (error instanceof QaApiError) {
      // Backend returned an error — surface as empty list to keep pages functional
      // but log via status header for debugging
      return NextResponse.json([], {
        headers: { 'x-qa-error': error.message.substring(0, 200) },
      })
    }
    const message = error instanceof Error ? error.message : `Failed to load ${table}.`
    return NextResponse.json(
      { error: message },
      { status: 500, headers: { 'x-qa-error': message.substring(0, 200) } },
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
