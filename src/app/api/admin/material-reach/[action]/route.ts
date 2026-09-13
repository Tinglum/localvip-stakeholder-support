import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

const ALLOWED_ACTIONS = new Set(['preview', 'check', 'entity-preview', 'activate'])

export async function POST(request: NextRequest, { params }: { params: { action: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error
  if (!ALLOWED_ACTIONS.has(params.action)) return NextResponse.json({ error: 'Unknown material reach action.' }, { status: 404 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  try {
    const response = await fetchQaApi(`/api/admin/material-reach/${params.action}`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    const payload = await parseQaResponse<unknown>(response, 'Material reach could not be calculated.')
    return NextResponse.json(payload)
  } catch (error) {
    return qaRouteErrorResponse(error, 'Material reach could not be calculated.')
  }
}
