import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

async function scopedCauseId(request: NextRequest) {
  const access = await requireQaRouteAccess(['community'])
  if ('error' in access) return { error: access.error }
  const id = request.nextUrl.searchParams.get('causeId')
  if (!id || !/^\d+$/.test(String(id))) {
    return { error: NextResponse.json({ error: 'A linked cause is required.' }, { status: 400 }) }
  }
  return { id: String(id) }
}

export async function GET(request: NextRequest) {
  const scope = await scopedCauseId(request)
  if ('error' in scope) return scope.error
  try {
    const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${scope.id}/business-nominations`)
    return NextResponse.json(await parseQaResponse(response, 'Could not load business leads.'))
  } catch (error) {
    return qaRouteErrorResponse(error, 'Could not load business leads.')
  }
}

export async function POST(request: NextRequest) {
  const scope = await scopedCauseId(request)
  if ('error' in scope) return scope.error
  try {
    const body = await request.json()
    const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${scope.id}/business-nominations`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    return NextResponse.json(await parseQaResponse(response, 'Could not add business lead.'))
  } catch (error) {
    return qaRouteErrorResponse(error, 'Could not add business lead.')
  }
}
