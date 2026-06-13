import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { fetchQaBusinessDetail } from '@/lib/server/qa-dashboard-businesses'
import { parseQaRouteId, requireQaRouteAccess } from '@/lib/server/qa-route'

function isImageResponse(response: Response) {
  const contentType = response.headers.get('content-type') || ''
  return contentType.startsWith('image/') || contentType === 'application/octet-stream'
}

async function proxyQaImage(paths: string[]) {
  const attempts: Array<{ path: string; status: number }> = []

  for (const path of paths) {
    try {
      const response = await fetchQaApi(path, { redirect: 'manual' })
      attempts.push({ path, status: response.status })

      if (response.ok && isImageResponse(response)) {
        const headers = new Headers()
        const contentType = response.headers.get('content-type')
        if (contentType) headers.set('content-type', contentType)
        headers.set('cache-control', 'private, no-store')
        return new NextResponse(response.body, { status: 200, headers })
      }
    } catch {
      attempts.push({ path, status: 0 })
    }
  }

  return NextResponse.json(
    { error: 'The QA cover photo could not be resolved to an image response.', attempts },
    { status: 502 },
  )
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaBusinessId = parseQaRouteId(params.id)
  if (qaBusinessId === null) {
    return NextResponse.json({ error: 'A numeric QA business id is required.' }, { status: 400 })
  }

  const qaBusiness = await fetchQaBusinessDetail(qaBusinessId).catch(() => null)
  const coverName = (qaBusiness as { coverPhotoUrl?: string | null } | null)?.coverPhotoUrl?.trim() || ''
  if (!coverName) {
    return NextResponse.json({ error: 'No QA cover photo is set for this business.' }, { status: 404 })
  }

  if (/^https?:\/\//i.test(coverName)) {
    return NextResponse.redirect(coverName)
  }

  // Cover photos are served as static files under /uploads/covers on the QA host.
  return proxyQaImage([
    `/uploads/covers/${encodeURIComponent(coverName)}`,
  ])
}
