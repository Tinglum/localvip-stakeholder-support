import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await request.json().catch(() => ({}))
    const res = await fetchQaApi(`/api/dashboard/v1/Stakeholder/${encodeURIComponent(params.id)}/assign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await parseQaResponse<unknown>(res, 'Failed to assign stakeholder.')
    return NextResponse.json(json)
  } catch (err) {
    if (err instanceof QaApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Assignment failed.' },
      { status: 500 },
    )
  }
}
