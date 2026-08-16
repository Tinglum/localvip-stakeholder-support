import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

/**
 * Admin edit of another user's profile.
 *
 * Distinct from /api/qa/user/profile, which edits whoever holds the token -
 * that one reads _currentUser.UserId on the backend and ignores any id, so it
 * can never be used by support to fix a customer's details.
 */
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const id = parseQaRouteId(params.id)
  if (id === null) return NextResponse.json({ error: 'Invalid user id.' }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/User/${id}/profile`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await parseQaJsonResponse(res, 'Failed to update the profile.')
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return qaRouteErrorResponse(error, 'The profile could not be updated.')
  }
}
