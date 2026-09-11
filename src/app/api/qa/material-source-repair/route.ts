import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'

/**
 * Proxy for the backend MaterialSourceRepair endpoint.
 *
 * The repair exists because every Olathe flyer template is stored as an inline
 * `data:` URL, and the renderer only reads a source beginning with "/" — so
 * generating from one silently produced the generic "Scan to join the
 * community" poster instead of the artwork. The endpoint is SysAdmin-only and
 * had no way to be called from the dashboard, which is why it shipped and was
 * never actually run.
 *
 * GET  -> status (reports what is renderable / repairable, changes nothing)
 * POST -> materialize (body is passed through; { dryRun: true } reports only)
 */

const BASE = '/api/dashboard/v1/MaterialSourceRepair'

async function forward(path: string, init?: RequestInit) {
  try {
    const response = await fetchQaApi(path, init)
    const data = await parseQaResponse(response, 'Material source repair failed.')
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    if (error instanceof QaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 502 })
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Repair call failed.' },
      { status: 502 },
    )
  }
}

export async function GET() {
  return forward(`${BASE}/status`)
}

export async function POST(request: NextRequest) {
  const body = await request.text()
  return forward(`${BASE}/materialize`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body || '{}',
  })
}
