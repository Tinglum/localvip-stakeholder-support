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
            /* Falls through to sourcePath === null and is counted as unusable below. */
          }
        }
        return { id, name, sourcePath, outputFormat }
      }),
    )

    // A template with no loadable design cannot be generated from, so it is not
    // offered. Silently dropping it meant an admin could flag a material as a
    // template, see nothing appear in the portal, and have no way to tell whether
    // the flag failed or the design was missing. Report the count so both sides
    // can be told the list is incomplete.
    const usable = templates.filter((t) => t.sourcePath)
    const unusable = templates
      .filter((t) => !t.sourcePath)
      .map((t) => ({ id: t.id, name: t.name }))
    if (unusable.length > 0) {
      console.warn(
        '[portal/templates] %d template(s) flagged IsTemplate have no loadable design and were hidden: %s',
        unusable.length,
        unusable.map((t) => `${t.name || 'Untitled'} (#${t.id})`).join(', '),
      )
    }
    return NextResponse.json({ templates: usable, unusable })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load templates.' }, { status: 400 })
  }
}
