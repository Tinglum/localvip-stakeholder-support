import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const body = await request.json().catch(() => ({})) as { causeId?: string | number }
  const metadata = (session.profile.metadata || {}) as Record<string, unknown>
  const requestedCauseId = Number(body.causeId || 0)
  const metadataCauseId = Number(metadata.view_as_cause_account_id || 0)
  const causeId = session.portalCauseAccountId
    || (Number.isInteger(metadataCauseId) && metadataCauseId > 0 ? metadataCauseId : null)
    || (Number.isInteger(requestedCauseId) && requestedCauseId > 0 ? requestedCauseId : null)
  if (!causeId) return NextResponse.json({ error: 'Could not resolve your cause account.' }, { status: 400 })

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/QrCode/cause/${causeId}/outreach-codes`, { method: 'POST' })
    const result = await parseQaResponse<Record<string, unknown>>(response, 'Could not prepare outreach QR codes.')
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not prepare outreach QR codes.' }, { status: 400 })
  }
}
