import { NextRequest, NextResponse } from 'next/server'
import { fetchBugSettings, updateBugSettings } from '@/lib/server/qa-bug-report'
import { qaRouteErrorResponse, requireQaRouteAccess, parseJsonRequest } from '@/lib/server/qa-route'
import type { BugReportSettings } from '@/lib/bug-center/types'

export const dynamic = 'force-dynamic'

// Any authenticated QA session may read settings (the widget needs it to decide
// whether to render the button).
export async function GET() {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  try {
    return NextResponse.json(await fetchBugSettings())
  } catch (error) {
    return qaRouteErrorResponse(error, 'Bug Center settings could not be loaded.')
  }
}

// Only admins can flip the master on/off toggles.
export async function PUT(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const body = await parseJsonRequest<Partial<BugReportSettings>>(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })

  try {
    const next = await updateBugSettings({
      enabledDashboard: Boolean(body.enabledDashboard),
      enabledWebapp: Boolean(body.enabledWebapp),
    })
    return NextResponse.json(next)
  } catch (error) {
    return qaRouteErrorResponse(error, 'Bug Center settings could not be saved.')
  }
}
