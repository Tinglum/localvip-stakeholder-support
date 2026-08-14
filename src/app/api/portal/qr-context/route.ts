import { NextRequest, NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { resolveScopedPortalBusinessId } from '@/lib/server/portal-business'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'
import { ensureQaBusinessEngagementAssets } from '@/lib/server/qa-business-stakeholders'
import { isBoomerangEnabled } from '@/lib/engagement-codes'

export const dynamic = 'force-dynamic'

// The dynamic business details used to fill a templated QR (link / logo / phone)
// when a business generates a material. Mirrors the backend's join-URL logic so
// the client can preview the exact QR that will be stamped.
// `businessId` is optional: the admin Materials Library is not business-scoped,
// so it names the business it is generating for. Verified, never trusted as-is.
export async function GET(request: NextRequest) {
  const session = await getAuthenticatedSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  const scope = await resolveScopedPortalBusinessId(session, request.nextUrl.searchParams.get('businessId'))
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: scope.status })
  const businessId = scope.businessId
  try {
    const assets = await ensureQaBusinessEngagementAssets(String(businessId))
    const b = assets.business as unknown as Record<string, unknown>
    const code = assets.networkReferral.networkReferralCode || ''
    const networkUrl = assets.networkReferral.networkReferralUrl
      || (code ? `https://my.localvip.com/auth/signup?ref=${encodeURIComponent(code)}` : '')

    // The logo lives on the QA host under /uploads; route it through the same-
    // origin proxy so the client can draw it onto a <canvas> without tainting it.
    const rawLogo = (typeof b.imageUrl === 'string' && b.imageUrl) || (typeof b.image_url === 'string' && b.image_url) || ''
    // Accounts.ImageUrl holds a bare filename; the files live in /uploads/logos.
    const logoUrl = rawLogo ? toProxiedMaterialUrl(rawLogo, '/uploads/logos') : ''

    // A business that declined the Boomerang list, or was never asked, must not
    // be shown its QR, link, offer or materials anywhere. The flag was recorded
    // during onboarding and then never consulted, so declining changed nothing.
    const boomerangEnabled = isBoomerangEnabled(
      (b.hundredListInterest as 'interested' | 'not_now' | null | undefined) ?? null,
    )

    return NextResponse.json({
      businessId,
      boomerangEnabled,
      name: String(b.name || ''),
      joinUrl: networkUrl,
      networkReferralUrl: networkUrl,
      referralCode: code,
      standardQrId: assets.networkReferral.qrCode?.id || null,
      logoUrl,
      phone: typeof b.ownerPhone === 'string' ? b.ownerPhone : '',
      // Per-asset, so a QR that could not be prepared names itself instead of
      // failing the whole request. This used to be one thrown error that took
      // the logo and the referral link down with it, and surfaced the raw
      // backend string where the destination URL belongs.
      networkQrError: assets.networkReferral.error,
      captureQrError: assets.customerCapture.error,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Could not load business.' }, { status: 400 })
  }
}
