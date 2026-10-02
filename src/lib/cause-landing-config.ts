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
  /** Written by the launch-materials renderer, not edited by hand. */
  video?: { src: string; poster: string }
  /** The asset fingerprint the current `video` was rendered from. */
  videoSource?: string
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
 * Everything that must be filled in before a landing page may be published.
 *
 * This is the dashboard-side publish gate, shared by the landing-page editor
 * (which disables Publish) and cause setup (which shows what is still missing).
 * The backend has the final say — `/landing-page/publish` answers 409 with its
 * own `blockers` list, which the editor surfaces — but this list is what stops
 * a half-finished page from being sent in the first place.
 *
 * All four photos are required here, on purpose: a published page becomes a
 * printed flyer, a shared link and a rendered video, and a page built from one
 * photo sells a team rather than a community.
 */
export function landingPublishBlockers(config: LandingConfig) {
  const items: string[] = []
  if (!config.schoolName.trim()) items.push('Add the school or community name.')
  if (!config.organizationName.trim()) items.push('Add the organization name.')
  if (!config.locality.trim()) items.push('Add the city or community.')
  if (!config.assets.mark.src) items.push('Upload a logo.')
  for (const prompt of CAUSE_PHOTO_PROMPTS) {
    if (!config.assets[prompt.slot]?.src) items.push(`Upload the "${prompt.label}" photo.`)
  }
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
