import { NextRequest, NextResponse } from 'next/server'
import { fetchQaTransactions } from '@/lib/auth/qa-api'
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

export async function GET(request: NextRequest) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error

  const sp = request.nextUrl.searchParams
  const search = sp.get('search') || undefined
  const page = Number.parseInt(sp.get('page') || '1', 10) || 1
  const pageSize = Number.parseInt(sp.get('pageSize') || '100', 10) || 100

  try {
    const data = await fetchQaTransactions({ search, page, pageSize })
    return NextResponse.json(data)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The transactions list could not be loaded.')
  }
}
