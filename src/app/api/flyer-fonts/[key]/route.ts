import { readFile } from 'node:fs/promises'
import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { flyerFontFace } from '@/lib/server/flyer-fonts'

export const runtime = 'nodejs'

// The font files the flyer renderer prints with, so the generator's live
// preview sets type exactly as the PDF will. Only resolved faces are served.
export async function GET(_: Request, { params }: { params: { key: string } }) {
  if (!await getAuthenticatedSession()) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const face = flyerFontFace(params.key)
  if (!face) return NextResponse.json({ error: 'Unknown font.' }, { status: 404 })
  try {
    return new NextResponse(new Uint8Array(await readFile(face.file)), {
      headers: { 'content-type': 'font/ttf', 'cache-control': 'private, max-age=86400' },
    })
  } catch {
    return NextResponse.json({ error: 'Font unavailable.' }, { status: 404 })
  }
}
