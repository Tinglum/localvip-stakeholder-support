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
import { resolveBusinessOffer } from '@/lib/offers'
import {
  renderMaterialAssetTemplate,
  syncMaterialAssetTemplatesForStakeholder,
} from '@/lib/server/material-asset-template-engine'
import type { createServiceClient } from '@/lib/supabase/server'
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
  cta: string
  footer: string
  qrCaption: string
  titlePattern: string
  descriptionPattern: string
  accentColor?: string
  highlightColor?: string
  backgroundColor?: string
  panelColor?: string
  textColor?: string
  variant?: 'poster' | 'flyer' | 'card'
  canvasWidth?: number
  canvasHeight?: number
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
  const { data, error } = await (supabase.from('stakeholders') as any)
    .insert({
      type: payload.type,
      name: payload.name,
      city_id: payload.cityId || null,
      owner_user_id: payload.ownerUserId || null,
      profile_id: payload.profileId || null,
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

export async function upsertStakeholderCodesAndGenerate(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  actorId: string | null,
  payload: {
    referralCode: string
    connectionCode: string
  },
) {
  const stakeholder = await getStakeholderById(supabase, stakeholderId)
  if (!stakeholder) throw new Error('Stakeholder not found.')

  const referralCode = normalizeStakeholderCode(payload.referralCode)
  const connectionCode = normalizeStakeholderCode(payload.connectionCode)

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
    throw new Error(`Referral code "${referralCode}" is already in use.`)
  }

  const connectionConflict = await findStakeholderCodeConflict(
    supabase,
    'connection_code',
    connectionCode,
    stakeholderId,
  )
  if (connectionConflict) {
    throw new Error(`Connection code "${connectionCode}" is already in use.`)
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

  try {
    const generation = await generateMaterialsForStakeholder(supabase, stakeholderId, actorId)
    return {
      ...generation,
      codes: savedCodes,
      generationStatus: 'generated' as const,
      generationError: null,
    }
  } catch (error) {
    const message = extractErrorMessage(error, 'Material generation failed (unknown error).')
    await updateAdminTaskStatus(supabase, stakeholder.id, 'failed', {
      referral_code: referralCode,
      connection_code: connectionCode,
      join_url: joinUrl,
      last_error: message,
      codes_saved_at: new Date().toISOString(),
      attempted_at: new Date().toISOString(),
    })

    // Re-throw so the caller (API route) gets the detailed message
    throw new Error(`Codes saved, but material generation failed: ${message}`)
  }
}

export async function generateMaterialsForStakeholder(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  actorId: string | null,
  options?: {
    templateId?: string
  },
): Promise<GenerationResult> {
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
    ensureStakeholderQrCode(supabase, context, actorId),
    getTemplatesForStakeholder(supabase, stakeholder.type, options?.templateId, {
      tier: 'auto',
      cityId: stakeholder.city_id,
      campaignId: context.business?.campaign_id || context.cause?.campaign_id || null,
      businessCategory: context.business?.category || null,
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

  for (const template of templates) {
    try {
      const generated = await generateOneMaterial(supabase, context, qrCode, template, actorId)
      results.push(generated)
    } catch (error) {
      const message = extractErrorMessage(error, `Generation failed for template "${template.name}"`)
      failures.push({ templateId: template.id, templateName: template.name, error: message })
      await upsertGeneratedMaterialFailure(supabase, stakeholder.id, template, message)
    }
  }

  const status = failures.length > 0 && results.length === 0 ? 'failed' : 'generated'

  await updateAdminTaskStatus(
    supabase,
    stakeholder.id,
    status,
    {
      generated_count: results.length,
      failure_count: failures.length,
      failures,
      generated_at: new Date().toISOString(),
    },
  )

  if (status === 'failed') {
    throw new Error(
      `Material generation failed for all ${failures.length} template(s). `
      + failures.map((f) => `[${f.templateName}]: ${f.error}`).join(' | ')
    )
  }

  // Send notification to stakeholder owner
  await createMaterialNotification(supabase, stakeholder, results.length)

  return {
    stakeholder,
    codes,
    generatedMaterials: results,
    failures,
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

async function generateOneMaterial(
  supabase: ServiceSupabaseClient,
  context: StakeholderMaterialContext,
  qrCode: QrCode,
  template: MaterialTemplate,
  actorId: string | null,
) {
  const rawQrDataUrl = await QRCode.toDataURL(qrCode.redirect_url || context.joinUrl, {
    width: 1024,
    margin: 1,
    color: {
      dark: context.brand === 'hato' ? '#ec8012' : '#2563eb',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  })

  // Embed business logo into QR center if available
  const logoUrl = context.business?.logo_url || null
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
  const nextVersion = existingVersions.length > 0
    ? Math.max(...existingVersions.map(v => v.version_number || 1)) + 1
    : 1

  if (existingVersions.length > 0) {
    for (const old of existingVersions) {
      await (supabase.from('generated_materials') as any)
        .update({ is_active: false, is_outdated: true })
        .eq('id', old.id)
    }
  }

  const existingGenerated = existingVersions[0] || null
  const ownerProfileId = await resolveStakeholderLibraryProfileId(supabase, context.stakeholder)
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
    created_by: actorId || context.stakeholder.owner_user_id || ownerProfileId || context.stakeholder.profile_id,
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
    await ensureMaterialAssignment(supabase, materialId, ownerProfileId, actorId)
  }

  const { data: generatedData, error: generatedError } = await (supabase.from('generated_materials') as any)
    .insert({
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
      version_number: nextVersion,
      is_active: true,
      metadata: {
        qr_code_id: qrCode.id,
        redirect_url: qrCode.redirect_url,
        join_url: context.joinUrl,
        display_url: context.displayUrl,
        output_format: template.output_format,
      },
    })
    .select()
    .single()

  if (generatedError) throw generatedError

  await syncLinkedStakeholderAssets(supabase, context.stakeholder, {
    qrCodeId: qrCode.id,
    materialId,
    generatedMaterialId: (generatedData as GeneratedMaterial).id,
  })

  return generatedData as GeneratedMaterial
}

async function generateEmergencyFallbackMaterial(
  supabase: ServiceSupabaseClient,
  context: StakeholderMaterialContext,
  qrCode: QrCode,
  template: MaterialTemplate,
  actorId: string | null,
  primaryError: string,
) {
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
  const fileBase = `${sanitizeFilenamePart(context.stakeholder.name)}-${sanitizeFilenamePart(template.name)}-fallback`
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
  const ownerProfileId = await resolveStakeholderLibraryProfileId(supabase, context.stakeholder)
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
    created_by: actorId || context.stakeholder.owner_user_id || ownerProfileId || context.stakeholder.profile_id,
    metadata: {
      generated_by_engine: true,
      generation_mode: 'emergency_fallback',
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
    await ensureMaterialAssignment(supabase, materialId, ownerProfileId, actorId)
  }

  // Archive old versions for fallback too
  const oldFallback = await getActiveGeneratedMaterials(supabase, context.stakeholder.id, template.id)
  const fallbackVersion = oldFallback.length > 0
    ? Math.max(...oldFallback.map(v => v.version_number || 1)) + 1
    : 1
  if (oldFallback.length > 0) {
    for (const old of oldFallback) {
      await (supabase.from('generated_materials') as any)
        .update({ is_active: false, is_outdated: true })
        .eq('id', old.id)
    }
  }

  const { data: generatedData, error: generatedError } = await (supabase.from('generated_materials') as any)
    .insert({
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
      version_number: fallbackVersion,
      is_active: true,
      metadata: {
        qr_code_id: qrCode.id,
        redirect_url: qrCode.redirect_url,
        join_url: context.joinUrl,
        display_url: context.displayUrl,
        output_format: 'svg',
        generation_mode: 'emergency_fallback',
        primary_error: primaryError,
      },
    })
    .select()
    .single()

  if (generatedError) throw generatedError

  await syncLinkedStakeholderAssets(supabase, context.stakeholder, {
    qrCodeId: qrCode.id,
    materialId,
    generatedMaterialId: (generatedData as GeneratedMaterial).id,
  })

  return generatedData as GeneratedMaterial
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
  },
) {
  const tier = options?.tier || 'auto'
  const syncedAssetTemplates = await syncMaterialAssetTemplatesForStakeholder(supabase, stakeholderType, templateId)

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
  const [business, cause, profile, organization, city] = await Promise.all([
    stakeholder.business_id ? getBusinessById(supabase, stakeholder.business_id) : Promise.resolve(null),
    stakeholder.cause_id ? getCauseById(supabase, stakeholder.cause_id) : Promise.resolve(null),
    stakeholder.profile_id ? getProfileById(supabase, stakeholder.profile_id) : Promise.resolve(null),
    stakeholder.organization_id ? getOrganizationById(supabase, stakeholder.organization_id) : Promise.resolve(null),
    stakeholder.city_id ? getCityById(supabase, stakeholder.city_id) : Promise.resolve(null),
  ])

  const offers = business ? await getOffersForBusiness(supabase, business.id) : []
  const captureOffer = business ? resolveBusinessOffer(business, offers, 'capture') : null
  const cashbackOffer = business ? resolveBusinessOffer(business, offers, 'cashback') : null
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
    cashbackLabel: cashbackOffer?.value_label || '10% cashback',
    supportLabel: getSupportLabel(stakeholder, cityName),
  }
}

async function ensureStakeholderQrCode(
  supabase: ServiceSupabaseClient,
  context: StakeholderMaterialContext,
  actorId: string | null,
) {
  const purpose = getQrPurposeForStakeholderType(context.stakeholder.type)
  const stakeholderProfileId = await resolveStakeholderQrProfileId(supabase, context.stakeholder)
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
    logo_url: context.business?.logo_url || null,
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
    created_by: actorId || context.stakeholder.owner_user_id || context.stakeholder.profile_id,
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
    actorId || context.stakeholder.owner_user_id || context.stakeholder.profile_id,
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
  const { data } = await supabase
    .from('stakeholder_codes')
    .select('stakeholder_id')
    .ilike(column, value)
    .maybeSingle()

  const existingRow = (data || null) as { stakeholder_id: string } | null
  if (!existingRow) return null
  return existingRow.stakeholder_id === stakeholderId ? null : existingRow.stakeholder_id
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
  const { data } = await supabase.from('businesses').select('*').eq('id', id).single()
  return (data || null) as Business | null
}

async function getCauseById(supabase: ServiceSupabaseClient, id: string) {
  const { data } = await supabase.from('causes').select('*').eq('id', id).single()
  return (data || null) as Cause | null
}

async function getProfileById(supabase: ServiceSupabaseClient, id: string) {
  const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
  return (data || null) as Profile | null
}

async function getOrganizationById(supabase: ServiceSupabaseClient, id: string) {
  const { data } = await supabase.from('organizations').select('*').eq('id', id).single()
  return (data || null) as Organization | null
}

async function getCityById(supabase: ServiceSupabaseClient, id: string) {
  const { data } = await supabase.from('cities').select('*').eq('id', id).single()
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
  if (stakeholder.profile_id) return stakeholder.profile_id
  if (stakeholder.owner_user_id) return stakeholder.owner_user_id

  if (stakeholder.business_id) {
    const business = await getBusinessById(supabase, stakeholder.business_id)
    return business?.owner_user_id || business?.owner_id || null
  }

  if (stakeholder.cause_id) {
    const cause = await getCauseById(supabase, stakeholder.cause_id)
    return cause?.owner_id || null
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

function getTemplateCopy(template: MaterialTemplate): TemplateCopyDefinition {
  const metadata = (template.metadata as Record<string, unknown> | null) || {}
  return {
    eyebrow: `${metadata.eyebrow || 'LocalVIP'}`,
    headline: `${metadata.headline || '{{stakeholder_name}}'}`,
    subheadline: `${metadata.subheadline || '{{capture_offer_headline}}'}`,
    body: `${metadata.body || '{{capture_offer_description}}'}`,
    cta: `${metadata.cta || 'Scan to get started'}`,
    footer: `${metadata.footer || '{{support_label}}'}`,
    qrCaption: `${metadata.qrCaption || 'Scan with your phone'}`,
    titlePattern: `${metadata.titlePattern || '{{stakeholder_name}} - {{template_name}}'}`,
    descriptionPattern: `${metadata.descriptionPattern || '{{capture_offer_headline}}'}`,
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
  const backgroundImage = template.source_path
    ? `<image href="${escapeXml(template.source_path)}" x="0" y="0" width="${width}" height="${height}" preserveAspectRatio="xMidYMid slice" opacity="0.18" />`
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

  await drawStructuredTemplateOnContext(ctx, template, renderState, qrDataUrl, loadImage)

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

  await drawStructuredTemplateOnContext(ctx, template, renderState, qrDataUrl, loadImage)

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
  const palette = getPalette(context.brand, copy)

  return {
    copy,
    valueMap,
    qrPosition,
    width,
    height,
    palette,
    headlineLines: wrapText(fillTemplateText(copy.headline, valueMap), 18),
    subheadlineLines: wrapText(fillTemplateText(copy.subheadline, valueMap), 24),
    bodyLines: wrapText(fillTemplateText(copy.body, valueMap), 44),
    footerLines: wrapText(fillTemplateText(copy.footer, valueMap), 36),
  }
}

async function drawStructuredTemplateOnContext(
  ctx: any,
  template: MaterialTemplate,
  renderState: StructuredTemplateRenderState,
  qrDataUrl: string,
  loadImage: RuntimeCanvasModule['loadImage'],
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
  } = renderState

  const backgroundGradient = ctx.createLinearGradient(0, 0, width, height)
  backgroundGradient.addColorStop(0, palette.background)
  backgroundGradient.addColorStop(1, palette.soft)
  ctx.fillStyle = backgroundGradient
  ctx.fillRect(0, 0, width, height)

  if (template.source_path) {
    try {
      const backgroundImage = await loadImage(template.source_path)
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

function getPalette(brand: 'localvip' | 'hato', copy: TemplateCopyDefinition) {
  if (brand === 'hato') {
    return {
      accent: copy.accentColor || '#ec8012',
      soft: copy.highlightColor || '#fff3e6',
      background: copy.backgroundColor || '#fffaf5',
      panel: copy.panelColor || '#ffffff',
      text: copy.textColor || '#1f2937',
    }
  }

  return {
    accent: copy.accentColor || '#2563eb',
    soft: copy.highlightColor || '#edf4ff',
    background: copy.backgroundColor || '#f8fbff',
    panel: copy.panelColor || '#ffffff',
    text: copy.textColor || '#0f172a',
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
) {
  ctx.fillStyle = fill
  const fontSize = lineHeight === 66 ? 64 : lineHeight - 4
  ctx.font = `${fontWeight} ${fontSize}px Arial`

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
  const { data } = await supabase
    .from('generated_materials')
    .select('*')
    .eq('stakeholder_id', stakeholderId)
    .eq('template_id', templateId)
    .eq('is_active', true)
    .order('version_number', { ascending: false })
  return (data || []) as GeneratedMaterial[]
}

async function createMaterialNotification(
  supabase: ServiceSupabaseClient,
  stakeholder: Stakeholder,
  materialCount: number,
) {
  const userId = stakeholder.owner_user_id || stakeholder.profile_id
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
): Promise<GenerationResult> {
  return generateMaterialsForStakeholder(supabase, stakeholderId, actorId)
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

  // Deactivate current active version for same stakeholder+template
  await (supabase.from('generated_materials') as any)
    .update({ is_active: false, is_outdated: true })
    .eq('stakeholder_id', target.stakeholder_id)
    .eq('template_id', target.template_id)
    .eq('is_active', true)

  // Activate the target version
  await (supabase.from('generated_materials') as any)
    .update({ is_active: true, is_outdated: false })
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
