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

export async function GET(request: NextRequest) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  try {
    const includeInactive = request.nextUrl.searchParams.get('includeInactive')
    const query = new URLSearchParams()
    if (includeInactive !== null) query.set('includeInactive', includeInactive)
    const qs = query.toString()
    const response = await fetchQaApi(`${QA_PATH}${qs ? `?${qs}` : ''}`)
    const payload = await parseQaResponse<unknown>(response, 'Audience tags could not be loaded.')
    return NextResponse.json(payload)
  } catch (error) {
    return passThroughQaError(error, 'Audience tags could not be loaded.')
  }
}

export async function POST(request: NextRequest) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  try {
    const response = await fetchQaApi(QA_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await parseQaResponse<unknown>(response, 'The audience tag could not be created.')
    return NextResponse.json(payload)
  } catch (error) {
    return passThroughQaError(error, 'The audience tag could not be created.')
  }
}
