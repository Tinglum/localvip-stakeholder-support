import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import {
  EMPTY_FALLBACK_TABLES,
  QA_ENTITY_MAP,
  QaEntityKey,
  toBackendShape,
  toFrontendShape,
} from '@/lib/qa/dashboard-entity-map'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

/**
 * Who may write through the generic proxy. See the sibling collection route:
 * QA_ENTITY_MAP is a mapping table, not an authorization boundary.
 */
const WRITE_SHELLS = ['admin', 'field', 'launch_partner', 'business', 'community'] as const

function isMappedEntity(table: string): table is QaEntityKey {
  return table in QA_ENTITY_MAP
}

async function call(
  request: NextRequest,
  table: string,
  id: string,
  method: 'GET' | 'PUT' | 'PATCH' | 'DELETE',
) {
  const access = await requireQaRouteAccess(method === 'GET' ? undefined : [...WRITE_SHELLS])
  if ('error' in access) return access.error

  if (EMPTY_FALLBACK_TABLES.has(table)) {
    return NextResponse.json(null, { status: 200 })
  }

  if (!isMappedEntity(table)) {
    return NextResponse.json({ error: `Unknown QA entity: ${table}` }, { status: 400 })
  }

  const config = QA_ENTITY_MAP[table]
  // Some controllers expose the collection under a named action while the by-id
  // route lives at the controller root, so the detail path can't be derived from
  // the list path. `profiles` is the case that bit us: /User/list/{id} matches no
  // route template and 404s, which the user detail page renders as "User not found".
  const url = `${config.detailEndpoint ?? config.endpoint}/${encodeURIComponent(id)}`

  const init: RequestInit = { method }
  if (method === 'PUT' || method === 'PATCH') {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 })
    }
    const backendPayload = toBackendShape(table, body as Record<string, unknown>)
    init.headers = { 'content-type': 'application/json' }
    init.body = JSON.stringify(backendPayload)
  }

  try {
    const res = await fetchQaApi(url, init)
    const json = await parseQaResponse<unknown>(res, `Failed ${method} on ${table}.`)
    const shaped = toFrontendShape(table, json)
    return NextResponse.json(shaped ?? null)
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    const message = error instanceof Error ? error.message : `Failed ${method} on ${table}.`
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { table: string; id: string } },
) {
  return call(request, params.table, params.id, 'GET')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { table: string; id: string } },
) {
  return call(request, params.table, params.id, 'PUT')
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { table: string; id: string } },
) {
  return call(request, params.table, params.id, 'PATCH')
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { table: string; id: string } },
) {
  return call(request, params.table, params.id, 'DELETE')
}
