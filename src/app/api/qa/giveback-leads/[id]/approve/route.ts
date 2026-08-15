import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

/**
 * Approve a Giveback Day lead: the backend registers the real Business account
 * and attaches it to whoever shared the flyer. Admin only — this is the step
 * that turns anonymous form input into a live record.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const id = parseQaRouteId(params.id)
  if (id === null) return NextResponse.json({ error: 'Invalid lead id.' }, { status: 400 })

  let body: Record<string, unknown> = {}
  try {
    body = await request.json()
  } catch {
    // An approval with no corrections is the normal case: the lead already
    // carries every field needed to register the business.
    body = {}
  }

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/GivebackLead/${id}/approve`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await parseQaJsonResponse(res, 'Failed to approve the lead.')
    return NextResponse.json(data)
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    return qaRouteErrorResponse(error, 'The lead could not be approved.')
  }
}
