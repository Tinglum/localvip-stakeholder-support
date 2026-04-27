import { NextResponse } from 'next/server'
import { fetchQaConsumerDetail } from '@/lib/auth/qa-api'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaConsumerId = parseQaRouteId(params.id)
  if (qaConsumerId === null) {
    return NextResponse.json({ error: 'A numeric QA consumer id is required.' }, { status: 400 })
  }

  try {
    const consumer = await fetchQaConsumerDetail(qaConsumerId)
    return NextResponse.json(consumer)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA consumer detail could not be loaded.')
  }
}
