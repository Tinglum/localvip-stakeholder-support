import { NextResponse } from 'next/server'
import { fetchQaBusinessList } from '@/lib/server/qa-dashboard-businesses'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  try {
    const businesses = await fetchQaBusinessList()
    return NextResponse.json(businesses)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA business list could not be loaded.')
  }
}
