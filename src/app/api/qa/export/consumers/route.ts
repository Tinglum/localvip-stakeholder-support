import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  // The whole consumer table as a CSV — the most sensitive read in the app.
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  try {
    const res = await fetchQaApi('/api/dashboard/v1/Consumer/export')
    const body = await res.arrayBuffer()
    return new NextResponse(body, {
      status: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition': 'attachment; filename="consumers.csv"',
      },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Export failed.' },
      { status: 500 },
    )
  }
}
