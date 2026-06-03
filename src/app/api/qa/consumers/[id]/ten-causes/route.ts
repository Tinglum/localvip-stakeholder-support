import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Consumer/${params.id}/ten-causes`)
    const data = await parseQaJsonResponse(res, 'Failed to load causes.')
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof QaApiError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'Failed.' }, { status: 500 })
  }
}
