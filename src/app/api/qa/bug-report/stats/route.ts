import { NextResponse } from 'next/server'
import { fetchBugStats } from '@/lib/server/qa-bug-report'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

export async function GET() {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  try {
    return NextResponse.json(await fetchBugStats())
  } catch (error) {
    return qaRouteErrorResponse(error, 'Bug Center stats could not be loaded.')
  }
}
