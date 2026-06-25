import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export const dynamic = 'force-dynamic'

// Stream a QA-hosted material file (PDF/image) through THIS origin so it can be
// embedded in an <iframe>/<object> without cross-origin restrictions. The dashboard
// runs on a different host than the QA backend (qa.localvip.com), and browsers
// refuse to render cross-origin PDFs inline — the preview comes up blank.
//
// Not an open proxy: it only forwards the configured QA host (and the known
// production host as a hard fallback) under /uploads/, for an authenticated session.
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })

  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return NextResponse.json({ error: 'A url is required.' }, { status: 400 })

  // Resolve the allowed QA host from env, but ALWAYS allow the known production
  // host too, so an env/inlining quirk can never break previews.
  const qaBase = (process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || 'https://qa.localvip.com').trim().replace(/\/$/, '')
  let qaHost = 'qa.localvip.com'
  try { qaHost = new URL(qaBase).hostname } catch { /* keep default */ }
  const allowedHosts = new Set([qaHost, 'qa.localvip.com'])

  let target: URL
  try {
    target = raw.startsWith('/') ? new URL(`https://${qaHost}${raw}`) : new URL(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid url.' }, { status: 400 })
  }

  const pathOk = target.pathname.toLowerCase().startsWith('/uploads/')
  const hostOk = allowedHosts.has(target.hostname)

  // One-shot diagnostic: ?debug=1 returns the resolved values instead of the file.
  if (request.nextUrl.searchParams.get('debug') === '1') {
    return NextResponse.json({ qaBase, qaHost, targetHost: target.hostname, targetPath: target.pathname, hostOk, pathOk })
  }

  if (!hostOk || !pathOk) {
    return NextResponse.json({ error: 'That asset cannot be proxied.' }, { status: 403 })
  }

  try {
    // Always fetch over https from the allowed host/path.
    const upstreamUrl = `https://${target.hostname}${target.pathname}${target.search}`
    const upstream = await fetch(upstreamUrl, { cache: 'no-store' })
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: `Asset unavailable (${upstream.status}).` }, { status: 502 })
    }

    const contentType = upstream.headers.get('content-type')
      || (target.pathname.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'application/octet-stream')

    return new NextResponse(upstream.body, {
      headers: {
        'content-type': contentType,
        'content-disposition': 'inline',
        'cache-control': 'private, max-age=300',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Failed to load asset.' }, { status: 502 })
  }
}
