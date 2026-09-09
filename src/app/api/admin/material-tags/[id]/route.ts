import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { qaRouteErrorResponse } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

const QA_PATH = '/api/dashboard/v1/MaterialAudienceTag'

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

/** Preserve the upstream JSON error body (e.g. a 409 carrying materialCount) verbatim. */
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

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const response = await fetchQaApi(`${QA_PATH}/${encodeURIComponent(params.id)}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await parseQaResponse<unknown>(response, 'The audience tag could not be saved.')
    return NextResponse.json(payload)
  } catch (error) {
    return passThroughQaError(error, 'The audience tag could not be saved.')
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  try {
    const response = await fetchQaApi(`${QA_PATH}/${encodeURIComponent(params.id)}`, { method: 'DELETE' })
    const payload = await parseQaResponse<unknown>(response, 'The audience tag could not be deleted.')
    return NextResponse.json(payload ?? { success: true })
  } catch (error) {
    // Upstream returns 409 with { error, materialCount } when in use, or 409 when the
    // tag is a built-in (isSystem). Both must reach the client body intact.
    return passThroughQaError(error, 'The audience tag could not be deleted.')
  }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  try {
    const response = await fetchQaApi(`${QA_PATH}/${encodeURIComponent(params.id)}/materials`)
    const payload = await parseQaResponse<unknown>(response, 'Materials for this tag could not be loaded.')
    return NextResponse.json(payload)
  } catch (error) {
    return passThroughQaError(error, 'Materials for this tag could not be loaded.')
  }
}
