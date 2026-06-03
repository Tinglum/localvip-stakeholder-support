import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const params = new URLSearchParams()
  for (const key of ['email', 'phone', 'firstName', 'lastName']) {
    const v = url.searchParams.get(key)
    if (v) params.append(key, v)
  }
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Contact/check-duplicate?${params.toString()}`)
    const data = await parseQaJsonResponse(res, 'Duplicate check failed.')
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof QaApiError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'Duplicate check failed.' }, { status: 500 })
  }
}
