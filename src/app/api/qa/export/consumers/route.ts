import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'

export async function GET() {
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
