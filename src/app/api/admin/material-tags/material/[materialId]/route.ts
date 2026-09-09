import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { qaRouteErrorResponse } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

const QA_PATH = '/api/dashboard/v1/MaterialAudienceTag/material'

async function requireSysAdmin() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Only SysAdmins can manage audience tags.' }, { status: 403 }) }
  }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'A QA session is required.' }, { status: 409 }) }
  }
  return { session }
}

function passThroughQaError(error: unknown, fallbackMessage: string) {
  if (error instanceof QaApiError && error.body) {
    try {
      const parsed = JSON.parse(error.body)
      return NextResponse.json(parsed, { status: error.status })
    } catch {
      // not JSON — fall through to the default handler
    }
  }
  return qaRouteErrorResponse(error, fallbackMessage)
}

export async function GET(_request: NextRequest, { params }: { params: { materialId: string } }) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  try {
    const response = await fetchQaApi(`${QA_PATH}/${encodeURIComponent(params.materialId)}`)
    const payload = await parseQaResponse<unknown>(response, "This material's audience tags could not be loaded.")
    return NextResponse.json(payload)
  } catch (error) {
    return passThroughQaError(error, "This material's audience tags could not be loaded.")
  }
}

export async function PUT(request: NextRequest, { params }: { params: { materialId: string } }) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || !Array.isArray((body as Record<string, unknown>).tagIds)) {
    return NextResponse.json({ error: 'A tagIds array is required.' }, { status: 400 })
  }

  try {
    const response = await fetchQaApi(`${QA_PATH}/${encodeURIComponent(params.materialId)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await parseQaResponse<unknown>(response, "This material's audience tags could not be saved.")
    return NextResponse.json(payload ?? { success: true })
  } catch (error) {
    return passThroughQaError(error, "This material's audience tags could not be saved.")
  }
}
