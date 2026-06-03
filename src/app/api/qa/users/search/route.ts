import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const q = url.searchParams.get('q') ?? ''
  const limit = url.searchParams.get('limit') ?? '20'

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/User/search?q=${encodeURIComponent(q)}&limit=${limit}`)
    const data = await parseQaJsonResponse(res, 'User search failed.')
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof QaApiError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'Search failed.' }, { status: 500 })
  }
}
