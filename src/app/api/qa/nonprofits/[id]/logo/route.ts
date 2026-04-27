import { NextResponse } from 'next/server'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
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
    {
      error: 'The QA nonprofit logo could not be resolved to an image response.',
      attempts,
    },
    { status: 502 },
  )
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaNonprofitId = parseQaRouteId(params.id)
  if (qaNonprofitId === null) {
    return NextResponse.json({ error: 'A numeric QA nonprofit id is required.' }, { status: 400 })
  }

  const qaCause = await fetchQaCauseDetail(qaNonprofitId).catch(() => null)
  const imageName = qaCause?.imageUrl?.trim() || ''
  if (!imageName) {
    return NextResponse.json({ error: 'No QA logo is set for this nonprofit.' }, { status: 404 })
  }

  if (/^https?:\/\//i.test(imageName)) {
    return NextResponse.redirect(imageName)
  }

  return proxyQaImage([
    `/Nonprofits/GetLogo?id=${qaNonprofitId}`,
    `/Nonprofits/GetImage?id=${qaNonprofitId}`,
    `/Nonprofit/GetLogo?id=${qaNonprofitId}`,
    `/Nonprofit/GetImage?id=${qaNonprofitId}`,
    `/Nonprofits/GetLogo?fileName=${encodeURIComponent(imageName)}`,
    `/Nonprofits/GetImage?fileName=${encodeURIComponent(imageName)}`,
    `/Nonprofit/GetLogo?fileName=${encodeURIComponent(imageName)}`,
    `/Nonprofit/GetImage?fileName=${encodeURIComponent(imageName)}`,
  ])
}
