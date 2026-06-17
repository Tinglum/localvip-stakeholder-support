import { NextRequest, NextResponse } from 'next/server'
import { fetchQaPublicApi } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

// Public: the person completes their own conversion. Only now does QA create and
// link a consumer under the business.
export async function POST(_req: NextRequest, { params }: { params: { token: string } }) {
  try {
    const res = await fetchQaPublicApi(`/api/mobile/v1/BoomerangVIP/complete-conversion/${encodeURIComponent(params.token)}`, {
      method: 'POST',
    })
    const body = await res.text()
    return new NextResponse(body, { status: res.status, headers: { 'content-type': 'application/json' } })
  } catch {
    return NextResponse.json({ error: 'Could not complete conversion right now.' }, { status: 502 })
  }
}
