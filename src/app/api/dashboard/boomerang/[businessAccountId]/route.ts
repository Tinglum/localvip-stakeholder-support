import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

const ROLES = ['business', 'admin', 'field', 'launch_partner', 'community', 'consumer'] as const

// List a business's Boomerang 100-list (BusinessVIP). Pre-customer waitlist only.
export async function GET(req: NextRequest, { params }: { params: { businessAccountId: string } }) {
  const access = await requireQaRouteAccess([...ROLES])
  if ('error' in access) return access.error
  const id = params.businessAccountId
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'A numeric businessAccountId is required.' }, { status: 400 })
  const status = req.nextUrl.searchParams.get('status')
  const search = req.nextUrl.searchParams.get('search')
  const qs = new URLSearchParams()
  if (status) qs.set('status', status)
  if (search) qs.set('search', search)
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Boomerang/${id}/list?${qs.toString()}`)
    const data = await parseQaJsonResponse(res, 'Could not load the 100-list.')
    return NextResponse.json(data)
  } catch (error) {
    return qaRouteErrorResponse(error, 'Could not load the 100-list.')
  }
}

// Manually add someone to the list.
export async function POST(req: NextRequest, { params }: { params: { businessAccountId: string } }) {
  const access = await requireQaRouteAccess([...ROLES])
  if ('error' in access) return access.error
  const id = params.businessAccountId
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'A numeric businessAccountId is required.' }, { status: 400 })
  try {
    const payload = await req.json().catch(() => ({}))
    const res = await fetchQaApi(`/api/dashboard/v1/Boomerang/${id}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await parseQaJsonResponse(res, 'Could not add to the 100-list.')
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    return qaRouteErrorResponse(error, 'Could not add to the 100-list.')
  }
}
