import { NextRequest, NextResponse } from 'next/server'
import { fetchQaNodeAccess, updateQaNodeAccess } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess, parseJsonRequest } from '@/lib/server/qa-route'
import { getSessionOperator } from '@/lib/auth/operator-identity'

export const dynamic = 'force-dynamic'

// Access grants are admin-only — narrower than the node detail route, which field
// and launch-partner users can also read. The backend enforces `access.manage`
// independently via [RequiresGrant]; this is defence in depth, not the only gate.
export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  try {
    return NextResponse.json(await fetchQaNodeAccess(params.id))
  } catch (error) {
    return qaRouteErrorResponse(error, 'Access grants could not be loaded.')
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const body = await parseJsonRequest<{ grants?: unknown }>(request)
  if (!body || !Array.isArray(body.grants)) {
    return NextResponse.json({ error: 'grants must be an array.' }, { status: 400 })
  }
  const grants = body.grants.filter((g): g is string => typeof g === 'string')

  // Attribute the change to the human behind the shared SuperAdmin login, resolved
  // server-side from the signed operator cookie so it cannot be spoofed.
  const operator = await getSessionOperator(access.session.profile)

  try {
    return NextResponse.json(await updateQaNodeAccess(params.id, grants, operator))
  } catch (error) {
    return qaRouteErrorResponse(error, 'Access grants could not be saved.')
  }
}
