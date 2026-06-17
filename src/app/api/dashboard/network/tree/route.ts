import { NextRequest, NextResponse } from 'next/server'
import { fetchQaNetworkTree } from '@/lib/auth/qa-api'
import { enrichQaNetworkTreeWithSpend, resolveQaNetworkWindow, type QaNetworkPeriod } from '@/lib/server/qa-network'
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
  const period = request.nextUrl.searchParams.get('period')
  const startDate = request.nextUrl.searchParams.get('startDate')
  const endDate = request.nextUrl.searchParams.get('endDate')

  try {
    const filter = { period: isNetworkPeriod(period) ? period : 'all', startDate, endDate }
    const window = resolveQaNetworkWindow(filter)
    const tree = await fetchQaNetworkTree(accountId.trim(), depth, {
      startDate: window.startDate,
      endDate: window.endDate,
    })
    const enrichedTree = enrichQaNetworkTreeWithSpend(tree, filter)
    return NextResponse.json(enrichedTree)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The network tree could not be loaded.')
  }
}

function isNetworkPeriod(value: string | null): value is QaNetworkPeriod {
  return value === 'day' || value === 'week' || value === 'month' || value === 'year' || value === 'all' || value === 'custom'
}
