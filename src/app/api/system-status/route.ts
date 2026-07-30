import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, fetchQaPublicApi } from '@/lib/auth/qa-api'
import { isAdminProfile } from '@/lib/stakeholder-access'

export const dynamic = 'force-dynamic'

// Operator-set "work in progress" flag shown in the dashboard topbar so bug
// testers know the system is being changed under them.
//
// GET is deliberately unbreakable. The upstream QA endpoint is not deployed
// yet, so every failure path — no session, non-2xx, non-JSON, thrown fetch —
// resolves to `{ workInProgress: false, unavailable: true }` with a 200. The
// indicator renders a quiet neutral state for that: never an error, and never
// a false red banner.
//
// PUT is the opposite: it must fail loudly, because the client applies the
// toggle optimistically and needs a real signal to roll back.
const QA_PATH = '/api/dashboard/v1/SystemStatus'
const UNAVAILABLE = { workInProgress: false, unavailable: true } as const

export interface SystemStatusPayload {
  workInProgress: boolean
  unavailable?: boolean
  message?: string | null
  updatedOn?: string | null
  updatedBy?: string | null
}

function toStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null
}

function normalize(json: Record<string, unknown>): SystemStatusPayload {
  return {
    workInProgress: json.workInProgress === true,
    message: toStringOrNull(json.message),
    updatedOn: toStringOrNull(json.updatedOn),
    updatedBy: toStringOrNull(json.updatedBy),
  }
}

async function readStatusJson(res: Response): Promise<SystemStatusPayload | null> {
  if (!res.ok) return null
  if (!(res.headers.get('content-type') || '').includes('json')) return null

  const json = (await res.json().catch(() => null)) as Record<string, unknown> | null
  if (!json || typeof json !== 'object') return null

  return normalize(json)
}

export async function GET() {
  try {
    const session = await getAuthenticatedSession()
    // The QA endpoint is anonymous, but a QA session carries useful context, so
    // send the bearer token when we have one and fall back to the public call.
    const res = session?.source === 'qa'
      ? await fetchQaApi(QA_PATH)
      : await fetchQaPublicApi(QA_PATH)

    const status = await readStatusJson(res)
    return NextResponse.json(status ?? UNAVAILABLE)
  } catch {
    return NextResponse.json(UNAVAILABLE)
  }
}

export async function PUT(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isAdminProfile(session.profile)) {
    return NextResponse.json({ error: 'Only admins can change the system status.' }, { status: 403 })
  }
  if (session.source !== 'qa') {
    return NextResponse.json({ error: 'System status can only be changed from a QA session.' }, { status: 409 })
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || typeof body.workInProgress !== 'boolean') {
    return NextResponse.json({ error: 'A workInProgress boolean is required.' }, { status: 400 })
  }

  try {
    const res = await fetchQaApi(QA_PATH, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workInProgress: body.workInProgress,
        message: toStringOrNull(body.message),
      }),
    })

    const status = await readStatusJson(res)
    if (!status) {
      return NextResponse.json(
        { error: 'The system status could not be saved.' },
        { status: res.ok ? 502 : res.status },
      )
    }

    return NextResponse.json(status)
  } catch {
    return NextResponse.json({ error: 'The system status could not be saved.' }, { status: 502 })
  }
}
