import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { parseQaRouteId, requireQaRouteAccess } from '@/lib/server/qa-route'

function positiveInt(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(n) && n > 0 ? n : null
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  // Granting a stakeholder access to an entity is an authorization change.
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const stakeholderId = parseQaRouteId(params.id)
  if (stakeholderId === null) {
    return NextResponse.json({ error: 'A numeric stakeholder id is required.' }, { status: 400 })
  }

  // The body used to be forwarded verbatim. Only the assignment's own fields go
  // through, so nothing else can be smuggled into the backend command.
  const raw = await request.json().catch(() => null)
  const record = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const entityType = record.entityType ?? record.entity_type
  const entityId = positiveInt(record.entityId ?? record.entity_id)
  if ((entityType !== 'business' && entityType !== 'cause') || entityId === null) {
    return NextResponse.json(
      { error: 'entityType must be "business" or "cause", with a numeric entityId.' },
      { status: 400 },
    )
  }
  const body = { entityType, entityId }

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Stakeholder/${stakeholderId}/assign`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await parseQaResponse<unknown>(res, 'Failed to assign stakeholder.')
    return NextResponse.json(json)
  } catch (err) {
    if (err instanceof QaApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Assignment failed.' },
      { status: 500 },
    )
  }
}
