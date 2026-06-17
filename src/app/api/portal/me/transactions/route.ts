import { NextResponse } from 'next/server'
import { requireQaRouteAccess, qaRouteErrorResponse } from '@/lib/server/qa-route'
import { fetchQaConsumerTransactions, resolveCurrentConsumerId } from '@/lib/server/qa-consumer'

export async function GET() {
  const access = await requireQaRouteAccess(['consumer'])
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

    const transactions = await fetchQaConsumerTransactions(consumerId)

    return NextResponse.json({
      ok: true,
      endpoint: `/api/dashboard/v1/Consumer/${consumerId}/transactions`,
      count: transactions.length,
      transactions,
    })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The transactions request failed.')
  }
}
