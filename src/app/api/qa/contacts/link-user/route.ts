import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })

  try {
    const res = await fetchQaApi('/api/dashboard/v1/Contact/link-user', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await parseQaJsonResponse(res, 'Failed to link user as contact.')
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof QaApiError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'Failed.' }, { status: 500 })
  }
}
