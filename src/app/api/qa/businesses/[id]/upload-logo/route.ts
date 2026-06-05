import { NextRequest, NextResponse } from 'next/server'
import { fetchQaBusinessDetail, syncQaBusinessLogo, uploadQaBusinessLogo } from '@/lib/server/qa-dashboard-businesses'
import { parseQaRouteId, qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { canAccessQaBusinessRecord } from '@/lib/server/qa-business-access'

async function handleUpload(
  request: NextRequest,
  params: { id: string },
  method: 'POST' | 'PUT',
) {
  const access = await requireQaRouteAccess(['admin', 'field', 'launch_partner', 'business'])
  if ('error' in access) return access.error

  const qaBusinessId = parseQaRouteId(params.id)
  if (qaBusinessId === null) {
    return NextResponse.json({ error: 'A numeric QA business id is required.' }, { status: 400 })
  }

  const business = await fetchQaBusinessDetail(qaBusinessId).catch(() => null)
  if (!business) {
    return NextResponse.json({ error: 'Business not found.' }, { status: 404 })
  }
  if (!canAccessQaBusinessRecord(access.shell, access.session.profile, business)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const formData = await request.formData()
  const logoImage = formData.get('logoImage')
  if (!(logoImage instanceof File)) {
    return NextResponse.json({ error: 'A logoImage file is required.' }, { status: 400 })
  }

  try {
    const updatedBusiness = method === 'POST'
      ? await syncQaBusinessLogo(qaBusinessId, logoImage, 'POST')
      : await uploadQaBusinessLogo(qaBusinessId, logoImage, 'PUT')

    return NextResponse.json(updatedBusiness)
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
