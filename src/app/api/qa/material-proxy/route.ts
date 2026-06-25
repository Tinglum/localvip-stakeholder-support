import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

// Stream a QA-hosted material file (PDF/image) through THIS origin so it can be
// embedded in an <object>/<iframe> without cross-origin restrictions. The dashboard
// and webapp run on different hosts than the QA backend (qa.localvip.com), and
// browsers refuse to render cross-origin PDFs inline in many configurations — the
// preview comes up blank/broken. Proxying makes the bytes same-origin.
//
// This is intentionally NOT an open proxy: it only forwards URLs that live on the
// configured QA host under /uploads/, and only for an authenticated session.
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'A url is required.' }, { status: 400 })

  const qaBase = (process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || 'https://qa.localvip.com').replace(/\/$/, '')

  let target: URL
  try {
    // Accept both absolute QA URLs and server-relative /uploads paths.
    target = raw.startsWith('/') ? new URL(`${qaBase}${raw}`) : new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid url.' }, { status: 400 })
  }

  const allowedOrigin = new URL(qaBase).origin
  if (target.origin !== allowedOrigin || !target.pathname.toLowerCase().startsWith('/uploads/')) {
    return NextResponse.json({ error: 'That asset cannot be proxied.' }, { status: 403 })
  }

  try {
    const upstream = await fetch(target.toString(), { cache: 'no-store' })
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Asset unavailable (${upstream.status}).` }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type')
      || (target.pathname.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')

    return new NextResponse(upstream.body, {
      headers: {
        'content-type': contentType,
        // Inline so the browser renders it in the embed rather than downloading.
        'content-disposition': 'inline',
        'cache-control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load asset.' }, { status: 502 })
  }
}
