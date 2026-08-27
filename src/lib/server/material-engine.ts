import QRCode from 'qrcode'
import {
  buildStakeholderJoinUrl,
  fillTemplateText,
  getMaterialCategoryForFolder,
  getMaterialEngineBaseUrl,
  getQrPurposeForStakeholderType,
  getTargetRolesForStakeholderType,
  normalizeStakeholderCode,
  sanitizeFilenamePart,
  toDisplayUrl,
} from '@/lib/material-engine'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { getBusinessQaAccountId } from '@/lib/business-portal'
import { resolveBusinessOffer } from '@/lib/offers'
import { sanitizeStakeholderCodeValue } from '@/lib/stakeholder-codes'
import {
  renderMaterialAssetTemplate,
  syncMaterialAssetTemplatesForStakeholder,
} from '@/lib/server/material-asset-template-engine'
import {
  CORE_CAMPAIGN_TEMPLATE_NAMES,
  ensureCoreCampaignStructuredTemplates,
} from '@/lib/server/core-campaign-templates'
import type { createServiceClient } from '@/lib/supabase/server'
import { asUuid, pickFirstUuid } from '@/lib/uuid'
import { generateShortCode } from '@/lib/utils'
import type {
  Business,
  Cause,
  City,
  GeneratedMaterial,
  Material,
  MaterialTemplate,
  Offer,
  Organization,
  Profile,
  QrCode,
  Stakeholder,
  StakeholderCode,
  StakeholderType,
} from '@/lib/types/database'

type ServiceSupabaseClient = ReturnType<typeof createServiceClient>

/** Extract a meaningful error message from any thrown value (Error, Supabase PostgrestError, or unknown). */
function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === 'object' && 'message' in error) return String((error as any).message)
  if (typeof error === 'string') return error
  return fallback
}

interface StakeholderMaterialContext {
  stakeholder: Stakeholder
  codes: StakeholderCode
  business: Business | null
  cause: Cause | null
  profile: Profile | null
  organization: Organization | null
  city: City | null
  offers: Offer[]
  brand: 'localvip' | 'hato'
  joinUrl: string
  displayUrl: string
  ownerName: string
  cityName: string
  captureOfferHeadline: string
  captureOfferDescription: string
  captureOfferValue: string
  cashbackLabel: string
  supportLabel: string
}

interface TemplateCopyDefinition {
  eyebrow: string
  headline: string
  subheadline: string
  body: string
  comparisonSummary?: string
  cta: string
  footer: string
  qrCaption: string
  noteHeadline?: string
  layoutStyle?: 'comparison_master'
  titlePattern: string
  descriptionPattern: string
  sectionLabel?: string
  sectionTitle?: string
  sectionBody?: string
  proofLabel?: string
  ctaSubline?: string
  footerBadges?: string[]
  steps?: Array<{ title: string; body: string }>
  proofItems?: Array<{ title: string; body: string }>
  accentColor?: string
  highlightColor?: string
  backgroundColor?: string
  panelColor?: string
  textColor?: string
  variant?: 'poster' | 'flyer' | 'card' | 'campaign_sheet'
  canvasWidth?: number
  canvasHeight?: number
}

interface FilledTemplateCard {
  title: string
  body: string
}

interface GenerationResult {
  stakeholder: Stakeholder
  codes: StakeholderCode
  generatedMaterials: GeneratedMaterial[]
  failures: Array<{ templateId: string; templateName: string; error: string }>
  generationStatus?: 'generated' | 'failed'
  generationError?: string | null
}

interface RuntimeCanvasModule {
  createCanvas: (width: number, height: number) => {
    getContext: (contextId: '2d') => any
    toBuffer: (mimeType: string) => Buffer
  }
  loadImage: (source: string | Buffer | Uint8Array | ArrayBufferLike) => Promise<{
    width: number
    height: number
  }>
  PDFDocument: new (metadata?: {
    title?: string
    author?: string
    creator?: string
    producer?: string
    rasterDPI?: number
    encodingQuality?: number
    compressionLevel?: number
  } | null) => {
    beginPage: (width: number, height: number, rect?: unknown) => any
    endPage: () => void
    close: () => Buffer
  }
}

interface StructuredTemplateRenderState {
  copy: TemplateCopyDefinition
  valueMap: Record<string, string | null | undefined>
  qrPosition: {
    x: number
    y: number
    width: number
    height: number
    canvas_width: number
    canvas_height: number
  }
  width: number
  height: number
  palette: ReturnType<typeof getPalette>
  headlineLines: string[]
  subheadlineLines: string[]
  bodyLines: string[]
  footerLines: string[]
  noteHeadlineLines: string[]
  sectionLabel: string
  sectionTitleLines: string[]
  sectionBodyLines: string[]
  proofLabel: string
  ctaSublineLines: string[]
  steps: FilledTemplateCard[]
  proofItems: FilledTemplateCard[]
  footerBadges: string[]
  primaryLogoUrl: string | null
  primaryMark: string
  secondaryMark: string
}

const DEFAULT_QR_POSITION = {
  x: 760,
  y: 930,
  width: 220,
  height: 220,
  canvas_width: 1080,
  canvas_height: 1440,
}

let materialsBucketPrepared = false
let generatedMaterialsSupportsActiveFlag: boolean | null = null
let generatedMaterialsSupportsVersionNumber: boolean | null = null

async function supportsGeneratedMaterialsActiveFlag(
  supabase: ServiceSupabaseClient,
): Promise<boolean> {
  if (generatedMaterialsSupportsActiveFlag !== null) {
    return generatedMaterialsSupportsActiveFlag
  }

  const { error } = await (supabase.from('generated_materials') as any)
    .select('is_active')
    .limit(1)

  if (error && /is_active/i.test(error.message || '')) {
    generatedMaterialsSupportsActiveFlag = false
    return false
  }

  generatedMaterialsSupportsActiveFlag = true
  return true
}

async function supportsGeneratedMaterialsVersionNumber(
  supabase: ServiceSupabaseClient,
): Promise<boolean> {
  if (generatedMaterialsSupportsVersionNumber !== null) {
    return generatedMaterialsSupportsVersionNumber
  }

  const { error } = await (supabase.from('generated_materials') as any)
    .select('version_number')
    .limit(1)

  if (error && /version_number/i.test(error.message || '')) {
    generatedMaterialsSupportsVersionNumber = false
    return false
  }

  generatedMaterialsSupportsVersionNumber = true
  return true
}

function isLegacyGeneratedMaterialsDuplicate(error: unknown) {
  if (!error || typeof error !== 'object') return false
  const message = 'message' in error ? String((error as { message?: unknown }).message || '') : ''
  return /idx_generated_materials_unique|generated_materials_stakeholder_id_template_id_key/i.test(message)
}

async function writeGeneratedMaterialRow(
  supabase: ServiceSupabaseClient,
  row: Record<string, unknown>,
  supportsActiveFlag: boolean,
) {
  const initialWrite = supportsActiveFlag
    ? (supabase.from('generated_materials') as any).insert(row)
    : (supabase.from('generated_materials') as any).upsert(row, { onConflict: 'stakeholder_id,template_id' })

  let { data, error } = await initialWrite.select().single()

  if (!error) {
    return data as GeneratedMaterial
  }

  if (supportsActiveFlag && isLegacyGeneratedMaterialsDuplicate(error)) {
    const fallbackWrite = await (supabase.from('generated_materials') as any)
      .upsert(row, { onConflict: 'stakeholder_id,template_id' })
      .select()
      .single()

    if (fallbackWrite.error) throw fallbackWrite.error
    return fallbackWrite.data as GeneratedMaterial
  }

  throw error
}

export async function createStakeholderRecord(
  supabase: ServiceSupabaseClient,
  payload: {
    type: StakeholderType
    name: string
    cityId?: string | null
    ownerUserId?: string | null
    profileId?: string | null
    businessId?: string | null
    causeId?: string | null
    organizationId?: string | null
    status?: Stakeholder['status']
    metadata?: Record<string, unknown> | null
  },
) {
  const ownerUserId = asUuid(payload.ownerUserId)
  const profileId = asUuid(payload.profileId)
  const { data, error } = await (supabase.from('stakeholders') as any)
    .insert({
      type: payload.type,
      name: payload.name,
      city_id: payload.cityId || null,
      owner_user_id: ownerUserId,
      profile_id: profileId,
      business_id: payload.businessId || null,
      cause_id: payload.causeId || null,
      organization_id: payload.organizationId || null,
      status: payload.status || 'pending',
      metadata: payload.metadata || null,
    })
    .select()
    .single()

  if (error) throw error
  return data as Stakeholder
}

export async function ensureAutomatedStakeholderMaterials(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  actorId: string | null,
) {
  const stakeholder = await getStakeholderById(supabase, stakeholderId)
  if (!stakeholder) throw new Error('Stakeholder not found.')

  const existingCodes = await getStakeholderCode(supabase, stakeholderId)
  const defaultCodes = await buildDefaultStakeholderCodes(supabase, stakeholder, existingCodes)

  return upsertStakeholderCodesAndGenerate(supabase, stakeholderId, actorId, {
    referralCode: defaultCodes.referralCode,
    connectionCode: defaultCodes.connectionCode,
  })
}

type QaDealForMaterials = {
  active?: boolean | null
  isActive?: boolean | null
  cashBack?: number | string | null
  cash_back?: number | string | null
}

function asQaItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (value && typeof value === 'object' && Array.isArray((value as { items?: unknown }).items)) {
    return (value as { items: T[] }).items
  }
  return []
}

async function getQaDealCashbackLabel(business: Business | null) {
  const qaBusinessId = getBusinessQaAccountId(business)
  if (!qaBusinessId) return null

  try {
    const response = await fetchQaApi(`/api/dashboard/v1/Deal?businessAccountId=${encodeURIComponent(qaBusinessId)}`)
    const payload = await parseQaResponse<unknown>(response, 'Failed to load the business deal.')
    const deals = asQaItems<QaDealForMaterials>(payload)
    const deal = deals.find((item) => item.active === true || item.isActive === true) || deals[0]
    const value = Number(deal?.cashBack ?? deal?.cash_back)
    return Number.isFinite(value) && value >= 1 && value <= 36 ? `${value}% cashback` : null
  } catch {
    return null
  }
}

export async function ensureStakeholderCodesAndQrCode(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  actorId: string | null,
) {
  const stakeholder = await getStakeholderById(supabase, stakeholderId)
  if (!stakeholder) throw new Error('Stakeholder not found.')

  const existingCodes = await getStakeholderCode(supabase, stakeholderId)
  const defaultCodes = await buildDefaultStakeholderCodes(supabase, stakeholder, existingCodes)

  // Codes and the QR are separate concerns. This used to run the code upsert first and let
  // it throw, which aborted the whole call before the QR was ever created — so a code clash
  // showed up in the UI as a permanently "Creating" QR. Keep going and report both outcomes.
  let codes = existingCodes
  let joinUrl = existingCodes?.join_url || ''
  let codeError: string | null = null

  try {
    const saved = await upsertStakeholderCodes(supabase, stakeholderId, {
      referralCode: defaultCodes.referralCode,
      connectionCode: defaultCodes.connectionCode,
    })
    codes = saved.codes
    joinUrl = saved.joinUrl
  } catch (error) {
    codeError = extractErrorMessage(error, 'Stakeholder codes could not be saved.')
  }

  // The QR is keyed off the connection code, so it can only be provisioned when we have a
  // code to key it on — either the newly saved set or the pre-existing one.
  let qrCode: Awaited<ReturnType<typeof ensureStakeholderQrCode>> | null = null
  let qrError: string | null = null

  if (codes) {
    try {
      const context = await buildStakeholderMaterialContext(supabase, stakeholder, codes)
      qrCode = await ensureStakeholderQrCode(supabase, context, actorId)
      joinUrl = joinUrl || context.joinUrl
    } catch (error) {
      qrError = extractErrorMessage(error, 'The QR code could not be prepared.')
    }
  } else {
    qrError = 'No connection code is stored yet, so the QR code could not be prepared.'
  }

  // Only a total failure is fatal; a partial result still gives the operator something usable.
  if (codeError && qrError) {
    throw new Error(codeError)
  }

  return {
    stakeholder,
    codes,
    joinUrl,
    qrCode,
    codeError,
    qrError,
  }
}

export async function upsertStakeholderCodes(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  payload: {
    referralCode: string
    connectionCode: string
  },
) {
  const stakeholder = await getStakeholderById(supabase, stakeholderId)
  if (!stakeholder) throw new Error('Stakeholder not found.')

  const referralCode = sanitizeStakeholderCodeValue(payload.referralCode)
  const connectionCode = sanitizeStakeholderCodeValue(payload.connectionCode)

  if (!referralCode || !connectionCode) {
    throw new Error('Referral code and connection code are required after cleanup. Use letters or numbers.')
  }

  const referralConflict = await findStakeholderCodeConflict(
    supabase,
    'referral_code',
    referralCode,
    stakeholderId,
  )
  if (referralConflict) {
    throw new Error(
      `The referral code "${referralCode}" is already in use by a different stakeholder record. `
      + 'This is a code clash only — the QR code and capture link are not affected. '
      + 'Set a different referral code for this business, or release the code from the other record.',
    )
  }

  const connectionConflict = await findStakeholderCodeConflict(
    supabase,
    'connection_code',
    connectionCode,
    stakeholderId,
  )
  if (connectionConflict) {
    throw new Error(
      `The connection code "${connectionCode}" is already in use by a different stakeholder record. `
      + 'This is a code clash only — the QR code and capture link are not affected. '
      + 'Set a different connection code for this business, or release the code from the other record.',
    )
  }

  const joinUrl = buildStakeholderJoinUrl(stakeholder.type, connectionCode)
  const existing = await getStakeholderCode(supabase, stakeholderId)

  if (existing) {
    const { error } = await (supabase.from('stakeholder_codes') as any)
      .update({
        referral_code: referralCode,
        connection_code: connectionCode,
        join_url: joinUrl,
      })
      .eq('id', existing.id)

    if (error) throw new Error(getStakeholderCodeSaveErrorMessage(error, 'update'))
  } else {
    const { error } = await (supabase.from('stakeholder_codes') as any)
      .insert({
        stakeholder_id: stakeholderId,
        referral_code: referralCode,
        connection_code: connectionCode,
        join_url: joinUrl,
      })

    if (error) throw new Error(getStakeholderCodeSaveErrorMessage(error, 'insert'))
  }

  const savedCodes = await getStakeholderCode(supabase, stakeholderId)
  if (!savedCodes) throw new Error('Codes were saved but could not be reloaded.')

  await updateAdminTaskStatus(supabase, stakeholder.id, 'ready_to_generate', {
    referral_code: referralCode,
    connection_code: connectionCode,
    join_url: joinUrl,
    codes_saved_at: new Date().toISOString(),
  })

  return {
    stakeholder,
    codes: savedCodes,
    joinUrl,
  }
}

export async function upsertStakeholderCodesAndGenerate(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  actorId: string | null,
  payload: {
    referralCode: string
    connectionCode: string
  },
) {
  const saveResult = await upsertStakeholderCodes(supabase, stakeholderId, payload)

  try {
    const generation = await generateMaterialsForStakeholder(supabase, stakeholderId, actorId)
    return {
      ...generation,
      stakeholder: saveResult.stakeholder,
      codes: saveResult.codes,
      generationStatus: 'generated' as const,
      generationError: null,
    }
  } catch (error) {
    const message = extractErrorMessage(error, 'Material generation failed (unknown error).')
    await updateAdminTaskStatus(supabase, saveResult.stakeholder.id, 'failed', {
      referral_code: saveResult.codes.referral_code,
      connection_code: saveResult.codes.connection_code,
      join_url: saveResult.joinUrl,
      last_error: message,
      codes_saved_at: new Date().toISOString(),
      attempted_at: new Date().toISOString(),
    })

    // Re-throw so the caller (API route) gets the detailed message
    throw new Error(`Codes saved, but material generation failed: ${message}`)
  }
}

export async function listAutoGenerationTemplatesForStakeholder(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  options?: {
    fastMode?: boolean
  },
) {
  const stakeholder = await getStakeholderById(supabase, stakeholderId)
  if (!stakeholder) throw new Error('Stakeholder not found.')

  const [businessResult, causeResult] = await Promise.all([
    stakeholder.business_id
      ? supabase.from('businesses').select('*').eq('id', stakeholder.business_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    stakeholder.cause_id
      ? supabase.from('causes').select('*').eq('id', stakeholder.cause_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])

  const business = (businessResult.data || null) as Business | null
  const cause = (causeResult.data || null) as Cause | null

  return getTemplatesForStakeholder(supabase, stakeholder.type, undefined, {
    tier: 'auto',
    cityId: stakeholder.city_id,
    campaignId: business?.campaign_id || cause?.campaign_id || null,
    businessCategory: business?.category || null,
    includeAssetTemplates: true,
  })
}

export async function generateMaterialsForStakeholder(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  actorId: string | null,
  options?: {
    templateId?: string
    fastMode?: boolean
  },
): Promise<GenerationResult> {
  const actorUuid = asUuid(actorId)
  // Phase 1: Load stakeholder + codes in parallel
  const [stakeholder, codesResult] = await Promise.all([
    getStakeholderById(supabase, stakeholderId),
    getStakeholderCode(supabase, stakeholderId),
  ])
  if (!stakeholder) throw new Error('Stakeholder not found.')
  const codes = codesResult
  if (!codes) throw new Error('Stakeholder codes are missing.')

  // Phase 2: Build context + ensure bucket in parallel
  const [context] = await Promise.all([
    buildStakeholderMaterialContext(supabase, stakeholder, codes),
    ensureMaterialsBucket(supabase),
  ])

  // Phase 3: Ensure QR code + resolve templates in parallel (both depend on context)
  const [qrCode, templates] = await Promise.all([
    ensureStakeholderQrCode(supabase, context, actorUuid),
    getTemplatesForStakeholder(supabase, stakeholder.type, options?.templateId, {
      tier: 'auto',
      cityId: stakeholder.city_id,
      campaignId: context.business?.campaign_id || context.cause?.campaign_id || null,
      businessCategory: context.business?.category || null,
      // Always include asset templates — they are PDF/image files from the
      // material library and should be rendered regardless of fastMode.
      includeAssetTemplates: true,
    }),
  ])

  if (templates.length === 0) {
    const msg = options?.templateId
      ? `No active template found with id "${options.templateId}" for stakeholder type "${stakeholder.type}".`
      : `No active auto-generation templates found for stakeholder type "${stakeholder.type}". Create one in the Template Engine.`
    await updateAdminTaskStatus(supabase, stakeholder.id, 'failed', {
      error: msg,
      attempted_at: new Date().toISOString(),
    })
    throw new Error(msg)
  }

  const results: GeneratedMaterial[] = []
  const failures: Array<{ templateId: string; templateName: string; error: string }> = []
  const fastMode = options?.fastMode ?? false

  for (const template of templates) {
    try {
      // material_asset templates are library PDFs/images — always use the real
      // renderer so the actual file (with QR embedded) is produced.
      // Other templates use the fast SVG fallback in fastMode.
      const generated = (fastMode && template.template_type !== 'material_asset')
        ? await generateEmergencyFallbackMaterial(
            supabase,
            context,
            qrCode,
            template,
            actorUuid,
            'Fast interactive generation mode.',
            'fast',
          )
        : await generateOneMaterial(supabase, context, qrCode, template, actorUuid)
      results.push(generated)
    } catch (error) {
      const message = extractErrorMessage(error, `Generation failed for template "${template.name}"`)
      if (fastMode) {
        failures.push({ templateId: template.id, templateName: template.name, error: message })
        await upsertGeneratedMaterialFailure(supabase, stakeholder.id, template, message)
      } else {
        try {
          const fallbackGenerated = await generateEmergencyFallbackMaterial(
            supabase,
            context,
            qrCode,
            template,
            actorUuid,
            message,
            'emergency_fallback',
          )
          results.push(fallbackGenerated)
          failures.push({
            templateId: template.id,
            templateName: template.name,
            error: `Primary render failed, but a fallback material was generated instead: ${message}`,
          })
        } catch (fallbackError) {
          const fallbackMessage = extractErrorMessage(
            fallbackError,
            `Fallback generation also failed for template "${template.name}"`,
          )
          const combinedMessage = `${message} | Fallback failed: ${fallbackMessage}`
          failures.push({ templateId: template.id, templateName: template.name, error: combinedMessage })
          await upsertGeneratedMaterialFailure(supabase, stakeholder.id, template, combinedMessage)
        }
      }
    }
  }

  const status = failures.length > 0 && results.length === 0 ? 'failed' : 'generated'
  const generationError = failures.length > 0
    ? failures.map((failure) => `[${failure.templateName}] ${failure.error}`).join(' | ')
    : null

  await updateAdminTaskStatus(
    supabase,
    stakeholder.id,
    status,
    {
      generated_count: results.length,
      failure_count: failures.length,
      failures,
      generation_error: generationError,
      generated_at: new Date().toISOString(),
    },
  )

  if (status === 'failed') {
    throw new Error(
      `Material generation failed for all ${failures.length} template(s). ${generationError || ''}`.trim(),
    )
  }

  // Notification should never block successful material generation.
  try {
    await createMaterialNotification(supabase, stakeholder, results.length)
  } catch {
    // Ignore notification failures.
  }

  return {
    stakeholder,
    codes,
    generatedMaterials: results,
    failures,
    generationStatus: status,
    generationError,
  }
}

export async function regenerateSingleGeneratedMaterial(
  supabase: ServiceSupabaseClient,
  generatedMaterialId: string,
  actorId: string | null,
) {
  const { data, error } = await supabase
    .from('generated_materials')
    .select('*')
    .eq('id', generatedMaterialId)
    .single()

  const generatedMaterial = (data || null) as GeneratedMaterial | null

  if (error || !generatedMaterial) throw new Error('Generated material not found.')

  return generateMaterialsForStakeholder(supabase, generatedMaterial.stakeholder_id, actorId, {
    templateId: generatedMaterial.template_id,
  })
}

export async function renderStructuredTemplatePreviewPng(
  template: MaterialTemplate,
  options: {
    stakeholderName: string
    stakeholderType?: StakeholderType
    brand?: 'localvip' | 'hato'
    ownerName?: string
    cityName?: string
    referralCode?: string
    connectionCode?: string
    joinUrl?: string
    displayUrl?: string
    captureOfferHeadline?: string
    captureOfferDescription?: string
    captureOfferValue?: string
    cashbackLabel?: string
    supportLabel?: string
    logoUrl?: string | null
    coverPhotoUrl?: string | null
    metadata?: Record<string, unknown> | null
  },
) {
  const now = new Date().toISOString()
  const stakeholderType = options.stakeholderType || template.stakeholder_types[0] || 'school'
  const fallbackCode = normalizeStakeholderCode(options.referralCode || options.stakeholderName || 'localvip')
  const joinUrl = options.joinUrl || buildStakeholderJoinUrl(stakeholderType, fallbackCode)
  const displayUrl = options.displayUrl || toDisplayUrl(joinUrl)
  const metadata = options.metadata || null

  const stakeholder: Stakeholder = {
    id: 'preview-stakeholder',
    type: stakeholderType,
    name: options.stakeholderName,
    city_id: null,
    owner_user_id: null,
    profile_id: null,
    business_id: null,
    cause_id: stakeholderType === 'business' ? null : 'preview-cause',
    organization_id: null,
    status: 'active',
    metadata,
    created_at: now,
    updated_at: now,
  }

  const causeRecord = stakeholderType === 'business'
    ? null
    : {
      id: 'preview-cause',
      name: options.stakeholderName,
      type: stakeholderType === 'school' ? 'school' : 'cause',
      logo_url: options.logoUrl || null,
      cover_photo_url: options.coverPhotoUrl || null,
      metadata,
    }

  const context: StakeholderMaterialContext = {
    stakeholder,
    codes: {
      id: 'preview-code',
      stakeholder_id: stakeholder.id,
      referral_code: options.referralCode || fallbackCode,
      connection_code: options.connectionCode || fallbackCode,
      join_url: joinUrl,
      created_at: now,
      updated_at: now,
    },
    business: null,
    cause: causeRecord as Cause | null,
    profile: null,
    organization: null,
    city: null,
    offers: [],
    brand: options.brand || 'localvip',
    joinUrl,
    displayUrl,
    ownerName: options.ownerName || 'LocalVIP',
    cityName: options.cityName || '',
    captureOfferHeadline: options.captureOfferHeadline || 'Support your local community.',
    captureOfferDescription: options.captureOfferDescription || getDefaultDescriptionForStakeholder(stakeholder),
    captureOfferValue: options.captureOfferValue || 'Local impact',
    cashbackLabel: options.cashbackLabel || 'Rewards available',
    supportLabel: options.supportLabel || 'Community support',
  }

  let qrDataUrl = await QRCode.toDataURL(joinUrl, {
    width: 1024,
    margin: 1,
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  })

  if (options.logoUrl) {
    qrDataUrl = await embedLogoIntoQr(qrDataUrl, options.logoUrl)
  }

  return renderStructuredTemplatePng(template, context, qrDataUrl)
}

async function generateOneMaterial(
  supabase: ServiceSupabaseClient,
  context: StakeholderMaterialContext,
  qrCode: QrCode,
  template: MaterialTemplate,
  actorId: string | null,
) {
  const actorUuid = asUuid(actorId)
  const rawQrDataUrl = await QRCode.toDataURL(qrCode.redirect_url || context.joinUrl, {
    width: 1024,
    margin: 1,
    color: {
      dark: context.brand === 'hato' ? '#ec8012' : '#2563eb',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  })

  // Embed business or cause logo into QR center if available
  const logoUrl = context.business?.logo_url || context.cause?.logo_url || null
  const qrDataUrl = logoUrl
    ? await embedLogoIntoQr(rawQrDataUrl, logoUrl)
    : rawQrDataUrl

  const fileBase = `${sanitizeFilenamePart(context.stakeholder.name)}-${sanitizeFilenamePart(template.name)}`
  let fileExtension = 'svg'
  let contentType = 'image/svg+xml'
  let materialType: Material['type'] = 'flyer'
  let fileBuffer: Uint8Array

  if (template.template_type === 'material_asset') {
    try {
      const rendered = await renderMaterialAssetTemplate(supabase, template, qrCode, qrDataUrl)
      fileExtension = rendered.fileExtension
      contentType = rendered.contentType
      materialType = rendered.materialType
      fileBuffer = rendered.fileBuffer
    } catch (assetError) {
      throw new Error(
        `Material asset rendering failed for "${template.name}": ${extractErrorMessage(assetError, 'unknown error')}. `
        + `This usually means @napi-rs/canvas is not available in this environment (e.g. Netlify serverless). `
        + `Convert the template to SVG output format or use a server that supports native modules.`
      )
    }
  } else {
    const svg = renderStructuredTemplateSvg(template, context, qrDataUrl)
    fileBuffer = Buffer.from(svg, 'utf8')

    if (template.output_format === 'png') {
      try {
        fileExtension = 'png'
        contentType = 'image/png'
        fileBuffer = new Uint8Array(await renderStructuredTemplatePng(template, context, qrDataUrl))
      } catch (pngError) {
        throw new Error(
          `PNG rendering failed for "${template.name}": ${extractErrorMessage(pngError, 'unknown error')}. `
          + `@napi-rs/canvas may not be available. Change template output_format to "svg" or deploy to a server with native module support.`
        )
      }
    } else if (template.output_format === 'pdf') {
      try {
        fileExtension = 'pdf'
        contentType = 'application/pdf'
        materialType = 'pdf'
        fileBuffer = new Uint8Array(await renderStructuredTemplatePdf(template, context, qrDataUrl))
      } catch (pdfError) {
        throw new Error(
          `PDF rendering failed for "${template.name}": ${extractErrorMessage(pdfError, 'unknown error')}. `
          + `@napi-rs/canvas may not be available. Change template output_format to "svg" or deploy to a server with native module support.`
        )
      }
    }
  }

  const filePath = `generated-materials/${context.stakeholder.id}/${fileBase}.${fileExtension}`

  const uploadResult = await supabase.storage
    .from('materials')
    .upload(filePath, fileBuffer, {
      upsert: true,
      contentType,
    })

  if (uploadResult.error) throw new Error(uploadResult.error.message)

  const { data: urlData } = supabase.storage.from('materials').getPublicUrl(filePath)
  const generatedFileUrl = urlData.publicUrl
  // Archive existing versions for this stakeholder+template
  const existingVersions = await getActiveGeneratedMaterials(supabase, context.stakeholder.id, template.id)
  const supportsVersionNumber = await supportsGeneratedMaterialsVersionNumber(supabase)
  const nextVersion = supportsVersionNumber && existingVersions.length > 0
    ? Math.max(...existingVersions.map(v => v.version_number || 1)) + 1
    : 1

  if (existingVersions.length > 0) {
    const supportsActiveFlag = await supportsGeneratedMaterialsActiveFlag(supabase)
    for (const old of existingVersions) {
      await (supabase.from('generated_materials') as any)
        .update({
          ...(supportsActiveFlag ? { is_active: false } : {}),
          is_outdated: true,
        })
        .eq('id', old.id)
    }
  }

  const existingGenerated = existingVersions[0] || null
  const ownerProfileId = asUuid(await resolveStakeholderLibraryProfileId(supabase, context.stakeholder))
  const title = fillTemplateText(getTemplateCopy(template).titlePattern, {
    ...getTemplateValueMap(context),
    template_name: template.name,
  })
  const description = fillTemplateText(getTemplateCopy(template).descriptionPattern, {
    ...getTemplateValueMap(context),
    template_name: template.name,
  })

  const materialPayload = {
    title,
    description: description || null,
    type: materialType,
    brand: context.brand,
    file_url: generatedFileUrl,
    file_name: `${fileBase}.${fileExtension}`,
    file_size: fileBuffer.byteLength,
    mime_type: contentType,
    thumbnail_url: generatedFileUrl,
    category: getMaterialCategoryForFolder(template.library_folder),
    use_case: 'general',
    target_roles: getTargetRolesForStakeholderType(context.stakeholder.type),
    target_subtypes: [],
    campaign_id: null,
    city_id: context.stakeholder.city_id,
    is_template: false,
    version: nextVersion,
    status: 'active' as Material['status'],
    created_by: pickFirstUuid(actorUuid, context.stakeholder.owner_user_id, ownerProfileId, context.stakeholder.profile_id),
    metadata: {
      generated_by_engine: true,
      stakeholder_id: context.stakeholder.id,
      template_id: template.id,
      library_folder: template.library_folder,
      audience_tags: template.audience_tags,
      qr_code_id: qrCode.id,
      join_url: context.joinUrl,
      source_path: template.source_path,
    },
  }

  let materialId = existingGenerated?.material_id || null

  if (materialId) {
    const { error } = await (supabase.from('materials') as any)
      .update(materialPayload)
      .eq('id', materialId)
    if (error) throw error
  } else {
    const { data, error } = await (supabase.from('materials') as any)
      .insert(materialPayload)
      .select()
      .single()
    if (error) throw error
    materialId = (data as Material).id
  }

  if (ownerProfileId && materialId) {
    await ensureMaterialAssignment(supabase, materialId, ownerProfileId, actorUuid)
  }

  const supportsActiveFlag = await supportsGeneratedMaterialsActiveFlag(supabase)
  const generatedRow = {
    stakeholder_id: context.stakeholder.id,
    template_id: template.id,
    material_id: materialId,
    generated_file_url: generatedFileUrl,
    generated_file_name: `${fileBase}.${fileExtension}`,
    library_folder: template.library_folder,
    tags: template.audience_tags,
    generation_status: 'generated',
    generation_error: null,
    generated_at: new Date().toISOString(),
    template_version: template.version || 1,
    is_outdated: false,
    ...(supportsVersionNumber ? { version_number: nextVersion } : {}),
    ...(supportsActiveFlag ? { is_active: true } : {}),
    metadata: {
      qr_code_id: qrCode.id,
      redirect_url: qrCode.redirect_url,
      join_url: context.joinUrl,
      display_url: context.displayUrl,
      output_format: template.output_format,
    },
  }

  const generatedData = await writeGeneratedMaterialRow(
    supabase,
    generatedRow,
    supportsActiveFlag,
  )

  await syncLinkedStakeholderAssets(supabase, context.stakeholder, {
    qrCodeId: qrCode.id,
    materialId,
    generatedMaterialId: generatedData.id,
  })

  return generatedData
}

async function generateEmergencyFallbackMaterial(
  supabase: ServiceSupabaseClient,
  context: StakeholderMaterialContext,
  qrCode: QrCode,
  template: MaterialTemplate,
  actorId: string | null,
  primaryError: string,
  mode: 'fast' | 'emergency_fallback' = 'emergency_fallback',
) {
  const actorUuid = asUuid(actorId)
  const copy = getTemplateCopy(template)
  const valueMap = getTemplateValueMap(context)
  const qrDataUrl = await QRCode.toDataURL(qrCode.redirect_url || context.joinUrl, {
    width: 1024,
    margin: 1,
    color: {
      dark: context.brand === 'hato' ? '#ec8012' : '#2563eb',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  })

  const emergencyTemplate: MaterialTemplate = {
    ...template,
    output_format: 'svg',
    metadata: {
      ...(template.metadata || {}),
      eyebrow: copy.eyebrow,
      headline: copy.headline,
      subheadline: copy.subheadline,
      body: copy.body,
      cta: copy.cta,
      footer: copy.footer,
    },
  }

  const svg = renderStructuredTemplateSvg(emergencyTemplate, context, qrDataUrl)
  const fallbackSuffix = mode === 'emergency_fallback' ? '-fallback' : ''
  const fileBase = `${sanitizeFilenamePart(context.stakeholder.name)}-${sanitizeFilenamePart(template.name)}${fallbackSuffix}`
  const filePath = `generated-materials/${context.stakeholder.id}/${fileBase}.svg`
  const fileBuffer = Buffer.from(svg, 'utf8')

  const uploadResult = await supabase.storage
    .from('materials')
    .upload(filePath, fileBuffer, {
      upsert: true,
      contentType: 'image/svg+xml',
    })

  if (uploadResult.error) throw new Error(uploadResult.error.message)

  const { data: urlData } = supabase.storage.from('materials').getPublicUrl(filePath)
  const generatedFileUrl = urlData.publicUrl
  const existingFallbackVersions = await getActiveGeneratedMaterials(supabase, context.stakeholder.id, template.id)
  const existingGenerated = existingFallbackVersions[0] || null
  const ownerProfileId = asUuid(await resolveStakeholderLibraryProfileId(supabase, context.stakeholder))
  const title = fillTemplateText(copy.titlePattern, {
    ...valueMap,
    template_name: template.name,
  })
  const description = fillTemplateText(copy.descriptionPattern, {
    ...valueMap,
    template_name: template.name,
  })

  const materialPayload = {
    title,
    description: description || null,
    type: 'flyer' as Material['type'],
    brand: context.brand,
    file_url: generatedFileUrl,
    file_name: `${fileBase}.svg`,
    file_size: fileBuffer.byteLength,
    mime_type: 'image/svg+xml',
    thumbnail_url: generatedFileUrl,
    category: getMaterialCategoryForFolder(template.library_folder),
    use_case: 'general',
    target_roles: getTargetRolesForStakeholderType(context.stakeholder.type),
    target_subtypes: [],
    campaign_id: null,
    city_id: context.stakeholder.city_id,
    is_template: false,
    version: 1,
    status: 'active' as Material['status'],
    created_by: pickFirstUuid(actorUuid, context.stakeholder.owner_user_id, ownerProfileId, context.stakeholder.profile_id),
      metadata: {
        generated_by_engine: true,
        generation_mode: mode,
        stakeholder_id: context.stakeholder.id,
        template_id: template.id,
        library_folder: template.library_folder,
      audience_tags: template.audience_tags,
      qr_code_id: qrCode.id,
      join_url: context.joinUrl,
      primary_error: primaryError,
    },
  }

  let materialId = existingGenerated?.material_id || null
  if (materialId) {
    const { error } = await (supabase.from('materials') as any)
      .update(materialPayload)
      .eq('id', materialId)
    if (error) throw error
  } else {
    const { data, error } = await (supabase.from('materials') as any)
      .insert(materialPayload)
      .select()
      .single()
    if (error) throw error
    materialId = (data as Material).id
  }

  if (ownerProfileId && materialId) {
    await ensureMaterialAssignment(supabase, materialId, ownerProfileId, actorUuid)
  }

  // Archive old versions for fallback too
  const oldFallback = await getActiveGeneratedMaterials(supabase, context.stakeholder.id, template.id)
  const supportsVersionNumber = await supportsGeneratedMaterialsVersionNumber(supabase)
  const fallbackVersion = supportsVersionNumber && oldFallback.length > 0
    ? Math.max(...oldFallback.map(v => v.version_number || 1)) + 1
    : 1
  if (oldFallback.length > 0) {
    const supportsActiveFlag = await supportsGeneratedMaterialsActiveFlag(supabase)
    for (const old of oldFallback) {
      await (supabase.from('generated_materials') as any)
        .update({
          ...(supportsActiveFlag ? { is_active: false } : {}),
          is_outdated: true,
        })
        .eq('id', old.id)
    }
  }

  const fallbackGeneratedRow = {
      stakeholder_id: context.stakeholder.id,
      template_id: template.id,
      material_id: materialId,
      generated_file_url: generatedFileUrl,
      generated_file_name: `${fileBase}.svg`,
      library_folder: template.library_folder,
      tags: template.audience_tags,
      generation_status: 'generated',
      generation_error: null,
      generated_at: new Date().toISOString(),
      template_version: template.version || 1,
      is_outdated: false,
      ...(supportsVersionNumber ? { version_number: fallbackVersion } : {}),
      ...(await supportsGeneratedMaterialsActiveFlag(supabase) ? { is_active: true } : {}),
      metadata: {
        qr_code_id: qrCode.id,
        redirect_url: qrCode.redirect_url,
        join_url: context.joinUrl,
        display_url: context.displayUrl,
        output_format: 'svg',
        generation_mode: mode,
        primary_error: primaryError,
      },
    }

  const supportsActiveFlag = await supportsGeneratedMaterialsActiveFlag(supabase)
  const generatedData = await writeGeneratedMaterialRow(
    supabase,
    fallbackGeneratedRow,
    supportsActiveFlag,
  )

  await syncLinkedStakeholderAssets(supabase, context.stakeholder, {
    qrCodeId: qrCode.id,
    materialId,
    generatedMaterialId: generatedData.id,
  })

  return generatedData
}

async function upsertGeneratedMaterialFailure(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  template: MaterialTemplate,
  message: string,
) {
  await (supabase.from('generated_materials') as any).upsert(
    {
      stakeholder_id: stakeholderId,
      template_id: template.id,
      material_id: null,
      generated_file_url: null,
      generated_file_name: null,
      library_folder: template.library_folder,
      tags: template.audience_tags,
      generation_status: 'failed',
      generation_error: message,
      generated_at: null,
      metadata: {
        output_format: template.output_format,
      },
    },
    { onConflict: 'stakeholder_id,template_id' },
  )
}

async function getTemplatesForStakeholder(
  supabase: ServiceSupabaseClient,
  stakeholderType: StakeholderType,
  templateId?: string,
  options?: {
    tier?: 'auto' | 'assignable' | 'selfserve'
    cityId?: string | null
    campaignId?: string | null
    businessCategory?: string | null
    includeAssetTemplates?: boolean
  },
) {
  const tier = options?.tier || 'auto'
  if (['school', 'cause', 'community'].includes(stakeholderType)) {
    await ensureCoreCampaignStructuredTemplates(supabase)
  }
  const syncedAssetTemplates = options?.includeAssetTemplates === false
    ? []
    : await syncMaterialAssetTemplatesForStakeholder(supabase, stakeholderType, templateId)

  let query = supabase
    .from('material_templates')
    .select('*')
    .eq('is_active', true)
    .neq('template_type', 'material_asset')
    .contains('tiers', [tier])

  if (templateId) query = query.eq('id', templateId)

  const { data, error } = await query.order('created_at', { ascending: true })

  if (error) {
    throw new Error(
      `Template query failed: ${error.message}. `
      + `This likely means the migration "20260329100000_template_tiers_and_versioning.sql" has not been applied. `
      + `Run it in the Supabase SQL Editor.`
    )
  }

  const combined = [...((data || []) as MaterialTemplate[]), ...syncedAssetTemplates]
  const uniqueTemplates = combined.filter((template, index, array) => array.findIndex((item) => item.id === template.id) === index)

  // Filter by stakeholder type — require explicit match, no empty = all
  const typeFiltered = uniqueTemplates.filter((template) => {
    if (template.stakeholder_types.length === 0) return true
    if (template.stakeholder_types.includes(stakeholderType)) return true
    if (stakeholderType === 'cause' && template.stakeholder_types.includes('community')) return true
    if (stakeholderType === 'school' && template.stakeholder_types.includes('community')) return true
    return false
  })

  // Hierarchical scope: Global → City → Campaign (union of all matching levels)
  const scopeFiltered = tier === 'auto' ? typeFiltered.filter((template) => {
    // Global templates always apply
    if (template.scope_global) return true
    // City-level templates apply if city matches
    const cityMatch = options?.cityId && template.scope_cities?.length && template.scope_cities.includes(options.cityId)
    // Campaign-level templates apply if campaign matches
    const campaignMatch = options?.campaignId && template.scope_campaigns?.length && template.scope_campaigns.includes(options.campaignId)
    // Category-level templates apply if category matches
    const categoryMatch = options?.businessCategory && template.scope_categories?.length && template.scope_categories.includes(options.businessCategory)
    // Unscoped templates (no scope set) are treated as global
    const noScope = !template.scope_cities?.length && !template.scope_campaigns?.length && !template.scope_categories?.length
    return cityMatch || campaignMatch || categoryMatch || noScope
  }) : typeFiltered

  // Apply template rules from the rules engine
  const rulesFiltered = await applyTemplateRules(supabase, scopeFiltered, stakeholderType, options?.cityId, options?.campaignId)

  if (['school', 'cause', 'community'].includes(stakeholderType)) {
    const nonFallbackTemplates = rulesFiltered.filter((template) => {
      const isLegacyFallback = /^(school|cause|community)-default-auto-template$/i.test(template.name)
      const isCoreCampaign = CORE_CAMPAIGN_TEMPLATE_NAMES.includes(template.name)
      return isCoreCampaign || !isLegacyFallback
    })
    const hasCoreCampaignTemplates = nonFallbackTemplates.some((template) => CORE_CAMPAIGN_TEMPLATE_NAMES.includes(template.name))
    if (hasCoreCampaignTemplates) {
      return nonFallbackTemplates
    }
  }

  if (rulesFiltered.length > 0) {
    return rulesFiltered
  }

  // Only fall back for auto tier
  if (tier === 'auto') {
    const fallbackTemplate = await ensureFallbackTemplateForStakeholderType(supabase, stakeholderType)
    return [fallbackTemplate]
  }

  return []
}

async function ensureFallbackTemplateForStakeholderType(
  supabase: ServiceSupabaseClient,
  stakeholderType: StakeholderType,
) {
  const fallbackName = `${stakeholderType}-default-auto-template`
  const { data: existing } = await supabase
    .from('material_templates')
    .select('*')
    .eq('name', fallbackName)
    .limit(1)

  const existingTemplate = ((existing || []) as MaterialTemplate[])[0]
  if (existingTemplate) return existingTemplate

  const fallbackMap: Record<StakeholderType, {
    audienceTags: string[]
    libraryFolder: MaterialTemplate['library_folder']
    eyebrow: string
    headline: string
    subheadline: string
    body: string
    cta: string
    footer: string
  }> = {
    business: {
      audienceTags: ['customers'],
      libraryFolder: 'share_with_customers',
      eyebrow: 'LocalVIP',
      headline: '{{stakeholder_name}}',
      subheadline: '{{capture_offer_headline}}',
      body: '{{capture_offer_description}}',
      cta: 'Scan to get your offer',
      footer: '{{support_label}}',
    },
    school: {
      audienceTags: ['parents'],
      libraryFolder: 'share_with_parents',
      eyebrow: 'Support Local',
      headline: 'Support {{stakeholder_name}}',
      subheadline: 'Simple support starts here',
      body: '{{capture_offer_description}}',
      cta: 'Scan to support',
      footer: '{{support_label}}',
    },
    cause: {
      audienceTags: ['parents'],
      libraryFolder: 'share_with_parents',
      eyebrow: 'Support Local',
      headline: 'Support {{stakeholder_name}}',
      subheadline: 'Simple support starts here',
      body: '{{capture_offer_description}}',
      cta: 'Scan to support',
      footer: '{{support_label}}',
    },
    community: {
      audienceTags: ['parents'],
      libraryFolder: 'share_with_parents',
      eyebrow: 'Support Local',
      headline: 'Support {{stakeholder_name}}',
      subheadline: 'Simple support starts here',
      body: '{{capture_offer_description}}',
      cta: 'Scan to support',
      footer: '{{support_label}}',
    },
    field: {
      audienceTags: ['outreach'],
      libraryFolder: 'share_with_businesses',
      eyebrow: 'LocalVIP Field Kit',
      headline: '{{stakeholder_name}}',
      subheadline: 'Use this to move local outreach forward',
      body: '{{support_label}}',
      cta: 'Scan to connect',
      footer: '{{display_url}}',
    },
    influencer: {
      audienceTags: ['parents'],
      libraryFolder: 'share_with_parents',
      eyebrow: 'Share LocalVIP',
      headline: '{{stakeholder_name}}',
      subheadline: 'Invite more people into something local',
      body: '{{support_label}}',
      cta: 'Scan to join',
      footer: '{{display_url}}',
    },
    launch_partner: {
      audienceTags: ['businesses'],
      libraryFolder: 'share_with_businesses',
      eyebrow: 'LocalVIP',
      headline: '{{stakeholder_name}}',
      subheadline: 'Grow your launch footprint',
      body: '{{support_label}}',
      cta: 'Scan to connect',
      footer: '{{display_url}}',
    },
  }

  const selected = fallbackMap[stakeholderType] || fallbackMap.business
  const { data, error } = await (supabase.from('material_templates') as any)
    .insert({
      name: fallbackName,
      source_path: null,
      template_type: 'structured',
      output_format: 'svg',
      audience_tags: selected.audienceTags,
      stakeholder_types: stakeholderType === 'school' ? ['school', 'community'] : stakeholderType === 'cause' ? ['cause', 'community'] : [stakeholderType],
      library_folder: selected.libraryFolder,
      qr_position_json: DEFAULT_QR_POSITION,
      is_active: true,
      tiers: ['auto'],
      version: 1,
      scope_global: true,
      scope_cities: [],
      scope_campaigns: [],
      scope_categories: [],
      created_by: null,
      metadata: {
        eyebrow: selected.eyebrow,
        headline: selected.headline,
        subheadline: selected.subheadline,
        body: selected.body,
        cta: selected.cta,
        footer: selected.footer,
        titlePattern: '{{stakeholder_name}} - Default Auto Material',
        descriptionPattern: '{{capture_offer_headline}}',
      },
    })
    .select()
    .single()

  if (error) {
    throw new Error(
      `Failed to create fallback template "${fallbackName}": ${error.message}. `
      + `Ensure the migration "20260329100000_template_tiers_and_versioning.sql" has been applied.`
    )
  }
  return data as MaterialTemplate
}

async function buildStakeholderMaterialContext(
  supabase: ServiceSupabaseClient,
  stakeholder: Stakeholder,
  codes: StakeholderCode,
): Promise<StakeholderMaterialContext> {
  const businessId = asUuid(stakeholder.business_id)
  const causeId = asUuid(stakeholder.cause_id)
  const profileId = asUuid(stakeholder.profile_id)
  const organizationId = asUuid(stakeholder.organization_id)
  const cityId = asUuid(stakeholder.city_id)

  const [business, cause, profile, organization, city] = await Promise.all([
    businessId ? getBusinessById(supabase, businessId) : Promise.resolve(null),
    causeId ? getCauseById(supabase, causeId) : Promise.resolve(null),
    profileId ? getProfileById(supabase, profileId) : Promise.resolve(null),
    organizationId ? getOrganizationById(supabase, organizationId) : Promise.resolve(null),
    cityId ? getCityById(supabase, cityId) : Promise.resolve(null),
  ])

  const offers = business ? await getOffersForBusiness(supabase, business.id) : []
  const captureOffer = business ? resolveBusinessOffer(business, offers, 'capture') : null
  const cashbackLabel = await getQaDealCashbackLabel(business)
  const brand = (business?.brand || cause?.brand || profile?.brand_context || 'localvip') as 'localvip' | 'hato'
  const ownerName = profile?.full_name || business?.name || cause?.name || stakeholder.name
  const cityName = city?.name || 'your city'
  const joinUrl = codes.join_url || (codes.connection_code ? buildStakeholderJoinUrl(stakeholder.type, codes.connection_code) : '')

  return {
    stakeholder,
    codes,
    business,
    cause,
    profile,
    organization,
    city,
    offers,
    brand,
    joinUrl,
    displayUrl: toDisplayUrl(joinUrl),
    ownerName,
    cityName,
    captureOfferHeadline: captureOffer?.headline || `Join ${stakeholder.name}`,
    captureOfferDescription: captureOffer?.description || getDefaultDescriptionForStakeholder(stakeholder),
    captureOfferValue: captureOffer?.value_label || '',
    cashbackLabel: cashbackLabel || 'LocalVIP cashback',
    supportLabel: getSupportLabel(stakeholder, cityName),
  }
}

async function ensureStakeholderQrCode(
  supabase: ServiceSupabaseClient,
  context: StakeholderMaterialContext,
  actorId: string | null,
) {
  const purpose = getQrPurposeForStakeholderType(context.stakeholder.type)
  const actorUuid = asUuid(actorId)
  const stakeholderProfileId = asUuid(await resolveStakeholderQrProfileId(supabase, context.stakeholder))
  const existing = await getStakeholderQrCode(supabase, context.stakeholder, purpose, stakeholderProfileId)
  // Use connection code directly as the redirect short code
  const redirectShortCode = normalizeStakeholderCode(context.codes.connection_code || '') || await ensureUniqueShortCode(supabase, context.codes.connection_code, null)
  const redirectUrl = `${getMaterialEngineBaseUrl()}/r/${redirectShortCode}`

  const payload = {
    name: `${context.stakeholder.name} QR`,
    short_code: redirectShortCode,
    destination_url: context.joinUrl,
    redirect_url: redirectUrl,
    brand: context.brand,
    logo_url: context.business?.logo_url || context.cause?.logo_url || null,
    foreground_color: context.brand === 'hato' ? '#ec8012' : '#2563eb',
    background_color: '#ffffff',
    frame_text: context.stakeholder.type === 'business' ? 'GET MY OFFER' : 'SCAN TO JOIN',
    campaign_id: context.business?.campaign_id || context.cause?.campaign_id || null,
    city_id: context.stakeholder.city_id,
    stakeholder_id: stakeholderProfileId,
    business_id: context.stakeholder.business_id,
    cause_id: context.stakeholder.cause_id,
    collection_id: null,
    destination_preset: purpose,
    scan_count: existing?.scan_count || 0,
    version: existing?.version || 1,
    status: 'active' as QrCode['status'],
    created_by: pickFirstUuid(actorUuid, context.stakeholder.owner_user_id, context.stakeholder.profile_id),
    metadata: {
      purpose,
      stakeholder_id: context.stakeholder.id,
      stakeholder_record_id: context.stakeholder.id,
      stakeholder_profile_id: stakeholderProfileId,
      stakeholder_type: context.stakeholder.type,
      connection_code: context.codes.connection_code,
      join_url: context.joinUrl,
      support_label: context.supportLabel,
      future_hooks: {
        sms_after_signup: false,
        email_confirmation: false,
        referral_tracking: false,
        stakeholder_variants: false,
      },
    },
  }

  let qrCodeId = existing?.id || null
  const oldShortCode = existing?.short_code || null

  if (qrCodeId) {
    const { error } = await (supabase.from('qr_codes') as any).update(payload).eq('id', qrCodeId)
    if (error) throw error

    // Clean up old redirect if the short code changed
    if (oldShortCode && oldShortCode !== redirectShortCode) {
      await (supabase.from('redirects') as any)
        .update({ status: 'inactive' })
        .eq('short_code', oldShortCode)
    }
  } else {
    const { data, error } = await (supabase.from('qr_codes') as any).insert(payload).select().single()
    if (error) throw error
    qrCodeId = (data as QrCode).id
  }

  await ensureRedirectRow(
    supabase,
    qrCodeId!,
    redirectShortCode,
    context.joinUrl,
    pickFirstUuid(actorUuid, context.stakeholder.owner_user_id, context.stakeholder.profile_id),
  )

  const { data, error } = await supabase.from('qr_codes').select('*').eq('id', qrCodeId!).single()
  if (error || !data) throw new Error('QR code could not be loaded after save.')
  const qrCode = data as QrCode

  // Verify the QR code was saved with the correct redirect URL
  if (qrCode.short_code !== redirectShortCode) {
    throw new Error(
      `QR code short_code mismatch: expected "${redirectShortCode}" but got "${qrCode.short_code}". `
      + `The QR code record may not have been updated correctly.`
    )
  }
  await syncLinkedStakeholderAssets(supabase, context.stakeholder, {
    qrCodeId: qrCode.id,
    materialId: null,
    generatedMaterialId: null,
  })
  return qrCode
}

async function ensureRedirectRow(
  supabase: ServiceSupabaseClient,
  qrCodeId: string,
  shortCode: string,
  destinationUrl: string,
  createdBy: string | null,
) {
  createdBy = asUuid(createdBy)
  const { data: redirect } = await supabase.from('redirects').select('*').eq('short_code', shortCode).maybeSingle()
  const redirectRecord = (redirect || null) as { id: string } | null

  if (redirectRecord) {
    await (supabase.from('redirects') as any)
      .update({ qr_code_id: qrCodeId, destination_url: destinationUrl, status: 'active' })
      .eq('id', redirectRecord.id)
    return
  }

  await (supabase.from('redirects') as any).insert({
    short_code: shortCode,
    destination_url: destinationUrl,
    qr_code_id: qrCodeId,
    click_count: 0,
    status: 'active',
    created_by: createdBy,
  })
}

async function ensureMaterialAssignment(
  supabase: ServiceSupabaseClient,
  materialId: string,
  stakeholderProfileId: string,
  actorId: string | null,
) {
  actorId = asUuid(actorId)
  const { data } = await supabase
    .from('material_assignments')
    .select('id')
    .eq('material_id', materialId)
    .eq('stakeholder_id', stakeholderProfileId)
    .maybeSingle()

  if (data) return

  await (supabase.from('material_assignments') as any).insert({
    material_id: materialId,
    stakeholder_id: stakeholderProfileId,
    assigned_by: actorId,
  })
}

async function syncLinkedStakeholderAssets(
  supabase: ServiceSupabaseClient,
  stakeholder: Stakeholder,
  input: {
    qrCodeId: string | null
    materialId: string | null
    generatedMaterialId: string | null
  },
) {
  if (stakeholder.business_id) {
    const patch: Record<string, unknown> = {}
    if (input.qrCodeId) patch.linked_qr_code_id = input.qrCodeId
    if (input.materialId) patch.linked_material_id = input.materialId

    if (Object.keys(patch).length > 0) {
      await (supabase.from('businesses') as any)
        .update(patch)
        .eq('id', stakeholder.business_id)
    }
  }

  if (stakeholder.cause_id && input.qrCodeId) {
    const { data } = await supabase
      .from('causes')
      .select('metadata')
      .eq('id', stakeholder.cause_id)
      .single()

    const metadata = ((data as { metadata?: Record<string, unknown> | null } | null)?.metadata || {}) as Record<string, unknown>
    await (supabase.from('causes') as any)
      .update({
        metadata: {
          ...metadata,
          linked_qr_code_id: input.qrCodeId,
          linked_generated_material_id: input.generatedMaterialId,
        },
      })
      .eq('id', stakeholder.cause_id)
  }
}

async function updateAdminTaskStatus(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  status: 'ready_to_generate' | 'generated' | 'failed',
  payload: Record<string, unknown>,
) {
  await (supabase.from('admin_tasks') as any)
    .update({ status, payload_json: payload })
    .eq('stakeholder_id', stakeholderId)
    .eq('task_type', 'stakeholder_setup')
}

async function getStakeholderById(supabase: ServiceSupabaseClient, stakeholderId: string) {
  const { data } = await supabase.from('stakeholders').select('*').eq('id', stakeholderId).single()
  return (data || null) as Stakeholder | null
}

async function getStakeholderCode(supabase: ServiceSupabaseClient, stakeholderId: string) {
  const { data } = await supabase
    .from('stakeholder_codes')
    .select('*')
    .eq('stakeholder_id', stakeholderId)
    .maybeSingle()
  return (data || null) as StakeholderCode | null
}

async function findStakeholderCodeConflict(
  supabase: ServiceSupabaseClient,
  column: 'referral_code' | 'connection_code',
  value: string,
  stakeholderId: string,
) {
  // Deliberately NOT maybeSingle(): that throws when more than one row matches, so a
  // stale/duplicate stakeholder_codes row turned a survivable situation into a hard
  // failure ("code already in use") that also aborted QR provisioning. Fetch a small
  // page instead and filter in JS so duplicates degrade into a normal conflict answer.
  const { data } = await supabase
    .from('stakeholder_codes')
    .select('stakeholder_id')
    .ilike(column, value)
    .limit(10)

  const rows = (data || []) as Array<{ stakeholder_id: string | null }>
  // Exclude our own row(s) — a stakeholder must never collide with itself. Rows with no
  // stakeholder_id are orphans we cannot name; leave those to the DB unique constraint,
  // which already produces a specific message via getStakeholderCodeSaveErrorMessage.
  const conflict = rows.find((row) => row.stakeholder_id && row.stakeholder_id !== stakeholderId)
  return conflict?.stakeholder_id || null
}

function getStakeholderCodeSaveErrorMessage(error: unknown, action: 'insert' | 'update') {
  if (error && typeof error === 'object') {
    const value = error as { code?: string; message?: string; details?: string }
    if (value.code === '23505') {
      const detail = `${value.details || value.message || ''}`.toLowerCase()
      if (detail.includes('referral_code')) {
        return 'That referral code is already in use.'
      }
      if (detail.includes('connection_code')) {
        return 'That connection code is already in use.'
      }
      return 'These codes must be unique. One of them is already in use.'
    }
    if (value.message) {
      return value.message
    }
  }

  return action === 'insert'
    ? 'Could not save stakeholder codes.'
    : 'Could not update stakeholder codes.'
}

async function getGeneratedMaterialByStakeholderTemplate(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  templateId: string,
) {
  const { data } = await supabase
    .from('generated_materials')
    .select('*')
    .eq('stakeholder_id', stakeholderId)
    .eq('template_id', templateId)
    .maybeSingle()
  return (data || null) as GeneratedMaterial | null
}

async function getStakeholderQrCode(
  supabase: ServiceSupabaseClient,
  stakeholder: Stakeholder,
  purpose: string,
  stakeholderProfileId: string | null,
) {
  const candidates: QrCode[] = []

  if (stakeholder.business_id) {
    const { data } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('business_id', stakeholder.business_id)
      .order('created_at', { ascending: false })
      .limit(20)
    candidates.push(...((data || []) as QrCode[]))
  }

  if (stakeholder.cause_id) {
    const { data } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('cause_id', stakeholder.cause_id)
      .order('created_at', { ascending: false })
      .limit(20)
    candidates.push(...((data || []) as QrCode[]))
  }

  if (stakeholderProfileId) {
    const { data } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('stakeholder_id', stakeholderProfileId)
      .order('created_at', { ascending: false })
      .limit(20)
    candidates.push(...((data || []) as QrCode[]))
  }

  const unique = candidates.filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index)

  return unique.find((item) => {
    const metadata = (item.metadata as Record<string, unknown> | null) || {}
    return metadata.purpose === purpose
      && (
        metadata.stakeholder_record_id === stakeholder.id
        || item.business_id === stakeholder.business_id
        || item.cause_id === stakeholder.cause_id
      )
  }) || null
}

async function ensureMaterialsBucket(supabase: ServiceSupabaseClient) {
  if (materialsBucketPrepared) return

  const storage = supabase.storage as any
  const bucketName = 'materials'
  const { data, error } = await storage.getBucket(bucketName)

  if (!error && data) {
    materialsBucketPrepared = true
    return
  }

  const createResult = await storage.createBucket(bucketName, { public: true })

  if (createResult.error && !String(createResult.error.message || '').toLowerCase().includes('already exists')) {
    throw new Error(`The materials storage bucket is not ready: ${createResult.error.message}`)
  }

  materialsBucketPrepared = true
}

async function buildDefaultStakeholderCodes(
  supabase: ServiceSupabaseClient,
  stakeholder: Stakeholder,
  existingCodes: StakeholderCode | null,
) {
  const baseSeed = normalizeStakeholderCode(stakeholder.name)
    || normalizeStakeholderCode(`${stakeholder.type}-${generateShortCode(6)}`)
    || `lv-${generateShortCode(6).toLowerCase()}`

  const referralCode = existingCodes?.referral_code || await ensureUniqueStakeholderCodeValue(
    supabase,
    'referral_code',
    baseSeed,
    stakeholder.id,
  )
  const connectionCode = existingCodes?.connection_code || await ensureUniqueStakeholderCodeValue(
    supabase,
    'connection_code',
    baseSeed,
    stakeholder.id,
  )

  return { referralCode, connectionCode }
}

async function ensureUniqueStakeholderCodeValue(
  supabase: ServiceSupabaseClient,
  column: 'referral_code' | 'connection_code',
  preferredSeed: string,
  stakeholderId: string,
) {
  const preferred = normalizeStakeholderCode(preferredSeed) || `lv-${generateShortCode(6).toLowerCase()}`
  const preferredConflict = await findStakeholderCodeConflict(supabase, column, preferred, stakeholderId)
  if (!preferredConflict) return preferred

  const base = preferred.slice(0, 40) || 'lv'
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const candidate = normalizeStakeholderCode(`${base}-${generateShortCode(4).toLowerCase()}`)
    if (!candidate) continue
    const conflict = await findStakeholderCodeConflict(supabase, column, candidate, stakeholderId)
    if (!conflict) return candidate
  }

  return normalizeStakeholderCode(`lv-${generateShortCode(8).toLowerCase()}`) || preferred
}

async function getBusinessById(supabase: ServiceSupabaseClient, id: string) {
  const businessId = asUuid(id)
  if (!businessId) return null
  const { data } = await supabase.from('businesses').select('*').eq('id', businessId).single()
  return (data || null) as Business | null
}

async function getCauseById(supabase: ServiceSupabaseClient, id: string) {
  const causeId = asUuid(id)
  if (!causeId) return null
  const { data } = await supabase.from('causes').select('*').eq('id', causeId).single()
  return (data || null) as Cause | null
}

async function getProfileById(supabase: ServiceSupabaseClient, id: string) {
  const profileId = asUuid(id)
  if (!profileId) return null
  const { data } = await supabase.from('profiles').select('*').eq('id', profileId).single()
  return (data || null) as Profile | null
}

async function getOrganizationById(supabase: ServiceSupabaseClient, id: string) {
  const organizationId = asUuid(id)
  if (!organizationId) return null
  const { data } = await supabase.from('organizations').select('*').eq('id', organizationId).single()
  return (data || null) as Organization | null
}

async function getCityById(supabase: ServiceSupabaseClient, id: string) {
  const cityId = asUuid(id)
  if (!cityId) return null
  const { data } = await supabase.from('cities').select('*').eq('id', cityId).single()
  return (data || null) as City | null
}

async function getOffersForBusiness(supabase: ServiceSupabaseClient, businessId: string) {
  const { data } = await supabase.from('offers').select('*').eq('business_id', businessId)
  return (data || []) as Offer[]
}

async function resolveStakeholderLibraryProfileId(
  supabase: ServiceSupabaseClient,
  stakeholder: Stakeholder,
) {
  const directStakeholderProfileId = pickFirstUuid(stakeholder.profile_id, stakeholder.owner_user_id)
  if (directStakeholderProfileId) return directStakeholderProfileId

  if (stakeholder.business_id) {
    const business = await getBusinessById(supabase, stakeholder.business_id)
    return pickFirstUuid(business?.owner_user_id, business?.owner_id)
  }

  if (stakeholder.cause_id) {
    const cause = await getCauseById(supabase, stakeholder.cause_id)
    return asUuid(cause?.owner_id)
  }

  return null
}

async function resolveStakeholderQrProfileId(
  supabase: ServiceSupabaseClient,
  stakeholder: Stakeholder,
) {
  return resolveStakeholderLibraryProfileId(supabase, stakeholder)
}

async function ensureUniqueShortCode(
  supabase: ServiceSupabaseClient,
  preferredCode: string | null,
  existingCode: string | null,
) {
  if (existingCode) return existingCode

  const preferred = normalizeStakeholderCode(preferredCode || '')
  if (preferred) {
    const { data } = await supabase.from('redirects').select('id').eq('short_code', preferred).maybeSingle()
    if (!data) return preferred
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = `${preferred.slice(0, 10) || 'lv'}-${generateShortCode(5).toLowerCase()}`
    const { data } = await supabase.from('redirects').select('id').eq('short_code', candidate).maybeSingle()
    if (!data) return candidate
  }

  return generateShortCode(8).toLowerCase()
}

function getSupportLabel(stakeholder: Stakeholder, cityName: string) {
  if (stakeholder.type === 'business') return `Used to get your first 100 customers in ${cityName}`
  if (stakeholder.type === 'school') return `Support families and classrooms in ${cityName}`
  if (stakeholder.type === 'cause' || stakeholder.type === 'community') return `Support this local cause in ${cityName}`
  if (stakeholder.type === 'launch_partner') return `Grow your city launch in ${cityName}`
  return `Built for LocalVIP growth in ${cityName}`
}

function getDefaultDescriptionForStakeholder(stakeholder: Stakeholder) {
  if (stakeholder.type === 'business') return 'Join our list and be part of something local.'
  if (stakeholder.type === 'school') return 'Support this school by taking one simple step today.'
  if (stakeholder.type === 'cause' || stakeholder.type === 'community') {
    return 'Join this local cause and help grow community support.'
  }
  return 'Connect with this LocalVIP stakeholder and take the next step.'
}

function getEntityMetadata(context: StakeholderMaterialContext) {
  const records = [
    context.cause?.metadata,
    context.business?.metadata,
    context.organization?.metadata,
    context.stakeholder.metadata,
  ]

  for (const record of records) {
    if (record && typeof record === 'object') return record as Record<string, unknown>
  }

  return {} as Record<string, unknown>
}

function readMetadataString(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

function getStakeholderKindLabel(context: StakeholderMaterialContext) {
  if (context.cause?.type === 'school' || context.stakeholder.type === 'school') return 'school'
  if (context.cause?.type === 'church') return 'church'
  if (context.stakeholder.type === 'cause' || context.stakeholder.type === 'community') return 'cause'
  return context.stakeholder.type
}

function getCampaignTokenValues(context: StakeholderMaterialContext) {
  const metadata = getEntityMetadata(context)
  const stakeholderKind = getStakeholderKindLabel(context)
  const shortName = readMetadataString(metadata, 'short_name', 'community_short_name', 'school_short_name')
    || context.stakeholder.name
  const supportFocus = readMetadataString(metadata, 'support_focus', 'campaign_support_focus', 'team_label')
    || (stakeholderKind === 'school' ? 'our school' : 'our community')
  const communityGroup = readMetadataString(metadata, 'community_group', 'supporter_group', 'family_group')
    || (stakeholderKind === 'school'
      ? 'families, supporters, and booster families'
      : 'supporters and community members')
  const peerGroupLabel = readMetadataString(metadata, 'peer_group_label', 'peer_group', 'school_outreach_label')
    || (stakeholderKind === 'school' ? 'YOUR SCHOOL' : 'YOUR ORGANIZATION')

  return {
    community_short_name: shortName,
    support_focus: supportFocus,
    community_group: communityGroup,
    peer_group_label: peerGroupLabel,
    stakeholder_kind_label: stakeholderKind,
  }
}

function parseTemplateCards(raw: unknown) {
  if (!Array.isArray(raw)) return [] as FilledTemplateCard[]
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const title = typeof record.title === 'string' ? record.title : ''
      const body = typeof record.body === 'string' ? record.body : ''
      if (!title.trim() && !body.trim()) return null
      return { title, body }
    })
    .filter((entry): entry is FilledTemplateCard => !!entry)
}

function fillTemplateCards(
  cards: FilledTemplateCard[],
  valueMap: Record<string, string | null | undefined>,
) {
  return cards.map((card) => ({
    title: fillTemplateText(card.title, valueMap),
    body: fillTemplateText(card.body, valueMap),
  }))
}

function getTemplateBranding(context: StakeholderMaterialContext) {
  const metadata = getEntityMetadata(context)
  const raw = metadata.template_branding
  const source = raw && typeof raw === 'object' ? raw as Record<string, unknown> : metadata
  const readColor = (...keys: string[]) => {
    for (const key of keys) {
      const value = source[key]
      if (typeof value === 'string' && value.trim()) return value.trim()
    }
    return undefined
  }

  return {
    accent: readColor('primaryColor', 'primary_color', 'accentColor', 'accent_color'),
    soft: readColor('secondaryColor', 'secondary_color', 'highlightColor', 'highlight_color'),
    background: readColor('backgroundColor', 'background_color'),
    panel: readColor('panelColor', 'panel_color'),
    text: readColor('textColor', 'text_color'),
  }
}

function getTemplateCopy(template: MaterialTemplate): TemplateCopyDefinition {
  const metadata = (template.metadata as Record<string, unknown> | null) || {}
  return {
    eyebrow: `${metadata.eyebrow || 'LocalVIP'}`,
    headline: `${metadata.headline || '{{stakeholder_name}}'}`,
    subheadline: `${metadata.subheadline || '{{capture_offer_headline}}'}`,
    body: `${metadata.body || '{{capture_offer_description}}'}`,
    comparisonSummary: metadata.comparisonSummary ? `${metadata.comparisonSummary}` : undefined,
    cta: `${metadata.cta || 'Scan to get started'}`,
    footer: `${metadata.footer || '{{support_label}}'}`,
    qrCaption: `${metadata.qrCaption || 'Scan with your phone'}`,
    noteHeadline: metadata.noteHeadline ? `${metadata.noteHeadline}` : undefined,
    layoutStyle: metadata.layoutStyle === 'comparison_master' ? 'comparison_master' : undefined,
    titlePattern: `${metadata.titlePattern || '{{stakeholder_name}} - {{template_name}}'}`,
    descriptionPattern: `${metadata.descriptionPattern || '{{capture_offer_headline}}'}`,
    sectionLabel: metadata.sectionLabel ? `${metadata.sectionLabel}` : undefined,
    sectionTitle: metadata.sectionTitle ? `${metadata.sectionTitle}` : undefined,
    sectionBody: metadata.sectionBody ? `${metadata.sectionBody}` : undefined,
    proofLabel: metadata.proofLabel ? `${metadata.proofLabel}` : undefined,
    ctaSubline: metadata.ctaSubline ? `${metadata.ctaSubline}` : undefined,
    footerBadges: Array.isArray(metadata.footerBadges)
      ? metadata.footerBadges.map((item) => `${item}`)
      : undefined,
    steps: parseTemplateCards(metadata.steps),
    proofItems: parseTemplateCards(metadata.proofItems),
    accentColor: metadata.accentColor ? `${metadata.accentColor}` : undefined,
    highlightColor: metadata.highlightColor ? `${metadata.highlightColor}` : undefined,
    backgroundColor: metadata.backgroundColor ? `${metadata.backgroundColor}` : undefined,
    panelColor: metadata.panelColor ? `${metadata.panelColor}` : undefined,
    textColor: metadata.textColor ? `${metadata.textColor}` : undefined,
    variant: (metadata.variant as TemplateCopyDefinition['variant']) || 'poster',
    canvasWidth: typeof metadata.canvasWidth === 'number' ? metadata.canvasWidth : undefined,
    canvasHeight: typeof metadata.canvasHeight === 'number' ? metadata.canvasHeight : undefined,
  }
}

function getTemplateValueMap(context: StakeholderMaterialContext) {
  const campaignValues = getCampaignTokenValues(context)
  return {
    stakeholder_name: context.stakeholder.name,
    stakeholder_type: context.stakeholder.type,
    city_name: context.cityName,
    owner_name: context.ownerName,
    capture_offer_headline: context.captureOfferHeadline,
    capture_offer_description: context.captureOfferDescription,
    capture_offer_value: context.captureOfferValue,
    cashback_label: context.cashbackLabel,
    support_label: context.supportLabel,
    join_url: context.joinUrl,
    display_url: context.displayUrl,
    referral_code: context.codes.referral_code,
    connection_code: context.codes.connection_code,
    business_name: context.business?.name || context.stakeholder.name,
    cause_name: context.cause?.name || context.stakeholder.name,
    organization_name: context.organization?.name || context.stakeholder.name,
    template_name: '',
    ...campaignValues,
  }
}

function renderStructuredTemplateSvg(
  template: MaterialTemplate,
  context: StakeholderMaterialContext,
  qrDataUrl: string,
) {
  const renderState = buildStructuredTemplateRenderState(template, context)
  const {
    copy,
    valueMap,
    qrPosition,
    width,
    height,
    palette,
    headlineLines,
    subheadlineLines,
    bodyLines,
    footerLines,
  } = renderState
  const coverPhotoFallback = context.business?.cover_photo_url || context.cause?.cover_photo_url || null
  const backgroundImageSrc = template.source_path || coverPhotoFallback
  const backgroundImage = backgroundImageSrc
    ? `<image href="${escapeXml(backgroundImageSrc)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity="0.18" />`
    : ''

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none">
  <defs>
    <linearGradient id="heroGradient" x1="0" y1="0" x2="${width}" y2="${height}">
      <stop offset="0%" stop-color="${palette.background}" />
      <stop offset="100%" stop-color="${palette.soft}" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${height}" rx="36" fill="url(#heroGradient)" />
  ${backgroundImage}
  <rect x="48" y="52" width="${width - 96}" height="${height - 104}" rx="32" fill="${palette.panel}" />
  <rect x="48" y="52" width="${width - 96}" height="320" rx="32" fill="${palette.accent}" />
  <rect x="48" y="332" width="${width - 96}" height="40" fill="${palette.accent}" />
  <text x="88" y="110" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#ffffff" letter-spacing="3">${escapeXml(fillTemplateText(copy.eyebrow, valueMap).toUpperCase())}</text>
  ${renderTextBlock(headlineLines, 88, 168, 66, '#ffffff', 700)}
  ${renderTextBlock(subheadlineLines, 88, 420, 38, '#f8fafc', 600)}
  <rect x="88" y="516" width="${width - 176}" height="360" rx="28" fill="${palette.soft}" />
  ${renderTextBlock(bodyLines, 124, 588, 34, palette.text, 500)}
  <rect x="${qrPosition.x - 12}" y="${qrPosition.y - 12}" width="${qrPosition.width + 24}" height="${qrPosition.height + 24}" rx="28" fill="#ffffff" stroke="${palette.accent}" stroke-width="8" />
  <image href="${escapeXml(qrDataUrl)}" x="${qrPosition.x}" y="${qrPosition.y}" width="${qrPosition.width}" height="${qrPosition.height}" preserveAspectRatio="xMidYMid meet" />
  <text x="${qrPosition.x + (qrPosition.width / 2)}" y="${qrPosition.y + qrPosition.height + 42}" text-anchor="middle" font-family="Arial, sans-serif" font-size="24" font-weight="700" fill="${palette.text}">${escapeXml(fillTemplateText(copy.qrCaption, valueMap))}</text>
  <rect x="88" y="${height - 232}" width="${width - 420}" height="112" rx="26" fill="${palette.accent}" />
  <text x="124" y="${height - 164}" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#ffffff">${escapeXml(fillTemplateText(copy.cta, valueMap))}</text>
  ${renderTextBlock(footerLines, 88, height - 76, 24, palette.text, 500)}
</svg>`.trim()
}

async function renderStructuredTemplatePng(
  template: MaterialTemplate,
  context: StakeholderMaterialContext,
  qrDataUrl: string,
) {
  const { createCanvas, loadImage } = getRuntimeCanvasModule()
  const renderState = buildStructuredTemplateRenderState(template, context)
  const { width, height } = renderState
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  const coverPhotoFallback = context.business?.cover_photo_url || context.cause?.cover_photo_url || null

  await drawStructuredTemplateOnContext(ctx, template, renderState, qrDataUrl, loadImage, coverPhotoFallback)

  return canvas.toBuffer('image/png')
}

async function renderStructuredTemplatePdf(
  template: MaterialTemplate,
  context: StakeholderMaterialContext,
  qrDataUrl: string,
) {
  const { PDFDocument, loadImage } = getRuntimeCanvasModule()
  const renderState = buildStructuredTemplateRenderState(template, context)
  const { width, height, qrPosition } = renderState
  const pdf = new PDFDocument({
    title: `${context.stakeholder.name} - ${template.name}`,
    author: context.ownerName,
    creator: 'LocalVIP Material Engine',
    producer: 'LocalVIP Material Engine',
    rasterDPI: 144,
    encodingQuality: 101,
    compressionLevel: 6,
  })
  const ctx = pdf.beginPage(width, height)
  const coverPhotoFallback = context.business?.cover_photo_url || context.cause?.cover_photo_url || null

  await drawStructuredTemplateOnContext(ctx, template, renderState, qrDataUrl, loadImage, coverPhotoFallback)

  if (typeof ctx.annotateLinkUrl === 'function') {
    ctx.annotateLinkUrl(
      qrPosition.x - 12,
      qrPosition.y - 12,
      qrPosition.x + qrPosition.width + 12,
      qrPosition.y + qrPosition.height + 12,
      context.joinUrl,
    )
    ctx.annotateLinkUrl(88, height - 232, width - 332, height - 120, context.joinUrl)
  }

  pdf.endPage()
  return pdf.close()
}

function buildStructuredTemplateRenderState(
  template: MaterialTemplate,
  context: StakeholderMaterialContext,
): StructuredTemplateRenderState {
  const copy = getTemplateCopy(template)
  const valueMap = { ...getTemplateValueMap(context), template_name: template.name }
  const qrPosition = normalizeQrPosition(template.qr_position_json)
  const width = copy.canvasWidth || qrPosition.canvas_width || DEFAULT_QR_POSITION.canvas_width
  const height = copy.canvasHeight || qrPosition.canvas_height || DEFAULT_QR_POSITION.canvas_height
  const palette = getPalette(context.brand, copy, context)

  return {
    copy,
    valueMap,
    qrPosition,
    width,
    height,
    palette,
    headlineLines: copy.variant === 'campaign_sheet'
      ? wrapText(fillTemplateText(copy.headline, valueMap), 22).slice(0, 4)
      : wrapText(fillTemplateText(copy.headline, valueMap), 18),
    subheadlineLines: copy.variant === 'campaign_sheet'
      ? wrapText(fillTemplateText(copy.subheadline, valueMap), 34).slice(0, 3)
      : wrapText(fillTemplateText(copy.subheadline, valueMap), 24),
    bodyLines: wrapText(fillTemplateText(copy.body, valueMap), 44),
    footerLines: wrapText(fillTemplateText(copy.footer, valueMap), 36),
    noteHeadlineLines: wrapText(fillTemplateText(copy.noteHeadline || '', valueMap), 38),
    sectionLabel: fillTemplateText(copy.sectionLabel || '', valueMap),
    sectionTitleLines: wrapText(fillTemplateText(copy.sectionTitle || '', valueMap), 26),
    sectionBodyLines: wrapText(fillTemplateText(copy.sectionBody || '', valueMap), 46),
    proofLabel: fillTemplateText(copy.proofLabel || '', valueMap),
    ctaSublineLines: wrapText(fillTemplateText(copy.ctaSubline || '', valueMap), 40),
    steps: fillTemplateCards(copy.steps || [], valueMap),
    proofItems: fillTemplateCards(copy.proofItems || [], valueMap),
    footerBadges: (copy.footerBadges || []).map((badge) => fillTemplateText(badge, valueMap)),
    primaryLogoUrl: context.cause?.logo_url || context.business?.logo_url || null,
    primaryMark: context.stakeholder.name,
    secondaryMark: context.brand === 'hato' ? 'POWERED BY HATO' : 'POWERED BY LOCALVIP',
  }
}

async function drawStructuredTemplateOnContext(
  ctx: any,
  template: MaterialTemplate,
  renderState: StructuredTemplateRenderState,
  qrDataUrl: string,
  loadImage: RuntimeCanvasModule['loadImage'],
  coverPhotoUrl?: string | null,
) {
  const {
    copy,
    valueMap,
    qrPosition,
    width,
    height,
    palette,
    headlineLines,
    subheadlineLines,
    bodyLines,
    footerLines,
    sectionLabel,
    sectionTitleLines,
    sectionBodyLines,
    proofLabel,
    ctaSublineLines,
    noteHeadlineLines,
    steps,
    proofItems,
    footerBadges,
    primaryLogoUrl,
    primaryMark,
    secondaryMark,
  } = renderState

  if (copy.variant === 'campaign_sheet') {
    await drawCampaignSheetOnContext(ctx, {
      copy,
      palette,
      width,
      height,
      headlineLines,
      subheadlineLines,
      sectionLabel,
      sectionTitleLines,
      sectionBodyLines,
      proofLabel,
      ctaSublineLines,
      noteHeadlineLines,
      steps,
      proofItems,
      footerBadges,
      qrPosition,
      qrDataUrl,
      loadImage,
      coverPhotoUrl: template.source_path || coverPhotoUrl || null,
      primaryLogoUrl,
      primaryMark,
      secondaryMark,
      valueMap,
    })
    return
  }

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height)
  backgroundGradient.addColorStop(0, palette.background)
  backgroundGradient.addColorStop(1, palette.soft)
  ctx.fillStyle = backgroundGradient
  ctx.fillRect(0, 0, width, height)

  const backgroundImageSrc = template.source_path || coverPhotoUrl || null
  if (backgroundImageSrc) {
    try {
      const backgroundImage = await loadImage(backgroundImageSrc)
      ctx.save()
      ctx.globalAlpha = 0.18
      drawCoverImage(ctx, backgroundImage, width, height)
      ctx.restore()
    } catch {
      // Ignore background image failures and continue with the structured template.
    }
  }

  roundRect(ctx, 48, 52, width - 96, height - 104, 32, palette.panel)
  roundRect(ctx, 48, 52, width - 96, 320, 32, palette.accent)
  ctx.fillStyle = palette.accent
  ctx.fillRect(48, 332, width - 96, 40)

  ctx.fillStyle = '#ffffff'
  ctx.font = '700 26px Arial'
  ctx.fillText(fillTemplateText(copy.eyebrow, valueMap).toUpperCase(), 88, 110)

  drawTextBlockCanvas(ctx, headlineLines, 88, 168, 66, '#ffffff', 700)
  drawTextBlockCanvas(ctx, subheadlineLines, 88, 420, 38, '#f8fafc', 600)

  roundRect(ctx, 88, 516, width - 176, 360, 28, palette.soft)
  drawTextBlockCanvas(ctx, bodyLines, 124, 588, 34, palette.text, 500)

  roundRectWithStroke(
    ctx,
    qrPosition.x - 12,
    qrPosition.y - 12,
    qrPosition.width + 24,
    qrPosition.height + 24,
    28,
    '#ffffff',
    palette.accent,
    8,
  )

  const qrImage = await loadImage(qrDataUrl)
  ctx.drawImage(qrImage, qrPosition.x, qrPosition.y, qrPosition.width, qrPosition.height)

  ctx.fillStyle = palette.text
  ctx.textAlign = 'center'
  ctx.font = '700 24px Arial'
  ctx.fillText(fillTemplateText(copy.qrCaption, valueMap), qrPosition.x + (qrPosition.width / 2), qrPosition.y + qrPosition.height + 42)
  ctx.textAlign = 'start'

  roundRect(ctx, 88, height - 232, width - 420, 112, 26, palette.accent)
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 34px Arial'
  ctx.fillText(fillTemplateText(copy.cta, valueMap), 124, height - 164)

  drawTextBlockCanvas(ctx, footerLines, 88, height - 76, 24, palette.text, 500)
}

async function drawCampaignSheetOnContext(
  ctx: any,
  input: {
    copy: TemplateCopyDefinition
    palette: ReturnType<typeof getPalette>
    width: number
    height: number
    headlineLines: string[]
    subheadlineLines: string[]
    sectionLabel: string
    sectionTitleLines: string[]
    sectionBodyLines: string[]
    proofLabel: string
    ctaSublineLines: string[]
    noteHeadlineLines: string[]
    steps: FilledTemplateCard[]
    proofItems: FilledTemplateCard[]
    footerBadges: string[]
    qrPosition: StructuredTemplateRenderState['qrPosition']
    qrDataUrl: string
    loadImage: RuntimeCanvasModule['loadImage']
    coverPhotoUrl: string | null
    primaryLogoUrl: string | null
    primaryMark: string
    secondaryMark: string
    valueMap: Record<string, string | null | undefined>
  },
) {
  const {
    copy,
    palette,
    width,
    height,
    headlineLines,
    subheadlineLines,
    sectionLabel,
    sectionTitleLines,
    sectionBodyLines,
    proofLabel,
    ctaSublineLines,
    noteHeadlineLines,
    steps,
    proofItems,
    footerBadges,
    qrPosition,
    qrDataUrl,
    loadImage,
    coverPhotoUrl,
    primaryLogoUrl,
    primaryMark,
    secondaryMark,
    valueMap,
  } = input

  if (copy.layoutStyle === 'comparison_master') {
    await drawComparisonMasterCampaignSheetOnContext(ctx, input)
    return
  }

  const navy = palette.accent
  const gold = '#ddab3d'
  const ink = '#14213f'
  const muted = '#4d5a77'
  const paper = '#fbfaf6'
  const sheet = '#ffffff'

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height)
  backgroundGradient.addColorStop(0, paper)
  backgroundGradient.addColorStop(1, '#f4f6fb')
  ctx.fillStyle = backgroundGradient
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.strokeStyle = 'rgba(20, 33, 63, 0.035)'
  ctx.lineWidth = 2
  for (let offset = -height; offset < width; offset += 34) {
    ctx.beginPath()
    ctx.moveTo(offset, 0)
    ctx.lineTo(offset + height, height)
    ctx.stroke()
  }
  ctx.restore()

  if (coverPhotoUrl) {
    try {
      const backgroundImage = await loadImage(coverPhotoUrl)
      ctx.save()
      ctx.globalAlpha = 0.05
      drawCoverImage(ctx, backgroundImage, width, height)
      ctx.restore()
    } catch {}
  }

  ctx.save()
  ctx.shadowColor = 'rgba(20, 33, 63, 0.10)'
  ctx.shadowBlur = 24
  roundRect(ctx, 36, 34, width - 72, height - 68, 18, sheet)
  ctx.restore()

  const brandTop = 84
  const brandDividerX = width / 2
  const eyebrow = fillTemplateText(copy.eyebrow, valueMap).toUpperCase()
  const normalizedEyebrow = eyebrow.replace(/\s+/g, ' ').trim()
  const normalizedPrimaryMark = primaryMark.toUpperCase().replace(/\s+/g, ' ').trim()
  const showEyebrow = normalizedEyebrow && normalizedEyebrow !== normalizedPrimaryMark
  const primaryMarkLines = wrapText(primaryMark, 24).slice(0, 3)

  await drawCampaignLogo(ctx, loadImage, primaryLogoUrl, primaryMark, 86, brandTop, 96, '#ffffff', navy)

  ctx.fillStyle = ink
  ctx.font = '700 23px Arial'
  primaryMarkLines.forEach((line, index) => {
    ctx.fillText(line.toUpperCase(), 200, 110 + (index * 28))
  })
  if (showEyebrow) {
    ctx.fillStyle = muted
    ctx.font = '600 15px Arial'
    ctx.fillText(eyebrow, 200, 110 + (primaryMarkLines.length * 28) + 8)
  }

  ctx.save()
  ctx.strokeStyle = 'rgba(20, 33, 63, 0.15)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(brandDividerX, 82)
  ctx.lineTo(brandDividerX, 176)
  ctx.stroke()
  ctx.restore()

  ctx.textAlign = 'right'
  ctx.fillStyle = ink
  ctx.font = '700 26px Arial'
  ctx.fillText('LOCALVIP', width - 90, 118)
  ctx.fillStyle = gold
  ctx.beginPath()
  ctx.arc(width - 220, 106, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = muted
  ctx.font = '600 14px Arial'
  ctx.fillText(secondaryMark, width - 90, 144)
  ctx.textAlign = 'start'

  const heroTop = 214
  drawCenteredTextBlockCanvas(ctx, headlineLines.slice(0, 4), width / 2, heroTop, 56, ink, 800)

  const subheadlineStartY = heroTop + (headlineLines.slice(0, 4).length * 56) + 22
  const subheadlineVisible = subheadlineLines.slice(0, 2)
  const dividerY = subheadlineStartY - 14
  ctx.save()
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(92, dividerY)
  ctx.lineTo(234, dividerY)
  ctx.moveTo(width - 234, dividerY)
  ctx.lineTo(width - 92, dividerY)
  ctx.stroke()
  ctx.restore()
  drawCenteredTextBlockCanvas(ctx, subheadlineVisible, width / 2, subheadlineStartY, 24, muted, 600)

  const panelTop = 450
  const panelWidth = 422
  const panelHeight = 452
  const leftX = 54
  const rightX = width - panelWidth - 54
  drawCampaignComparisonPanel(ctx, {
    x: leftX,
    y: panelTop,
    width: panelWidth,
    height: panelHeight,
    header: sectionLabel || 'HOW IT WORKS',
    items: steps,
    accent: navy,
    ink,
    muted,
    side: 'left',
    gold,
  })
  drawCampaignComparisonPanel(ctx, {
    x: rightX,
    y: panelTop,
    width: panelWidth,
    height: panelHeight,
    header: proofLabel || 'WHY IT MATTERS',
    items: proofItems,
    accent: navy,
    ink,
    muted,
    side: 'right',
    gold,
  })

  ctx.save()
  ctx.shadowColor = 'rgba(20, 33, 63, 0.12)'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(width / 2, panelTop + 226, 34, 0, Math.PI * 2)
  ctx.fillStyle = navy
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.arc(width / 2, panelTop + 226, 34, 0, Math.PI * 2)
  ctx.lineWidth = 4
  ctx.strokeStyle = gold
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 22px Arial'
  ctx.fillText('VS.', width / 2, panelTop + 234)
  ctx.textAlign = 'start'

  const noteTop = 926
  const noteHeight = 124
  roundRect(ctx, 76, noteTop, width - 152, noteHeight, 18, '#fffdf8')
  ctx.save()
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(190, noteTop + 22)
  ctx.lineTo(190, noteTop + noteHeight - 22)
  ctx.stroke()
  ctx.restore()
  await drawCampaignLogo(ctx, loadImage, primaryLogoUrl, primaryMark, 96, noteTop + 26, 72, '#fff9ec', gold)
  const visibleNoteHeadlineLines = noteHeadlineLines.slice(0, 2)
  drawTextBlockCanvas(ctx, visibleNoteHeadlineLines, 216, noteTop + 42, 22, ink, 700)
  const noteBodyStartY = noteTop + 42 + (visibleNoteHeadlineLines.length * 22) + 12
  drawTextBlockCanvas(ctx, wrapText(fillTemplateText(copy.footer, valueMap), 62).slice(0, 3), 216, noteBodyStartY, 18, muted, 500)

  const bandTop = 1084
  const bandHeight = 172
  roundRect(ctx, 56, bandTop, width - 112, bandHeight, 14, navy)
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)'
  ctx.lineWidth = 2
  for (let offset = -40; offset < width; offset += 24) {
    ctx.beginPath()
    ctx.moveTo(offset, bandTop + bandHeight)
    ctx.lineTo(offset + 120, bandTop)
    ctx.stroke()
  }
  ctx.restore()

  const qrSize = 114
  const qrX = 86
  const qrY = bandTop + 24
  roundRectWithStroke(ctx, qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 10, '#ffffff', '#d8dee9', 3)
  const qrImage = await loadImage(qrDataUrl)
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 13px Arial'
  wrapText(fillTemplateText(copy.qrCaption, valueMap), 18).slice(0, 1).forEach((line, index) => {
    ctx.fillText(line, qrX + (qrSize / 2), qrY + qrSize + 18 + (index * 14))
  })
  ctx.textAlign = 'start'

  ctx.save()
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(230, bandTop + 20)
  ctx.lineTo(230, bandTop + bandHeight - 20)
  ctx.stroke()
  ctx.restore()

  const ctaLines = wrapText(fillTemplateText(copy.cta, valueMap), 30).slice(0, 2)
  drawTextBlockCanvas(ctx, ctaLines, 260, bandTop + 56, 32, '#ffffff', 800, 'Arial Narrow')

  const ctaSublineText = fillTemplateText(copy.ctaSubline || '', valueMap)
  const ctaSentenceCount = ctaSublineText
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .length
  const ctaRows = splitCampaignCtaRows(ctaSublineText, ctaSublineLines)
  ctaRows.slice(0, 2).forEach((line, index) => {
    const rowY = bandTop + 108 + (index * 30)
    if (ctaSentenceCount >= 2) {
      drawCampaignActionIcon(ctx, 262, rowY - 12, 18, gold, index === 0 ? 'play' : 'calendar')
    } else {
      ctx.beginPath()
      ctx.fillStyle = gold
      ctx.arc(271, rowY - 4, 5, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.fillStyle = '#f8fafc'
    ctx.font = '600 14px Arial'
    ctx.fillText(line, ctaSentenceCount >= 2 ? 290 : 286, rowY)
  })

  const badgeY = 1360
  footerBadges.slice(0, 3).forEach((badge, index) => {
    const badgeRegionWidth = (width - 120) / 3
    const centerX = 60 + (badgeRegionWidth * index) + (badgeRegionWidth / 2)
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.font = '700 13px Arial'
    ctx.fillText(badge, centerX, badgeY)
    ctx.beginPath()
    ctx.fillStyle = gold
    ctx.arc(centerX - (Math.min(120, ctx.measureText(badge).width / 2 + 18)), badgeY - 4, 4, 0, Math.PI * 2)
    ctx.fill()
  })
  ctx.textAlign = 'start'

  ctx.save()
  ctx.strokeStyle = 'rgba(20, 33, 63, 0.12)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(width / 3, 1338)
  ctx.lineTo(width / 3, 1376)
  ctx.moveTo((width / 3) * 2, 1338)
  ctx.lineTo((width / 3) * 2, 1376)
  ctx.stroke()
  ctx.restore()
}

async function drawComparisonMasterCampaignSheetOnContext(
  ctx: any,
  input: Parameters<typeof drawCampaignSheetOnContext>[1],
) {
  const {
    copy,
    palette,
    width,
    height,
    headlineLines,
    subheadlineLines,
    sectionLabel,
    proofLabel,
    ctaSublineLines,
    noteHeadlineLines,
    steps,
    proofItems,
    footerBadges,
    qrDataUrl,
    loadImage,
    coverPhotoUrl,
    primaryLogoUrl,
    primaryMark,
    secondaryMark,
    valueMap,
  } = input

  const navy = palette.accent
  const gold = '#dda328'
  const ink = '#16264d'
  const muted = '#56698f'
  const paper = '#fbfaf7'
  const sheet = '#ffffff'
  const line = '#d9dee9'

  ctx.fillStyle = paper
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  ctx.strokeStyle = 'rgba(22, 38, 77, 0.04)'
  ctx.lineWidth = 2
  for (let offset = -height; offset < width; offset += 30) {
    ctx.beginPath()
    ctx.moveTo(offset, 0)
    ctx.lineTo(offset + height, height)
    ctx.stroke()
  }
  ctx.restore()

  if (coverPhotoUrl) {
    try {
      const backgroundImage = await loadImage(coverPhotoUrl)
      ctx.save()
      ctx.globalAlpha = 0.035
      drawCoverImage(ctx, backgroundImage, width, height)
      ctx.restore()
    } catch {}
  }

  ctx.save()
  ctx.shadowColor = 'rgba(22, 38, 77, 0.10)'
  ctx.shadowBlur = 18
  roundRect(ctx, 16, 14, width - 32, height - 28, 2, sheet)
  ctx.restore()

  if (primaryLogoUrl) {
    await drawCampaignLogo(ctx, loadImage, primaryLogoUrl, primaryMark, 92, 30, 96, sheet, navy)
  } else {
    ctx.beginPath()
    ctx.fillStyle = navy
    ctx.arc(140, 76, 42, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'center'
    ctx.font = '800 25px Arial'
    ctx.fillText(getInitials(primaryMark), 140, 85)
    ctx.textAlign = 'start'
  }
  ctx.fillStyle = ink
  ctx.font = '700 22px Arial'
  wrapText(primaryMark, 20).slice(0, 3).forEach((lineText, index) => {
    ctx.fillText(lineText.toUpperCase(), 202, 64 + (index * 24))
  })
  ctx.fillStyle = muted
  ctx.font = '700 12px Arial'
  ctx.fillText('COMMUNITY PARTNER', 202, 116)

  ctx.save()
  ctx.strokeStyle = 'rgba(22, 38, 77, 0.18)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(width / 2, 36)
  ctx.lineTo(width / 2, 124)
  ctx.stroke()
  ctx.restore()

  ctx.textAlign = 'right'
  ctx.fillStyle = ink
  ctx.font = '700 26px Arial'
  ctx.fillText('LOCALVIP', width - 92, 66)
  ctx.fillStyle = gold
  ctx.beginPath()
  ctx.arc(width - 226, 54, 8, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = muted
  ctx.font = '600 14px Arial'
  ctx.fillText(secondaryMark, width - 92, 94)
  ctx.textAlign = 'start'

  const masterHeadline = ['ONE GIVEBACK DAY CAN', 'BECOME MORE THAN ONE DAY.']
  drawCenteredTextBlockCanvas(ctx, masterHeadline, width / 2, 146, 58, ink, 800, 'Arial Black')

  const heroSubY = 284
  ctx.save()
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(54, heroSubY - 10)
  ctx.lineTo(178, heroSubY - 10)
  ctx.moveTo(width - 178, heroSubY - 10)
  ctx.lineTo(width - 54, heroSubY - 10)
  ctx.stroke()
  ctx.restore()
  drawCenteredTextBlockCanvas(ctx, subheadlineLines.slice(0, 2), width / 2, heroSubY, 24, muted, 600, 'Arial')

  const leftBox = { x: 54, y: 326, w: 414, h: 548 }
  const rightBox = { x: width - 54 - 414, y: 326, w: 414, h: 548 }
  drawComparisonMasterBox(ctx, leftBox.x, leftBox.y, leftBox.w, leftBox.h, sectionLabel || 'THE GIVEBACK DAY YOU ALREADY KNOW', navy, line)
  drawComparisonMasterBox(ctx, rightBox.x, rightBox.y, rightBox.w, rightBox.h, proofLabel || 'WHAT LOCALVIP ADDS', navy, line)

  const leftRows = [0, 1, 2].map((index) => ({
    y: leftBox.y + 126 + (index * 132),
    icon: (['megaphone', 'bag', 'trophy'] as CampaignPanelIcon[])[index],
    text: fillTemplateText(steps[index]?.title || '', valueMap),
    body: fillTemplateText(steps[index]?.body || '', valueMap),
  }))
  leftRows.forEach((row, index) => {
    drawCampaignPanelIcon(ctx, leftBox.x + 70, row.y, row.icon, navy)
    drawTextBlockCanvas(ctx, wrapText(row.text, 18).slice(0, 3), leftBox.x + 126, row.y - 2, 20, ink, 600)
    if (row.body) {
      drawTextBlockCanvas(ctx, wrapText(row.body, 23).slice(0, 3), leftBox.x + 92, row.y + 34, 18, muted, 500)
    }
    if (index < leftRows.length - 1) {
      drawComparisonDownArrow(ctx, leftBox.x + 68, row.y + 38, '#b8b8b8')
    }
  })

  const rightTopRows = [0, 1].map((index) => ({
    y: rightBox.y + 126 + (index * 102),
    icon: (['megaphone', 'bag'] as CampaignPanelIcon[])[index],
    text: fillTemplateText(steps[index]?.title || '', valueMap),
  }))
  rightTopRows.forEach((row, index) => {
    drawCampaignPanelIcon(ctx, rightBox.x + 70, row.y, row.icon, navy)
    drawTextBlockCanvas(ctx, wrapText(row.text, 18).slice(0, 2), rightBox.x + 126, row.y + 2, 18, ink, 500)
    if (index < rightTopRows.length - 1) {
      drawComparisonDownArrow(ctx, rightBox.x + 68, row.y + 30, '#b8b8b8')
    }
  })

  drawComparisonDownArrow(ctx, rightBox.x + (rightBox.w / 2), rightBox.y + 252, '#b8b8b8')

  const benefitIcons: CampaignPanelIcon[] = ['heart', 'people', 'chart']
  proofItems.slice(0, 3).forEach((item, index) => {
    const startX = rightBox.x + 14 + (index * 128)
    const iconY = rightBox.y + 326
    drawCampaignPanelIcon(ctx, startX + 24, iconY, benefitIcons[index], navy)
    drawCenteredTextBlockCanvas(
      ctx,
      wrapText(fillTemplateText(item.title, valueMap), 14).slice(0, 3),
      startX + 40,
      iconY + 42,
      15,
      ink,
      600,
      'Arial',
    )
  })

  ctx.save()
  ctx.strokeStyle = '#b8b8b8'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(rightBox.x + 76, rightBox.y + 414)
  ctx.lineTo(rightBox.x + rightBox.w - 76, rightBox.y + 414)
  ctx.stroke()
  ctx.restore()

  drawCenteredTextBlockCanvas(
    ctx,
    wrapText(fillTemplateText(copy.comparisonSummary || '', valueMap), 36).slice(0, 2),
    rightBox.x + (rightBox.w / 2),
    rightBox.y + 470,
    18,
    ink,
    700,
    'Arial',
  )

  ctx.save()
  ctx.shadowColor = 'rgba(22, 38, 77, 0.12)'
  ctx.shadowBlur = 12
  ctx.beginPath()
  ctx.arc(width / 2, 590, 32, 0, Math.PI * 2)
  ctx.fillStyle = navy
  ctx.fill()
  ctx.restore()
  ctx.beginPath()
  ctx.arc(width / 2, 590, 32, 0, Math.PI * 2)
  ctx.lineWidth = 4
  ctx.strokeStyle = gold
  ctx.stroke()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 20px Arial'
  ctx.fillText('VS.', width / 2, 598)
  ctx.textAlign = 'start'

  const noteTop = 890
  roundRect(ctx, 76, noteTop, width - 152, 108, 2, '#ffffff')
  drawCampaignPanelIcon(ctx, 116, noteTop + 34, 'heart', navy)
  ctx.save()
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(182, noteTop + 18)
  ctx.lineTo(182, noteTop + 86)
  ctx.stroke()
  ctx.restore()
  drawTextBlockCanvas(ctx, noteHeadlineLines.slice(0, 2), 210, noteTop + 40, 22, ink, 700)
  drawTextBlockCanvas(ctx, wrapText(fillTemplateText(copy.footer, valueMap), 72).slice(0, 3), 210, noteTop + 72, 17, muted, 500)

  const bandTop = 1010
  roundRect(ctx, 16, bandTop, width - 32, 194, 0, navy)
  ctx.save()
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 2
  for (let offset = -40; offset < width; offset += 22) {
    ctx.beginPath()
    ctx.moveTo(offset, bandTop + 166)
    ctx.lineTo(offset + 118, bandTop)
    ctx.stroke()
  }
  ctx.restore()

  const qrSize = 142
  const qrX = 136
  const qrY = bandTop + 24
  roundRectWithStroke(ctx, qrX - 8, qrY - 8, qrSize + 16, qrSize + 16, 8, '#ffffff', '#d9dee9', 3)
  const qrImage = await loadImage(qrDataUrl)
  ctx.drawImage(qrImage, qrX, qrY, qrSize, qrSize)
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  ctx.font = '700 12px Arial'
  ctx.fillText(fillTemplateText(copy.qrCaption, valueMap), qrX + (qrSize / 2), qrY + qrSize + 24)
  ctx.textAlign = 'start'

  ctx.save()
  ctx.strokeStyle = gold
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(314, bandTop + 20)
  ctx.lineTo(314, bandTop + 174)
  ctx.stroke()
  ctx.restore()

  drawTextBlockCanvas(ctx, wrapText(fillTemplateText(copy.cta, valueMap), 30).slice(0, 2), 346, bandTop + 55, 32, '#ffffff', 800, 'Arial Black')
  const ctaRows = splitCampaignCtaRows(fillTemplateText(copy.ctaSubline || '', valueMap), ctaSublineLines).slice(0, 2)
  ctaRows.forEach((row, index) => {
    const rowY = bandTop + 118 + (index * 42)
    drawCampaignActionIcon(ctx, 348, rowY - 14, 20, '#ffffff', index === 0 ? 'play' : 'calendar')
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 15px Arial'
    ctx.fillText(row, 382, rowY)
  })

  const badgeY = 1260
  footerBadges.slice(0, 3).forEach((badge, index) => {
    const badgeRegionWidth = (width - 120) / 3
    const centerX = 60 + (badgeRegionWidth * index) + (badgeRegionWidth / 2)
    ctx.beginPath()
    ctx.fillStyle = gold
    ctx.arc(centerX - 92, badgeY - 5, 4, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = ink
    ctx.textAlign = 'center'
    ctx.font = '700 14px Arial'
    ctx.fillText(badge, centerX, badgeY)
  })
  ctx.textAlign = 'start'

  ctx.save()
  ctx.strokeStyle = 'rgba(22, 38, 77, 0.14)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(width / 3, 1228)
  ctx.lineTo(width / 3, 1282)
  ctx.moveTo((width / 3) * 2, 1228)
  ctx.lineTo((width / 3) * 2, 1282)
  ctx.stroke()
  ctx.restore()
}

function drawComparisonMasterBox(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  header: string,
  accent: string,
  stroke: string,
) {
  ctx.save()
  ctx.shadowColor = 'rgba(22, 38, 77, 0.08)'
  ctx.shadowBlur = 14
  roundRect(ctx, x, y, width, height, 14, '#ffffff')
  ctx.restore()
  roundRectWithStroke(ctx, x, y, width, height, 14, '#ffffff', stroke, 2)
  roundRect(ctx, x, y, width, 66, 14, accent)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.font = '700 18px Arial'
  const lines = wrapText(header.toUpperCase(), 28).slice(0, 2)
  lines.forEach((line, index) => {
    ctx.fillText(line, x + (width / 2), y + 34 + (index * 18))
  })
  ctx.textAlign = 'start'
}

function drawComparisonDownArrow(ctx: any, x: number, y: number, stroke: string) {
  ctx.save()
  ctx.strokeStyle = stroke
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(x, y)
  ctx.lineTo(x, y + 32)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(x - 5, y + 26)
  ctx.lineTo(x, y + 32)
  ctx.lineTo(x + 5, y + 26)
  ctx.stroke()
  ctx.restore()
}

function drawCenteredTextBlockCanvas(
  ctx: any,
  lines: string[],
  centerX: number,
  startY: number,
  lineHeight: number,
  fill: string,
  fontWeight: number,
  fontFamily = 'Arial Narrow',
) {
  ctx.fillStyle = fill
  const fontSize = lineHeight - 4
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`
  lines.forEach((line, index) => {
    const width = ctx.measureText(line).width
    ctx.fillText(line, centerX - (width / 2), startY + (index * lineHeight))
  })
}

function drawCampaignComparisonPanel(
  ctx: any,
  input: {
    x: number
    y: number
    width: number
    height: number
    header: string
    items: FilledTemplateCard[]
    accent: string
    ink: string
    muted: string
    side: 'left' | 'right'
    gold: string
  },
) {
  const { x, y, width, height, header, items, accent, ink, muted, side, gold } = input

  ctx.save()
  ctx.shadowColor = 'rgba(20, 33, 63, 0.10)'
  ctx.shadowBlur = 16
  roundRect(ctx, x, y, width, height, 16, '#ffffff')
  ctx.restore()
  roundRectWithStroke(ctx, x, y, width, height, 16, '#ffffff', 'rgba(20, 33, 63, 0.08)', 2)
  roundRect(ctx, x, y, width, 66, 16, accent)
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  let headerFontSize = 23
  ctx.font = `700 ${headerFontSize}px Arial`
  while (headerFontSize > 17 && ctx.measureText(header.toUpperCase()).width > width - 28) {
    headerFontSize -= 1
    ctx.font = `700 ${headerFontSize}px Arial`
  }
  ctx.fillText(header.toUpperCase(), x + (width / 2), y + 42)
  ctx.textAlign = 'start'

  const visibleItems = items.slice(0, 3)
  const rowStartY = y + 100
  const rowGap = 114
  visibleItems.forEach((item, index) => {
    const itemY = rowStartY + (index * rowGap)
    drawCampaignPanelIcon(ctx, x + 44, itemY + 4, side === 'left' ? ['megaphone', 'bag', 'trophy'][index] as CampaignPanelIcon : ['heart', 'people', 'chart'][index] as CampaignPanelIcon, accent)
    const titleLines = wrapText(item.title, 20).slice(0, 2)
    drawTextBlockCanvas(ctx, titleLines, x + 84, itemY + 2, 22, ink, 700)
    const bodyStartY = itemY + 2 + (titleLines.length * 22) + 12
    drawTextBlockCanvas(ctx, wrapText(item.body, 24).slice(0, 3), x + 84, bodyStartY, 18, muted, 500)

    if (index < visibleItems.length - 1) {
      const arrowX = x + 44
      const arrowTop = itemY + 38
      ctx.save()
      ctx.strokeStyle = 'rgba(20, 33, 63, 0.18)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowTop)
      ctx.lineTo(arrowX, arrowTop + 36)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(arrowX - 5, arrowTop + 30)
      ctx.lineTo(arrowX, arrowTop + 36)
      ctx.lineTo(arrowX + 5, arrowTop + 30)
      ctx.stroke()
      ctx.restore()
    }
  })
}

type CampaignPanelIcon = 'megaphone' | 'bag' | 'trophy' | 'heart' | 'people' | 'chart'

function drawCampaignPanelIcon(
  ctx: any,
  x: number,
  y: number,
  icon: CampaignPanelIcon,
  stroke: string,
) {
  ctx.save()
  ctx.strokeStyle = stroke
  ctx.fillStyle = 'transparent'
  ctx.lineWidth = 2.5
  const w = 28
  const h = 28

  if (icon === 'megaphone') {
    ctx.beginPath()
    ctx.moveTo(x - 10, y + 6)
    ctx.lineTo(x, y + 2)
    ctx.lineTo(x + 8, y + 2)
    ctx.lineTo(x + 14, y - 4)
    ctx.lineTo(x + 14, y + 18)
    ctx.lineTo(x + 8, y + 12)
    ctx.lineTo(x, y + 12)
    ctx.lineTo(x - 10, y + 8)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 2, y + 12)
    ctx.lineTo(x + 2, y + 20)
    ctx.stroke()
  } else if (icon === 'bag') {
    ctx.beginPath()
    ctx.rect(x - 10, y + 4, 20, 18)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x, y + 4, 6, Math.PI, 0)
    ctx.stroke()
  } else if (icon === 'trophy') {
    ctx.beginPath()
    ctx.moveTo(x - 8, y)
    ctx.lineTo(x + 8, y)
    ctx.lineTo(x + 5, y + 10)
    ctx.lineTo(x - 5, y + 10)
    ctx.closePath()
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x, y + 10)
    ctx.lineTo(x, y + 18)
    ctx.moveTo(x - 6, y + 22)
    ctx.lineTo(x + 6, y + 22)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(x - 9, y + 4, 4, Math.PI / 2, (Math.PI * 3) / 2)
    ctx.arc(x + 9, y + 4, 4, (Math.PI * 3) / 2, Math.PI / 2)
    ctx.stroke()
  } else if (icon === 'heart') {
    ctx.beginPath()
    ctx.moveTo(x, y + 18)
    ctx.bezierCurveTo(x - 16, y + 8, x - 10, y - 6, x, y + 1)
    ctx.bezierCurveTo(x + 10, y - 6, x + 16, y + 8, x, y + 18)
    ctx.stroke()
  } else if (icon === 'people') {
    ctx.beginPath()
    ctx.arc(x - 6, y + 4, 4, 0, Math.PI * 2)
    ctx.arc(x + 6, y + 4, 4, 0, Math.PI * 2)
    ctx.arc(x, y - 1, 4.5, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 13, y + 20)
    ctx.quadraticCurveTo(x - 6, y + 12, x + 1, y + 20)
    ctx.moveTo(x - 1, y + 20)
    ctx.quadraticCurveTo(x + 6, y + 12, x + 13, y + 20)
    ctx.stroke()
  } else if (icon === 'chart') {
    ctx.beginPath()
    ctx.moveTo(x - 10, y + 20)
    ctx.lineTo(x - 10, y + 8)
    ctx.lineTo(x - 2, y + 8)
    ctx.lineTo(x - 2, y + 20)
    ctx.moveTo(x + 2, y + 20)
    ctx.lineTo(x + 2, y + 2)
    ctx.lineTo(x + 10, y + 2)
    ctx.lineTo(x + 10, y + 20)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x - 12, y + 22)
    ctx.lineTo(x + 12, y + 22)
    ctx.stroke()
  }

  ctx.restore()
}

function splitCampaignCtaRows(text: string, fallbackLines: string[]) {
  const sentenceParts = text
    .split(/[.!?]/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (sentenceParts.length >= 2) return sentenceParts.slice(0, 2)
  if (sentenceParts.length === 1) return wrapText(sentenceParts[0], 34).slice(0, 2)
  return fallbackLines.slice(0, 2)
}

function drawCampaignActionIcon(
  ctx: any,
  x: number,
  y: number,
  size: number,
  stroke: string,
  icon: 'play' | 'calendar',
) {
  ctx.save()
  ctx.lineWidth = 2
  ctx.strokeStyle = stroke
  ctx.beginPath()
  ctx.arc(x + (size / 2), y + (size / 2), size / 2, 0, Math.PI * 2)
  ctx.stroke()

  if (icon === 'play') {
    ctx.beginPath()
    ctx.moveTo(x + 7, y + 5)
    ctx.lineTo(x + 7, y + size - 5)
    ctx.lineTo(x + size - 4, y + (size / 2))
    ctx.closePath()
    ctx.stroke()
  } else {
    ctx.beginPath()
    ctx.rect(x + 4, y + 6, size - 8, size - 10)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x + 4, y + 11)
    ctx.lineTo(x + size - 4, y + 11)
    ctx.moveTo(x + 7, y + 4)
    ctx.lineTo(x + 7, y + 8)
    ctx.moveTo(x + size - 7, y + 4)
    ctx.lineTo(x + size - 7, y + 8)
    ctx.stroke()
  }

  ctx.restore()
}

async function drawCampaignLogo(
  ctx: any,
  loadImage: RuntimeCanvasModule['loadImage'],
  logoUrl: string | null,
  label: string,
  x: number,
  y: number,
  size: number,
  background: string,
  fallbackFill: string,
) {
  roundRect(ctx, x, y, size, size, 22, background)

  if (logoUrl) {
    try {
      const logo = await loadImage(logoUrl)
      const inset = 12
      drawContainImage(ctx, logo, x + inset, y + inset, size - (inset * 2), size - (inset * 2))
      return
    } catch {}
  }

  ctx.fillStyle = fallbackFill
  ctx.textAlign = 'center'
  ctx.font = '700 28px Arial'
  ctx.fillText(getInitials(label), x + (size / 2), y + (size / 2) + 10)
  ctx.textAlign = 'start'
}

function normalizeQrPosition(raw: unknown) {
  if (raw && typeof raw === 'object') {
    const value = raw as Record<string, unknown>
    return {
      x: typeof value.x === 'number' ? value.x : DEFAULT_QR_POSITION.x,
      y: typeof value.y === 'number' ? value.y : DEFAULT_QR_POSITION.y,
      width: typeof value.width === 'number' ? value.width : DEFAULT_QR_POSITION.width,
      height: typeof value.height === 'number' ? value.height : DEFAULT_QR_POSITION.height,
      canvas_width: typeof value.canvas_width === 'number' ? value.canvas_width : DEFAULT_QR_POSITION.canvas_width,
      canvas_height: typeof value.canvas_height === 'number' ? value.canvas_height : DEFAULT_QR_POSITION.canvas_height,
    }
  }

  return { ...DEFAULT_QR_POSITION }
}

function getPalette(
  brand: 'localvip' | 'hato',
  copy: TemplateCopyDefinition,
  context?: StakeholderMaterialContext,
) {
  const branding = context ? getTemplateBranding(context) : null
  if (brand === 'hato') {
    return {
      accent: branding?.accent || copy.accentColor || '#ec8012',
      soft: branding?.soft || copy.highlightColor || '#fff3e6',
      background: branding?.background || copy.backgroundColor || '#fffaf5',
      panel: branding?.panel || copy.panelColor || '#ffffff',
      text: branding?.text || copy.textColor || '#1f2937',
    }
  }

  return {
    accent: branding?.accent || copy.accentColor || '#2563eb',
    soft: branding?.soft || copy.highlightColor || '#edf4ff',
    background: branding?.background || copy.backgroundColor || '#f8fbff',
    panel: branding?.panel || copy.panelColor || '#ffffff',
    text: branding?.text || copy.textColor || '#0f172a',
  }
}

function renderTextBlock(lines: string[], x: number, startY: number, lineHeight: number, fill: string, fontWeight: number) {
  return lines
    .map((line, index) => `<text x="${x}" y="${startY + (index * lineHeight)}" font-family="Arial, sans-serif" font-size="${lineHeight === 66 ? 64 : lineHeight - 4}" font-weight="${fontWeight}" fill="${fill}">${escapeXml(line)}</text>`)
    .join('')
}

function wrapText(text: string, maxChars: number) {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''

  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (next.length <= maxChars) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }

  if (current) lines.push(current)
  return lines.slice(0, 6)
}

function drawTextBlockCanvas(
  ctx: any,
  lines: string[],
  x: number,
  startY: number,
  lineHeight: number,
  fill: string,
  fontWeight: number,
  fontFamily = 'Arial',
) {
  ctx.fillStyle = fill
  const fontSize = lineHeight === 66 ? 64 : lineHeight - 4
  ctx.font = `${fontWeight} ${fontSize}px "${fontFamily}"`

  lines.forEach((line, index) => {
    ctx.fillText(line, x, startY + (index * lineHeight))
  })
}

function roundRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
}

function roundRectWithStroke(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fill: string,
  stroke: string,
  strokeWidth: number,
) {
  roundRect(ctx, x, y, width, height, radius, fill)
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
  ctx.lineWidth = strokeWidth
  ctx.strokeStyle = stroke
  ctx.stroke()
}

function drawCoverImage(
  ctx: any,
  image: { width: number; height: number },
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const x = (width - drawWidth) / 2
  const y = (height - drawHeight) / 2
  ctx.drawImage(image, x, y, drawWidth, drawHeight)
}

function drawContainImage(
  ctx: any,
  image: { width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.min(width / image.width, height / image.height)
  const drawWidth = image.width * scale
  const drawHeight = image.height * scale
  const drawX = x + ((width - drawWidth) / 2)
  const drawY = y + ((height - drawHeight) / 2)
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
}

function getInitials(value: string) {
  const letters = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')

  return letters || 'LV'
}

function getRuntimeCanvasModule(): RuntimeCanvasModule {
  const runtimeRequire = eval('require') as (id: string) => unknown
  return runtimeRequire('@napi-rs/canvas') as RuntimeCanvasModule
}

async function embedLogoIntoQr(qrDataUrl: string, logoUrl: string): Promise<string> {
  try {
    const { createCanvas, loadImage } = getRuntimeCanvasModule()
    const qrImage = await loadImage(qrDataUrl)
    const qrSize = qrImage.width || 1024
    const canvas = createCanvas(qrSize, qrSize)
    const ctx = canvas.getContext('2d')
    ctx.drawImage(qrImage, 0, 0, qrSize, qrSize)

    // Logo occupies ~22% of QR center (safe with H error correction)
    const logoSize = Math.round(qrSize * 0.22)
    const logoX = Math.round((qrSize - logoSize) / 2)
    const logoY = Math.round((qrSize - logoSize) / 2)
    const padding = Math.round(logoSize * 0.12)

    // White background circle for logo
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(qrSize / 2, qrSize / 2, (logoSize / 2) + padding, 0, Math.PI * 2)
    ctx.fill()

    try {
      const logoImage = await loadImage(logoUrl)
      ctx.save()
      ctx.beginPath()
      ctx.arc(qrSize / 2, qrSize / 2, logoSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize)
      ctx.restore()
    } catch {
      // If logo can't be loaded, return QR without logo
      return qrDataUrl
    }

    const buffer = canvas.toBuffer('image/png')
    return `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`
  } catch {
    // Canvas not available, return QR without logo
    return qrDataUrl
  }
}

async function getActiveGeneratedMaterials(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  templateId: string,
) {
  const supportsActiveFlag = await supportsGeneratedMaterialsActiveFlag(supabase)
  const supportsVersionNumber = await supportsGeneratedMaterialsVersionNumber(supabase)

  let query = supabase
    .from('generated_materials')
    .select('*')
    .eq('stakeholder_id', stakeholderId)
    .eq('template_id', templateId)
    .eq('generation_status', 'generated')
    .order('updated_at', { ascending: false })

  if (supportsVersionNumber) {
    query = query.order('version_number', { ascending: false })
  }

  query = supportsActiveFlag
    ? query.eq('is_active', true)
    : query.eq('is_outdated', false)

  const { data } = await query
  return (data || []) as GeneratedMaterial[]
}

async function createMaterialNotification(
  supabase: ServiceSupabaseClient,
  stakeholder: Stakeholder,
  materialCount: number,
) {
  const userId = pickFirstUuid(stakeholder.owner_user_id, stakeholder.profile_id)
  if (!userId) return

  await (supabase.from('notifications') as any).insert({
    user_id: userId,
    title: 'New materials ready',
    message: `${materialCount} new material${materialCount === 1 ? '' : 's'} ready for use for ${stakeholder.name}.`,
    type: 'success',
    entity_type: stakeholder.business_id ? 'business' : stakeholder.cause_id ? 'cause' : 'stakeholder',
    entity_id: stakeholder.business_id || stakeholder.cause_id || stakeholder.id,
    metadata: {
      stakeholder_id: stakeholder.id,
      material_count: materialCount,
    },
  })
}

async function applyTemplateRules(
  supabase: ServiceSupabaseClient,
  templates: MaterialTemplate[],
  stakeholderType: StakeholderType,
  cityId?: string | null,
  campaignId?: string | null,
): Promise<MaterialTemplate[]> {
  const { data: rules } = await supabase
    .from('template_rules')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: false })

  if (!rules || rules.length === 0) return templates

  const typedRules = rules as Array<{
    stakeholder_type: string | null
    city_id: string | null
    campaign_id: string | null
    template_id: string
    rule_type: string
    priority: number
  }>

  const matchingRules = typedRules.filter((rule) => {
    if (rule.stakeholder_type && rule.stakeholder_type !== stakeholderType) return false
    if (rule.city_id && rule.city_id !== cityId) return false
    if (rule.campaign_id && rule.campaign_id !== campaignId) return false
    return true
  })

  if (matchingRules.length === 0) return templates

  const excludeIds = new Set(
    matchingRules.filter((r) => r.rule_type === 'exclude').map((r) => r.template_id)
  )
  const includeIds = new Set(
    matchingRules.filter((r) => r.rule_type === 'include').map((r) => r.template_id)
  )

  // Remove excluded templates
  let filtered = templates.filter((t) => !excludeIds.has(t.id))

  // If include rules exist, ensure included templates are present
  if (includeIds.size > 0) {
    const existingIds = new Set(filtered.map((t) => t.id))
    const missingIds = Array.from(includeIds).filter((id) => !existingIds.has(id))
    if (missingIds.length > 0) {
      const { data: missing } = await supabase
        .from('material_templates')
        .select('*')
        .in('id', missingIds)
        .eq('is_active', true)
      if (missing) {
        filtered = [...filtered, ...(missing as MaterialTemplate[])]
      }
    }
  }

  return filtered
}

/** Regenerate all active materials for a stakeholder (triggered by branding/code/offer changes). */
export async function regenerateAllForStakeholder(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  actorId: string | null,
  options?: {
    fastMode?: boolean
  },
): Promise<GenerationResult> {
  return generateMaterialsForStakeholder(supabase, stakeholderId, actorId, {
    fastMode: options?.fastMode,
  })
}

/** Restore an archived version to active, deactivating the current active. */
export async function restoreGeneratedMaterialVersion(
  supabase: ServiceSupabaseClient,
  generatedMaterialId: string,
) {
  const { data, error } = await supabase
    .from('generated_materials')
    .select('*')
    .eq('id', generatedMaterialId)
    .single()

  if (error || !data) throw new Error('Generated material version not found.')
  const target = data as GeneratedMaterial
  const supportsActiveFlag = await supportsGeneratedMaterialsActiveFlag(supabase)

  // Deactivate current active version for same stakeholder+template
  let deactivateQuery = (supabase.from('generated_materials') as any)
    .update({
      ...(supportsActiveFlag ? { is_active: false } : {}),
      is_outdated: true,
    })
    .eq('stakeholder_id', target.stakeholder_id)
    .eq('template_id', target.template_id)
    .eq('generation_status', 'generated')

  deactivateQuery = supportsActiveFlag
    ? deactivateQuery.eq('is_active', true)
    : deactivateQuery.eq('is_outdated', false)

  await deactivateQuery

  // Activate the target version
  await (supabase.from('generated_materials') as any)
    .update({
      ...(supportsActiveFlag ? { is_active: true } : {}),
      is_outdated: false,
    })
    .eq('id', generatedMaterialId)

  return target
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
