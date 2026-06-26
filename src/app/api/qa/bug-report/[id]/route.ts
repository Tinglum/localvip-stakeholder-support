import { NextRequest, NextResponse } from 'next/server'
import { deleteBugReport, fetchBugReport, updateBugReport } from '@/lib/server/qa-bug-report'
import { qaRouteErrorResponse, requireQaRouteAccess, parseJsonRequest } from '@/lib/server/qa-route'
import type { BugReportUpdateInput } from '@/lib/bug-center/types'

export const dynamic = 'force-dynamic'

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  try {
    return NextResponse.json(await fetchBugReport(params.id))
  } catch (error) {
    return qaRouteErrorResponse(error, 'The bug report could not be loaded.')
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const body = await parseJsonRequest<BugReportUpdateInput>(request)
  if (!body) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })

  try {
    return NextResponse.json(await updateBugReport(params.id, body))
  } catch (error) {
    return qaRouteErrorResponse(error, 'The bug report could not be updated.')
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  try {
    await deleteBugReport(params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The bug report could not be deleted.')
  }
}
