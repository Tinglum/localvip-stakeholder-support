import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

// Business initiates conversion for a 100-list entry. Does NOT create a customer
// — it issues a conversion link the person must complete themselves.
export async function POST(req: NextRequest, { params }: { params: { businessAccountId: string } }) {
  const access = await requireQaRouteAccess(['business', 'admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error
  const id = params.businessAccountId
  const { entryId } = await req.json().catch(() => ({ entryId: null }))
  if (!/^\d+$/.test(id) || !entryId) {
    return NextResponse.json({ error: 'businessAccountId and entryId are required.' }, { status: 400 })
  }
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Boomerang/${id}/${entryId}/convert`, { method: 'POST' })
    const data = await parseQaJsonResponse(res, 'Could not start conversion.')
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return qaRouteErrorResponse(error, 'Could not start conversion.')
  }
}
