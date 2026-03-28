import type { Business, Contact, Offer, Profile, QrCode } from '@/lib/types/database'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildBusinessJoinResource,
  canManageBusinessJoin,
  getBusinessJoinLogoUrl,
  getBusinessJoinQrAppearance,
  getBusinessJoinCaptureData,
  getBusinessJoinSlug,
  getBusinessRedirectUrl,
  isBusinessJoinQrCode,
  mergeBusinessJoinCaptureMetadata,
  mergeBusinessJoinQrAppearanceMetadata,
  type BusinessJoinQrAppearance,
} from '@/lib/business-join'
import { resolveBusinessOffer } from '@/lib/offers'
import { BUSINESS_ACCENT_DARK_HEX, BUSINESS_ACCENT_HEX } from '@/lib/business-theme'
import { generateShortCode, normalizePhone } from '@/lib/utils'

type ServiceSupabaseClient = ReturnType<typeof createServiceClient>

export async function getProfileForUser(supabase: ServiceSupabaseClient, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return (data || null) as Profile | null
}

export async function resolveBusinessByJoinIdentifier(
  supabase: ServiceSupabaseClient,
  identifier: string,
) {
  if (!identifier) return null

  if (isUuid(identifier)) {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', identifier)
      .eq('status', 'active')
      .single()

    if (data) return data as Business
  }

  const { data } = await supabase
    .from('businesses')
    .select('*')
    .contains('metadata', { customer_capture: { join_slug: identifier } })
    .eq('status', 'active')
    .limit(1)

  return (data?.[0] || null) as Business | null
}

export async function ensureBusinessJoinResource(
  supabase: ServiceSupabaseClient,
  business: Business,
  actorId: string | null,
) {
  const capture = getBusinessJoinCaptureData(business)
  const joinSlug = capture.join_slug || getBusinessJoinSlug(business)

  let qrCode: QrCode | null = null

  if (capture.qr_code_id) {
    const { data } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('id', capture.qr_code_id)
      .single()

    qrCode = (data || null) as QrCode | null
  }

  if (!qrCode) {
    const { data } = await supabase
      .from('qr_codes')
      .select('*')
      .eq('business_id', business.id)
      .order('created_at', { ascending: false })
      .limit(20)

    qrCode = ((data || []) as QrCode[]).find((item) => isBusinessJoinQrCode(item, business.id)) || null
  }

  if (!qrCode) {
    qrCode = await createBusinessJoinQrCode(supabase, business, actorId, joinSlug)
  } else {
    qrCode = await syncExistingBusinessJoinQrCode(supabase, business, actorId, joinSlug, qrCode)
  }

  const linkedCauseName = await getLinkedCauseName(supabase, business.linked_cause_id)
  const offers = await getBusinessOffers(supabase, business.id)
  const captureOffer = resolveBusinessOffer(business, offers, 'capture')

  const resource = buildBusinessJoinResource(business, {
    joinSlug,
    shortCode: qrCode.short_code,
    redirectUrl: qrCode.redirect_url || getBusinessRedirectUrl(qrCode.short_code),
    qrCodeId: qrCode.id,
    qrCode,
    linkedCauseName,
    captureOffer: {
      headline: captureOffer.headline,
      description: captureOffer.description,
      valueLabel: captureOffer.value_label,
    },
  })

  await (supabase
    .from('businesses') as any)
    .update({
      metadata: mergeBusinessJoinCaptureMetadata(business.metadata as Record<string, unknown> | null, {
        join_slug: resource.joinSlug,
        join_url: resource.joinUrl,
        redirect_url: resource.redirectUrl,
        short_code: resource.shortCode,
        qr_code_id: resource.qrCodeId,
        last_synced_at: new Date().toISOString(),
      }),
    })
    .eq('id', business.id)

  return resource
}

export async function upsertBusinessJoinContact(
  supabase: ServiceSupabaseClient,
  business: Business,
  payload: {
    firstName: string
    phone: string | null
    email: string | null
    supportsLocalCauses: boolean
    wantsBusinessOffers: boolean
  },
) {
  const now = new Date().toISOString()
  const ownerId = business.owner_user_id || business.owner_id || null
  const contacts = await getBusinessContacts(supabase, business.id)
  const offers = await getBusinessOffers(supabase, business.id)
  const captureOffer = resolveBusinessOffer(business, offers, 'capture')
  const email = payload.email?.trim().toLowerCase() || null
  const phone = payload.phone?.trim() || null
  const normalizedPhone = phone ? normalizePhone(phone) : ''

  const existing = contacts.find((contact) => {
    const contactEmail = contact.email?.trim().toLowerCase() || null
    const contactPhone = contact.phone ? normalizePhone(contact.phone) : ''

    return (
      (!!email && contactEmail === email)
      || (!!normalizedPhone && contactPhone === normalizedPhone)
    )
  }) || null

  if (existing) {
    throw new BusinessJoinClaimError(
      'This phone number or email has already been used to claim this offer.',
      existing,
    )
  }

  const nextMetadata = {
    future_hooks: {
      sms_after_signup: false,
      email_confirmation: false,
      referral_tracking: false,
      school_cause_attribution: false,
      stakeholder_variants: false,
    },
    list_status: 'joined',
    offer_eligible: true,
    supports_local_causes: payload.supportsLocalCauses,
    wants_business_offers: payload.wantsBusinessOffers,
    capture_source: 'business_join_qr',
  }

  const { data } = await (supabase
    .from('contacts') as any)
    .insert({
      first_name: payload.firstName,
      last_name: '',
      phone,
      email,
      business_id: business.id,
      owner_id: ownerId,
      created_by_user_id: ownerId,
      capture_offer_id: captureOffer.id,
      source: 'qr',
      tag: 'Offer signup',
      list_status: 'joined',
      invited_at: null,
      joined_at: now,
      normalized_email: email,
      normalized_phone: normalizedPhone || null,
      status: 'active',
      metadata: nextMetadata,
    })
    .select()
    .single()

  return data as Contact
}

export class BusinessJoinClaimError extends Error {
  constructor(
    message: string,
    public readonly contact: Contact | null = null,
  ) {
    super(message)
    this.name = 'BusinessJoinClaimError'
  }
}

export function userCanManageBusinessJoin(profile: Profile | null, business: Business | null) {
  return canManageBusinessJoin(profile, business)
}

export async function updateBusinessJoinQrAppearance(
  supabase: ServiceSupabaseClient,
  business: Business,
  actorId: string | null,
  appearanceInput: Partial<BusinessJoinQrAppearance>,
) {
  const resource = await ensureBusinessJoinResource(supabase, business, actorId)
  const { data } = await supabase
    .from('qr_codes')
    .select('*')
    .eq('id', resource.qrCodeId)
    .single()

  if (!data) {
    throw new Error('QR code could not be found.')
  }

  const qrCode = data as QrCode
  const current = getBusinessJoinQrAppearance(business, qrCode)
  const next: BusinessJoinQrAppearance = {
    ...current,
    ...appearanceInput,
    useBusinessLogo: appearanceInput.useBusinessLogo ?? current.useBusinessLogo,
    logoUrl: (appearanceInput.useBusinessLogo ?? current.useBusinessLogo)
      ? getBusinessJoinLogoUrl(business)
      : null,
    gradientColors: isGradientColorPair(appearanceInput.gradientColors)
      ? [appearanceInput.gradientColors[0], appearanceInput.gradientColors[1]]
      : current.gradientColors,
  }

  const nextMetadata = mergeBusinessJoinQrAppearanceMetadata(
    (qrCode.metadata as Record<string, unknown> | null) || {},
    next,
  )

  await (supabase.from('qr_codes') as any)
    .update({
      foreground_color: next.foregroundColor,
      background_color: next.backgroundColor,
      frame_text: next.frameText,
      logo_url: next.logoUrl,
      metadata: nextMetadata,
      version: (qrCode.version || 1) + 1,
      created_by: qrCode.created_by || actorId,
    })
    .eq('id', qrCode.id)

  const { data: refreshedBusiness } = await supabase
    .from('businesses')
    .select('*')
    .eq('id', business.id)
    .single()

  return ensureBusinessJoinResource(
    supabase,
    (refreshedBusiness || business) as Business,
    actorId,
  )
}

async function createBusinessJoinQrCode(
  supabase: ServiceSupabaseClient,
  business: Business,
  actorId: string | null,
  joinSlug: string,
) {
  const shortCode = await createUniqueShortCode(supabase)
  const redirectUrl = getBusinessRedirectUrl(shortCode)
  const joinUrl = buildBusinessJoinResource(business, {
    joinSlug,
    shortCode,
    redirectUrl,
    qrCodeId: 'pending',
  }).joinUrl

  const { data } = await (supabase
    .from('qr_codes') as any)
    .insert({
      name: `${business.name} - Our Clients QR`,
      short_code: shortCode,
      destination_url: joinUrl,
      redirect_url: redirectUrl,
      brand: business.brand || 'localvip',
      logo_url: getBusinessJoinLogoUrl(business),
      foreground_color: BUSINESS_ACCENT_HEX,
      background_color: '#ffffff',
      frame_text: 'GET MY OFFER',
      campaign_id: business.campaign_id,
      city_id: business.city_id,
      stakeholder_id: null,
      business_id: business.id,
      cause_id: business.linked_cause_id,
      collection_id: null,
      destination_preset: 'business_join_capture',
      scan_count: 0,
      version: 1,
      status: 'active',
      created_by: actorId,
      metadata: {
        purpose: 'business_capture',
        customer_capture: true,
        join_slug: joinSlug,
        join_url: joinUrl,
        qr_appearance: {
          useBusinessLogo: true,
          dotStyle: 'rounded',
          cornerStyle: 'rounded',
          gradientType: 'none',
          gradientColors: [BUSINESS_ACCENT_HEX, BUSINESS_ACCENT_DARK_HEX],
        },
        future_hooks: {
          sms_after_signup: false,
          email_confirmation: false,
          referral_tracking: false,
          school_cause_attribution: false,
          stakeholder_variants: false,
        },
      },
    })
    .select()
    .single()

  const qrCode = data as QrCode

  await (supabase
    .from('redirects') as any)
    .insert({
      short_code: shortCode,
      destination_url: joinUrl,
      qr_code_id: qrCode.id,
      click_count: 0,
      status: 'active',
      created_by: actorId,
    })

  return qrCode
}

async function syncExistingBusinessJoinQrCode(
  supabase: ServiceSupabaseClient,
  business: Business,
  actorId: string | null,
  joinSlug: string,
  qrCode: QrCode,
) {
  const currentAppearance = getBusinessJoinQrAppearance(business, qrCode)
  const redirectUrl = qrCode.redirect_url || getBusinessRedirectUrl(qrCode.short_code)
  const joinUrl = buildBusinessJoinResource(business, {
    joinSlug,
    shortCode: qrCode.short_code,
    redirectUrl,
    qrCodeId: qrCode.id,
    qrCode,
  }).joinUrl

  const nextMetadata = mergeBusinessJoinQrAppearanceMetadata({
    ...((qrCode.metadata as Record<string, unknown> | null) || {}),
    purpose: 'business_capture',
    customer_capture: true,
    join_slug: joinSlug,
    join_url: joinUrl,
    future_hooks: {
      sms_after_signup: false,
      email_confirmation: false,
      referral_tracking: false,
      school_cause_attribution: false,
      stakeholder_variants: false,
    },
  }, currentAppearance)

  const { data } = await (supabase.from('qr_codes') as any)
    .update({
      destination_url: joinUrl,
      redirect_url: redirectUrl,
      foreground_color: currentAppearance.foregroundColor,
      background_color: currentAppearance.backgroundColor,
      frame_text: currentAppearance.frameText,
      logo_url: currentAppearance.logoUrl,
      metadata: nextMetadata,
      created_by: qrCode.created_by || actorId,
    })
    .eq('id', qrCode.id)
    .select()
    .single()

  await ensureRedirectRow(supabase, qrCode.short_code, joinUrl, qrCode.id, qrCode.created_by || actorId)

  return (data || { ...qrCode, destination_url: joinUrl, redirect_url: redirectUrl, metadata: nextMetadata }) as QrCode
}

async function ensureRedirectRow(
  supabase: ServiceSupabaseClient,
  shortCode: string,
  destinationUrl: string,
  qrCodeId: string,
  actorId: string | null,
) {
  const { data: existing } = await (supabase
    .from('redirects') as any)
    .select('*')
    .eq('short_code', shortCode)
    .single()

  if (!existing) {
    await (supabase
      .from('redirects') as any)
      .insert({
        short_code: shortCode,
        destination_url: destinationUrl,
        qr_code_id: qrCodeId,
        click_count: 0,
        status: 'active',
        created_by: actorId,
      })
    return
  }

  await (supabase.from('redirects') as any)
    .update({
      destination_url: destinationUrl,
      qr_code_id: qrCodeId,
      status: 'active',
    })
    .eq('id', existing.id)
}

async function createUniqueShortCode(supabase: ServiceSupabaseClient) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const shortCode = generateShortCode(8)
    const { data } = await supabase
      .from('redirects')
      .select('id')
      .eq('short_code', shortCode)
      .maybeSingle()

    if (!data) return shortCode
  }

  return `${generateShortCode(6)}${Date.now().toString().slice(-2)}`
}

async function getLinkedCauseName(supabase: ServiceSupabaseClient, causeId: string | null) {
  if (!causeId) return null

  const { data } = await supabase
    .from('causes')
    .select('name')
    .eq('id', causeId)
    .single()

  return (data as { name?: string } | null)?.name || null
}

async function getBusinessContacts(supabase: ServiceSupabaseClient, businessId: string) {
  const { data } = await supabase
    .from('contacts')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(250)

  return (data || []) as Contact[]
}

async function getBusinessOffers(supabase: ServiceSupabaseClient, businessId: string) {
  const { data } = await supabase
    .from('offers')
    .select('*')
    .eq('business_id', businessId)

  return (data || []) as Offer[]
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isGradientColorPair(value: unknown): value is [string, string] {
  return Array.isArray(value)
    && value.length >= 2
    && typeof value[0] === 'string'
    && typeof value[1] === 'string'
}
