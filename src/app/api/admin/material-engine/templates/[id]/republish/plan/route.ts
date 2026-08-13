import { NextRequest, NextResponse } from 'next/server'
import { getAdminRouteContext } from '@/lib/server/admin-access'
import {
  getRepublishPlan,
  getRepublishRunLog,
  RepublishEndpointMissingError,
} from '@/lib/server/template-republish'

/** Dry run: how many accounts would a republish of this template touch? */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getAdminRouteContext()
  if ('error' in context) return context.error

  try {
    const plan = await getRepublishPlan(params.id)
    return NextResponse.json({
      plan,
      // The log is whatever this server process has seen so far; null is normal
      // (fresh process, or no run started). Progress is still derivable from
      // plan.outdatedCopies either way.
      run: getRepublishRunLog(params.id),
    })
  } catch (error) {
    if (error instanceof RepublishEndpointMissingError) {
      return NextResponse.json({ error: error.message, endpointMissing: true }, { status: 501 })
    }
    const message = error instanceof Error ? error.message : 'Could not build the republish plan.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
