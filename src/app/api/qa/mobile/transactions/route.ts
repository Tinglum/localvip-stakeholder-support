import { NextRequest, NextResponse } from 'next/server'
import { fetchTransactions, fetchTransactionsByMonth } from '@/lib/server/qa-mobile-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const { searchParams } = request.nextUrl
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  try {
    const data = year && month
      ? await fetchTransactionsByMonth(Number(year), Number(month))
      : await fetchTransactions()
    return NextResponse.json(data)
  } catch (error) {
    return qaRouteErrorResponse(error, 'Failed to load transactions.')
  }
}
