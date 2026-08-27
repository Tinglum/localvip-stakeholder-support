import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET(request: NextRequest) {
  // Global search reaches across every entity, so it needs a QA session.
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const q = request.nextUrl.searchParams.get('q') || ''
  if (!q || q.length < 2) return NextResponse.json({ results: [] })
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Search/global?q=${encodeURIComponent(q)}`)
    const json = await parseQaResponse<unknown>(res, 'Search failed.')
    return NextResponse.json(json)
  } catch (err) {
    if (err instanceof QaApiError) return NextResponse.json({ results: [] })
    return NextResponse.json({ results: [], error: err instanceof Error ? err.message : 'Search failed.' })
  }
}
