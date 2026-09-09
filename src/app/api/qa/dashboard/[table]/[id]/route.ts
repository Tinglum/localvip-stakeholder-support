import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { mapQaRoleFromSignals } from '@/lib/auth/qa-auth'
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

async function call(
  request: NextRequest,
  table: string,
  id: string,
  method: 'GET' | 'PUT' | 'PATCH' | 'DELETE',
) {
  if (EMPTY_FALLBACK_TABLES.has(table)) {
    return NextResponse.json(null, { status: 200 })
  }

  if (!isMappedEntity(table)) {
    return NextResponse.json({ error: `Unknown QA entity: ${table}` }, { status: 400 })
  }

  const config = QA_ENTITY_MAP[table]
  const url = table === 'profiles' ? `/api/dashboard/v1/User/${id}` : `${config.endpoint}/${id}`

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
    if (table === 'profiles' && (method === 'PUT' || method === 'PATCH')) {
      const payload = JSON.parse(init.body as string)
      if (payload.role) await parseQaResponse(await fetchQaApi(`${url}/role`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ role: payload.role }) }), 'Could not update role.')
      if (payload.status) await parseQaResponse(await fetchQaApi(`${url}/status`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ active: payload.status === 'active' }) }), 'Could not update status.')
      init.method = 'GET'; delete init.body; delete init.headers
    }
    const res = await fetchQaApi(url, init)
    const json = await parseQaResponse<unknown>(res, `Failed ${method} on ${table}.`)
    if (table === 'profiles' && json && typeof json === 'object' && 'user' in json) {
      const detail = json as { user: Record<string, unknown>; roles?: string[] }
      const accountType = typeof detail.user.accountType === 'string' ? detail.user.accountType : null
      const mapped = mapQaRoleFromSignals({
        accountType,
        claims: {
          sub: String(detail.user.id || id),
          email: null,
          name: null,
          given_name: null,
          family_name: null,
          preferred_username: null,
          roles: detail.roles || [],
          scopes: [],
          exp: null,
          raw: {},
        },
      })
      return NextResponse.json(toFrontendShape(table, { ...detail.user, role: mapped.role, roleSubtype: mapped.roleSubtype || null, brandContext: 'localvip' }))
    }
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
