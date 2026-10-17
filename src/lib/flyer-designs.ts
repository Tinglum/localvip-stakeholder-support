// Client-safe description of the approved flyer artwork. The renderer
// (src/lib/server/cause-campaign-flyers.ts) re-exports these, and the
// generator and materials library use them to link library templates to the
// designs the generator can render.

export type FlyerAudience = 'business' | 'families' | 'schools' | 'boosters'
export const FLYER_AUDIENCES: FlyerAudience[] = ['business', 'families', 'schools', 'boosters']
export const FLYER_DESIGNS = ['community', 'growth', 'comparison'] as const
export type FlyerDesign = (typeof FLYER_DESIGNS)[number]
export const FLYER_DESIGN_LABELS: Record<FlyerDesign, string> = { community: 'Community Win', growth: 'Growth', comparison: 'Comparison' }

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
