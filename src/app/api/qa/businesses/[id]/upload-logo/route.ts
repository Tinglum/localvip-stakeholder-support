import { NextRequest, NextResponse } from 'next/server'
import { syncQaBusinessLogo, uploadQaBusinessLogo } from '@/lib/server/qa-dashboard-businesses'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'

async function handleUpload(
  request: NextRequest,
  params: { id: string },
  method: 'POST' | 'PUT',
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner'])
  if ('error' in access) return access.error

  const qaBusinessId = parseQaRouteId(params.id)
  if (qaBusinessId === null) {
    return NextResponse.json({ error: 'A numeric QA business id is required.' }, { status: 400 })
  }

  const formData = await request.formData()
  const logoImage = formData.get('logoImage')
  if (!(logoImage instanceof File)) {
    return NextResponse.json({ error: 'A logoImage file is required.' }, { status: 400 })
  }

  try {
    const business = method === 'POST'
      ? await syncQaBusinessLogo(qaBusinessId, logoImage, 'POST')
      : await uploadQaBusinessLogo(qaBusinessId, logoImage, 'PUT')

    return NextResponse.json(business)
  } catch (error) {
    return qaRouteErrorResponse(error, 'The QA business logo upload failed.')
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
