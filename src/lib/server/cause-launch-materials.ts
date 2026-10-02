import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { renderCauseCampaignFlyer, type FlyerAudience } from './cause-campaign-flyers'
import { CAUSE_PHOTO_PROMPTS, type CausePhotoSlot } from '@/lib/cause-setup'

/**
 * The landing draft's named image slots. These are the webapp's own
 * `Campaign.assets` names, and the cause video has one image beat per photo
 * slot, so a single upload set feeds the page and the render.
 */
type DraftAssets = Partial<Record<'mark' | CausePhotoSlot, { src?: string; alt?: string }>>
const PHOTO_SLOTS = CAUSE_PHOTO_PROMPTS.map((prompt) => prompt.slot)

/**
 * A landing page that is already live keeps serving its PUBLISHED blob; writing
 * the draft (new photos, a freshly rendered video) does not change what the
 * public sees. The backend moves such a record to `published_with_changes`, and
 * the cause has to press Publish for the live page to catch up.
 *
 * We deliberately do not republish for them. Publishing is a review gate (the
 * backend refuses it while blockers remain, and a relationship disclaimer is
 * part of what gets published), and draft and published are single JSON blobs:
 * republishing to ship a video would also ship every other unreviewed draft
 * edit — names, slug, colours, disclaimer. So this reports the staleness and
 * the UI asks for one click instead.
 */
const STALE_LIVE_NOTE = 'Your live page still shows the previous version. Open your landing page and press Publish to update it.'
const isLandingLive = (status?: string) => status === 'published' || status === 'published_with_changes'

type LaunchCause = {
  id: number
  name: string
  city?: string | null
  state?: string | null
  imageUrl?: string | null
  coverPhotoUrl?: string | null
  category?: string | null
  referralCode?: string | null
  headline?: string | null
}

type LandingRecord = { status?: string; draft?: unknown; published?: unknown }
type GeneratedList = { items?: Array<{ generatedFileUrl?: string | null; generationStatus?: string | null; metadata?: unknown }> }
const DEFAULT_SETUP_CALL_URL = process.env.LOCALVIP_SETUP_CALL_URL || 'https://calendly.com/ktinglum/localvip-internship'

function materialMetadata(value: unknown): Record<string, unknown> | null {
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return null }
  }
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

const slugify = (value: string) => value.toLowerCase().normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '').slice(0, 70)

function assetUrl(value: string | null | undefined, folder: 'logos' | 'covers') {
  if (!value) return ''
  if (/^https?:\/\//i.test(value)) return value
  return `${QA_AUTH_CONFIG.baseUrl}/uploads/${folder}/${encodeURIComponent(value)}`
}

async function qaJson<T>(path: string, init?: RequestInit, message = 'Launch materials request failed.') {
  return parseQaResponse<T>(await fetchQaApi(path, init), message)
}

export async function getCauseLaunchStatus(causeId: number, request: typeof qaJson = qaJson) {
  const [landing, generated] = await Promise.all([
    request<LandingRecord>(`/api/dashboard/v1/Nonprofit/${causeId}/landing-page`),
    request<GeneratedList>(`/api/dashboard/v1/GeneratedMaterial?causeAccountId=${causeId}`),
  ])
  const flyerCount = generated?.items?.filter(item => item.generatedFileUrl && item.generationStatus !== 'failed').length || 0
  const audienceCount = new Set(generated?.items?.filter(item => item.generatedFileUrl && item.generationStatus !== 'failed')
    .map(item => materialMetadata(item.metadata))
    .filter(metadata => metadata?.generator === 'cause-campaign-v1' && String(metadata.version || '').startsWith('olathe-west-layout-v3|'))
    .map(metadata => metadata?.audience)).size
  const draft = landing?.draft as { slug?: string; video?: { src?: string }; assets?: DraftAssets } | null
  const published = landing?.published as { video?: { src?: string } } | null
  const videoUrl = draft?.video?.src || null
  const missingPhotos = PHOTO_SLOTS.filter((slot) => !draft?.assets?.[slot]?.src)
  return {
    missingPhotos,
    /** True when the live page is serving an older revision than the draft. */
    landingNeedsRepublish: landing?.status === 'published_with_changes'
      || (isLandingLive(landing?.status) && !!videoUrl && published?.video?.src !== videoUrl),
    flyers: audienceCount === 3 ? 'generated' : audienceCount > 0 ? 'partial' : 'waiting for assets',
    flyerCount: audienceCount,
    totalMaterialCount: flyerCount,
    landingPages: landing?.status || 'not_started',
    landingSlug: draft?.slug || null,
    video: videoUrl ? 'generated'
      : !draft?.assets?.mark?.src || !draft?.assets?.crowd?.src ? 'waiting for images'
        : !process.env.CAUSE_VIDEO_RENDER_URL || !process.env.CAUSE_VIDEO_RENDER_TOKEN ? 'renderer not configured' : 'ready to render',
    videoUrl,
  }
}

async function generateCauseLaunchMaterialsInner(cause: LaunchCause, request: typeof qaJson) {
  const steps: Record<string, { status: string; detail?: string }> = {}
  const landingPath = `/api/dashboard/v1/Nonprofit/${cause.id}/landing-page`
  let campaignSlug = `${slugify(cause.name) || 'cause'}-${cause.id}`
  let logoUrl = assetUrl(cause.imageUrl, 'logos')
  // `crowd` is the original single cover photo, so an existing cause's upload
  // carries straight over into the four-slot model.
  const photoUrls: Record<CausePhotoSlot, string> = { crowd: assetUrl(cause.coverPhotoUrl, 'covers'), team: '', people: '', community: '' }
  let flyerColors: { navy?: string; gold?: string } | undefined
  let flyerMission = cause.headline || ''
  let parentOrganization = ''
  try {
    const record = await request<LandingRecord>(landingPath)
    campaignSlug = String((record?.draft as { slug?: string } | null)?.slug || campaignSlug)
    const draftAssets = (record?.draft as { assets?: DraftAssets } | null)?.assets
    flyerColors = (record?.draft as { colors?: { navy?: string; gold?: string } } | null)?.colors
    flyerMission = String((record?.draft as { mission?: string } | null)?.mission || cause.headline || '')
    parentOrganization = String((record?.draft as { parentOrganization?: string } | null)?.parentOrganization || '')
    logoUrl ||= draftAssets?.mark?.src || ''
    for (const slot of PHOTO_SLOTS) photoUrls[slot] ||= draftAssets?.[slot]?.src || ''
    if (record?.draft || record?.published) {
      const draft = record.draft as Record<string, unknown> | null
      const assets = draft?.assets as DraftAssets | undefined
      const logo = logoUrl
      const photosChanged = PHOTO_SLOTS.some((slot) => photoUrls[slot] && assets?.[slot]?.src !== photoUrls[slot])
      if (draft && assets && ((logo && assets.mark?.src !== logo) || photosChanged || !draft.scheduleCallUrl || (!draft.mission && cause.headline))) {
        const nextAssets: DraftAssets = { ...assets, mark: logo ? { src: logo, alt: `${cause.name} logo` } : assets.mark }
        for (const prompt of CAUSE_PHOTO_PROMPTS) {
          const src = photoUrls[prompt.slot]
          if (src) nextAssets[prompt.slot] = { src, alt: assets[prompt.slot]?.alt || `${cause.name}: ${prompt.label.toLowerCase()}` }
        }
        const config = { ...draft, mission: draft.mission || cause.headline || '', scheduleCallUrl: draft.scheduleCallUrl || DEFAULT_SETUP_CALL_URL, assets: nextAssets }
        const slug = String(draft.slug || `${slugify(cause.name) || 'cause'}-${cause.id}`)
        await request(landingPath, {
          method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ slug, config }),
        })
        steps.landingPages = { status: 'draft',
          detail: `Newly uploaded assets added to the campaign draft.${isLandingLive(record.status) ? ` ${STALE_LIVE_NOTE}` : ''}` }
      } else {
        steps.landingPages = { status: record.status || 'draft', detail: 'Existing campaign preserved.' }
      }
    } else {
      const slug = `${slugify(cause.name) || 'cause'}-${cause.id}`
      const config = {
        slug, revision: 'draft', schoolName: cause.name, organizationName: cause.name, mission: cause.headline || '',
        causeAccountId: cause.id, locality: [cause.city, cause.state].filter(Boolean).join(', ') || 'your community',
        routeBase: `/landing/${slug}`,
        colors: { navy: '#071A3D', navyDeep: '#031126', royal: '#153E78', silver: '#C8CBD1', silverLight: '#EEF0F3', gold: '#D0A323' },
        assets: {
          mark: { src: logoUrl, alt: `${cause.name} logo` },
          ...Object.fromEntries(CAUSE_PHOTO_PROMPTS.map((prompt) => [
            prompt.slot, { src: photoUrls[prompt.slot], alt: `${cause.name}: ${prompt.label.toLowerCase()}` },
          ])),
        },
        scheduleCallUrl: DEFAULT_SETUP_CALL_URL, disclaimer: '', assetsArePlaceholder: false,
      }
      const saved = await request<{ blockers?: string[] }>(landingPath, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, config }),
      })
      steps.landingPages = { status: 'draft', detail: saved?.blockers?.join(' ') || 'Ready for review.' }
    }
  } catch (error) {
    steps.landingPages = { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }

  /** The flyers use the one wide supporters photo, as they always have. */
  const coverUrl = photoUrls.crowd
  const missingPhotos = CAUSE_PHOTO_PROMPTS.filter((prompt) => !photoUrls[prompt.slot])

  try {
    if (!cause.referralCode) {
      steps.flyers = { status: 'waiting', detail: 'The cause needs a referral code before its QR flyers can be generated.' }
    } else {
      const audiences: FlyerAudience[] = ['business', 'families', 'schools']
      const flyerErrors: string[] = []
      let customGenerated = 0
      const existing = await request<GeneratedList>(`/api/dashboard/v1/GeneratedMaterial?causeAccountId=${cause.id}&pageSize=100`)
      if (logoUrl && coverUrl) {
        const version = `olathe-west-layout-v3|${logoUrl}|${coverUrl}|${cause.referralCode}|${flyerMission}|${parentOrganization}|${flyerColors?.navy || ''}|${flyerColors?.gold || ''}`
        for (const audience of audiences) {
          const alreadySaved = existing?.items?.some(item => {
            const metadata = materialMetadata(item.metadata)
            return item.generatedFileUrl && metadata?.generator === 'cause-campaign-v1' && metadata?.audience === audience && metadata?.version === version
          })
          if (alreadySaved) { customGenerated += 1; continue }
          try {
            const joinUrl = `https://my.localvip.com/go/campaign/${encodeURIComponent(campaignSlug)}/${audience}?ref=${encodeURIComponent(cause.referralCode)}`
            const bytes = await renderCauseCampaignFlyer({ name: cause.name,
              locality: [cause.city, cause.state].filter(Boolean).join(', ') || 'Your community',
              logoUrl, coverUrl, joinUrl, audience, mission: flyerMission, parentOrganization, colors: flyerColors })
            const filename = `${slugify(cause.name) || 'cause'}-${audience}-flyer.pdf`
            const form = new FormData()
            form.append('file', new File([new Uint8Array(bytes)], filename, { type: 'application/pdf' }))
            const uploaded = await request<{ fileUrl: string }>(
              '/api/dashboard/v1/MaterialAsset/upload?folder=cause-launch', { method: 'POST', body: form },
              `Could not upload ${audience} flyer.`)
            if (!uploaded?.fileUrl) throw new Error('The asset upload did not return a file URL.')
            await request('/api/dashboard/v1/GeneratedMaterial', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ causeAccountId: cause.id, generatedFileUrl: uploaded.fileUrl,
                generatedFileName: filename, libraryFolder: 'Cause launch', tags: `school,cause,${audience}`,
                metadata: { generator: 'cause-campaign-v1', audience, version, joinUrl } }),
            }, `Could not save ${audience} flyer.`)
            customGenerated += 1
          } catch (error) {
            flyerErrors.push(`${audience}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
      }
      const templatesResult = await request<unknown>('/api/dashboard/v1/MaterialTemplate?isActive=true')
      const raw = Array.isArray(templatesResult) ? templatesResult
        : (templatesResult && typeof templatesResult === 'object' && Array.isArray((templatesResult as { items?: unknown[] }).items))
          ? (templatesResult as { items: unknown[] }).items : []
      const templates = raw.filter(item => {
        if (!item || typeof item !== 'object') return false
        const row = item as Record<string, unknown>
        const value = row.stakeholderTypes ?? row.stakeholder_types
        let types: unknown[]
        if (Array.isArray(value)) types = value
        else {
          const text = String(value || '').trim()
          if (text.startsWith('[')) {
            try {
              const parsed = JSON.parse(text) as unknown
              types = Array.isArray(parsed) ? parsed : [text]
            } catch { types = text.split(',') }
          } else types = text.split(',')
        }
        return types.length === 0 || types.every(type => !String(type).trim())
          || types.some(type => ['cause', 'school', 'community', 'nonprofit'].includes(String(type).trim().toLowerCase()))
      }) as Array<{ id: number | string; name?: string }>
      if (templates.length === 0) {
        steps.flyers = { status: customGenerated === 3 ? 'generated' : 'waiting',
          detail: customGenerated === 3 ? '3/3 audience flyers generated.' : 'Upload a logo and cover photo to generate three audience flyers.' }
      } else {
        const errors: string[] = []
        let generated = 0
        for (const template of templates) {
          const version = `${template.id}|${cause.referralCode}`
          if (existing?.items?.some(item => {
            const metadata = materialMetadata(item.metadata)
            return item.generatedFileUrl && metadata?.generator === 'cause-template-v1' && metadata?.version === version
          })) { generated += 1; continue }
          try {
            await request<unknown>('/api/dashboard/v1/GeneratedMaterial', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ causeAccountId: cause.id, templateId: template.id,
                templateSource: 'material_template', metadata: { generator: 'cause-template-v1', version } }),
            }, `Could not generate ${template.name || 'a flyer'}.`)
            generated += 1
          } catch (error) {
            errors.push(`${template.name || template.id}: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        const allErrors = [...flyerErrors, ...errors]
        steps.flyers = { status: allErrors.length ? (generated || customGenerated ? 'partial' : 'failed') :
          customGenerated === 3 || (!logoUrl || !coverUrl) ? 'generated' : 'partial',
          detail: `${customGenerated}/3 audience flyers, ${generated}/${templates.length} templates generated.${allErrors.length ? ` ${allErrors.join(' ')}` : ''}` }
      }
    }
  } catch (error) {
    steps.flyers = { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }

  const renderUrl = process.env.CAUSE_VIDEO_RENDER_URL
  const renderToken = process.env.CAUSE_VIDEO_RENDER_TOKEN
  const videoJoinUrl = cause.referralCode
    ? `https://my.localvip.com/go/campaign/${encodeURIComponent(campaignSlug)}/families?ref=${encodeURIComponent(cause.referralCode)}`
    : ''
  // Every photo is in the version key: when a cause adds the three newer
  // photos later, the video re-renders with its remaining beats filled in.
  const videoVersion = `qr-v3|${logoUrl}|${PHOTO_SLOTS.map((slot) => photoUrls[slot]).join('|')}|${videoJoinUrl}`
  let savedVideoUrl: string | null = null
  if (logoUrl && coverUrl) {
    try {
      const beforeRender = await request<LandingRecord>(landingPath)
      const draft = beforeRender?.draft as Record<string, unknown> | null
      const video = draft?.video as { src?: string } | undefined
      if (video?.src && (!draft?.videoSource || draft.videoSource === videoVersion)) savedVideoUrl = video.src
    } catch { /* The render path reports landing-page failures below. */ }
  }
  if (!logoUrl || !coverUrl) {
    steps.video = { status: 'waiting', detail: 'Upload the cause logo and the supporters photo to render the video.' }
  } else if (savedVideoUrl) {
    steps.video = { status: 'generated',
      detail: missingPhotos.length
        ? `${savedVideoUrl} Add the ${missingPhotos.map((prompt) => prompt.label.toLowerCase()).join(', ')} photo${missingPhotos.length > 1 ? 's' : ''} and the video re-renders with those beats filled in.`
        : savedVideoUrl }
  } else if (!renderUrl || !renderToken) {
    steps.video = { status: 'not_configured', detail: 'Set CAUSE_VIDEO_RENDER_URL and CAUSE_VIDEO_RENDER_TOKEN to connect the renderer.' }
  } else {
    try {
      const response = await fetch(`${renderUrl.replace(/\/$/, '')}/render`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${renderToken}` },
        body: JSON.stringify({ accountId: cause.id, causeName: cause.name,
          kind: /school|pta|booster/i.test(cause.category || '') ? 'school' : 'cause',
          locality: [cause.city, cause.state].filter(Boolean).join(', '),
          logoUrl, coverPhotoUrl: coverUrl,
          // Named slots for the renderer's four image beats. `coverPhotoUrl`
          // stays for compatibility; `photos.crowd` is the same image.
          photos: Object.fromEntries(PHOTO_SLOTS.filter((slot) => photoUrls[slot]).map((slot) => [slot, photoUrls[slot]])),
          joinUrl: videoJoinUrl,
        }),
        signal: AbortSignal.timeout(240000),
      })
      const rendered = await response.json() as { src?: string; poster?: string; error?: string }
      if (!response.ok || !rendered.src || !rendered.poster) throw new Error(rendered.error || 'Video render failed.')
      const record = await request<LandingRecord>(landingPath)
      const draft = record?.draft as Record<string, unknown> | null
      if (!draft?.slug) throw new Error('Landing draft is missing; video could not be attached.')
      await request(landingPath, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: draft.slug, config: { ...draft, video: { src: rendered.src, poster: rendered.poster }, videoSource: videoVersion } }),
      })
      // The render landed in the DRAFT. An already-live page keeps serving its
      // published revision until the cause publishes again, so say so instead
      // of reporting a video the public cannot see.
      steps.video = { status: 'generated',
        detail: isLandingLive(record?.status) ? `${rendered.src} ${STALE_LIVE_NOTE}` : rendered.src }
    } catch (error) {
      steps.video = { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
    }
  }
  return { causeId: cause.id, steps }
}

const launchQueue = new Map<number, Promise<unknown>>()

export async function generateCauseLaunchMaterials(cause: LaunchCause, request: typeof qaJson = qaJson) {
  const previous = launchQueue.get(cause.id)
  const run = (previous ? previous.catch(() => undefined) : Promise.resolve())
    .then(() => generateCauseLaunchMaterialsInner(cause, request))
  launchQueue.set(cause.id, run)
  try { return await run } finally { if (launchQueue.get(cause.id) === run) launchQueue.delete(cause.id) }
}
