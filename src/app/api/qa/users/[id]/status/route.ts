import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

/**
 * Enable or disable a user.
 *
 * The backend has had PATCH /User/{id}/status for a while; the dashboard simply
 * had no route to reach it, so there was no way to suspend someone from the CRM
 * without going to the database. Admin only - this locks a person out.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const id = parseQaRouteId(params.id)
  if (id === null) return NextResponse.json({ error: 'Invalid user id.' }, { status: 400 })

  let body: { active?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'active (boolean) is required.' }, { status: 400 })
  }

  try {
    // UserStatusRequest on the backend is { Active: bool }; it sets
    // ApplicationUser.IsEnabled from it. Forwarding the client's own field name
    // would deserialise to default(false) and silently disable the account.
    const res = await fetchQaApi(`/api/dashboard/v1/User/${id}/status`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ Active: body.active }),
    })
    const data = await parseQaJsonResponse(res, 'Failed to update the user status.')
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return qaRouteErrorResponse(error, 'The user status could not be updated.')
  }
}
