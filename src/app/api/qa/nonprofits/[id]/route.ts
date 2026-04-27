import { NextResponse } from 'next/server'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaNonprofitId = parseQaRouteId(params.id)
  if (qaNonprofitId === null) {
    return NextResponse.json({ error: 'A numeric QA nonprofit id is required.' }, { status: 400 })
  }

  try {
    const nonprofit = await fetchQaCauseDetail(qaNonprofitId)
    return NextResponse.json(nonprofit)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA nonprofit detail could not be loaded.')
  }
}
