import { createDetachedQaRequester, fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'
import { FLYER_DESIGNS, flyerKind, renderCauseCampaignFlyer, type FlyerAudience } from './cause-campaign-flyers'
import { CAUSE_PHOTO_PROMPTS, type CausePhotoSlot } from '@/lib/cause-setup'
import {
  CAUSE_VIDEO_CUTS, causeVideoJobState, causeVideoVersion, requestCauseVideoRender,
  type CauseVideoCut, type CauseVideoProps,
} from './cause-video-render'

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

/**
 * The same requester, bound to a token captured now so it still works after the
 * response has been sent. The video renders run in the background and outlive
 * the request that started them.
 */
async function detachedQaJson(): Promise<typeof qaJson> {
  const fetcher = await createDetachedQaRequester()
  return async <T>(path: string, init?: RequestInit, message = 'Launch materials request failed.') =>
    parseQaResponse<T>(await fetcher(path, init), message)
}

type VideoAsset = { src?: string; poster?: string }
type VideoFields = {
  video?: VideoAsset; videoSource?: string
  shortVideo?: VideoAsset; shortVideoSource?: string
}

/**
 * `video` used to hold the 15-second cut, because it was the only cut. It now
 * holds the 60-second film, which is what the public cause page plays.
 *
 * So before rendering anything, move an existing 15s out of `video` and into
 * `shortVideo` rather than letting the 60s overwrite it. A legacy 15s is
 * recognisable by its `qr-v3|` fingerprint (the 60s writes `giveback60-v1|`);
 * a `video` with no fingerprint at all also predates the 60s, since the 60s
 * always writes one.
 */
async function migrateLegacyShortVideo(landingPath: string, record: LandingRecord | null, request: typeof qaJson): Promise<VideoFields> {
  const draft = record?.draft as (Record<string, unknown> & VideoFields) | null
  if (!draft?.slug) return {}
  const source = typeof draft.videoSource === 'string' ? draft.videoSource : ''
  const isLegacy = !!draft.video?.src && !draft.shortVideo?.src && (!source || source.startsWith('qr-v3|'))
  if (!isLegacy) return draft
  const { video: _video, videoSource: _videoSource, ...rest } = draft
  const migrated: VideoFields = { shortVideo: draft.video, shortVideoSource: source }
  await request(landingPath, {
    method: 'PUT', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ slug: draft.slug, config: { ...rest, ...migrated } }),
  })
  return { ...rest, ...migrated } as VideoFields
}

export async function getCauseLaunchStatus(causeId: number, request: typeof qaJson = qaJson) {
  const [landing, generated] = await Promise.all([
    request<LandingRecord>(`/api/dashboard/v1/Nonprofit/${causeId}/landing-page`),
    request<GeneratedList>(`/api/dashboard/v1/GeneratedMaterial?causeAccountId=${causeId}&pageSize=100`),
  ])
  const flyerCount = generated?.items?.filter(item => item.generatedFileUrl && item.generationStatus !== 'failed').length || 0
  const variantCount = new Set(generated?.items?.filter(item => item.generatedFileUrl && item.generationStatus !== 'failed')
    .map(item => materialMetadata(item.metadata))
    .filter(metadata => metadata?.generator === 'cause-campaign-v1' && String(metadata.version || '').startsWith('campaign-template-v7|'))
    .map(metadata => `${metadata?.audience}:${metadata?.design}`)).size
  const draft = landing?.draft as (VideoFields & { slug?: string; assets?: DraftAssets }) | null
  const published = landing?.published as VideoFields | null
  // `video` is the 60-second film, which is the cut the public page plays.
  const videoUrl = draft?.video?.src || null
  const shortVideoUrl = draft?.shortVideo?.src || null
  const missingPhotos = PHOTO_SLOTS.filter((slot) => !draft?.assets?.[slot]?.src)
  const hasImages = !!draft?.assets?.mark?.src && !!draft?.assets?.crowd?.src
  const configured = !!process.env.CAUSE_VIDEO_RENDER_URL && !!process.env.CAUSE_VIDEO_RENDER_TOKEN
  /**
   * One cut's headline state. A render in flight (or a render that failed) is
   * reported as such instead of as "ready", so the operator is never told a
   * video exists before it does.
   */
  const cutState = (cut: CauseVideoCut, url: string | null) => {
    const job = causeVideoJobState(causeId, cut)
    if (url && job?.status !== 'rendering') return 'generated'
    if (job) return job.status === 'failed' ? 'failed' : 'rendering'
    if (!hasImages) return 'waiting for images'
    if (!configured) return 'renderer not configured'
    return 'ready to render'
  }
  // The 60-second film waits for all four photos (see the render gate below), so
  // say that rather than the vaguer "ready to render".
  const featureState = cutState('feature', videoUrl) === 'ready to render' && missingPhotos.length && !isLandingLive(landing?.status)
    ? 'waiting for photos'
    : cutState('feature', videoUrl)
  return {
    missingPhotos,
    /** True when the live page is serving an older revision than the draft. */
    landingNeedsRepublish: landing?.status === 'published_with_changes'
      || (isLandingLive(landing?.status) && !!videoUrl && published?.video?.src !== videoUrl),
    flyers: variantCount === 12 ? 'generated' : variantCount > 0 ? 'partial' : 'waiting for assets',
    flyerCount: variantCount,
    totalMaterialCount: flyerCount,
    landingPages: landing?.status || 'not_started',
    landingSlug: draft?.slug || null,
    /** The 60-second film: the headline `video` state, since it is the one on the page. */
    video: featureState,
    videoUrl,
    shortVideo: cutState('short', shortVideoUrl),
    shortVideoUrl,
  }
}

async function generateCauseLaunchMaterialsInner(cause: LaunchCause, request: typeof qaJson, onlyFlyers = false) {
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
    const publishedSlug = (record?.published as { slug?: string } | null)?.slug
    const draftSlug = (record?.draft as { slug?: string } | null)?.slug
    campaignSlug = String((isLandingLive(record?.status) && publishedSlug) || draftSlug || campaignSlug)
    const draftAssets = (record?.draft as { assets?: DraftAssets } | null)?.assets
    flyerColors = (record?.draft as { colors?: { navy?: string; gold?: string } } | null)?.colors
    flyerMission = String((record?.draft as { mission?: string } | null)?.mission || cause.headline || '')
    parentOrganization = String((record?.draft as { parentOrganization?: string } | null)?.parentOrganization || '')
    logoUrl ||= draftAssets?.mark?.src || ''
    for (const slot of PHOTO_SLOTS) photoUrls[slot] ||= draftAssets?.[slot]?.src || ''
    if (!onlyFlyers && (record?.draft || record?.published)) {
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
    } else if (!onlyFlyers) {
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
      const audiences: FlyerAudience[] = ['business', 'families', 'schools', 'boosters']
      const flyerErrors: string[] = []
      let customGenerated = 0
      const existing = await request<GeneratedList>(`/api/dashboard/v1/GeneratedMaterial?causeAccountId=${cause.id}&pageSize=100`)
      if (logoUrl && coverUrl) {
        const version = `campaign-template-v7|${cause.name}|${cause.city || ''}|${cause.state || ''}|${campaignSlug}|${logoUrl}|${coverUrl}|${cause.referralCode}|${cause.category || ''}|${flyerMission}|${parentOrganization}|${flyerColors?.navy || ''}|${flyerColors?.gold || ''}`
        for (const audience of audiences) {
          for (const design of FLYER_DESIGNS) {
          const alreadySaved = existing?.items?.some(item => {
            const metadata = materialMetadata(item.metadata)
            return item.generatedFileUrl && metadata?.generator === 'cause-campaign-v1' && metadata?.audience === audience && metadata?.design === design && metadata?.version === version
          })
          if (alreadySaved) { customGenerated += 1; continue }
          try {
            const joinUrl = `${process.env.NEXT_PUBLIC_WEBAPP_URL || 'https://my.localvip.com'}/go/campaign/${encodeURIComponent(campaignSlug)}/${audience}?ref=${encodeURIComponent(cause.referralCode)}`
            const bytes = await renderCauseCampaignFlyer({ name: cause.name,
              locality: [cause.city, cause.state].filter(Boolean).join(', ') || 'Your community',
              logoUrl, coverUrl, joinUrl, audience, design, category: cause.category, mission: flyerMission, parentOrganization, colors: flyerColors })
            const filename = `${slugify(cause.name) || 'cause'}-${audience}-${design}-flyer.pdf`
            const form = new FormData()
            form.append('file', new File([new Uint8Array(bytes)], filename, { type: 'application/pdf' }))
            const uploaded = await request<{ fileUrl: string }>(
              '/api/dashboard/v1/MaterialAsset/upload?folder=cause-launch', { method: 'POST', body: form },
              `Could not upload ${audience} ${design} flyer.`)
            if (!uploaded?.fileUrl) throw new Error('The asset upload did not return a file URL.')
            await request('/api/dashboard/v1/GeneratedMaterial', {
              method: 'POST', headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ causeAccountId: cause.id, generatedFileUrl: uploaded.fileUrl,
                generatedFileName: filename, libraryFolder: 'Cause launch', tags: `${flyerKind(cause.category, cause.name)},cause,${audience},${design}`,
                metadata: { generator: 'cause-campaign-v1', audience, design, version, joinUrl } }),
            }, `Could not save ${audience} ${design} flyer.`)
            customGenerated += 1
          } catch (error) {
            flyerErrors.push(`${audience}/${design}: ${error instanceof Error ? error.message : String(error)}`)
          }
          }
        }
      }
      steps.flyers = {
        status: flyerErrors.length ? (customGenerated ? 'partial' : 'failed') : customGenerated === 12 ? 'generated' : 'waiting',
        detail: `${customGenerated}/12 flyers.${!logoUrl || !coverUrl ? ' A logo and supporters photo are required.' : ''}${flyerErrors.length ? ` ${flyerErrors.join(' ')}` : ''}`,
      }
    }
  } catch (error) {
    steps.flyers = { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
  }

  if (onlyFlyers) return { causeId: cause.id, steps }

  const videoJoinUrl = cause.referralCode
    ? `${process.env.NEXT_PUBLIC_WEBAPP_URL || 'https://my.localvip.com'}/go/campaign/${encodeURIComponent(campaignSlug)}/families?ref=${encodeURIComponent(cause.referralCode)}`
    : ''
  const videoProps: CauseVideoProps = {
    accountId: cause.id, causeName: cause.name,
    kind: /school|pta|booster/i.test(cause.category || '') ? 'school' : 'cause',
    locality: [cause.city, cause.state].filter(Boolean).join(', '),
    logoUrl, coverPhotoUrl: coverUrl,
    // Named slots for the renderer's image beats. `coverPhotoUrl` stays for
    // compatibility; `photos.crowd` is the same image.
    photos: Object.fromEntries(PHOTO_SLOTS.filter((slot) => photoUrls[slot]).map((slot) => [slot, photoUrls[slot]])),
    joinUrl: videoJoinUrl,
  }
  // Every photo is in the version key: when a cause adds the three newer
  // photos later, the video re-renders with its remaining beats filled in.
  const versions: Record<CauseVideoCut, string> = {
    short: causeVideoVersion('short', videoProps, PHOTO_SLOTS),
    feature: causeVideoVersion('feature', videoProps, PHOTO_SLOTS),
  }

  if (!logoUrl || !coverUrl) {
    steps.video = { status: 'waiting', detail: 'Upload the cause logo and the supporters photo to render the videos.' }
  } else {
    try {
      // Hand the background jobs a requester that does not depend on this
      // request's cookie jar still being on the stack minutes from now. A test
      // that injected its own requester keeps using it.
      const detached = request === qaJson ? await detachedQaJson() : request
      const record = await request<LandingRecord>(landingPath)
      const stored = await migrateLegacyShortVideo(landingPath, record, request)
      const live = isLandingLive(record?.status)
      // Which cuts this cause should have right now.
      //  - The 15s renders as soon as there is a logo and the supporters photo:
      //    it is cheap (~40s) and gives the operator something to forward
      //    immediately.
      //  - The 60s waits for all four photos, because it has four photo-carried
      //    plates and costs ~200s a go. Rendering it on the first photo would
      //    burn four 200-second renders as the set fills in, and publishing a
      //    cause page for the first time already requires all four photos, so
      //    the film is there by the time the page can go live. A page that is
      //    ALREADY live (grandfathered in before the four-photo gate) gets its
      //    film with whatever photos exist, rather than never getting one.
      const cuts: CauseVideoCut[] = ['short']
      if (missingPhotos.length === 0 || live) cuts.push('feature')
      const notes: string[] = []
      for (const cut of cuts) {
        const spec = CAUSE_VIDEO_CUTS[cut]
        const current = stored[spec.field]
        if (current?.src && (!stored[spec.sourceField] || stored[spec.sourceField] === versions[cut])) {
          notes.push(`${spec.label}: ${current.src}`)
          continue
        }
        const state = requestCauseVideoRender(cause.id, cut, {
          version: versions[cut], props: videoProps, request: detached, landingPath,
        })
        notes.push(`${spec.label}: ${state.detail}`)
      }
      if (!cuts.includes('feature')) {
        notes.push(`60-second film: waiting for the ${missingPhotos.map((prompt) => prompt.label.toLowerCase()).join(', ')} photo${missingPhotos.length > 1 ? 's' : ''}. It has a plate for each one, so it renders once the set is complete.`)
      }
      // Anything written above landed in the DRAFT. An already-live page keeps
      // serving its published revision until the cause publishes again, so say
      // so rather than implying the public can see the new video.
      if (live) notes.push(STALE_LIVE_NOTE)
      const states = cuts.map((cut) => causeVideoJobState(cause.id, cut))
      steps.video = {
        status: states.some((state) => state?.status === 'failed') ? 'failed'
          : states.some((state) => state?.status === 'rendering') ? 'rendering'
            // The 60s is the cut the page needs, so a cause that does not have
            // one yet is not finished, however good the 15s is.
            : cuts.includes('feature') ? 'generated' : 'waiting',
        detail: notes.join(' '),
      }
    } catch (error) {
      steps.video = { status: 'failed', detail: error instanceof Error ? error.message : String(error) }
    }
  }
  return { causeId: cause.id, steps }
}

const launchQueue = new Map<number, Promise<unknown>>()

export async function generateCauseLaunchMaterials(cause: LaunchCause, request: typeof qaJson = qaJson, onlyFlyers = false) {
  const previous = launchQueue.get(cause.id)
  const run = (previous ? previous.catch(() => undefined) : Promise.resolve())
    .then(() => generateCauseLaunchMaterialsInner(cause, request, onlyFlyers))
  launchQueue.set(cause.id, run)
  try { return await run } finally { if (launchQueue.get(cause.id) === run) launchQueue.delete(cause.id) }
}
