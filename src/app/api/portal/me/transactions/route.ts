import { NextResponse } from 'next/server'
import { requireQaRouteAccess, qaRouteErrorResponse } from '@/lib/server/qa-route'
import { fetchQaConsumerTransactionsForSession, resolveCurrentConsumerId } from '@/lib/server/qa-consumer'

export async function GET() {
  const access = await requireQaRouteAccess(['consumer', 'admin', 'field', 'launch_partner', 'business'])
  if ('error' in access) return access.error

  try {
    const consumerId = await resolveCurrentConsumerId(access.session)
    if (!consumerId) {
      return NextResponse.json({
        ok: true,
        endpoint: null,
        count: 0,
        transactions: [],
      })
    }

    const transactions = await fetchQaConsumerTransactionsForSession(access.session)

    return NextResponse.json({
      ok: true,
      endpoint: '/api/mobile/v1/Payment/transactions',
      count: transactions.length,
      transactions,
    })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The transactions request failed.')
  }
}
