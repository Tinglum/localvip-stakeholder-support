import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse, QaApiError } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

function positiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export async function POST(request: NextRequest) {
  // Linking a user record to a contact is a write into the CRM — staff only.
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  // The body was forwarded verbatim. Send only the two ids this action needs, so
  // an attacker-shaped payload cannot ride along into the backend command.
  const raw = await request.json().catch(() => null)
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Invalid body.' }, { status: 400 })
  }
  const record = raw as Record<string, unknown>
  const contactId = positiveInt(record.contactId ?? record.contact_id)
  const userId = positiveInt(record.userId ?? record.user_id)
  if (contactId === null || userId === null) {
    return NextResponse.json(
      { error: 'A numeric contactId and userId are required.' },
      { status: 400 },
    )
  }
  const body = { contactId, userId }

  try {
    const res = await fetchQaApi('/api/dashboard/v1/Contact/link-user', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await parseQaJsonResponse(res, 'Failed to link user as contact.')
    return NextResponse.json(data)
  } catch (e) {
    if (e instanceof QaApiError) return NextResponse.json({ error: e.message }, { status: e.status })
    return NextResponse.json({ error: 'Failed.' }, { status: 500 })
  }
}
