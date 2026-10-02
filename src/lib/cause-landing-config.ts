import { CAUSE_PHOTO_PROMPTS } from '@/lib/cause-setup'
import type { Cause } from '@/lib/types/database'

/**
 * The cause landing-page config, shared by the landing-page editor and cause
 * setup. Its `colors` are also the cause's brand palette: the backend fills
 * {{brand_*}} slots in material designs from them (BrandTokens.cs), so what a
 * cause picks here is what its flyers and its landing page use.
 */
export type ImageAsset = { src: string; alt: string }
export type LandingColors = { navy: string; navyDeep: string; royal: string; silver: string; silverLight: string; gold: string }
export type LandingDesign = 'stadium' | 'editorial' | 'flyer' | 'v4' | 'cc3' | 'classic'
export type LandingConfig = {
  slug: string
  revision: string
  schoolName: string
  organizationName: string
  mission?: string
  parentOrganization?: string
  causeAccountId: number
  locality: string
  routeBase: string
  /** Visual style shared by every published audience page. */
  design?: LandingDesign
  colors: LandingColors
  assets: { mark: ImageAsset; crowd: ImageAsset; team?: ImageAsset; community?: ImageAsset; people?: ImageAsset }
  /**
   * The 60-second giveback film. Written by the launch-materials renderer, not
   * edited by hand. This is the field the webapp maps onto `Campaign.video`, so
   * this is the cut the public cause page plays.
   */
  video?: { src: string; poster: string }
  /** The asset fingerprint the current `video` was rendered from. */
  videoSource?: string
  /**
   * The 15-second cut. It used to live in `video` (and still does on causes
   * rendered before the 60-second film existed — the renderer migrates those
   * forward on its next run). It is not on the public page any more: it is the
   * short, forwardable asset an operator sends to a business owner, so it keeps
   * its own field and its own fingerprint rather than competing for `video`.
   */
  shortVideo?: { src: string; poster: string }
  /** The asset fingerprint the current `shortVideo` was rendered from. */
  shortVideoSource?: string
  scheduleCallUrl: string
  disclaimer: string
  assetsArePlaceholder: boolean
  /** Set once the cause has chosen (or accepted logo-derived) brand colours. */
  brandColorsConfirmed?: boolean
}

export type LandingRecord = {
  landingPageSlug?: string | null
  status: string
  draft?: LandingConfig | null
  published?: LandingConfig | null
  revision: number
  landingPageUpdatedDate?: string | null
  landingPagePublishedDate?: string | null
}

export const DEFAULT_LANDING_PALETTE: LandingColors = {
  navy: '#071A3D', navyDeep: '#031126', royal: '#153E78',
  silver: '#C8CBD1', silverLight: '#EEF0F3', gold: '#D0A323',
}

export function slugify(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
}

export function qaCauseId(cause: Cause) {
  const metadata = cause.metadata || {}
  const candidates = [cause.external_id, metadata.qaAccountId, metadata.qaCauseId]
  for (const value of candidates) if (/^\d+$/.test(String(value || ''))) return Number(value)
  return null
}

export function defaultLandingConfig(cause: Cause, id: number): LandingConfig {
  const slug = slugify(cause.name) || `cause-${id}`
  return {
    slug,
    revision: 'draft',
    schoolName: cause.name,
    organizationName: cause.name,
    mission: String(cause.metadata?.headline || ''),
    causeAccountId: id,
    locality: cause.address || 'your community',
    routeBase: `/landing/${slug}`,
    design: 'stadium',
    colors: DEFAULT_LANDING_PALETTE,
    assets: {
      mark: { src: cause.logo_url || '', alt: `${cause.name} logo` },
      crowd: { src: cause.cover_photo_url || '', alt: `${cause.name} community` },
    },
    scheduleCallUrl: 'https://calendly.com/ktinglum/localvip-internship',
    disclaimer: '',
    assetsArePlaceholder: false,
  }
}

/**
 * Photo slots the page has not filled yet, as sentences. Always worth showing;
 * only sometimes worth blocking on — see `landingPublishBlockers`.
 */
export function landingPhotoWarnings(config: LandingConfig) {
  return CAUSE_PHOTO_PROMPTS
    .filter((prompt) => !config.assets[prompt.slot]?.src)
    .map((prompt) => `Upload the "${prompt.label}" photo.`)
}

/** True once a revision of this page has been made public. */
export function hasEverBeenPublished(record: LandingRecord | null) {
  return !!record?.published || record?.status === 'published' || record?.status === 'published_with_changes'
}

/**
 * Everything that must be filled in before a landing page may be published.
 *
 * This is the dashboard-side publish gate, used by the landing-page editor to
 * disable Publish. The backend has the final say — `/landing-page/publish`
 * answers 409 with its own `blockers` list, which the editor surfaces — but
 * this list is what stops a half-finished page from being sent in the first
 * place.
 *
 * The four photos are deliberately a FIRST-publication rule only. A new page is
 * about to become a printed flyer, a shared link and a rendered video, and
 * holding it back until it is properly illustrated costs nobody anything. But a
 * cause that went live months ago on one photo must stay able to fix a typo in
 * its mission, correct its name or update its disclaimer: blocking that would
 * trap a wrong page in public and would punish exactly the person trying to put
 * it right. For an already-published page the missing photos are a warning
 * (`landingPhotoWarnings`), shown prominently and persistently, never a block.
 */
export function landingPublishBlockers(config: LandingConfig, record: LandingRecord | null = null) {
  const items: string[] = []
  if (!config.schoolName.trim()) items.push('Add the school or community name.')
  if (!config.organizationName.trim()) items.push('Add the organization name.')
  if (!config.locality.trim()) items.push('Add the city or community.')
  if (!config.assets.mark.src) items.push('Upload a logo.')
  if (!hasEverBeenPublished(record)) items.push(...landingPhotoWarnings(config))
  return items
}

/**
 * True when the page is live but the draft has moved on, so the public is still
 * being served the older revision. This happens without anyone editing: the
 * launch-materials job writes the rendered video and newly uploaded photos into
 * the DRAFT, and only Publish copies the draft over the published revision.
 *
 * We do not republish automatically. Publish is a review gate (the backend
 * refuses it while blockers remain, and the relationship disclaimer is part of
 * what goes public), and draft/published are whole JSON blobs, so republishing
 * to ship a video would also ship every other unreviewed draft edit. Instead
 * this is surfaced loudly and the cause presses Publish once.
 */
export function isLandingOutOfDate(record: LandingRecord | null) {
  return record?.status === 'published_with_changes'
}

/** True when the landing page is live (fully or with unpublished edits). */
export function isLandingPublished(record: LandingRecord | null) {
  return record?.status === 'published' || record?.status === 'published_with_changes'
}
