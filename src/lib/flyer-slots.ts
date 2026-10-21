/**
 * Editable slots on a generated cause flyer. Shared by the renderer, the flyer
 * API and the generator UI, so it must stay free of server-only imports.
 *
 * Each text slot is one printed line of an approved layout. Editing line by
 * line keeps the artwork's line breaks and rhythm intact; the renderer shrinks
 * a line that runs long rather than letting it spill out of its block.
 */
export type FlyerTextSlot = {
  id: string
  /** The block the line belongs to, e.g. "Headline" or "Step 2 description". */
  group: string
  /** 1-based line number within its block. */
  line: number
  default: string
  maxLength: number
  /** Common values offered as one-click choices (the editor still accepts any text). */
  suggestions?: string[]
}
export type FlyerImageSlotId = 'logo' | 'photo'
export type FlyerImageSlot = { id: FlyerImageSlotId; label: string; default: string }
export type FlyerSlots = { text: FlyerTextSlot[]; images: FlyerImageSlot[] }
export type FlyerOverrides = { text?: Record<string, string>; images?: Partial<Record<FlyerImageSlotId, string>> }

/** A replacement image as the renderer prints it, plus its box in the benefit circle for a logo. */
export type PreparedFlyerImage = { href: string; flowLogo?: { width: number; height: number } }

export const FLYER_IMAGE_SLOT_LABELS: Record<FlyerImageSlotId, string> = { logo: 'Cause logo', photo: 'Cover photo' }

/** The key a cause's saved edits live under: one set per design and audience. */
export const flyerEditKey = (design: string, audience: string) => `${design}:${audience}`

/**
 * What the flyers call the organization ("our school", "our club", …). It is
 * one word used across every line, so it is kept once for the whole cause,
 * under FLYER_SHARED_EDITS_KEY, instead of once per design and audience.
 */
export const FLYER_ORG_WORD_SLOT = 'org.word'
export const FLYER_ORG_WORDS = ['school', 'club', 'team', 'nonprofit', 'cause', 'church', 'PTA', 'group']
const FLYER_SHARED_EDITS_KEY = 'all'
const SHARED_TEXT_SLOTS = [FLYER_ORG_WORD_SLOT]

/** A design's saved edits with the cause-wide ones (the organization word) merged in. */
export function flyerEditsFor(all: Record<string, FlyerOverrides> | undefined, design: string, audience: string): FlyerOverrides {
  const own = all?.[flyerEditKey(design, audience)]
  return compactFlyerOverrides({ ...own, text: { ...all?.[FLYER_SHARED_EDITS_KEY]?.text, ...own?.text } })
}

/** Stores one design's edits, moving the cause-wide slots to the shared entry. */
export function storeFlyerEdits(all: Record<string, FlyerOverrides> | undefined, design: string, audience: string, overrides: FlyerOverrides) {
  const key = flyerEditKey(design, audience)
  const shared = Object.entries(overrides.text || {}).filter(([id]) => SHARED_TEXT_SLOTS.includes(id))
  const own = compactFlyerOverrides({ ...overrides, text: Object.fromEntries(Object.entries(overrides.text || {}).filter(([id]) => !SHARED_TEXT_SLOTS.includes(id))) })
  const { [key]: _replaced, [FLYER_SHARED_EDITS_KEY]: oldShared, ...others } = all || {}
  const sharedText = Object.fromEntries([
    ...Object.entries(oldShared?.text || {}).filter(([id]) => !SHARED_TEXT_SLOTS.includes(id)),
    ...shared,
  ])
  return {
    ...others,
    ...(Object.keys(own).length ? { [key]: own } : {}),
    ...(Object.keys(sharedText).length ? { [FLYER_SHARED_EDITS_KEY]: { text: sharedText } } : {}),
  }
}

/** Drops empty override maps so "no edits" is stored and compared as `{}`. */
export function compactFlyerOverrides(overrides: FlyerOverrides | undefined): FlyerOverrides {
  const text = Object.entries(overrides?.text || {})
  const images = Object.entries(overrides?.images || {}).filter(([, value]) => value)
  return {
    ...(text.length ? { text: Object.fromEntries(text) } : {}),
    ...(images.length ? { images: Object.fromEntries(images) } : {}),
  }
}
