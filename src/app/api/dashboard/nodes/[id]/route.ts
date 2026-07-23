import { NextRequest, NextResponse } from 'next/server'
import { fetchQaNodeDetail } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

// Detail for one CRM node (customer / business / cause). Same audience as the list
// route it drills into.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  try {
    return NextResponse.json(await fetchQaNodeDetail(params.id))
  } catch (error) {
    return qaRouteErrorResponse(error, 'The customer could not be loaded.')
  }
}
