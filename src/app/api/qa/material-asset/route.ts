import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

// Serve a material's file or thumbnail. The QA Material list omits the (large
// data-URL) file/thumbnail payloads, so the library + previews point here and we
// lazily fetch the single material's detail, then stream the decoded bytes.
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (session.source !== 'qa') {
    return NextResponse.json({ error: 'Not available.' }, { status: 404 })
  }

  const id = request.nextUrl.searchParams.get('id')
  const kind = request.nextUrl.searchParams.get('kind') === 'thumbnail' ? 'thumbnail' : 'file'
  if (!id || !/^\d+$/.test(id)) {
    return NextResponse.json({ error: 'A numeric material id is required.' }, { status: 400 })
  }

  try {
    const res = await fetchQaApi(`/api/dashboard/v1/Material/${encodeURIComponent(id)}`)
    const mat = await parseQaResponse<Record<string, unknown>>(res, 'Failed to load material.')
    // Prefer the requested asset; fall back to the file for thumbnails.
    const candidate = kind === 'thumbnail'
      ? (mat?.thumbnailUrl ?? mat?.fileUrl)
      : (mat?.fileUrl ?? mat?.thumbnailUrl)

    if (typeof candidate !== 'string' || !candidate) {
      return NextResponse.json({ error: 'Asset not found.' }, { status: 404 })
    }

    // Data URL → decode and stream the bytes with the right content-type.
    if (candidate.startsWith('data:')) {
      const match = candidate.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/)
      if (!match) {
        return NextResponse.json({ error: 'Malformed asset.' }, { status: 500 })
      }
      const contentType = match[1] || 'application/octet-stream'
      const body = match[2]
        ? Buffer.from(match[3], 'base64')
        : Buffer.from(decodeURIComponent(match[3]))
      return new NextResponse(body, {
        headers: {
          'content-type': contentType,
          'cache-control': 'private, max-age=300',
        },
      })
    }

    // Regular URL → redirect (prefix the QA host for server-relative paths).
    const base = (process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL || '').replace(/\/$/, '')
    const target = candidate.startsWith('/') && base ? `${base}${candidate}` : candidate
    return NextResponse.redirect(target)
  } catch {
    return NextResponse.json({ error: 'Failed to load asset.' }, { status: 500 })
  }
}
