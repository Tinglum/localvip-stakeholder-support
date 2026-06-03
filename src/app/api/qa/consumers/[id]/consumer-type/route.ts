import { NextRequest, NextResponse } from 'next/server'
import { updateQaConsumerType } from '@/lib/auth/qa-api'
import { parseJsonRequest, parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

interface PatchBody {
  consumerTypeId: number
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const qaConsumerId = parseQaRouteId(params.id)
  if (qaConsumerId === null) {
    return NextResponse.json({ error: 'A numeric QA consumer id is required.' }, { status: 400 })
  }

  const body = await parseJsonRequest<PatchBody>(request)
  if (!body || typeof body.consumerTypeId !== 'number') {
    return NextResponse.json({ error: 'consumerTypeId (number) is required.' }, { status: 400 })
  }

  try {
    const result = await updateQaConsumerType(qaConsumerId, body.consumerTypeId)
    return NextResponse.json(result)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA consumer type update failed.')
  }
}
