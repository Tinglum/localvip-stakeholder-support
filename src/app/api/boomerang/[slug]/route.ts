import { NextRequest, NextResponse } from 'next/server'
import { fetchQaPublicApi } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

// Public, isolated 100-list (Boomerang) capture proxy. Resolve the business and
// capture a BusinessVIP row ONLY — this never creates a customer/consumer.

export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const res = await fetchQaPublicApi(`/api/mobile/v1/BoomerangVIP/resolve/${encodeURIComponent(params.slug)}`)
    const body = await res.text()
    return new NextResponse(body, { status: res.status, headers: { 'content-type': 'application/json' } })
  } catch {
    return NextResponse.json({ error: 'Could not resolve this 100-list link.' }, { status: 502 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  try {
    const payload = await req.json().catch(() => ({}))
    const res = await fetchQaPublicApi(`/api/mobile/v1/BoomerangVIP/capture/${encodeURIComponent(params.slug)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: payload.firstName ?? null,
        phone: payload.phone ?? null,
        email: payload.email ?? null,
        supportsLocalCauses: payload.supportsLocalCauses ?? false,
        wantsBusinessOffers: payload.wantsBusinessOffers ?? false,
      }),
    })
    const body = await res.text()
    return new NextResponse(body, { status: res.status, headers: { 'content-type': 'application/json' } })
  } catch {
    return NextResponse.json({ error: 'Could not join the 100-list right now.' }, { status: 502 })
  }
}
