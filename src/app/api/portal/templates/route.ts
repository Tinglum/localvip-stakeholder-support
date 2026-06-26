import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

// Active material templates for the business portal browser. Uses the session
// token (server-side) so a business owner can list them without admin scope.
export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const res = await fetchQaApi('/api/dashboard/v1/MaterialTemplate?isActive=true')
    const json = await parseQaResponse<unknown>(res, 'Could not load templates.')
    const raw = Array.isArray(json) ? json : ((json as { items?: unknown[] })?.items || [])
    const templates = raw.map((t) => {
      const r = t as Record<string, unknown>
      return {
        id: r.id,
        name: String(r.name || ''),
        sourcePath: (r.sourcePath ?? r.source_path ?? null) as string | null,
        outputFormat: (r.outputFormat ?? r.output_format ?? null) as string | null,
      }
    }).filter((t) => t.sourcePath) // only templates that have a real design to stamp
    return NextResponse.json({ templates })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load templates.' }, { status: 400 })
  }
}
