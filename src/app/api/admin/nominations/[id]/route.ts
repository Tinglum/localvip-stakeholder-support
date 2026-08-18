import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { isSuperAdminRole } from '@/lib/auth/display-name'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

const NOMINATION_STATUSES = ['received', 'contacted', 'onboarding', 'joined', 'declined'] as const

async function authorize() {
  const session = await getAuthenticatedSession()
  if (!session) return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  if (!isSuperAdminRole(session.profile.role, session.profile.role_subtype)) {
    return { error: NextResponse.json({ error: 'Only SysAdmins can manage business nominations.' }, { status: 403 }) }
  }
  if (session.source !== 'qa') {
    return { error: NextResponse.json({ error: 'Business nominations require a QA-backed admin session.' }, { status: 409 }) }
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

  const id = (params.id || '').trim()
  if (!id) return NextResponse.json({ error: 'A nomination id is required.' }, { status: 400 })

  const payload = (await request.json().catch(() => null)) as { status?: unknown; note?: unknown } | null
  const status = typeof payload?.status === 'string' ? payload.status : ''
  if (!(NOMINATION_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json({ error: 'status must be one of received, contacted, onboarding, joined, declined.' }, { status: 400 })
  }
  const note = typeof payload?.note === 'string' && payload.note.trim() ? payload.note.trim() : undefined

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/BusinessNomination/${encodeURIComponent(id)}/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(note ? { status, note } : { status }),
    })
    return forward(response)
  } catch {
    return NextResponse.json({ error: 'The nomination status could not be updated.' }, { status: 502 })
  }
}
