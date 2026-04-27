import { NextRequest, NextResponse } from 'next/server'
import { getQaUserProfile, updateQaUserProfile, type QaUserProfileUpdateInput } from '@/lib/auth/qa-api'
import { parseJsonRequest, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export async function GET() {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  try {
    const profile = await getQaUserProfile()
    return NextResponse.json(profile)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA user profile could not be loaded.')
  }
}

export async function PUT(request: NextRequest) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const body = await parseJsonRequest<QaUserProfileUpdateInput>(request)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A profile payload is required.' }, { status: 400 })
  }

  try {
    const result = await updateQaUserProfile(body)
    return NextResponse.json(result ?? { success: true })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA user profile could not be updated.')
  }
}
