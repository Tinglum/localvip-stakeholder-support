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
}

interface RuntimeCanvasModule {
  createCanvas: (width: number, height: number) => {
    getContext: (contextId: '2d') => any
    toBuffer: (mimeType: string) => Buffer
  }
  loadImage: (source: string) => Promise<{
    width: number
    height: number
  }>
}

const DEFAULT_QR_POSITION = {
  x: 760,
  y: 930,
  width: 220,
  height: 220,
  canvas_width: 1080,
  canvas_height: 1440,
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
    throw new Error('Referral code and connection code are required.')
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

    if (error) throw error
  } else {
    const { error } = await (supabase.from('stakeholder_codes') as any)
      .insert({
        stakeholder_id: stakeholderId,
        referral_code: referralCode,
        connection_code: connectionCode,
        join_url: joinUrl,
      })

    if (error) throw error
  }

  return generateMaterialsForStakeholder(supabase, stakeholderId, actorId)
}

export async function generateMaterialsForStakeholder(
  supabase: ServiceSupabaseClient,
  stakeholderId: string,
  actorId: string | null,
  options?: {
    templateId?: string
  },
): Promise<GenerationResult> {
  const stakeholder = await getStakeholderById(supabase, stakeholderId)
  if (!stakeholder) throw new Error('Stakeholder not found.')

  const codes = await getStakeholderCode(supabase, stakeholder.id)
  if (!codes) throw new Error('Stakeholder codes are missing.')

  const context = await buildStakeholderMaterialContext(supabase, stakeholder, codes)
  const qrCode = await ensureStakeholderQrCode(supabase, context, actorId)
  const templates = await getTemplatesForStakeholder(supabase, stakeholder.type, options?.templateId)

  if (!templates.length) {
    await updateAdminTaskStatus(supabase, stakeholder.id, 'failed', {
      last_error: 'No active templates matched this stakeholder.',
      attempted_at: new Date().toISOString(),
    })
    throw new Error('No active templates matched this stakeholder.')
  }

  const results: GeneratedMaterial[] = []
  const failures: Array<{ templateId: string; templateName: string; error: string }> = []

  for (const template of templates) {
    try {
      const generated = await generateOneMaterial(supabase, context, qrCode, template, actorId)
      results.push(generated)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Material generation failed.'
      failures.push({ templateId: template.id, templateName: template.name, error: message })
      await upsertGeneratedMaterialFailure(supabase, stakeholder.id, template, message)
    }
  }

  await updateAdminTaskStatus(
    supabase,
    stakeholder.id,
    failures.length > 0 && results.length === 0 ? 'failed' : 'generated',
    {
      generated_count: results.length,
      failures,
      generated_at: new Date().toISOString(),
    },
  )

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
  const qrDataUrl = await QRCode.toDataURL(qrCode.redirect_url || context.joinUrl, {
    width: 1024,
    margin: 1,
    color: {
      dark: context.brand === 'hato' ? '#ec8012' : '#2563eb',
      light: '#ffffff',
    },
    errorCorrectionLevel: 'H',
  })

  const svg = renderStructuredTemplateSvg(template, context, qrDataUrl)
  const fileBase = `${sanitizeFilenamePart(context.stakeholder.name)}-${sanitizeFilenamePart(template.name)}`
  let fileExtension = 'svg'
  let contentType = 'image/svg+xml'
  let materialType: Material['type'] = 'flyer'
  let fileBuffer: Uint8Array = Buffer.from(svg, 'utf8')

  if (template.output_format === 'png') {
    fileExtension = 'png'
    contentType = 'image/png'
    fileBuffer = new Uint8Array(await renderStructuredTemplatePng(template, context, qrDataUrl))
  } else if (template.output_format === 'pdf') {
    throw new Error('PDF output needs a server-side PDF renderer dependency before it can export final files automatically.')
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
  const existingGenerated = await getGeneratedMaterialByStakeholderTemplate(supabase, context.stakeholder.id, template.id)
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
    version: 1,
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
    .upsert(
      {
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
        metadata: {
          qr_code_id: qrCode.id,
          redirect_url: qrCode.redirect_url,
          join_url: context.joinUrl,
          display_url: context.displayUrl,
          output_format: template.output_format,
        },
      },
      { onConflict: 'stakeholder_id,template_id' },
    )
    .select()
    .single()

  if (generatedError) throw generatedError
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
) {
  let query = supabase
    .from('material_templates')
    .select('*')
    .eq('is_active', true)

  if (templateId) query = query.eq('id', templateId)

  const { data, error } = await query.order('created_at', { ascending: true })
  if (error) throw error

  return ((data || []) as MaterialTemplate[]).filter((template) =>
    template.stakeholder_types.length === 0
    || template.stakeholder_types.includes(stakeholderType)
    || (stakeholderType === 'cause' && template.stakeholder_types.includes('community'))
    || (stakeholderType === 'school' && template.stakeholder_types.includes('community'))
  )
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
  const joinUrl = codes.join_url || buildStakeholderJoinUrl(stakeholder.type, codes.connection_code)

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
  const existing = await getStakeholderQrCode(supabase, context.stakeholder.id, purpose)
  const redirectShortCode = await ensureUniqueShortCode(supabase, context.codes.referral_code, existing?.short_code || null)
  const redirectUrl = `${getMaterialEngineBaseUrl()}/r/${redirectShortCode}`

  const payload = {
    name: `${context.stakeholder.name} QR`,
    short_code: redirectShortCode,
    destination_url: context.joinUrl,
    redirect_url: redirectUrl,
    brand: context.brand,
    logo_url: null,
    foreground_color: context.brand === 'hato' ? '#ec8012' : '#2563eb',
    background_color: '#ffffff',
    frame_text: context.stakeholder.type === 'business' ? 'GET MY OFFER' : 'SCAN TO JOIN',
    campaign_id: context.business?.campaign_id || context.cause?.campaign_id || null,
    city_id: context.stakeholder.city_id,
    stakeholder_id: context.stakeholder.id,
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
  if (qrCodeId) {
    const { error } = await (supabase.from('qr_codes') as any).update(payload).eq('id', qrCodeId)
    if (error) throw error
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
  return data as QrCode
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
  stakeholderId: string,
  purpose: string,
) {
  const { data } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('stakeholder_id', stakeholderId)
    .order('created_at', { ascending: false })
    .limit(20)

  return ((data || []) as QrCode[]).find((item) => {
    const metadata = (item.metadata as Record<string, unknown> | null) || {}
    return metadata.purpose === purpose
  }) || null
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

async function ensureUniqueShortCode(
  supabase: ServiceSupabaseClient,
  preferredCode: string,
  existingCode: string | null,
) {
  if (existingCode) return existingCode

  const preferred = normalizeStakeholderCode(preferredCode)
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
  const copy = getTemplateCopy(template)
  const valueMap = { ...getTemplateValueMap(context), template_name: template.name }
  const qrPosition = normalizeQrPosition(template.qr_position_json)
  const width = copy.canvasWidth || qrPosition.canvas_width || DEFAULT_QR_POSITION.canvas_width
  const height = copy.canvasHeight || qrPosition.canvas_height || DEFAULT_QR_POSITION.canvas_height
  const palette = getPalette(context.brand, copy)
  const headlineLines = wrapText(fillTemplateText(copy.headline, valueMap), 18)
  const subheadlineLines = wrapText(fillTemplateText(copy.subheadline, valueMap), 24)
  const bodyLines = wrapText(fillTemplateText(copy.body, valueMap), 44)
  const footerLines = wrapText(fillTemplateText(copy.footer, valueMap), 36)
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
  const copy = getTemplateCopy(template)
  const valueMap = { ...getTemplateValueMap(context), template_name: template.name }
  const qrPosition = normalizeQrPosition(template.qr_position_json)
  const width = copy.canvasWidth || qrPosition.canvas_width || DEFAULT_QR_POSITION.canvas_width
  const height = copy.canvasHeight || qrPosition.canvas_height || DEFAULT_QR_POSITION.canvas_height
  const palette = getPalette(context.brand, copy)
  const headlineLines = wrapText(fillTemplateText(copy.headline, valueMap), 18)
  const subheadlineLines = wrapText(fillTemplateText(copy.subheadline, valueMap), 24)
  const bodyLines = wrapText(fillTemplateText(copy.body, valueMap), 44)
  const footerLines = wrapText(fillTemplateText(copy.footer, valueMap), 36)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

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

  return canvas.toBuffer('image/png')
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

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
