import { NextRequest, NextResponse } from 'next/server'
import { fetchQaTransactionBreakdown, QaApiError } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { qaRouteErrorResponse } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

async function requireSysAdmin() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Only SysAdmins can view transactions.' }, { status: 403 }) }
  }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'A QA session is required.' }, { status: 409 }) }
  }
  return { session }
}

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  if (!/^\d+$/.test(params.id)) {
    return NextResponse.json({ error: 'A numeric transaction id is required.' }, { status: 400 })
  }

  try {
    const data = await fetchQaTransactionBreakdown(params.id)
    return NextResponse.json(data)
  } catch (error) {
    // Relay the upstream status (e.g. 503 "ledger reconciling") verbatim so the
    // UI can show an "unavailable" state rather than a generic error.
    if (error instanceof QaApiError && error.body) {
      try {
        return NextResponse.json(JSON.parse(error.body), { status: error.status })
      } catch {
        // not JSON — fall through
      }
    }
    return qaRouteErrorResponse(error, 'The payment breakdown could not be loaded.')
  }
}
