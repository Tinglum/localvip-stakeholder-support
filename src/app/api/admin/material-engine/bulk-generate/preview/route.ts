import { NextRequest, NextResponse } from 'next/server'
import { getAdminRouteContext } from '@/lib/server/admin-access'
import {
  fetchBulkTemplate,
  isBoomerangRun,
  previewTarget,
  resolveBulkAudience,
  type BulkAudience,
  type BulkGenerationFilters,
  type BulkQrPurpose,
} from '@/lib/server/bulk-material-generation'

export const dynamic = 'force-dynamic'

/**
 * Resolve the audience for a bulk generation run. Reads only — nothing is
 * generated here.
 *
 * The operator must see the count AND the actual accounts, with the ones that
 * will be skipped already marked and explained, before a single material is
 * written. That is the whole point of splitting preview from run.
 */
export async function POST(request: NextRequest) {
  const context = await getAdminRouteContext()
  if ('error' in context) return context.error

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 })
  }

  const audiences = Array.isArray(body.audiences)
    ? (body.audiences.filter((a) => a === 'businesses' || a === 'causes') as BulkAudience[])
    : []
  if (!audiences.length) {
    return NextResponse.json({ error: 'Choose businesses, causes, or both.' }, { status: 400 })
  }

  const filters: BulkGenerationFilters = {
    audiences,
    cityKeys: asStringArray(body.cityKeys),
    campaignIds: asStringArray(body.campaignIds),
    categoryIds: asStringArray(body.categoryIds).map(Number).filter((n) => Number.isFinite(n)),
    stages: asStringArray(body.stages),
    statuses: asStringArray(body.statuses),
    includeInactive: body.includeInactive === true,
    search: typeof body.search === 'string' ? body.search : undefined,
  }

  const templateId = body.templateId == null ? '' : String(body.templateId).trim()
  const qrPurpose = readQrPurpose(body.qrPurpose)
  const requireLogo = body.requireLogo === true

  try {
    const template = templateId ? await fetchBulkTemplate(templateId) : null
    if (templateId && !template) {
      return NextResponse.json({ error: 'That template could not be found.' }, { status: 404 })
    }

    const boomerangRun = isBoomerangRun(qrPurpose, template)
    const { targets, facets, totalConsidered } = await resolveBulkAudience(filters)
    const previewed = targets.map((target) => previewTarget(target, { boomerangRun, requireLogo }))

    const willGenerate = previewed.filter((t) => t.disposition === 'will_generate')

    return NextResponse.json({
      template: template ? { id: template.id, name: template.name, isActive: template.is_active } : null,
      boomerangRun,
      qrPurpose,
      totalConsidered,
      matched: previewed.length,
      willGenerate: willGenerate.length,
      willSkip: previewed.length - willGenerate.length,
      targets: previewed,
      facets,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not resolve the audience.' },
      { status: 400 },
    )
  }
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((item) => String(item).trim()).filter(Boolean)
}

function readQrPurpose(value: unknown): BulkQrPurpose {
  if (value === 'business_capture' || value === 'business_network_referral' || value === 'owner_default') {
    return value
  }
  // Default to the LocalVIP referral code: it applies to every account and can
  // never leak a Boomerang surface to a business that did not ask for one.
  return 'business_network_referral'
}
