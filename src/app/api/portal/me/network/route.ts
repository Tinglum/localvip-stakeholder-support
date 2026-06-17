import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, type QaNetworkTree } from '@/lib/auth/qa-api'
import { enrichQaNetworkTreeWithSpend, resolveQaNetworkWindow, type QaNetworkPeriod } from '@/lib/server/qa-network'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

// Consumer self-service "My Network" — proxies the QA mobile 10-level
// referral-tree endpoint. The consumer shell is allowed alongside the
// operator shells so this can be reused from operator "view as" sessions.
export async function GET(request: Request) {
  const access = await requireQaRouteAccess([
    'consumer',
    'admin',
    'field',
    'launch_partner',
    'business',
  ])
  if ('error' in access) return access.error

  try {
    const { searchParams } = new URL(request.url)
    const period = searchParams.get('period')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const filter = { period: isNetworkPeriod(period) ? period : 'all', startDate, endDate }
    const window = resolveQaNetworkWindow(filter)
    const params = new URLSearchParams({ depth: '10' })
    if (window.startDate) params.set('startDate', window.startDate)
    if (window.endDate) params.set('endDate', window.endDate)
    const res = await fetchQaApi(`/api/mobile/v1/Network/Tree?${params.toString()}`)
    const json = await parseQaResponse<QaNetworkTree>(res, 'Failed to load your network.')
    const enrichedTree = enrichQaNetworkTreeWithSpend(json ?? {
      rootId: 0,
      depth: 10,
      totalNodes: 0,
      nodes: [],
    }, filter)
    return NextResponse.json(enrichedTree)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load your network.'
    const status = (error as { status?: number })?.status ?? 500
    return NextResponse.json({ error: message }, { status })
  }
}

function isNetworkPeriod(value: string | null): value is QaNetworkPeriod {
  return value === 'day' || value === 'week' || value === 'month' || value === 'year' || value === 'all' || value === 'custom'
}
