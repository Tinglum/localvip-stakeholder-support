import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { parseQaRouteId, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  // Consumer records are staff-only: same gate as the sibling detail route.
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaConsumerId = parseQaRouteId(params.id)
  if (qaConsumerId === null) {
    return NextResponse.json({ error: 'A numeric QA consumer id is required.' }, { status: 400 })
  }

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Consumer/${qaConsumerId}/ten-causes`)
    const data = await parseQaJsonResponse(res, 'Failed to load causes.')
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof QaApiError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'Failed.' }, { status: 500 })
  }
}
