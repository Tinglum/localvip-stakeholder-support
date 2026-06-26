import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

// Templates for the business portal browser. A "template" is a dashboard
// material flagged IsTemplate (the team uploads a design and marks it as a
// template). The list endpoint omits FileUrl (data URLs can be MBs), so we
// fetch each flagged material's detail to get its design source path. The
// business then clicks Generate and its QR is stamped onto that design.
export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const res = await fetchQaApi('/api/dashboard/v1/Material?isTemplate=true')
    const json = await parseQaResponse<unknown>(res, 'Could not load templates.')
    const raw = Array.isArray(json) ? json : ((json as { items?: unknown[] })?.items || [])

    const templates = await Promise.all(
      raw.map(async (t) => {
        const r = t as Record<string, unknown>
        const id = r.id
        const name = String(r.title ?? r.name ?? '')
        const hasFile = r.hasFile
        let sourcePath: string | null = null
        let outputFormat: string | null = null
        // Pull the design source from the material detail (list omits FileUrl).
        if (id != null && hasFile !== false) {
          try {
            const dRes = await fetchQaApi(`/api/dashboard/v1/Material/${id}`)
            const d = (await parseQaResponse<Record<string, unknown>>(dRes, 'Could not load template.')) || {}
            sourcePath = (d.fileUrl ?? d.file_url ?? null) as string | null
            outputFormat = (d.mimeType ?? d.mime_type ?? null) as string | null
          } catch {
            /* skip templates whose design can't be loaded */
          }
        }
        return { id, name, sourcePath, outputFormat }
      }),
    )

    return NextResponse.json({ templates: templates.filter((t) => t.sourcePath) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load templates.' }, { status: 400 })
  }
}
