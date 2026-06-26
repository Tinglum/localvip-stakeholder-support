import { NextRequest, NextResponse } from 'next/server'
import { createBugReport, listBugReports } from '@/lib/server/qa-bug-report'
import { qaRouteErrorResponse, requireQaRouteAccess, parseJsonRequest } from '@/lib/server/qa-route'
import type { BugReportCreateInput, BugReportListQuery } from '@/lib/bug-center/types'

export const dynamic = 'force-dynamic'

// Admin-only triage list.
export async function GET(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const sp = request.nextUrl.searchParams
  const query: BugReportListQuery = {
    priority: (sp.get('priority') || '') as BugReportListQuery['priority'],
    category: (sp.get('category') || '') as BugReportListQuery['category'],
    status: (sp.get('status') || '') as BugReportListQuery['status'],
    app: (sp.get('app') || '') as BugReportListQuery['app'],
    search: sp.get('search') || '',
    page: Number(sp.get('page') || '1') || 1,
    pageSize: Number(sp.get('pageSize') || '25') || 25,
  }

  try {
    return NextResponse.json(await listBugReports(query))
  } catch (error) {
    return qaRouteErrorResponse(error, 'Bug reports could not be loaded.')
  }
}

// Any authenticated QA session may file a report (the floating widget).
export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess()
  if ('error' in access) return access.error

  const body = await parseJsonRequest<BugReportCreateInput>(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })

  // Force app:'dashboard' regardless of client input — this proxy only serves the
  // dashboard widget.
  const payload: BugReportCreateInput = { ...body, app: 'dashboard' }

  try {
    return NextResponse.json(await createBugReport(payload))
  } catch (error) {
    return qaRouteErrorResponse(error, 'The bug report could not be submitted.')
  }
}
