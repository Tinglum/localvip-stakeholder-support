import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'

export async function GET(request: NextRequest) {
  const limit = request.nextUrl.searchParams.get('limit') || '20'
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Activity/recent?limit=${encodeURIComponent(limit)}`)
    const json = await parseQaResponse<unknown>(res, 'Activity feed failed.')
    return NextResponse.json(json)
  } catch (err) {
    if (err instanceof QaApiError) return NextResponse.json({ items: [] })
    return NextResponse.json({ items: [], error: err instanceof Error ? err.message : 'Activity feed failed.' })
  }
}
