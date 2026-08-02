import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { qaRouteErrorResponse } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

const QA_PATH = '/api/dashboard/v1/FundraisingGoal/list'

export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return NextResponse.json({ error: 'Only SysAdmins can manage the fundraising goal.' }, { status: 403 })
  }
  if (session.source !== 'qa') {
    return NextResponse.json({ error: 'A QA session is required.' }, { status: 409 })
  }

  try {
    const response = await fetchQaApi(QA_PATH)
    const payload = await parseQaResponse<unknown>(response, 'The fundraising goals could not be loaded.')
    return NextResponse.json(payload)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The fundraising goals could not be loaded.')
  }
}
