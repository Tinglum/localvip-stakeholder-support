import { NextRequest, NextResponse } from 'next/server'
import { syncQaCauseLogo, uploadQaCauseLogo } from '@/lib/server/qa-dashboard-causes'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

async function handleUpload(
  request: NextRequest,
  params: { id: string },
  method: 'POST' | 'PUT',
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaNonprofitId = parseQaRouteId(params.id)
  if (qaNonprofitId === null) {
    return NextResponse.json({ error: 'A numeric QA nonprofit id is required.' }, { status: 400 })
  }

  const formData = await request.formData()
  const logoImage = formData.get('logoImage')
  if (!(logoImage instanceof File)) {
    return NextResponse.json({ error: 'A logoImage file is required.' }, { status: 400 })
  }

  try {
    const nonprofit = method === 'POST'
      ? await syncQaCauseLogo(qaNonprofitId, logoImage, 'POST')
      : await uploadQaCauseLogo(qaNonprofitId, logoImage, 'PUT')

    return NextResponse.json(nonprofit)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA nonprofit logo upload failed.')
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return handleUpload(request, params, 'POST')
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  return handleUpload(request, params, 'PUT')
}
