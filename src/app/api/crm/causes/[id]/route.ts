import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import {
  buildCrmCauseDetail,
  fetchQaCauseDetail,
  fetchQaCauseList,
  findQaCauseForLocal,
  parseQaCauseId,
  qaCauseRouteError,
} from '@/lib/server/qa-dashboard-causes'
import type { Cause } from '@/lib/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error

  const searchParams = request.nextUrl.searchParams
  const routeId = params.id
  const qaRouteId = routeId.startsWith('qa-') ? routeId.slice(3) : routeId

  let localCause: Cause | null = null
  if (!routeId.startsWith('qa-')) {
    const { data } = await context.supabase
      .from('causes')
      .select('*')
      .eq('id', routeId)
      .maybeSingle()

    localCause = (data || null) as Cause | null
  }

  let qaCauseId = parseQaCauseId(searchParams.get('qaId')) || parseQaCauseId(qaRouteId)
  let qaError: string | null = null

  if (qaCauseId === null && localCause) {
    try {
      const qaCauses = await fetchQaCauseList()
      qaCauseId = findQaCauseForLocal(localCause, qaCauses)?.id || null
    } catch (error) {
      qaError = qaCauseRouteError(error)
    }
  }

  let qaCause = null
  if (qaCauseId !== null) {
    try {
      qaCause = await fetchQaCauseDetail(qaCauseId)
    } catch (error) {
      qaError = qaCauseRouteError(error)
    }
  }

  const detail = buildCrmCauseDetail(localCause, qaCause, qaError)
  if (!detail) {
    const status = qaError && !/not found/i.test(qaError) ? 502 : 404
    return NextResponse.json(
      { error: qaError || 'Cause not found.' },
      { status },
    )
  }

  return NextResponse.json(detail)
}
