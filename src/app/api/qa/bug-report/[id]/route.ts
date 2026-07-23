import { NextRequest, NextResponse } from 'next/server'
import { deleteBugReport, fetchBugReport, updateBugReport } from '@/lib/server/qa-bug-report'
import { qaRouteErrorResponse, requireQaRouteAccess, parseJsonRequest } from '@/lib/server/qa-route'
import { getSessionOperator } from '@/lib/auth/operator-identity'
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

  // Shared SuperAdmin login: attribute the note to whoever picked themselves in the
  // operator dropdown. Resolved server-side from the signed, session-bound cookie so
  // the client can't spoof it. The backend still records the real account email.
  const operator = await getSessionOperator(access.session.profile)
  const payload: BugReportUpdateInput = operator && body.note ? { ...body, noteAuthor: operator } : body

  try {
    return NextResponse.json(await updateBugReport(params.id, payload))
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
