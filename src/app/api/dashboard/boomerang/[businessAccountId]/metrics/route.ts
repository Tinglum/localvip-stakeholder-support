import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: { businessAccountId: string } }) {
  const access = await requireQaRouteAccess(['business', 'admin', 'field', 'launch_partner', 'community', 'consumer'])
  if ('error' in access) return access.error
  const id = params.businessAccountId
  if (!/^\d+$/.test(id)) return NextResponse.json({ error: 'A numeric businessAccountId is required.' }, { status: 400 })
  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Boomerang/${id}/metrics`)
    const data = await parseQaJsonResponse(res, 'Could not load 100-list metrics.')
    return NextResponse.json(data)
  } catch (error) {
    return qaRouteErrorResponse(error, 'Could not load 100-list metrics.')
  }
}
