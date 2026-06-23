import { NextResponse } from 'next/server'
import { fetchQaCauseList } from '@/lib/server/qa-dashboard-causes'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  // Businesses can list causes too — they pick the cause they support during
  // setup. Cause records are public-facing (shown in the consumer app), so this
  // is not sensitive operator data.
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner', 'business'])
  if ('error' in access) return access.error

  try {
    const nonprofits = await fetchQaCauseList()
    return NextResponse.json(nonprofits)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA nonprofit list could not be loaded.')
  }
}
