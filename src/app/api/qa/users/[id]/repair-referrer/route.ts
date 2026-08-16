import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

/**
 * Move a user to a different referrer.
 *
 * Attribution decides who earns from this person's activity, so this is a
 * money-affecting edit, not a cosmetic one. Admin only here and SysAdmin-gated
 * again on the backend; a reason is required so the log says why.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const id = parseQaRouteId(params.id)
  if (id === null) return NextResponse.json({ error: 'Invalid user id.' }, { status: 400 })

  let body: { referrerUserId?: number; reason?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }
  if (!body.referrerUserId) {
    return NextResponse.json({ error: 'referrerUserId is required.' }, { status: 400 })
  }
  if (!body.reason || !body.reason.trim()) {
    return NextResponse.json(
      { error: 'A reason is required for an attribution change.' },
      { status: 400 },
    )
  }

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/User/${id}/repair-referrer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ReferrerUserId: body.referrerUserId,
        Reason: body.reason.trim(),
      }),
    })
    const data = await parseQaJsonResponse(res, 'Failed to repair the referrer.')
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return qaRouteErrorResponse(error, 'The referrer could not be repaired.')
  }
}
