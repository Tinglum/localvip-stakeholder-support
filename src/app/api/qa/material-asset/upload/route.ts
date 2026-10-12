import { NextRequest, NextResponse } from 'next/server'
import { fetchQaApi, parseQaResponse, QaApiError } from '@/lib/auth/qa-api'
import { getAuthenticatedSession } from '@/lib/server/auth-session'

// Material template assets are PDFs, raster images, or SVG designs. SVG can
// carry script, so the backend screens every SVG before writing it
// (SvgUploadScreening: no script/foreignObject/iframe/animation, no on*
// handlers, no remote references). SVG designs are needed for templates
// that fill {{brand_*}} colour slots per cause.
const MAX_UPLOAD_BYTES = 15 * 1024 * 1024 // 15MB
const ALLOWED_CONTENT_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
])
const ALLOWED_EXTENSIONS = new Set([
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
])

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot >= 0 ? name.slice(dot).toLowerCase() : ''
}

export async function POST(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const folder = request.nextUrl.searchParams.get('folder') || 'general'
  try {
    const form = await request.formData()
    const file = form.get('file')
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'file is required.' }, { status: 400 })
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File exceeds the 15MB limit.' }, { status: 413 })
    }

    const contentType = (file.type || '').toLowerCase()
    const extension = getExtension(file.name || '')
    if (!ALLOWED_CONTENT_TYPES.has(contentType) || !ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        { error: 'Unsupported file type. Allowed: PDF, PNG, JPEG, GIF, WEBP.' },
        { status: 415 },
      )
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
