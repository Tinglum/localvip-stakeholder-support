import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!await getAuthenticatedSession()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  if (!/^\d+$/.test(params.id)) return NextResponse.json({ error: 'A linked cause account is required.' }, { status: 400 })
  try {
    const incoming = await request.formData()
    const file = incoming.get('file')
    const slot = String(incoming.get('slot') || '')
    if (!(file instanceof File) || !['team', 'community', 'people'].includes(slot)) {
      return NextResponse.json({ error: 'Choose an image and its placement.' }, { status: 400 })
    }
    const form = new FormData()
    form.append('file', file)
    const response = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${encodeURIComponent(params.id)}/landing-page/assets/${slot}`, { method: 'POST', body: form })
    return NextResponse.json(await parseQaResponse(response, 'Could not upload the image.'))
  } catch (error) {
    const status = error instanceof QaApiError ? error.status : 500
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Upload failed.' }, { status })
  }
}
