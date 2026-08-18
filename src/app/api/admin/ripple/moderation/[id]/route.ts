import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

const ACTIONS = ['clear', 'withhold', 'revoke'] as const
type ModerationAction = (typeof ACTIONS)[number]

async function authorize() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Only SysAdmins can moderate LocalVIP Ripple.' }, { status: 403 }) }
  }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'Ripple moderation requires a QA-backed admin session.' }, { status: 409 }) }
  }
  return { error: null }
}

async function forward(response: Response) {
  const body = await response.arrayBuffer()
  return new NextResponse(body, {
    status: response.status,
    statusText: response.statusText,
    headers: { 'content-type': response.headers.get('content-type') || 'application/json' },
  })
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await authorize()
  if (auth.error) return auth.error

  const recommendationId = (params.id || '').trim()
  if (!recommendationId) {
    return NextResponse.json({ error: 'A recommendation id is required.' }, { status: 400 })
  }

  const payload = (await request.json().catch(() => null)) as { action?: unknown; note?: unknown } | null
  const action = typeof payload?.action === 'string' ? payload.action : ''
  if (!ACTIONS.includes(action as ModerationAction)) {
    return NextResponse.json({ error: 'action must be one of: clear, withhold, revoke.' }, { status: 400 })
  }
  const note = typeof payload?.note === 'string' && payload.note.trim() ? payload.note.trim().slice(0, 1000) : undefined

  try {
    const response = await fetchQaApi(
      `/api/dashboard/v1/Ripple/moderation/${encodeURIComponent(recommendationId)}/resolve`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(note ? { action, note } : { action }),
      }
    )
    return forward(response)
  } catch {
    return NextResponse.json({ error: 'The moderation decision could not be recorded.' }, { status: 502 })
  }
}
