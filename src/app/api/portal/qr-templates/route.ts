import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

export const dynamic = 'force-dynamic'

// Admin-defined QR style templates (saved in the QR generator as
// `template_kind: 'layout_template'`). Each carries the QR look (colors, dot
// style, gradient, frame) plus field bindings telling us to fill the link with
// the business's join link and (optionally) drop the business's logo in the
// center. The business portal lists these so a business can generate a material
// with a polished, on-brand QR auto-filled from its own details.
export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    const res = await fetchQaApi('/api/dashboard/v1/QrCodeCollection?status=active')
    const json = await parseQaResponse<unknown>(res, 'Could not load QR templates.')
    const raw = Array.isArray(json) ? json : ((json as { items?: unknown[] })?.items || [])

    const templates = raw
      .map((c) => {
        const r = c as Record<string, unknown>
        let meta: Record<string, unknown> = {}
        const m = r.metadata
        if (typeof m === 'string' && m.trim()) {
          try { meta = JSON.parse(m) } catch { meta = {} }
        } else if (m && typeof m === 'object') {
          meta = m as Record<string, unknown>
        }
        if (meta.template_kind !== 'layout_template') return null
        const layout = (meta.layout as Record<string, unknown>) || {}
        const bindings = (meta.field_bindings as Record<string, unknown>) || {}
        return {
          id: r.id,
          name: String(r.name || 'QR template'),
          layout,
          // Default to business join + business logo when bindings are absent.
          link: bindings.link === 'fixed' ? 'fixed' : 'business_join',
          logo: bindings.logo === 'none' ? 'none' : 'business',
        }
      })
      .filter(Boolean)

    return NextResponse.json({ templates })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load QR templates.' }, { status: 400 })
  }
}
