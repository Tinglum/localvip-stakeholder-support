/**
 * Bulk material generation — one template across a filtered set of accounts.
 *
 * Today an operator generates one material for one account from the Template
 * Library. This resolves an audience (businesses and/or causes, narrowed by
 * city, campaign, category, stage and status) and generates the chosen template
 * for every account in it.
 *
 * Three things shape the implementation, and none of them were obvious:
 *
 * 1. `generateMaterialsForStakeholder` (lib/server/material-engine) is the
 *    Supabase-era path. `stakeholders` is in EMPTY_FALLBACK_TABLES, so against
 *    the QA backend it has nothing to run on. Real generation is a POST to
 *    `/api/dashboard/v1/GeneratedMaterial` with a business or cause account id —
 *    which is what `/api/portal/generate` does and what this does too.
 *
 * 2. That POST is NOT idempotent: it always writes a new row at
 *    VersionNumber = latest + 1. Re-running a batch would therefore silently
 *    duplicate every material. Idempotency has to be enforced here, by asking
 *    what already exists for (account, template) before generating.
 *
 * 3. `ensureQaBusinessEngagementAssets` must NOT be used to prepare accounts in
 *    bulk. It unconditionally mints a `business_capture` QR — a Boomerang asset —
 *    for whatever business it is handed, including one that declined the
 *    Boomerang list. Everything here reads QR state; it never provisions it.
 */

import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { getBusinessCategoryById } from '@/lib/business-catalog'
import { isBoomerangEnabled, type BoomerangInterest } from '@/lib/engagement-codes'

export type BulkAudience = 'businesses' | 'causes'

/**
 * Which code the generated material carries.
 *
 * Named from `engagement-codes`: "referral" is LocalVIP only, "list" is
 * Boomerang only. `owner_default` leaves the choice to the backend, which falls
 * back to the account owner's LocalVIP signup link — never a Boomerang link.
 */
export type BulkQrPurpose = 'business_network_referral' | 'business_capture' | 'owner_default'

export type BulkSkipReason =
  | 'boomerang_declined'
  | 'boomerang_not_asked'
  | 'no_qr'
  | 'no_owner'
  | 'no_logo'
  | 'already_generated'

export interface BulkGenerationFilters {
  audiences: BulkAudience[]
  /** "City, ST" keys, matching how QA stores city/state as free text on the account. */
  cityKeys?: string[]
  /** Business campaign ids (`crmCampaignId`). Causes need a per-account lookup — see resolveBulkTargets. */
  campaignIds?: string[]
  /** Canonical BUSINESS_CATEGORIES ids. Businesses only; causes carry no category id. */
  categoryIds?: number[]
  stages?: string[]
  statuses?: string[]
  /** Deactivated accounts are excluded unless this is set. */
  includeInactive?: boolean
  /** Free-text name match, for narrowing a long list by hand. */
  search?: string
}

export interface BulkTarget {
  accountId: string
  accountType: 'business' | 'cause'
  name: string
  city: string | null
  state: string | null
  cityKey: string | null
  campaignId: string | null
  categoryId: number | null
  categoryLabel: string | null
  stage: string | null
  status: string | null
  active: boolean
  hasLogo: boolean
  hasOwner: boolean
  /** Businesses only. Null for a cause, which has no Boomerang list. */
  boomerangInterest: BoomerangInterest
}

export interface BulkFacets {
  cities: Array<{ value: string; label: string; count: number }>
  campaigns: Array<{ value: string; label: string; count: number }>
  categories: Array<{ value: number; label: string; count: number }>
  stages: Array<{ value: string; count: number }>
  statuses: Array<{ value: string; count: number }>
}

export type BulkResultStatus = 'generated' | 'skipped' | 'failed'

export interface BulkAccountResult {
  accountId: string
  accountType: 'business' | 'cause'
  name: string
  status: BulkResultStatus
  /** Machine-readable skip code. Null for generated/failed. */
  reasonCode: BulkSkipReason | null
  /** Always populated for skipped and failed — never a bare boolean. */
  message: string | null
  generatedMaterialId: string | null
  generatedFileUrl: string | null
}

/** Ceiling on how many accounts one run request may touch. Keeps a batch inside the request timeout. */
export const BULK_BATCH_LIMIT = 25

/** How many QA calls to keep in flight. The QA host is shared; this is deliberately modest. */
const QA_CONCURRENCY = 4

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(value)) return value as Array<Record<string, unknown>>
  if (value && typeof value === 'object') {
    const items = (value as { items?: unknown }).items
    if (Array.isArray(items)) return items as Array<Record<string, unknown>>
  }
  return []
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function idText(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return String(value)
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return value.trim()
  return null
}

export function buildCityKey(city: unknown, state: unknown): string | null {
  const c = text(city)
  if (!c) return null
  const s = text(state)
  return s ? `${c}, ${s}` : c
}

/** Run `worker` over `items` a few at a time, preserving input order in the output. */
async function mapWithConcurrency<T, R>(
  items: T[],
  worker: (item: T, index: number) => Promise<R>,
  concurrency = QA_CONCURRENCY,
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function pump(): Promise<void> {
    for (;;) {
      const index = cursor++
      if (index >= items.length) return
      results[index] = await worker(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, pump))
  return results
}

function mapBusinessRow(row: Record<string, unknown>): BulkTarget {
  const categoryId = typeof row.businessType === 'number' ? row.businessType : Number(row.businessType) || null
  const category = getBusinessCategoryById(categoryId)
  return {
    accountId: String(row.id),
    accountType: 'business',
    name: text(row.name) || `Business ${String(row.id)}`,
    city: text(row.city),
    state: text(row.state),
    cityKey: buildCityKey(row.city, row.state),
    campaignId: idText(row.crmCampaignId),
    categoryId: category?.id ?? null,
    categoryLabel: category?.label ?? text(row.category),
    stage: text(row.crmStage),
    status: text(row.crmStatus),
    active: row.active !== false,
    hasLogo: !!text(row.imageUrl),
    hasOwner: idText(row.ownerUserId) != null,
    boomerangInterest: (text(row.hundredListInterest) as BoomerangInterest) ?? null,
  }
}

function mapCauseRow(row: Record<string, unknown>): BulkTarget {
  return {
    accountId: String(row.id),
    accountType: 'cause',
    name: text(row.name) || `Cause ${String(row.id)}`,
    city: text(row.city),
    state: text(row.state),
    cityKey: buildCityKey(row.city, row.state),
    // The Nonprofit LIST projection omits CrmCampaignId (the detail has it).
    // Filled in by a detail lookup only when a campaign filter is actually used.
    campaignId: null,
    categoryId: null,
    categoryLabel: text(row.category),
    stage: text(row.crmStage),
    status: text(row.crmStatus),
    active: row.active !== false,
    // The list projection carries no ImageUrl for a cause.
    hasLogo: !!text(row.imageUrl),
    hasOwner: idText(row.ownerUserId) != null,
    boomerangInterest: null,
  }
}

async function fetchBusinessTargets(): Promise<BulkTarget[]> {
  const res = await fetchQaApi('/api/dashboard/v1/Business')
  const json = await parseQaResponse<unknown>(res, 'Could not load the business list.')
  return asRecordArray(json).map(mapBusinessRow)
}

async function fetchCauseTargets(): Promise<BulkTarget[]> {
  const res = await fetchQaApi('/api/dashboard/v1/Nonprofit')
  const json = await parseQaResponse<unknown>(res, 'Could not load the cause list.')
  return asRecordArray(json).map(mapCauseRow)
}

/**
 * Fill in `campaignId` for causes, which the list projection does not return.
 *
 * One detail request per cause, so it only runs when the operator actually
 * filters by campaign. Adding CrmCampaignId to the Nonprofit list projection
 * would remove this entirely — see the backend contract note in the PR.
 */
async function hydrateCauseCampaigns(causes: BulkTarget[]): Promise<void> {
  await mapWithConcurrency(causes, async (cause) => {
    try {
      const res = await fetchQaApi(`/api/dashboard/v1/Nonprofit/${encodeURIComponent(cause.accountId)}`)
      const detail = await parseQaResponse<Record<string, unknown>>(res, 'Could not load the cause.')
      cause.campaignId = idText(detail?.crmCampaignId)
    } catch {
      // A cause whose detail cannot be read simply has no campaign to match on.
      // It drops out of a campaign-filtered audience rather than failing the run.
      cause.campaignId = null
    }
  })
}

function countBy<T>(rows: BulkTarget[], pick: (row: BulkTarget) => T | null) {
  const counts = new Map<T, number>()
  for (const row of rows) {
    const value = pick(row)
    if (value === null || value === undefined || value === '') continue
    counts.set(value, (counts.get(value) || 0) + 1)
  }
  return counts
}

export function buildFacets(rows: BulkTarget[], campaignNames: Map<string, string>): BulkFacets {
  const cities = countBy(rows, (r) => r.cityKey)
  const campaigns = countBy(rows, (r) => r.campaignId)
  const categories = countBy(rows, (r) => r.categoryId)
  const stages = countBy(rows, (r) => r.stage)
  const statuses = countBy(rows, (r) => r.status)

  return {
    cities: [...cities.entries()]
      .map(([value, count]) => ({ value, label: value, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    campaigns: [...campaigns.entries()]
      .map(([value, count]) => ({ value, label: campaignNames.get(value) || `Campaign ${value}`, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    categories: [...categories.entries()]
      .map(([value, count]) => ({ value, label: getBusinessCategoryById(value)?.label || `Category ${value}`, count }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    stages: [...stages.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value)),
    statuses: [...statuses.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => a.value.localeCompare(b.value)),
  }
}

export async function fetchCampaignNames(): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  try {
    // The Campaign list is paged and defaults to 50; ask for enough to name every id.
    const res = await fetchQaApi('/api/dashboard/v1/Campaign?pageSize=500')
    const json = await parseQaResponse<unknown>(res, 'Could not load campaigns.')
    for (const row of asRecordArray(json)) {
      const id = idText(row.id)
      if (id) names.set(id, text(row.name) || `Campaign ${id}`)
    }
  } catch {
    // Campaign names are cosmetic — the ids still filter correctly without them.
  }
  return names
}

function matchesFilters(row: BulkTarget, filters: BulkGenerationFilters): boolean {
  if (!filters.includeInactive && !row.active) return false
  if (filters.cityKeys?.length && !(row.cityKey && filters.cityKeys.includes(row.cityKey))) return false
  if (filters.campaignIds?.length && !(row.campaignId && filters.campaignIds.includes(row.campaignId))) return false
  if (filters.categoryIds?.length && !(row.categoryId != null && filters.categoryIds.includes(row.categoryId))) return false
  if (filters.stages?.length && !(row.stage && filters.stages.includes(row.stage))) return false
  if (filters.statuses?.length && !(row.status && filters.statuses.includes(row.status))) return false
  if (filters.search?.trim()) {
    const needle = filters.search.trim().toLowerCase()
    if (!row.name.toLowerCase().includes(needle)) return false
  }
  return true
}

export interface ResolvedBulkAudience {
  /** Every account that matched, before eligibility is judged. */
  targets: BulkTarget[]
  /** Facets built from the UNFILTERED population, so the operator can widen as well as narrow. */
  facets: BulkFacets
  /** Total accounts considered across the chosen audiences. */
  totalConsidered: number
}

export async function resolveBulkAudience(
  filters: BulkGenerationFilters,
): Promise<ResolvedBulkAudience> {
  const wantBusinesses = filters.audiences.includes('businesses')
  const wantCauses = filters.audiences.includes('causes')

  const [businesses, causes, campaignNames] = await Promise.all([
    wantBusinesses ? fetchBusinessTargets() : Promise.resolve([]),
    wantCauses ? fetchCauseTargets() : Promise.resolve([]),
    fetchCampaignNames(),
  ])

  // Causes only get their campaign resolved when the operator is filtering on
  // one — otherwise this would be an extra request per cause on every preview.
  if (wantCauses && filters.campaignIds?.length) {
    await hydrateCauseCampaigns(causes)
  }

  const population = [...businesses, ...causes]
  const targets = population
    .filter((row) => matchesFilters(row, filters))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    targets,
    facets: buildFacets(population, campaignNames),
    totalConsidered: population.length,
  }
}

export interface BulkTemplateSummary {
  id: string
  name: string
  audience_tags: string[]
  library_folder: string | null
  output_format: string | null
  is_active: boolean
  metadata: Record<string, unknown> | null
}

/**
 * Load one template by id.
 *
 * MaterialTemplate has no GET-by-id on the backend, so this reads the list and
 * picks the row. `audienceTags` arrives as a CSV string and `metadata` as a JSON
 * string; both are normalised here so the Boomerang check can read them.
 */
export async function fetchBulkTemplate(templateId: string): Promise<BulkTemplateSummary | null> {
  const res = await fetchQaApi('/api/dashboard/v1/MaterialTemplate?pageSize=500')
  const json = await parseQaResponse<unknown>(res, 'Could not load material templates.')
  const row = asRecordArray(json).find((item) => String(item.id) === String(templateId))
  if (!row) return null

  let metadata: Record<string, unknown> | null = null
  if (row.metadata && typeof row.metadata === 'object') {
    metadata = row.metadata as Record<string, unknown>
  } else if (typeof row.metadata === 'string' && row.metadata.trim()) {
    try {
      const parsed = JSON.parse(row.metadata)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>
    } catch {
      metadata = null
    }
  }

  const rawTags = row.audienceTags
  const audience_tags = Array.isArray(rawTags)
    ? rawTags.map(String)
    : typeof rawTags === 'string'
      ? rawTags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : []

  return {
    id: String(row.id),
    name: text(row.name) || `Template ${String(row.id)}`,
    audience_tags,
    library_folder: text(row.libraryFolder),
    output_format: text(row.outputFormat),
    is_active: row.isActive !== false,
    metadata,
  }
}

/**
 * Whether this run puts a Boomerang list code on the material.
 *
 * True when the operator explicitly chose the Boomerang QR, and also when the
 * template itself is a Boomerang material — a template can declare that through
 * its audience tags or metadata, and an operator who leaves the QR on the
 * default must not be able to slip a Boomerang template past the gate.
 */
export function isBoomerangRun(
  qrPurpose: BulkQrPurpose,
  template: { audience_tags?: unknown; metadata?: unknown; name?: unknown } | null,
): boolean {
  if (qrPurpose === 'business_capture') return true
  if (!template) return false

  const tags = Array.isArray(template.audience_tags)
    ? template.audience_tags.map((t) => String(t).toLowerCase())
    : []
  if (tags.some((t) => t === 'boomerang' || t === 'business_capture' || t === 'hundred_list')) return true

  const metadata = (template.metadata && typeof template.metadata === 'object')
    ? template.metadata as Record<string, unknown>
    : {}
  const declared = String(metadata.engagement_code ?? metadata.qr_purpose ?? '').toLowerCase()
  return declared === 'business_capture' || declared === 'boomerang'
}

/**
 * The Boomerang gate, stated as a skip rather than a silent exclusion.
 *
 * `isBoomerangEnabledForBusiness` is the single gate for a Business record;
 * here the row comes straight off the QA account list, so the underlying
 * `isBoomerangEnabled` is applied to the same stored value
 * (`hundredListInterest`). Both "declined" and "never asked" stay closed.
 */
function boomerangSkip(target: BulkTarget): { reasonCode: BulkSkipReason; message: string } | null {
  if (target.accountType !== 'business') {
    return {
      reasonCode: 'boomerang_declined',
      message: 'A cause has no Boomerang list, so this material does not apply to it.',
    }
  }
  if (isBoomerangEnabled(target.boomerangInterest)) return null
  if (target.boomerangInterest === 'not_now') {
    return {
      reasonCode: 'boomerang_declined',
      message: 'This business declined the Boomerang list, so no Boomerang material was generated for it.',
    }
  }
  return {
    reasonCode: 'boomerang_not_asked',
    message: 'This business has not been asked about the Boomerang list yet, so no Boomerang material was generated for it.',
  }
}

/**
 * Re-read the named accounts straight from the backend.
 *
 * A run batch is given ids, never account state. Boomerang interest, logo and
 * ownership are always re-fetched here, so a client that edited the reviewed
 * list cannot talk the gate into including a business that declined.
 */
export async function fetchBulkTargetsByIds(
  ids: Array<{ accountId: string; accountType: 'business' | 'cause' }>,
): Promise<BulkTarget[]> {
  const wantBusinesses = ids.some((id) => id.accountType === 'business')
  const wantCauses = ids.some((id) => id.accountType === 'cause')

  const [businesses, causes] = await Promise.all([
    wantBusinesses ? fetchBusinessTargets() : Promise.resolve([]),
    wantCauses ? fetchCauseTargets() : Promise.resolve([]),
  ])

  const byKey = new Map<string, BulkTarget>()
  for (const row of [...businesses, ...causes]) {
    byKey.set(`${row.accountType}:${row.accountId}`, row)
  }

  return ids
    .map((id) => byKey.get(`${id.accountType}:${id.accountId}`))
    .filter((row): row is BulkTarget => !!row)
}

export interface BulkPreviewedTarget extends BulkTarget {
  /**
   * What the run will do with this account, decided from data already in hand.
   *
   * Only the checks that need no extra request are made here — the Boomerang
   * gate and the logo requirement. Whether a QR exists, and whether the material
   * was already generated, cost a request per account and are resolved during
   * the run, where they are reported per account like every other outcome.
   */
  disposition: 'will_generate' | 'will_skip'
  reasonCode: BulkSkipReason | null
  message: string | null
}

/** The cheap half of the eligibility decision. Shared so preview and run cannot disagree. */
export function previewTarget(
  target: BulkTarget,
  options: { boomerangRun: boolean; requireLogo: boolean },
): BulkPreviewedTarget {
  if (options.boomerangRun) {
    const skip = boomerangSkip(target)
    if (skip) return { ...target, disposition: 'will_skip', ...skip }
  }
  if (options.requireLogo && !target.hasLogo) {
    return {
      ...target,
      disposition: 'will_skip',
      reasonCode: 'no_logo',
      message: 'This account has no logo, so the material would generate unbranded.',
    }
  }
  return { ...target, disposition: 'will_generate', reasonCode: null, message: null }
}

const QR_ENTITY_TYPES: Record<Exclude<BulkQrPurpose, 'owner_default'>, string> = {
  business_network_referral: 'business_network_referral',
  business_capture: 'business_capture',
}

/** Read (never create) the account's QR of the requested purpose. */
async function findQrCodeId(target: BulkTarget, qrPurpose: BulkQrPurpose): Promise<string | null> {
  if (qrPurpose === 'owner_default') return null
  const entityType = target.accountType === 'cause' ? 'cause' : QR_ENTITY_TYPES[qrPurpose]
  const res = await fetchQaApi(
    `/api/dashboard/v1/QrCode?entityType=${encodeURIComponent(entityType)}`
    + `&entityId=${encodeURIComponent(target.accountId)}&pageSize=200`,
  )
  const json = await parseQaResponse<unknown>(res, 'Could not load QR codes.')
  const match = asRecordArray(json).find((row) => idText(row.id) != null)
  return match ? idText(match.id) : null
}

/** Whether an active material for this (account, template) pair already exists. */
async function hasExistingMaterial(target: BulkTarget, templateId: string): Promise<boolean> {
  const scope = target.accountType === 'business'
    ? `businessAccountId=${encodeURIComponent(target.accountId)}`
    : `causeAccountId=${encodeURIComponent(target.accountId)}`
  const res = await fetchQaApi(
    `/api/dashboard/v1/GeneratedMaterial?${scope}&templateId=${encodeURIComponent(templateId)}&pageSize=200`,
  )
  const json = await parseQaResponse<unknown>(res, 'Could not check existing materials.')
  return asRecordArray(json).some((row) => {
    if (row.isActive === false) return false
    const status = String(row.generationStatus ?? '').toLowerCase()
    return status === 'completed' || status === 'complete' || status === 'generated'
  })
}

export interface BulkRunOptions {
  templateId: string
  qrPurpose: BulkQrPurpose
  /** True when the chosen template puts a Boomerang list code on the material. */
  boomerangRun: boolean
  /** Generate again even when a material for this template already exists. Off by default — a re-run is a resume, not a duplicate. */
  regenerateExisting: boolean
  /** Skip accounts with no logo rather than generating an unbranded material. */
  requireLogo: boolean
  libraryFolder?: string | null
}

/**
 * Generate for one account. Never throws: a prerequisite the account is missing
 * comes back as a skip with the reason, and a failure comes back as a failure
 * with the error, so one bad account cannot take down the batch.
 */
async function generateForTarget(target: BulkTarget, options: BulkRunOptions): Promise<BulkAccountResult> {
  const base = {
    accountId: target.accountId,
    accountType: target.accountType,
    name: target.name,
    generatedMaterialId: null,
    generatedFileUrl: null,
  }

  // The Boomerang gate (and the logo requirement) run before anything else and
  // before any write, so a business that declined is never even looked up for
  // Boomerang assets. Same function the preview used, so what the operator
  // reviewed is what the run enforces.
  const preview = previewTarget(target, options)
  if (preview.disposition === 'will_skip') {
    return { ...base, status: 'skipped', reasonCode: preview.reasonCode, message: preview.message }
  }

  try {
    if (!options.regenerateExisting && await hasExistingMaterial(target, options.templateId)) {
      return {
        ...base,
        status: 'skipped',
        reasonCode: 'already_generated',
        message: 'This account already has this material. Re-running left it alone.',
      }
    }

    const qrCodeId = await findQrCodeId(target, options.qrPurpose)
    if (options.qrPurpose !== 'owner_default' && !qrCodeId) {
      return {
        ...base,
        status: 'skipped',
        reasonCode: 'no_qr',
        message: options.qrPurpose === 'business_capture'
          ? 'This business has no Boomerang list QR yet, so there was nothing to put on the material.'
          : 'This account has no LocalVIP referral QR yet, so there was nothing to put on the material.',
      }
    }
    // With no QR of its own the backend falls back to the account owner's
    // LocalVIP signup link. No owner means no link, and the material would
    // render with an empty QR — a skip, not a silent blank.
    if (!qrCodeId && !target.hasOwner) {
      return {
        ...base,
        status: 'skipped',
        reasonCode: 'no_owner',
        message: 'This account has no owner, so there is no link to put on the material.',
      }
    }

    const payload: Record<string, unknown> = {
      templateId: Number(options.templateId),
      metadata: {
        business_id: target.accountType === 'business' ? target.accountId : null,
        cause_id: target.accountType === 'cause' ? target.accountId : null,
        qr_code_id: qrCodeId,
        qr_purpose: options.qrPurpose === 'owner_default' ? null : options.qrPurpose,
        bulk_generation: true,
      },
    }
    if (target.accountType === 'business') payload.businessAccountId = Number(target.accountId)
    else payload.causeAccountId = Number(target.accountId)
    if (qrCodeId) payload.qrCodeId = Number(qrCodeId)
    if (options.libraryFolder) payload.libraryFolder = options.libraryFolder

    const res = await fetchQaApi('/api/dashboard/v1/GeneratedMaterial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const result = await parseQaResponse<Record<string, unknown>>(res, 'Could not generate the material.')

    // The backend records a render failure as an "error" status on a row it
    // still returns 200 for. Reporting that as success is exactly the
    // silently-did-nothing outcome this surface exists to avoid.
    const status = String(result?.generationStatus ?? '').toLowerCase()
    if (status === 'error' || status === 'failed') {
      return {
        ...base,
        status: 'failed',
        reasonCode: null,
        message: 'The backend accepted the request but the material failed to render.',
        generatedMaterialId: idText(result?.id),
        generatedFileUrl: null,
      }
    }

    return {
      ...base,
      status: 'generated',
      reasonCode: null,
      message: null,
      generatedMaterialId: idText(result?.id),
      generatedFileUrl: text(result?.generatedFileUrl),
    }
  } catch (error) {
    return {
      ...base,
      status: 'failed',
      reasonCode: null,
      message: error instanceof Error ? error.message : 'Generation failed.',
    }
  }
}

export async function runBulkGenerationBatch(
  targets: BulkTarget[],
  options: BulkRunOptions,
): Promise<BulkAccountResult[]> {
  return mapWithConcurrency(targets, (target) => generateForTarget(target, options))
}
