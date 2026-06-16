import { NextRequest, NextResponse } from 'next/server'
import { fetchQaNetworkTree } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

// Network tree for ANY node (business, cause, or customer). The node's own
// dashboard passes its QA accountId; the tree is read-only. Mirrors the
// consumer "My Network" route but lets the caller target a specific node.
export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess([
    'consumer',
    'admin',
    'field',
    'launch_partner',
    'business',
    'community',
  ])
  if ('error' in access) return access.error

  const accountId = request.nextUrl.searchParams.get('accountId')
  if (!accountId || !/^\d+$/.test(accountId.trim())) {
    return NextResponse.json({ error: 'A numeric accountId is required.' }, { status: 400 })
  }

  const depthRaw = request.nextUrl.searchParams.get('depth')
  const depth = depthRaw && /^\d+$/.test(depthRaw) ? Math.min(Number(depthRaw), 10) : 10

  try {
    const tree = await fetchQaNetworkTree(accountId.trim(), depth)
    return NextResponse.json(tree)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The network tree could not be loaded.')
  }
}
