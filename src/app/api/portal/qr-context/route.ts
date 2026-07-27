import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { resolvePortalBusinessId } from '@/lib/server/portal-business'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import { ensureQaBusinessEngagementAssets } from '@/lib/server/qa-business-stakeholders'

export const dynamic = 'force-dynamic'

// The dynamic business details used to fill a templated QR (link / logo / phone)
// when a business generates a material. Mirrors the backend's join-URL logic so
// the client can preview the exact QR that will be stamped.
export async function GET() {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const businessId = await resolvePortalBusinessId(session)
  if (businessId == null) {
    return NextResponse.json({ error: 'Could not resolve your business account.' }, { status: 400 })
  }
  try {
    const assets = await ensureQaBusinessEngagementAssets(String(businessId))
    const b = assets.business as unknown as Record<string, unknown>
    const code = assets.networkReferral.networkReferralCode || ''
    const networkUrl = assets.networkReferral.networkReferralUrl
      || (code ? `https://my.localvip.com/auth/signup?ref=${encodeURIComponent(code)}` : '')

    // The logo lives on the QA host under /uploads; route it through the same-
    // origin proxy so the client can draw it onto a <canvas> without tainting it.
    const rawLogo = (typeof b.imageUrl === 'string' && b.imageUrl) || (typeof b.image_url === 'string' && b.image_url) || ''
    const logoUrl = rawLogo ? toProxiedMaterialUrl(rawLogo) : ''

    return NextResponse.json({
      businessId,
      name: String(b.name || ''),
      joinUrl: networkUrl,
      networkReferralUrl: networkUrl,
      referralCode: code,
      standardQrId: assets.networkReferral.qrCode?.id || null,
      logoUrl,
      phone: typeof b.ownerPhone === 'string' ? b.ownerPhone : '',
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load business.' }, { status: 400 })
  }
}
