import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import {
  ensureCommunitySupportResource,
  userCanManageCommunitySupport,
} from '@/lib/server/community-support'

export async function GET(request: NextRequest) {
  const causeId = request.nextUrl.searchParams.get('causeId')

  if (!causeId) {
    return NextResponse.json({ error: 'causeId is required.' }, { status: 400 })
  }

  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  if (session.source === 'qa') {
    // Reads the cause's own QR row. This used to call
    // /api/dashboard/v1/Stakeholder — an endpoint that does not exist, because
    // the stakeholder concept was retired in the QA cutover — so every cause got
    // "No stakeholder for this cause" even when its QR was live. It also
    // returned a shape the card does not consume, so it could not have rendered
    // even had the lookup succeeded.
    const { fetchQaApi, parseQaResponse } = await import('@/lib/auth/qa-api')
    try {
      const qRes = await fetchQaApi(
        `/api/dashboard/v1/QrCode?entityId=${encodeURIComponent(causeId)}&entityType=cause`,
      )
      const qJson = await parseQaResponse<unknown>(qRes, 'Failed to load the cause QR code.').catch(() => null)
      const rows = Array.isArray(qJson) ? qJson
        : (qJson && typeof qJson === 'object' && Array.isArray((qJson as Record<string, unknown>).items))
          ? (qJson as Record<string, unknown>).items as Array<Record<string, unknown>>
          : []

      const read = (row: Record<string, unknown>, ...keys: string[]) => {
        for (const key of keys) {
          const value = row[key]
          if (typeof value === 'string' && value.trim()) return value.trim()
        }
        return null
      }

      // An active code is the one a supporter can actually use; fall back to the
      // first so an archived-but-present QR still renders.
      const qr = rows.find((row) => (read(row, 'status', 'Status') || '').toLowerCase() === 'active') || rows[0]
      if (!qr) {
        return NextResponse.json(
          { error: 'This cause does not have a supporter QR code yet.' },
          { status: 404 },
        )
      }

      const targetUrl = read(qr, 'targetUrl', 'TargetUrl', 'destinationUrl')
      const shortCode = read(qr, 'code', 'Code', 'shortCode') || ''
      if (!targetUrl) {
        return NextResponse.json(
          { error: 'The supporter QR code has no destination set.' },
          { status: 409 },
        )
      }

      return NextResponse.json({
        causeId,
        causeName: read(qr, 'name', 'Name') || '',
        brand: 'localvip',
        supportSlug: shortCode || causeId,
        supportUrl: targetUrl,
        // The card prints displayUrl and encodes redirectUrl. Both are the real
        // destination: there is no separate tracking hop for cause QRs, and
        // inventing one would produce a code that resolves nowhere.
        displayUrl: targetUrl.replace(/^https?:\/\//, ''),
        redirectUrl: targetUrl,
        shortCode,
        qrCodeId: String(read(qr, 'id', 'Id') ?? ''),
        frameText: 'Scan to support',
        headline: 'Support this cause',
        description: 'Scan to join and support this cause through LocalVIP.',
      })
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to build share resource.' },
        { status: 500 },
      )
    }
  }

  const { profile } = session
  const supabase = createServiceClient()

  const { data: cause } = await supabase
    .from('causes')
    .select('*')
    .eq('id', causeId)
    .single()

  if (!cause) {
    return NextResponse.json({ error: 'Cause not found.' }, { status: 404 })
  }

  if (!userCanManageCommunitySupport(profile, cause)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const resource = await ensureCommunitySupportResource(supabase, cause, profile.id)
  return NextResponse.json(resource)
}
