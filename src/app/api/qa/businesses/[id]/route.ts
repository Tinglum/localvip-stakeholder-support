import { NextResponse } from 'next/server'
import { fetchQaBusinessDetail } from '@/lib/server/qa-dashboard-businesses'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaBusinessId = parseQaRouteId(params.id)
  if (qaBusinessId === null) {
    return NextResponse.json({ error: 'A numeric QA business id is required.' }, { status: 400 })
  }

  try {
    const business = await fetchQaBusinessDetail(qaBusinessId)
    return NextResponse.json(business)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA business detail could not be loaded.')
  }
}
