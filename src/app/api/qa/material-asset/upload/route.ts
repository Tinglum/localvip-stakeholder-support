import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'

export async function POST(request: NextRequest) {
  const folder = request.nextUrl.searchParams.get('folder') || 'general'
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required.' }, { status: 400 })
    }
    const upstream = new FormData()
    upstream.append('file', file)
    const res = await fetchQaApi(`/api/dashboard/v1/MaterialAsset/upload?folder=${encodeURIComponent(folder)}`, {
      method: 'POST',
      body: upstream,
    })
    const json = await parseQaResponse<unknown>(res, 'Upload failed.')
    return NextResponse.json(json)
  } catch (err) {
    if (err instanceof QaApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Upload failed.' },
      { status: 500 },
    )
  }
}
