import { NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { fetchPortalCauseAccounts } from '@/lib/server/portal-cause'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { renderCauseCampaignFlyer, getFlyerSlots, isFlyerImageUrl, validateFlyerOverrides, FLYER_DESIGNS, type FlyerAudience, type FlyerDesign } from '@/lib/server/cause-campaign-flyers'
import { isHexColor } from '@/lib/brand-colors'
import type { LandingRecord } from '@/lib/cause-landing-config'
import { compactFlyerOverrides, flyerEditKey, type FlyerOverrides } from '@/lib/flyer-slots'

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

const AUDIENCES = ['business', 'families', 'schools', 'boosters']
const isTarget = (audience: unknown, design: unknown) => AUDIENCES.includes(audience as string) && FLYER_DESIGNS.includes(design as FlyerDesign)

/** The cause, its landing draft and the assets a flyer is generated from. */
async function loadFlyerSource(id: string) {
  const [cause, landing] = await Promise.all([
    fetchQaCauseDetail(Number(id)),
    fetchQaApi(`/api/dashboard/v1/Nonprofit/${id}/landing-page`).then(response => parseQaResponse<LandingRecord>(response, 'Could not load your cause branding.')),
  ])
  const draft = landing?.draft
  const asset = (value: string | null | undefined, folder: string) => !value ? '' : /^https:\/\//i.test(value) ? value : `${QA_AUTH_CONFIG.baseUrl}/uploads/${folder}/${encodeURIComponent(value)}`
  const logoUrl = draft?.assets?.mark?.src || asset(cause.imageUrl, 'logos')
  const coverUrl = draft?.assets?.crowd?.src || asset(cause.coverPhotoUrl, 'covers')
  return { cause, draft, logoUrl, coverUrl }
}
type FlyerSource = Awaited<ReturnType<typeof loadFlyerSource>>

/** The design's slots and the cause's saved edits for it, dropping any that no longer apply. */
async function slotsWithEdits(source: FlyerSource, audience: string, design: string) {
  const slots = await getFlyerSlots({ name: source.cause.name, audience: audience as FlyerAudience, design: design as FlyerDesign,
    category: source.cause.category, logoUrl: source.logoUrl, coverUrl: source.coverUrl })
  const checked = validateFlyerOverrides(source.draft?.flyerEdits?.[flyerEditKey(design, audience)], slots)
  return { slots, saved: 'overrides' in checked ? checked.overrides : {} }
}

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const denied = await authorize(params.id)
  if (denied) return denied
  // With a design and audience, return that flyer's editable slots instead of readiness.
  const search = new URL(request.url).searchParams
  if (search.has('design') || search.has('audience')) {
    const audience = search.get('audience'), design = search.get('design')
    if (!isTarget(audience, design)) return NextResponse.json({ error: 'Choose an audience and design.' }, { status: 400 })
    try {
      const source = await loadFlyerSource(params.id)
      // The cause's existing photos and logo, offered as one-click image choices.
      const assets = [...new Set([source.logoUrl, source.coverUrl, ...Object.values(source.draft?.assets || {}).map(item => item?.src)])].filter(isFlyerImageUrl)
      return NextResponse.json({ ...await slotsWithEdits(source, audience!, design!), assets }, { headers: { 'cache-control': 'no-store' } })
    } catch { return NextResponse.json({ error: 'Could not load this flyer’s editable text. Please retry.' }, { status: 502 }) }
  }
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
    const source = await loadFlyerSource(params.id)
    const { cause, draft, logoUrl, coverUrl } = source
    if (!logoUrl || !coverUrl || !cause.referralCode || !draft?.slug) return NextResponse.json({ error: 'Finish your cause setup with a logo, community photo, and referral link first.' }, { status: 400 })
    // Without `overrides` the cause's saved edits apply. With them, they replace
    // the saved set; an empty object is "Reset all".
    const { slots, saved } = await slotsWithEdits(source, body.audience, body.design)
    let overrides: FlyerOverrides = saved
    if (body.overrides !== undefined) {
      const checked = validateFlyerOverrides(body.overrides, slots)
      if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 })
      overrides = checked.overrides
    }
    const palette = body.mode === 'manual' ? { background: body.palette.background, highlight: body.palette.highlight, accent: body.palette.accent } : undefined
    const bytes = await renderCauseCampaignFlyer({ name: cause.name, locality: [cause.city, cause.state].filter(Boolean).join(', '), logoUrl, coverUrl,
      joinUrl: `https://my.localvip.com/go/campaign/${encodeURIComponent(draft.slug)}/${body.audience}?ref=${encodeURIComponent(cause.referralCode)}`,
      audience: body.audience as FlyerAudience, design: body.design as FlyerDesign, category: cause.category, palette, colors: body.mode === 'logo' ? { gold: body.palette.accent } : undefined, overrides }, true)
    let saveError: string | undefined
    if (JSON.stringify(overrides) !== JSON.stringify(saved)) {
      // Edits live on the landing draft, the cause's one free-form JSON record.
      // Every other writer of the draft spreads it, so they survive those saves.
      const key = flyerEditKey(body.design, body.audience)
      const { [key]: _replaced, ...others } = draft.flyerEdits || {}
      const flyerEdits = Object.keys(compactFlyerOverrides(overrides)).length ? { ...others, [key]: overrides } : others
      saveError = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${params.id}/landing-page`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: draft.slug, config: { ...draft, flyerEdits } }),
      }).then(response => parseQaResponse(response, 'Save failed.')).then(() => undefined, error => {
        console.error('Flyer edits could not be saved:', error instanceof Error ? error.message : 'Unknown error')
        return 'The preview is updated, but your edits could not be saved for next time.'
      })
    }
    return NextResponse.json({ ...JSON.parse(Buffer.from(bytes).toString('utf8')), overrides, saveError }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('Single flyer generation failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not generate this flyer. Please try again.' }, { status: 502 })
  }
}
