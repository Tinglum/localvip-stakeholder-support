import type { Cause, Contact, Profile, QrCode } from '@/lib/types/database'
import { createServiceClient } from '@/lib/supabase/server'
import {
  buildCommunitySupportResource,
  canManageCommunitySupport,
  getCommunityRedirectUrl,
  getCommunitySupportCaptureData,
  getCommunitySupportSlug,
  isCommunitySupportQrCode,
  mergeCommunitySupportMetadata,
} from '@/lib/community-support'
import { normalizePhone, generateShortCode } from '@/lib/utils'

type ServiceSupabaseClient = ReturnType<typeof createServiceClient>

export async function getProfileForUser(supabase: ServiceSupabaseClient, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  return (data || null) as Profile | null
}

export async function resolveCommunityBySupportIdentifier(
  supabase: ServiceSupabaseClient,
  identifier: string,
) {
  if (!identifier) return null

  if (isUuid(identifier)) {
    const { data } = await supabase
      .from('causes')
      .select('*')
      .eq('id', identifier)
      .eq('status', 'active')
      .single()

    if (data) return data as Cause
  }

  const { data } = await supabase
    .from('causes')
    .select('*')
    .contains('metadata', { supporter_capture: { support_slug: identifier } })
    .eq('status', 'active')
    .limit(1)

  return (data?.[0] || null) as Cause | null
}

export async function ensureCommunitySupportResource(
  supabase: ServiceSupabaseClient,
  cause: Cause,
  actorId: string | null,
) {
  const capture = getCommunitySupportCaptureData(cause)
  const supportSlug = capture.support_slug || getCommunitySupportSlug(cause)

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
      .eq('cause_id', cause.id)
      .order('created_at', { ascending: false })
      .limit(20)

    qrCode = ((data || []) as QrCode[]).find((item) => isCommunitySupportQrCode(item, cause.id)) || null
  }

  if (!qrCode) {
    qrCode = await createCommunitySupportQrCode(supabase, cause, actorId, supportSlug)
  } else {
    qrCode = await syncExistingCommunitySupportQrCode(supabase, cause, actorId, supportSlug, qrCode)
  }

  const resource = buildCommunitySupportResource(cause, {
    supportSlug,
    shortCode: qrCode.short_code,
    redirectUrl: qrCode.redirect_url || getCommunityRedirectUrl(qrCode.short_code),
    qrCodeId: qrCode.id,
  })

  await (supabase
    .from('causes') as any)
    .update({
      metadata: mergeCommunitySupportMetadata(cause.metadata as Record<string, unknown> | null, {
        support_slug: resource.supportSlug,
        support_url: resource.supportUrl,
        redirect_url: resource.redirectUrl,
        short_code: resource.shortCode,
        qr_code_id: resource.qrCodeId,
        last_synced_at: new Date().toISOString(),
      }),
    })
    .eq('id', cause.id)

  return resource
}

export async function upsertCommunitySupporter(
  supabase: ServiceSupabaseClient,
  cause: Cause,
  payload: {
    firstName: string
    phone: string | null
    email: string | null
    wantsUpdates: boolean
  },
) {
  const now = new Date().toISOString()
  const ownerId = cause.owner_id || null
  const contacts = await getCommunityContacts(supabase, cause.id)
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
    throw new CommunitySupportClaimError(
      'This phone number or email has already been registered for this supporter page.',
      existing,
    )
  }

  const { data } = await (supabase
    .from('contacts') as any)
    .insert({
      first_name: payload.firstName,
      last_name: '',
      phone,
      email,
      cause_id: cause.id,
      organization_id: cause.organization_id,
      owner_id: ownerId,
      created_by_user_id: ownerId,
      source: 'community_qr',
      tag: 'Supporter signup',
      list_status: 'joined',
      joined_at: now,
      normalized_email: email,
      normalized_phone: normalizedPhone || null,
      status: 'active',
      metadata: {
        future_hooks: {
          sms_after_signup: false,
          email_confirmation: false,
          referral_tracking: false,
          stakeholder_variants: false,
        },
        wants_updates: payload.wantsUpdates,
        supporter_signup: true,
      },
    })
    .select()
    .single()

  return data as Contact
}

export class CommunitySupportClaimError extends Error {
  constructor(
    message: string,
    public readonly contact: Contact | null = null,
  ) {
    super(message)
    this.name = 'CommunitySupportClaimError'
  }
}

export function userCanManageCommunitySupport(profile: Profile | null, cause: Cause | null) {
  return canManageCommunitySupport(profile, cause)
}

async function createCommunitySupportQrCode(
  supabase: ServiceSupabaseClient,
  cause: Cause,
  actorId: string | null,
  supportSlug: string,
) {
  const shortCode = await createUniqueShortCode(supabase)
  const redirectUrl = getCommunityRedirectUrl(shortCode)
  const supportUrl = buildCommunitySupportResource(cause, {
    supportSlug,
    shortCode,
    redirectUrl,
    qrCodeId: 'pending',
  }).supportUrl

  const { data } = await (supabase
    .from('qr_codes') as any)
    .insert({
      name: `${cause.name} - Supporter QR`,
      short_code: shortCode,
      destination_url: supportUrl,
      redirect_url: redirectUrl,
      brand: cause.brand || 'localvip',
      logo_url: null,
      foreground_color: cause.brand === 'hato' ? '#ec8012' : '#db2777',
      background_color: '#ffffff',
      frame_text: 'SUPPORT US',
      campaign_id: cause.campaign_id,
      city_id: cause.city_id,
      stakeholder_id: null,
      business_id: null,
      cause_id: cause.id,
      collection_id: null,
      destination_preset: 'community_support',
      scan_count: 0,
      version: 1,
      status: 'active',
      created_by: actorId,
      metadata: {
        purpose: 'community_supporter',
        supporter_capture: true,
        support_slug: supportSlug,
        support_url: supportUrl,
      },
    })
    .select()
    .single()

  const qrCode = data as QrCode

  await (supabase
    .from('redirects') as any)
    .insert({
      short_code: shortCode,
      destination_url: supportUrl,
      qr_code_id: qrCode.id,
      click_count: 0,
      status: 'active',
      created_by: actorId,
    })

  return qrCode
}

async function syncExistingCommunitySupportQrCode(
  supabase: ServiceSupabaseClient,
  cause: Cause,
  actorId: string | null,
  supportSlug: string,
  qrCode: QrCode,
) {
  const redirectUrl = qrCode.redirect_url || getCommunityRedirectUrl(qrCode.short_code)
  const supportUrl = buildCommunitySupportResource(cause, {
    supportSlug,
    shortCode: qrCode.short_code,
    redirectUrl,
    qrCodeId: qrCode.id,
  }).supportUrl

  const nextMetadata = {
    ...((qrCode.metadata as Record<string, unknown> | null) || {}),
    purpose: 'community_supporter',
    supporter_capture: true,
    support_slug: supportSlug,
    support_url: supportUrl,
  }

  const { data } = await (supabase.from('qr_codes') as any)
    .update({
      destination_url: supportUrl,
      redirect_url: redirectUrl,
      frame_text: qrCode.frame_text || 'SUPPORT US',
      metadata: nextMetadata,
      created_by: qrCode.created_by || actorId,
    })
    .eq('id', qrCode.id)
    .select()
    .single()

  await ensureRedirectRow(supabase, qrCode.short_code, supportUrl, qrCode.id, qrCode.created_by || actorId)

  return (data || { ...qrCode, destination_url: supportUrl, redirect_url: redirectUrl, metadata: nextMetadata }) as QrCode
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

async function getCommunityContacts(supabase: ServiceSupabaseClient, causeId: string) {
  const { data } = await supabase
    .from('contacts')
    .select('*')
    .eq('cause_id', causeId)
    .order('created_at', { ascending: false })
    .limit(250)

  return (data || []) as Contact[]
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}
