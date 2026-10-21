// Client-safe description of the approved flyer artwork. The renderer
// (src/lib/server/cause-campaign-flyers.ts) re-exports these, and the
// generator and materials library use them to link library templates to the
// designs the generator can render.

export type FlyerAudience = 'business' | 'families' | 'schools' | 'boosters'
export const FLYER_AUDIENCES: FlyerAudience[] = ['business', 'families', 'schools', 'boosters']
export const FLYER_DESIGNS = ['community', 'growth', 'comparison'] as const
export type FlyerDesign = (typeof FLYER_DESIGNS)[number]
export const FLYER_DESIGN_LABELS: Record<FlyerDesign, string> = { community: 'Community Win', growth: 'Growth', comparison: 'Comparison' }

// Designs the single-flyer generator offers. Beyond the approved library
// series, "giveback" is a native-Letter business flyer (GiveBack Days), built
// from the Father's Club draft and filled from each cause's own details. It is
// business-only and never part of the automatic twelve-flyer set.
// "giveback-v3" is its third revision (full-width hero, one type scale, a single
// QR-led call to action); both stay available.
export const GIVEBACK_DESIGN = 'giveback'
export const GIVEBACK_V3_DESIGN = 'giveback-v3'
// "giveback-v4" returns to the original draft's composition with sharper details.
export const GIVEBACK_V4_DESIGN = 'giveback-v4'
export const GIVEBACK_DESIGNS = [GIVEBACK_DESIGN, GIVEBACK_V3_DESIGN, GIVEBACK_V4_DESIGN] as const
export type GivebackDesign = (typeof GIVEBACK_DESIGNS)[number]
export const isGivebackDesign = (value: unknown): value is GivebackDesign => (GIVEBACK_DESIGNS as readonly unknown[]).includes(value)
export const GENERATOR_DESIGNS = [...FLYER_DESIGNS, ...GIVEBACK_DESIGNS] as const
export type GeneratorDesign = (typeof GENERATOR_DESIGNS)[number]
export const GENERATOR_DESIGN_LABELS: Record<GeneratorDesign, string> = { ...FLYER_DESIGN_LABELS, giveback: 'GiveBack Days v2 (business)', 'giveback-v3': 'GiveBack Days v3 (business)', 'giveback-v4': 'GiveBack Days v4 (business)' }
export const isGeneratorDesign = (value: unknown): value is GeneratorDesign => (GENERATOR_DESIGNS as readonly unknown[]).includes(value)
/** The audiences a generator design can be made for. */
export const designAudiences = (design: GeneratorDesign): FlyerAudience[] => isGivebackDesign(design) ? ['business'] : FLYER_AUDIENCES

// Library template ids of the approved artwork, in FLYER_DESIGNS order.
// Booster outreach uses the school series, personalized to the club's identity.
const SERIES: Record<FlyerAudience, readonly [number, number, number]> = {
  business: [77, 68, 69],
  families: [70, 71, 72],
  schools: [73, 74, 75],
  boosters: [73, 74, 75],
}

export function approvedFlyerTemplateId(audience: FlyerAudience, design: FlyerDesign = 'community') {
  return SERIES[audience][FLYER_DESIGNS.indexOf(design)]
}

// Each design gets a different one of the cause's four setup photos, so the
// set does not repeat one picture twelve times. Business flyers lead with the
// wider-community photo (a main street, a local shop). A missing photo falls
// back to the supporters photo, which every cause has.
const DESIGN_PHOTOS: Record<FlyerDesign, readonly string[]> = { community: ['crowd'], growth: ['people'], comparison: ['team'] }

/** The cover photo a design uses, from the cause's photos by setup slot (crowd, team, people, community). */
export function flyerPhotoFor(audience: FlyerAudience, design: FlyerDesign, photos: Partial<Record<string, string | null | undefined>>) {
  const order = audience === 'business' && design === 'community' ? ['community', 'crowd'] : [...DESIGN_PHOTOS[design], 'crowd']
  return order.map(slot => photos[slot]?.trim()).find(Boolean) || ''
}

/** The generator design for a library template id, or null if the generator cannot render it. */
export function flyerDesignForTemplate(templateId: string | number | null | undefined): { audience: FlyerAudience; design: FlyerDesign } | null {
  const id = Number(templateId)
  if (!Number.isInteger(id)) return null
  for (const audience of FLYER_AUDIENCES) {
    const index = SERIES[audience].indexOf(id)
    if (index >= 0) return { audience, design: FLYER_DESIGNS[index] }
  }
  return null
}
