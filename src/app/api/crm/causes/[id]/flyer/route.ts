import { NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { fetchPortalCauseAccounts } from '@/lib/server/portal-cause'
import { fetchQaCauseDetail } from '@/lib/server/qa-dashboard-causes'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { prepareFlyerImage, renderCauseCampaignFlyer, renderCauseCampaignFlyerSvg, getFlyerSlots, getGivebackFlyerSlots, isFlyerImageUrl, validateFlyerOverrides, type FlyerAudience, type FlyerDesign } from '@/lib/server/cause-campaign-flyers'
import { isHexColor } from '@/lib/brand-colors'
import type { LandingRecord } from '@/lib/cause-landing-config'
import { FLYER_ORG_WORD_SLOT, flyerEditsFor, storeFlyerEdits, type FlyerOverrides } from '@/lib/flyer-slots'
import { designAudiences, flyerPhotoFor, isGeneratorDesign, isGivebackDesign, type GivebackDesign } from '@/lib/flyer-designs'
import { flyerFonts, givebackFonts } from '@/lib/server/flyer-fonts'

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
// GiveBack Days is business-only; the library designs serve every audience.
const isTarget = (audience: unknown, design: unknown) => AUDIENCES.includes(audience as string) && isGeneratorDesign(design) && designAudiences(design).includes(audience as FlyerAudience)

/** The cause, its landing draft and the assets a flyer is generated from. */
async function loadFlyerSource(id: string) {
  const [cause, landing] = await Promise.all([
    fetchQaCauseDetail(Number(id)),
    fetchQaApi(`/api/dashboard/v1/Nonprofit/${id}/landing-page`).then(response => parseQaResponse<LandingRecord>(response, 'Could not load your cause branding.')),
  ])
  const draft = landing?.draft
  const asset = (value: string | null | undefined, folder: string) => !value ? '' : /^https:\/\//i.test(value) ? value : `${QA_AUTH_CONFIG.baseUrl}/uploads/${folder}/${encodeURIComponent(value)}`
  const logoUrl = draft?.assets?.mark?.src || asset(cause.imageUrl, 'logos')
  // The setup photos by slot; `crowd` is the account's original cover photo.
  const photos: Record<string, string> = { crowd: draft?.assets?.crowd?.src || asset(cause.coverPhotoUrl, 'covers') }
  for (const slot of ['team', 'people', 'community']) photos[slot] = draft?.assets?.[slot as 'team']?.src || ''
  return { cause, draft, logoUrl, photos }
}
type FlyerSource = Awaited<ReturnType<typeof loadFlyerSource>>
// GiveBack Days leads with the wider-community photo, as the business Community Win does.
const coverFor = (source: FlyerSource, audience: string, design: string) => flyerPhotoFor(audience as FlyerAudience, (isGivebackDesign(design) ? 'community' : design) as FlyerDesign, source.photos)
/** The cause details GiveBack Days is worded from. */
const givebackDetails = (source: FlyerSource) => ({
  name: source.cause.name, locality: [source.cause.city, source.cause.state].filter(Boolean).join(', '), category: source.cause.category,
  parentOrganization: String((source.draft as { parentOrganization?: string } | undefined)?.parentOrganization || ''),
  owner: { name: source.cause.ownerName, email: source.cause.ownerEmail, phone: source.cause.ownerPhone },
})

/**
 * The design's slots and the cause's saved edits for it, dropping any that no
 * longer apply. `orgWord` is the organization word to describe the lines with
 * (an unsaved edit); by default the saved one.
 */
async function slotsWithEdits(source: FlyerSource, audience: string, design: string, orgWord?: string) {
  const raw = flyerEditsFor(source.draft?.flyerEdits, design, audience)
  const slots = isGivebackDesign(design)
    ? getGivebackFlyerSlots({ ...givebackDetails(source), design: design as GivebackDesign, logoUrl: source.logoUrl, coverUrl: coverFor(source, audience, design) })
    : await getFlyerSlots({ name: source.cause.name, audience: audience as FlyerAudience, design: design as FlyerDesign,
    category: source.cause.category, logoUrl: source.logoUrl, coverUrl: coverFor(source, audience, design),
    orgWord: orgWord ?? raw.text?.[FLYER_ORG_WORD_SLOT] })
  const checked = validateFlyerOverrides(raw, slots)
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
      const assets = [...new Set([source.logoUrl, ...Object.values(source.photos), ...Object.values(source.draft?.assets || {}).map(item => item?.src)])].filter(isFlyerImageUrl)
      return NextResponse.json({ ...await slotsWithEdits(source, audience!, design!, search.get('orgWord') ?? undefined), assets }, { headers: { 'cache-control': 'no-store' } })
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
  if (!body || !isTarget(body.audience, body.design) || !['default', 'logo', 'manual'].includes(body.mode)) return NextResponse.json({ error: 'Choose an audience, design, and color mode.' }, { status: 400 })
  if (body.mode !== 'default' && !['background', 'highlight', 'accent'].every(key => typeof body.palette?.[key] === 'string' && isHexColor(body.palette[key]))) return NextResponse.json({ error: 'Choose valid six-digit hex colors.' }, { status: 400 })
  if (body.output === 'image') {
    // One replacement image, treated as the renderer treats it, for the live preview.
    const url = typeof body.url === 'string' && body.url.startsWith('/uploads/') ? `${QA_AUTH_CONFIG.baseUrl}${body.url}` : body.url
    if (!['logo', 'photo'].includes(body.slot) || !isFlyerImageUrl(url)) return NextResponse.json({ error: 'Choose an image uploaded to LocalVIP.' }, { status: 400 })
    try {
      return NextResponse.json(await prepareFlyerImage(body.slot, url), { headers: { 'cache-control': 'private, max-age=600' } })
    } catch (error) {
      console.error('Flyer image preparation failed:', error instanceof Error ? error.message : 'Unknown error')
      return NextResponse.json({ error: 'Could not prepare this image. Try another one.' }, { status: 502 })
    }
  }
  try {
    const source = await loadFlyerSource(params.id)
    const { cause, draft, logoUrl } = source
    const coverUrl = coverFor(source, body.audience, body.design)
    if (!logoUrl || !coverUrl || !cause.referralCode || !draft?.slug) return NextResponse.json({ error: 'Finish your cause setup with a logo, community photo, and referral link first.' }, { status: 400 })
    // Without `overrides` the cause's saved edits apply. With them, they replace
    // the saved set; an empty object is "Reset all".
    const { saved } = await slotsWithEdits(source, body.audience, body.design)
    let overrides: FlyerOverrides = saved
    if (body.overrides !== undefined) {
      // Describe the lines with the organization word being sent, so a line
      // that matches its new default is not stored as an edit.
      const word = typeof body.overrides?.text?.[FLYER_ORG_WORD_SLOT] === 'string' ? body.overrides.text[FLYER_ORG_WORD_SLOT] : ''
      const { slots } = await slotsWithEdits(source, body.audience, body.design, word)
      const checked = validateFlyerOverrides(body.overrides, slots)
      if ('error' in checked) return NextResponse.json({ error: checked.error }, { status: 400 })
      overrides = checked.overrides
    }
    // `output`: 'svg' is the live preview (no save), 'save' stores edits made in
    // the preview without rendering, anything else renders and saves the PDF.
    const output = body.output === 'svg' || body.output === 'save' ? body.output : 'pdf'
    let saveError: string | undefined
    if (output !== 'svg' && JSON.stringify(overrides) !== JSON.stringify(saved)) {
      // Edits live on the landing draft, the cause's one free-form JSON record.
      // Every other writer of the draft spreads it, so they survive those saves.
      // The organization word is kept once for the whole cause (see storeFlyerEdits).
      const flyerEdits = storeFlyerEdits(draft.flyerEdits, body.design, body.audience, overrides)
      saveError = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${params.id}/landing-page`, {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug: draft.slug, config: { ...draft, flyerEdits } }),
      }).then(response => parseQaResponse(response, 'Save failed.')).then(() => undefined, error => {
        console.error('Flyer edits could not be saved:', error instanceof Error ? error.message : 'Unknown error')
        return 'Your edits could not be saved for next time.'
      })
    }
    if (output === 'save') return NextResponse.json({ overrides, saveError }, { status: saveError ? 502 : 200, headers: { 'cache-control': 'no-store' } })
    const palette = body.mode === 'manual' ? { background: body.palette.background, highlight: body.palette.highlight, accent: body.palette.accent } : undefined
    const input = { name: cause.name, locality: [cause.city, cause.state].filter(Boolean).join(', '), logoUrl, coverUrl,
      joinUrl: `https://my.localvip.com/go/campaign/${encodeURIComponent(draft.slug)}/${body.audience}?ref=${encodeURIComponent(cause.referralCode)}`,
      audience: body.audience as FlyerAudience, design: body.design, category: cause.category, palette, colors: body.mode === 'logo' ? { gold: body.palette.accent } : undefined, overrides,
      ...(isGivebackDesign(body.design) ? { parentOrganization: givebackDetails(source).parentOrganization, owner: givebackDetails(source).owner, qr: body.qr === true } : {}) }
    if (output === 'svg') {
      // The browser draws this with the same font files resvg prints with.
      const { faces, display, sans } = isGivebackDesign(body.design) ? givebackFonts() : flyerFonts()
      return NextResponse.json({ svg: await renderCauseCampaignFlyerSvg(input), overrides,
        fonts: { display, sans, faces: faces.map(({ key, family, weight }) => ({ url: `/api/flyer-fonts/${key}`, family, weight })) } },
      { headers: { 'cache-control': 'no-store' } })
    }
    const bytes = await renderCauseCampaignFlyer(input, true)
    return NextResponse.json({ ...JSON.parse(Buffer.from(bytes).toString('utf8')), overrides, saveError }, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    console.error('Single flyer generation failed:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Could not generate this flyer. Please try again.' }, { status: 502 })
  }
}
