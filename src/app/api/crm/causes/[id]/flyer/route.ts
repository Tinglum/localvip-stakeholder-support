import { NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { fetchPortalCauseAccounts } from '@/lib/server/portal-cause'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { renderCauseCampaignFlyer, FLYER_DESIGNS, type FlyerAudience, type FlyerDesign } from '@/lib/server/cause-campaign-flyers'
import { isHexColor } from '@/lib/brand-colors'
import { getConsumerWebappBaseUrl } from '@/lib/material-engine'
import type { LandingRecord } from '@/lib/cause-landing-config'

export const runtime = 'nodejs'
export const maxDuration = 300

async function authorize(id: string) {
  const operator = await getOperatorRouteContext(['admin', 'field', 'launch_partner', 'community'])
  if ('error' in operator) return operator.error
  if (!operator.session.qaSession) return NextResponse.json({ error: 'Sign in to generate a flyer.' }, { status: 401 })
  if (!/^[1-9]\d*$/.test(id)) return NextResponse.json({ error: 'Select a linked cause.' }, { status: 400 })
  if (operator.shell === 'community') {
    const userId = operator.session.viewingAs?.targetUserId ?? Number(operator.session.localProfileId)
    const accounts = Number.isInteger(userId) && userId > 0 ? await fetchPortalCauseAccounts(userId) : null
    if (!accounts?.some(account => account.accountId === Number(id))) return NextResponse.json({ error: 'This cause is not linked to your account.' }, { status: 403 })
  }
  return null
}

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const denied = await authorize(params.id)
  if (denied) return denied
  try {
    const [cause, landing] = await Promise.all([fetchQaCauseDetail(Number(params.id)),
      fetchQaApi(`/api/dashboard/v1/Nonprofit/${params.id}/landing-page`).then(response => response.ok ? response.json() : null)])
    const missing = [!(landing?.draft?.assets?.mark?.src || cause.imageUrl) && 'logo',
      !(landing?.draft?.assets?.crowd?.src || cause.coverPhotoUrl) && 'community photo',
      !cause.referralCode && 'referral code', !landing?.draft?.slug && 'campaign page setup'].filter(Boolean)
    return NextResponse.json({ ready: missing.length === 0, missing }, { headers: { 'cache-control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'Could not check this cause. Please retry.' }, { status: 502 }) }
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const denied = await authorize(params.id)
  if (denied) return denied
  const body = await request.json().catch(() => null)
  if (!body || !['business', 'families', 'schools', 'boosters'].includes(body.audience) || !FLYER_DESIGNS.includes(body.design) || !['default', 'logo', 'manual'].includes(body.mode)) return NextResponse.json({ error: 'Choose an audience, design, and color mode.' }, { status: 400 })
  if (body.mode !== 'default' && !['background', 'highlight', 'accent'].every(key => typeof body.palette?.[key] === 'string' && isHexColor(body.palette[key]))) return NextResponse.json({ error: 'Choose valid six-digit hex colors.' }, { status: 400 })
  try {
    const [cause, landing] = await Promise.all([
      fetchQaCauseDetail(Number(params.id)),
      fetchQaApi(`/api/dashboard/v1/Nonprofit/${params.id}/landing-page`).then(response => parseQaResponse<LandingRecord>(response, 'Could not load your cause branding.')),
    ])
    const draft = landing?.draft
    const asset = (value: string | null | undefined, folder: string) => !value ? '' : /^https:\/\//i.test(value) ? value : `${QA_AUTH_CONFIG.baseUrl}/uploads/${folder}/${encodeURIComponent(value)}`
    const logoUrl = draft?.assets?.mark?.src || asset(cause.imageUrl, 'logos')
    const coverUrl = draft?.assets?.crowd?.src || asset(cause.coverPhotoUrl, 'covers')
    if (!logoUrl || !coverUrl || !cause.referralCode || !draft?.slug) return NextResponse.json({ error: 'Finish your cause setup with a logo, community photo, and referral link first.' }, { status: 400 })
    const palette = body.mode === 'manual' ? { background: body.palette.background, highlight: body.palette.highlight, accent: body.palette.accent } : undefined
    const bytes = await renderCauseCampaignFlyer({ name: cause.name, locality: [cause.city, cause.state].filter(Boolean).join(', '), logoUrl, coverUrl,
      joinUrl: `${getConsumerWebappBaseUrl()}/go/campaign/${encodeURIComponent(draft.slug)}/${body.audience}?ref=${encodeURIComponent(cause.referralCode)}`,
      audience: body.audience as FlyerAudience, design: body.design as FlyerDesign, category: cause.category, palette, colors: body.mode === 'logo' ? { gold: body.palette.accent } : undefined }, true)
    return NextResponse.json(JSON.parse(Buffer.from(bytes).toString('utf8')), { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('Single flyer generation failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not generate this flyer. Please try again.' }, { status: 502 })
  }
}
