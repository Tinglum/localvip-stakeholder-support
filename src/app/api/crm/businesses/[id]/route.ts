import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import {
  buildCrmBusinessDetail,
  fetchQaBusinessDetail,
  fetchQaBusinessList,
  findQaBusinessForLocal,
  parseQaBusinessId,
  qaBusinessRouteError,
} from '@/lib/server/qa-dashboard-businesses'
import type { Business } from '@/lib/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error

  const searchParams = request.nextUrl.searchParams
  const routeId = params.id
  const qaRouteId = routeId.startsWith('qa-') ? routeId.slice(3) : routeId

  let localBusiness: Business | null = null
  if (!routeId.startsWith('qa-')) {
    const { data } = await context.supabase
      .from('businesses')
      .select('*')
      .eq('id', routeId)
      .maybeSingle()

    localBusiness = (data || null) as Business | null
  }

  let qaBusinessId = parseQaBusinessId(searchParams.get('qaId')) || parseQaBusinessId(qaRouteId)
  let qaError: string | null = null

  if (qaBusinessId === null && localBusiness) {
    try {
      const qaBusinesses = await fetchQaBusinessList()
      qaBusinessId = findQaBusinessForLocal(localBusiness, qaBusinesses)?.id || null
    } catch (error) {
      qaError = qaBusinessRouteError(error)
    }
  }

  let qaBusiness = null
  if (qaBusinessId !== null) {
    try {
      qaBusiness = await fetchQaBusinessDetail(qaBusinessId)
    } catch (error) {
      qaError = qaBusinessRouteError(error)
    }
  }

  const detail = buildCrmBusinessDetail(localBusiness, qaBusiness, qaError)
  if (!detail) {
    const status = qaError && !/not found/i.test(qaError) ? 502 : 404
    return NextResponse.json(
      { error: qaError || 'Business not found.' },
      { status },
    )
  }

  return NextResponse.json(detail)
}
