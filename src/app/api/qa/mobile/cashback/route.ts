import { NextRequest, NextResponse } from 'next/server'
import { fetchCashback, fetchCashbackByMonth, fetchCashbackLifetime } from '@/lib/server/qa-mobile-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const { searchParams } = request.nextUrl
  const scope = searchParams.get('scope')
  const year = searchParams.get('year')
  const month = searchParams.get('month')

  try {
    if (scope === 'lifetime') {
      const data = await fetchCashbackLifetime()
      return NextResponse.json(data)
    }

    const data = year && month
      ? await fetchCashbackByMonth(Number(year), Number(month))
      : await fetchCashback()
    return NextResponse.json(data)
  } catch (error) {
    return qaRouteErrorResponse(error, 'Failed to load cashback data.')
  }
}
