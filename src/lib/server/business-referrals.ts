import { canManageBusinessJoin } from '@/lib/business-join'
import { splitFullName } from '@/lib/business-portal'
import { createServiceClient } from '@/lib/supabase/server'
import type {
  Business,
  BusinessReferral,
  Contact,
  OnboardingStage,
  Profile,
} from '@/lib/types/database'
import { normalizeBusinessName, normalizePhone } from '@/lib/utils'
import type {
  BusinessReferralChannel,
  BusinessReferralScriptType,
} from '@/lib/business-referral-script-engine'

type ServiceSupabaseClient = ReturnType<typeof createServiceClient>

export interface BusinessReferralCandidate {
  id: string
  name: string
  category: string | null
  address: string | null
  city_id: string | null
  city_label: string
  stage: OnboardingStage
  source: string | null
  status: string
}

export interface TrackBusinessReferralInput {
  sourceBusinessId: string
  targetBusinessId?: string | null
  targetBusinessName: string
  targetCategory?: string | null
  targetOwnerName?: string | null
  targetEmail?: string | null
  targetPhone?: string | null
  channel: BusinessReferralChannel
  scriptType: BusinessReferralScriptType
  tier: 'good' | 'better' | 'best' | 'ultra'
  message: string
  notes?: string | null
  fitReason?: string | null
  relationshipNote?: string | null
}

export interface UpdateBusinessReferralStatusInput {
  referralId: string
  status: BusinessReferral['status']
  note?: string | null
}

export async function getBusinessReferralCandidates(
  supabase: ServiceSupabaseClient,
  sourceBusiness: Business,
) {
  if (!sourceBusiness.city_id) {
    return [] as BusinessReferralCandidate[]
  }

  const [{ data: businesses }, { data: city }] = await Promise.all([
    supabase
      .from('businesses')
      .select('id, name, category, address, city_id, stage, source, status')
      .eq('city_id', sourceBusiness.city_id)
      .eq('status', 'active')
      .neq('id', sourceBusiness.id)
      .order('updated_at', { ascending: false })
      .limit(120),
    supabase
      .from('cities')
      .select('name, state')
      .eq('id', sourceBusiness.city_id)
      .single(),
  ])

  const cityRecord = (city || null) as { name: string; state: string } | null
  const cityLabel = cityRecord ? `${cityRecord.name}, ${cityRecord.state}` : 'Same city'

  return ((businesses || []) as Array<{
    id: string
    name: string
    category: string | null
    address: string | null
    city_id: string | null
    stage: OnboardingStage
    source: string | null
    status: string
  }>).map((business) => ({
    ...business,
    city_label: cityLabel,
  }))
}

export async function trackBusinessReferralInvite(
  supabase: ServiceSupabaseClient,
  actorProfile: Profile,
  sourceBusiness: Business,
  payload: TrackBusinessReferralInput,
) {
  const targetBusiness = await findOrCreateTargetBusiness(supabase, sourceBusiness, actorProfile, payload)
  const targetContact = await findOrCreateTargetContact(supabase, sourceBusiness, actorProfile, targetBusiness, payload)
  const outreachActivity = await createOutreachActivity(supabase, sourceBusiness, targetBusiness, targetContact, actorProfile, payload)
  const note = await createBusinessNote(supabase, sourceBusiness, targetBusiness, actorProfile, payload, targetContact)
  const createdAt = new Date().toISOString()

  const { data: referral } = (await (supabase
    .from('business_referrals') as any)
    .insert({
      source_business_id: sourceBusiness.id,
      created_by: actorProfile.id,
      target_business_id: targetBusiness.id,
      target_business_name: targetBusiness.name,
      target_city_id: targetBusiness.city_id || sourceBusiness.city_id,
      target_category: targetBusiness.category || payload.targetCategory || null,
      target_contact_id: targetContact?.id || null,
      target_contact_name: targetContact ? [targetContact.first_name, targetContact.last_name].filter(Boolean).join(' ').trim() : clean(payload.targetOwnerName) || null,
      target_contact_email: targetContact?.email || normalizeEmail(payload.targetEmail),
      target_contact_phone: targetContact?.phone || normalizePhoneOrNull(payload.targetPhone),
      channel: payload.channel,
      message_snapshot: clean(payload.message) || null,
      status: 'contacted',
      notes: clean(payload.notes) || null,
      converted_business_id: null,
      metadata: {
        source: 'business_growth_portal',
        created_new_business_lead: isNewBusinessLead(targetBusiness, sourceBusiness, payload),
        outreach_activity_id: outreachActivity?.id || null,
        note_id: note?.id || null,
        script_type: payload.scriptType,
        script_tier: payload.tier,
        fit_reason: clean(payload.fitReason) || null,
        relationship_note: clean(payload.relationshipNote) || null,
        history: [
          {
            type: 'created',
            status: 'contacted',
            note: clean(payload.notes) || 'Initial business intro tracked.',
            at: createdAt,
            by: actorProfile.id,
          },
        ],
      },
    })
    .select()
    .single()) as { data: BusinessReferral | null }

  return {
    referral,
    targetBusiness,
    targetContact,
    outreachActivity,
    note,
  }
}

export async function updateBusinessReferralStatus(
  supabase: ServiceSupabaseClient,
  actorProfile: Profile,
  sourceBusiness: Business,
  payload: UpdateBusinessReferralStatusInput,
) {
  const { data } = await supabase
    .from('business_referrals')
    .select('*')
    .eq('id', payload.referralId)
    .eq('source_business_id', sourceBusiness.id)
    .single()

  const referral = (data || null) as BusinessReferral | null
  if (!referral) throw new Error('Referral not found.')

  const metadata = (referral.metadata as Record<string, unknown> | null) || {}
  const history = Array.isArray(metadata.history) ? [...metadata.history] : []
  history.push({
    type: 'status_change',
    status: payload.status,
    note: clean(payload.note) || null,
    at: new Date().toISOString(),
    by: actorProfile.id,
  })

  const { data: updated, error } = await (supabase.from('business_referrals') as any)
    .update({
      status: payload.status,
      notes: clean(payload.note) || referral.notes,
      converted_business_id: payload.status === 'onboarded' ? referral.target_business_id || referral.converted_business_id : referral.converted_business_id,
      metadata: {
        ...metadata,
        history,
        last_status_changed_at: new Date().toISOString(),
        last_status_changed_by: actorProfile.id,
      },
    })
    .eq('id', referral.id)
    .select()
    .single()

  if (error) throw error

  await createReferralStatusNote(supabase, sourceBusiness, referral, actorProfile, payload)
  return updated as BusinessReferral
}

export function userCanManageBusinessReferrals(profile: Profile | null, business: Business | null) {
  return canManageBusinessJoin(profile, business)
}

async function findOrCreateTargetBusiness(
  supabase: ServiceSupabaseClient,
  sourceBusiness: Business,
  actorProfile: Profile,
  payload: TrackBusinessReferralInput,
) {
  const normalizedName = normalizeBusinessName(payload.targetBusinessName)
  const normalizedEmail = normalizeEmail(payload.targetEmail)
  const normalizedPhone = normalizePhoneOrNull(payload.targetPhone)

  let matchedBusiness: Business | null = null

  if (payload.targetBusinessId) {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', payload.targetBusinessId)
      .single()

    matchedBusiness = (data || null) as Business | null
  }

  if (!matchedBusiness) {
    let query = supabase
      .from('businesses')
      .select('*')
      .limit(150)

    if (sourceBusiness.city_id) {
      query = query.eq('city_id', sourceBusiness.city_id)
    }

    const { data: candidates } = await query

    const existingBusinesses = (candidates || []) as Business[]

    matchedBusiness = existingBusinesses.find((candidate) => {
      const sameName = normalizedName && normalizeBusinessName(candidate.name) === normalizedName
      const sameEmail = normalizedEmail && normalizeEmail(candidate.email) === normalizedEmail
      const samePhone = normalizedPhone && normalizePhoneOrNull(candidate.phone) === normalizedPhone
      return sameName || sameEmail || samePhone
    }) || null
  }

  if (matchedBusiness) {
    const nextCategory = clean(payload.targetCategory)
    const updates: Partial<Business> = {}

    if (!matchedBusiness.category && nextCategory) updates.category = nextCategory
    if (!matchedBusiness.email && normalizedEmail) updates.email = normalizedEmail
    if (!matchedBusiness.phone && normalizedPhone) updates.phone = normalizedPhone
    if (Object.keys(updates).length > 0) {
      const { data } = await (supabase.from('businesses') as any)
        .update({
          ...updates,
          metadata: {
            ...(((matchedBusiness.metadata as Record<string, unknown> | null) || {})),
            last_referral_source_business_id: sourceBusiness.id,
            last_referral_source_business_name: sourceBusiness.name,
            last_referral_at: new Date().toISOString(),
          },
        })
        .eq('id', matchedBusiness.id)
        .select()
        .single()

      return (data || matchedBusiness) as Business
    }

    return matchedBusiness
  }

  const metadata = {
    created_via: 'business_growth_portal',
    lead_origin: 'business_referral',
    referred_by_business_id: sourceBusiness.id,
    referred_by_business_name: sourceBusiness.name,
    referred_by_user_id: actorProfile.id,
    business_referral: true,
  }

  const { data } = await (supabase
    .from('businesses') as any)
    .insert({
      name: clean(payload.targetBusinessName) || 'Unnamed business',
      website: null,
      email: normalizedEmail,
      phone: normalizedPhone,
      address: null,
      city_id: sourceBusiness.city_id,
      category: clean(payload.targetCategory) || null,
      brand: sourceBusiness.brand || actorProfile.brand_context,
      stage: 'lead',
      owner_id: actorProfile.id,
      source: 'Referral',
      source_detail: `Business referral from ${sourceBusiness.name}`,
      campaign_id: sourceBusiness.campaign_id,
      linked_cause_id: null,
      linked_material_id: null,
      linked_qr_code_id: null,
      linked_qr_collection_id: null,
      duplicate_of: null,
      external_id: null,
      public_description: null,
      avg_ticket: null,
      products_services: [],
      activation_status: 'not_started',
      launch_phase: 'setup',
      status: 'active',
      metadata,
    })
    .select()
    .single()

  return data as Business
}

async function findOrCreateTargetContact(
  supabase: ServiceSupabaseClient,
  sourceBusiness: Business,
  actorProfile: Profile,
  targetBusiness: Business,
  payload: TrackBusinessReferralInput,
) {
  const ownerName = clean(payload.targetOwnerName)
  const email = normalizeEmail(payload.targetEmail)
  const phone = normalizePhoneOrNull(payload.targetPhone)
  if (!ownerName && !email && !phone) return null

  const { data: contacts } = await supabase
    .from('contacts')
    .select('*')
    .eq('business_id', targetBusiness.id)
    .limit(50)

  const existing = ((contacts || []) as Contact[]).find((contact) => {
    const sameEmail = email && normalizeEmail(contact.email) === email
    const samePhone = phone && normalizePhoneOrNull(contact.phone) === phone
    const sameName = ownerName
      && `${contact.first_name} ${contact.last_name}`.trim().toLowerCase() === ownerName.toLowerCase()

    return sameEmail || samePhone || sameName
  }) || null

  if (existing) return existing

  const names = splitFullName(ownerName || targetBusiness.name)
  const { data } = await (supabase
    .from('contacts') as any)
    .insert({
      first_name: names.first_name || targetBusiness.name,
      last_name: names.last_name || '',
      email,
      phone,
      title: 'Business owner / contact',
      business_id: targetBusiness.id,
      cause_id: null,
      organization_id: null,
      owner_id: actorProfile.id,
      created_by_user_id: actorProfile.id,
      capture_offer_id: null,
      source: 'business_referral',
      tag: 'Business intro',
      list_status: null,
      invited_at: new Date().toISOString(),
      joined_at: null,
      normalized_email: email,
      normalized_phone: phone,
      duplicate_of: null,
      status: 'active',
      metadata: {
        created_via: 'business_growth_portal',
        referred_by_business_id: sourceBusiness.id,
        referred_by_business_name: sourceBusiness.name,
      },
    })
    .select()
    .single()

  return data as Contact
}

async function createOutreachActivity(
  supabase: ServiceSupabaseClient,
  sourceBusiness: Business,
  targetBusiness: Business,
  targetContact: Contact | null,
  actorProfile: Profile,
  payload: TrackBusinessReferralInput,
) {
  const { data } = await (supabase
    .from('outreach_activities') as any)
    .insert({
      type: mapReferralChannelToOutreachType(payload.channel),
      subject: `Business intro from ${sourceBusiness.name} to ${targetBusiness.name}`,
      body: clean(payload.message) || null,
      entity_type: 'business',
      entity_id: targetBusiness.id,
      performed_by: actorProfile.id,
      user_id: actorProfile.id,
      campaign_id: targetBusiness.campaign_id || sourceBusiness.campaign_id,
      outreach_script_id: null,
      business_id: targetBusiness.id,
      cause_id: null,
      city_id: targetBusiness.city_id || sourceBusiness.city_id,
      contact_id: targetContact?.id || null,
      script_category: 'business_referral',
      script_type: payload.scriptType,
      script_tier: payload.tier,
      script_channel: mapReferralChannelToScriptChannel(payload.channel),
      outreach_status: 'sent',
      business_category: targetBusiness.category,
      generated_script_content: clean(payload.message) || null,
      edited_script_content: clean(payload.message) || null,
      log_notes: clean(payload.notes) || clean(payload.relationshipNote) || clean(payload.fitReason) || null,
      linked_material_id: null,
      linked_qr_code_id: null,
      linked_qr_collection_id: null,
      outcome: null,
      next_step: 'Follow up on business intro',
      next_step_date: null,
      metadata: {
        source: 'business_growth_portal',
        source_business_id: sourceBusiness.id,
        source_business_name: sourceBusiness.name,
        target_contact_name: targetContact ? [targetContact.first_name, targetContact.last_name].filter(Boolean).join(' ').trim() : clean(payload.targetOwnerName) || null,
        fit_reason: clean(payload.fitReason) || null,
        relationship_note: clean(payload.relationshipNote) || null,
      },
    })
    .select()
    .single()

  return data || null
}

async function createBusinessNote(
  supabase: ServiceSupabaseClient,
  sourceBusiness: Business,
  targetBusiness: Business,
  actorProfile: Profile,
  payload: TrackBusinessReferralInput,
  targetContact: Contact | null,
) {
  const lines = [
    `Business-to-business intro from ${sourceBusiness.name}.`,
    clean(payload.fitReason) ? `Why it fits: ${clean(payload.fitReason)}` : '',
    clean(payload.relationshipNote) ? `Relationship note: ${clean(payload.relationshipNote)}` : '',
    targetContact ? `Contact: ${[targetContact.first_name, targetContact.last_name].filter(Boolean).join(' ').trim() || 'Business contact'}${targetContact.email ? ` / ${targetContact.email}` : ''}${targetContact.phone ? ` / ${targetContact.phone}` : ''}` : '',
    clean(payload.notes) ? `Internal note: ${clean(payload.notes)}` : '',
  ].filter(Boolean)

  const { data } = await (supabase
    .from('notes') as any)
    .insert({
      content: lines.join('\n'),
      entity_type: 'business',
      entity_id: targetBusiness.id,
      created_by: actorProfile.id,
      is_internal: true,
      metadata: {
        source: 'business_growth_portal',
        source_business_id: sourceBusiness.id,
        source_business_name: sourceBusiness.name,
        channel: payload.channel,
      },
    })
    .select()
    .single()

  return data || null
}

function normalizeEmail(value: string | null | undefined) {
  const trimmed = clean(value).toLowerCase()
  return trimmed || null
}

function normalizePhoneOrNull(value: string | null | undefined) {
  const trimmed = clean(value)
  if (!trimmed) return null
  const normalized = normalizePhone(trimmed)
  return normalized || null
}

function clean(value: string | null | undefined) {
  return (value || '').replace(/\s+/g, ' ').trim()
}

function mapReferralChannelToOutreachType(channel: BusinessReferralChannel) {
  switch (channel) {
    case 'sms':
      return 'text'
    case 'email':
      return 'email'
    default:
      return 'referral'
  }
}

function mapReferralChannelToScriptChannel(channel: BusinessReferralChannel) {
  switch (channel) {
    case 'sms':
      return 'text_dm'
    case 'email':
      return 'email'
    default:
      return null
  }
}

function isNewBusinessLead(targetBusiness: Business, sourceBusiness: Business, payload: TrackBusinessReferralInput) {
  const metadata = (targetBusiness.metadata as Record<string, unknown> | null) || null
  return metadata?.created_via === 'business_growth_portal'
    && metadata?.referred_by_business_id === sourceBusiness.id
    && normalizeBusinessName(targetBusiness.name) === normalizeBusinessName(payload.targetBusinessName)
}

async function createReferralStatusNote(
  supabase: ServiceSupabaseClient,
  sourceBusiness: Business,
  referral: BusinessReferral,
  actorProfile: Profile,
  payload: UpdateBusinessReferralStatusInput,
) {
  const noteText = [
    `Business referral status changed to ${payload.status}.`,
    clean(payload.note) ? `Update: ${clean(payload.note)}` : '',
    `Source business: ${sourceBusiness.name}.`,
  ].filter(Boolean).join('\n')

  await (supabase.from('notes') as any).insert({
    content: noteText,
    entity_type: 'business',
    entity_id: referral.target_business_id || sourceBusiness.id,
    created_by: actorProfile.id,
    is_internal: true,
    metadata: {
      source: 'business_growth_portal',
      referral_id: referral.id,
      referral_status: payload.status,
    },
  })
}
