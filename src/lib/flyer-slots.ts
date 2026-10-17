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

/** Drops empty override maps so "no edits" is stored and compared as `{}`. */
export function compactFlyerOverrides(overrides: FlyerOverrides | undefined): FlyerOverrides {
  const text = Object.entries(overrides?.text || {})
  const images = Object.entries(overrides?.images || {}).filter(([, value]) => value)
  return {
    ...(text.length ? { text: Object.fromEntries(text) } : {}),
    ...(images.length ? { images: Object.fromEntries(images) } : {}),
  }
}
