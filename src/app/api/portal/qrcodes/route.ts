import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { resolvePortalBusinessId } from '@/lib/server/portal-business'

export const dynamic = 'force-dynamic'

interface PortalQr {
  id: number | string
  name: string
  targetUrl: string | null
  code: string | null
  qrImageUrl: string | null
}

function mapQr(r: Record<string, unknown>): PortalQr {
  // The display name lives in Metadata JSON when present; fall back to the code.
  let name = ''
  const meta = r.metadata
  if (typeof meta === 'string' && meta.trim()) {
    try {
      const m = JSON.parse(meta) as Record<string, unknown>
      name = String(m.name ?? m.label ?? m.title ?? '')
    } catch {
      /* not JSON */
    }
  }
  const code = (r.code ?? null) as string | null
  return {
    id: r.id as number | string,
    name: name || (code ? `QR ${code}` : 'QR code'),
    targetUrl: (r.targetUrl ?? r.target_url ?? null) as string | null,
    code,
    qrImageUrl: (r.qrImageUrl ?? r.qr_image_url ?? null) as string | null,
  }
}

// GET: the active QR codes belonging to the session's business, so a business
// can choose which QR to stamp on a generated material.
export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const businessId = await resolvePortalBusinessId(session)
  if (businessId == null) {
    return NextResponse.json({ error: 'Could not resolve your business account.' }, { status: 400 })
  }
  try {
    const res = await fetchQaApi(
      `/api/dashboard/v1/QrCode?entityType=business&entityId=${businessId}&status=active&pageSize=200`,
    )
    const json = await parseQaResponse<unknown>(res, 'Could not load QR codes.')
    const raw = Array.isArray(json) ? json : ((json as { items?: unknown[] })?.items || [])
    const qrCodes = raw.map((q) => mapQr(q as Record<string, unknown>))
    return NextResponse.json({ qrCodes, businessId })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load QR codes.' }, { status: 400 })
  }
}

// POST: create a new QR code for the session's business (the "make a new one"
// option in the template generator).
export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const businessId = await resolvePortalBusinessId(session)
  if (businessId == null) {
    return NextResponse.json({ error: 'Could not resolve your business account.' }, { status: 400 })
  }
  const body = await request.json().catch(() => ({})) as { name?: string; targetUrl?: string }
  const targetUrl = (body.targetUrl || '').trim()
  const name = (body.name || '').trim()
  if (!targetUrl) {
    return NextResponse.json({ error: 'A destination URL is required for the new QR code.' }, { status: 400 })
  }
  try {
    const res = await fetchQaApi('/api/dashboard/v1/QrCode', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        entityType: 'business',
        entityId: businessId,
        targetUrl,
        metadata: name ? JSON.stringify({ name }) : null,
      }),
    })
    const created = await parseQaResponse<Record<string, unknown>>(res, 'Could not create the QR code.')
    return NextResponse.json({ qrCode: mapQr(created || {}) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not create the QR code.' }, { status: 400 })
  }
}
