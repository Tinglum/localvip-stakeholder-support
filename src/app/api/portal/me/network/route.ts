import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

// Consumer self-service "My Network" — proxies the QA mobile 10-level
// referral-tree endpoint. The consumer shell is allowed alongside the
// operator shells so this can be reused from operator "view as" sessions.
export async function GET() {
  const access = await requireQaRouteAccess([
    'consumer',
    'admin',
    'field',
    'launch_partner',
    'business',
  ])
  if ('error' in access) return access.error

  try {
    const res = await fetchQaApi('/api/mobile/v1/Network/Tree?depth=10')
    const json = await parseQaResponse<unknown>(res, 'Failed to load your network.')
    return NextResponse.json(json ?? {})
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not load your network.'
    const status = (error as { status?: number })?.status ?? 500
    return NextResponse.json({ error: message }, { status })
  }
}
