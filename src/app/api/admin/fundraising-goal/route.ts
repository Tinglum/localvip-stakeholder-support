import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { qaRouteErrorResponse } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

const QA_PATH = '/api/dashboard/v1/FundraisingGoal'

async function requireSysAdmin() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Only SysAdmins can manage the fundraising goal.' }, { status: 403 }) }
  }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'A QA session is required.' }, { status: 409 }) }
  }
  return { session }
}

function parsePeriod(request: NextRequest) {
  const now = new Date()
  const year = Number(request.nextUrl.searchParams.get('year') || now.getFullYear())
  const month = Number(request.nextUrl.searchParams.get('month') || now.getMonth() + 1)
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12) return null
  return { year, month }
}

export async function GET(request: NextRequest) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error
  const period = parsePeriod(request)
  if (!period) return NextResponse.json({ error: 'A valid year and month are required.' }, { status: 400 })

  try {
    const query = new URLSearchParams({ year: String(period.year), month: String(period.month) })
    const response = await fetchQaApi(`${QA_PATH}?${query}`)
    const payload = await parseQaResponse<unknown>(response, 'The fundraising goal could not be loaded.')
    return NextResponse.json(payload)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The fundraising goal could not be loaded.')
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireSysAdmin()
  if ('error' in access) return access.error
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const year = Number(body?.year)
  const month = Number(body?.month)
  const goalAmount = Number(body?.goalAmount)
  if (!Number.isInteger(year) || year < 2000 || year > 2100 || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(goalAmount) || goalAmount < 0) {
    return NextResponse.json({ error: 'A valid year, month, and non-negative goal amount are required.' }, { status: 400 })
  }

  try {
    const response = await fetchQaApi(QA_PATH, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ year, month, goalAmount }),
    })
    const payload = await parseQaResponse<unknown>(response, 'The fundraising goal could not be saved.')
    return NextResponse.json(payload)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The fundraising goal could not be saved.')
  }
}
