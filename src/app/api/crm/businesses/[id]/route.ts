import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import {
  ensureBusinessOnboardingFlow,
  ensureBusinessStakeholderSetup,
} from '@/lib/server/stakeholder-lifecycle'
import {
  buildCrmBusinessDetail,
  fetchQaBusinessDetail,
  fetchQaBusinessList,
  findQaBusinessForLocal,
  parseQaBusinessId,
  qaBusinessRouteError,
} from '@/lib/server/qa-dashboard-businesses'
import { buildQaAccountMetadata, joinAddress, resolveImageUrl } from '@/lib/server/qa-dashboard-shared'
import { fetchQaUserProfile } from '@/lib/auth/qa-api'
import { normalizeStakeholderCode, buildStakeholderJoinUrl } from '@/lib/material-engine'
import type { Business } from '@/lib/types/database'

function asProfileUuid(value: string | null | undefined) {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function buildBusinessCreatePayload(
  actorId: string | null,
  qaBusiness: Awaited<ReturnType<typeof fetchQaBusinessDetail>>,
) {
  return {
    name: qaBusiness.name,
    website: null,
    email: qaBusiness.ownerEmail || null,
    phone: qaBusiness.ownerPhone || null,
    address:
      qaBusiness.fullAddress ||
      joinAddress([
        qaBusiness.address1,
        qaBusiness.address2,
        qaBusiness.city,
        qaBusiness.state,
        qaBusiness.zipCode,
        qaBusiness.country,
      ]) ||
      null,
    city_id: null,
    category: null,
    brand: 'localvip' as const,
    stage: 'lead' as const,
    owner_id: actorId,
    source: 'qa_server',
    source_detail: 'Imported from QA on first open',
    campaign_id: null,
    duplicate_of: null,
    external_id: String(qaBusiness.id),
    status: qaBusiness.active ? ('active' as const) : ('inactive' as const),
    metadata: {
      created_from: 'qa_business_import',
      qa_import_mode: 'first_open',
      imported_by: actorId,
      ...buildBusinessMetadata(null, qaBusiness),
    },
  } satisfies Partial<Business>
}

async function findLocalBusinessByQaId(supabase: any, qaBusinessId: number) {
  const externalId = String(qaBusinessId)

  const { data: byExternalId } = await supabase
    .from('businesses')
    .select('*')
    .eq('external_id', externalId)
    .maybeSingle()

  if (byExternalId) return byExternalId as Business

  const { data: byMetadata } = await supabase
    .from('businesses')
    .select('*')
    .contains('metadata', { qaAccountId: qaBusinessId })
    .maybeSingle()

  return (byMetadata || null) as Business | null
}

function buildBusinessMetadata(
  existing: Business['metadata'],
  qaBusiness: Awaited<ReturnType<typeof fetchQaBusinessDetail>>,
) {
  return {
    ...((existing as Record<string, unknown> | null) || {}),
    qaAccountId: qaBusiness.id,
    qaBusinessId: qaBusiness.id,
    qaImportedAt: new Date().toISOString(),
    qaApi: buildQaAccountMetadata(qaBusiness),
  }
}

function buildBusinessQaSyncPatch(
  localBusiness: Business | null,
  qaBusiness: Awaited<ReturnType<typeof fetchQaBusinessDetail>>,
) {
  return {
    name: qaBusiness.name,
    email: qaBusiness.ownerEmail || localBusiness?.email || null,
    phone: qaBusiness.ownerPhone || localBusiness?.phone || null,
    address:
      qaBusiness.fullAddress ||
      joinAddress([
        qaBusiness.address1,
        qaBusiness.address2,
        qaBusiness.city,
        qaBusiness.state,
        qaBusiness.zipCode,
        qaBusiness.country,
      ]) ||
      localBusiness?.address ||
      null,
    external_id: String(qaBusiness.id),
    status:
      localBusiness?.status === 'archived'
        ? 'archived'
        : qaBusiness.active
          ? 'active'
          : 'inactive',
    metadata: buildBusinessMetadata(localBusiness?.metadata || null, qaBusiness),
  } satisfies Partial<Business>
}

async function createImportedBusinessRecord(
  supabase: any,
  actorId: string | null,
  qaBusiness: Awaited<ReturnType<typeof fetchQaBusinessDetail>>,
) {
  const { data, error } = await (supabase.from('businesses') as any)
    .insert(buildBusinessCreatePayload(actorId, qaBusiness))
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Business could not be imported.')
  }

  return data as Business
}

async function ensureLinkedBusiness(
  supabase: any,
  actorId: string | null,
  qaBusiness: Awaited<ReturnType<typeof fetchQaBusinessDetail>>,
  initialCodes?: { referral_code?: string | null; connection_code?: string | null; join_url?: string | null },
) {
  const created = await createImportedBusinessRecord(supabase, actorId, qaBusiness)

  const lifecycleResults = await Promise.allSettled([
    ensureBusinessOnboardingFlow(supabase as any, created, actorId),
    ensureBusinessStakeholderSetup(supabase as any, created, actorId, initialCodes),
  ])

  for (const result of lifecycleResults) {
    if (result.status === 'rejected') {
      console.warn('[qa-business-import] lightweight lifecycle setup failed', {
        qaBusinessId: qaBusiness.id,
        localBusinessId: created.id,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      })
    }
  }

  try {
    const { data: syncedBusiness } = await (supabase.from('businesses') as any)
      .update(buildBusinessQaSyncPatch(created, qaBusiness))
      .eq('id', created.id)
      .select('*')
      .single()

    return (syncedBusiness || created) as Business
  } catch {
    return created as Business
  }
}

async function ensureImportedBusinessLifecycle(
  supabase: any,
  actorId: string | null,
  business: Business,
  initialCodes?: { referral_code?: string | null; connection_code?: string | null; join_url?: string | null },
) {
  await Promise.allSettled([
    ensureBusinessOnboardingFlow(supabase as any, business, actorId),
    ensureBusinessStakeholderSetup(supabase as any, business, actorId, initialCodes),
  ])
}

async function repairImportedBusinessRecord(supabase: any, actorId: string | null, business: Business) {
  const patch: Partial<Business> = {}
  if (!business.owner_id && actorId) patch.owner_id = actorId
  if (!business.source) patch.source = 'qa_server'
  if (!business.source_detail) patch.source_detail = 'Imported from QA on first open'

  if (Object.keys(patch).length === 0) return business

  try {
    const { data } = await (supabase.from('businesses') as any)
      .update(patch)
      .eq('id', business.id)
      .select('*')
      .single()

    return (data || business) as Business
  } catch {
    return business
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error
  const localProfileId = asProfileUuid(context.profile.id)
  let createdLocalBusiness = false

  // Fetch QA user profile to pre-fill referral code and link on import
  let qaInitialCodes: { referral_code: string; connection_code: string; join_url: string } | undefined
  try {
    const qaProfile = await fetchQaUserProfile()
    if (qaProfile?.referralCode) {
      const normalized = normalizeStakeholderCode(qaProfile.referralCode)
      if (normalized) {
        qaInitialCodes = {
          referral_code: normalized,
          connection_code: normalized,
          // sharedURL is the Branch.io deep link — best for QR destination (opens app or web)
          // fall back to referralLink, then to our local join URL
          join_url: qaProfile.sharedURL || qaProfile.referralLink || buildStakeholderJoinUrl('business', normalized),
        }
      }
    }
  } catch {
    // non-fatal — codes will be set manually later
  }

  const searchParams = request.nextUrl.searchParams
  const routeId = params.id
  const qaRouteId = routeId.startsWith('qa-') ? routeId.slice(3) : routeId

  let localBusiness: Business | null = null
  if (!routeId.startsWith('qa-')) {
    const { data } = await context.supabase
      .from('businesses')
      .select('*')
      .eq('id', routeId)
      .maybeSingle()

    localBusiness = (data || null) as Business | null
  }

  let qaBusinessId = parseQaBusinessId(searchParams.get('qaId')) || parseQaBusinessId(qaRouteId)
  let qaError: string | null = null

  if (qaBusinessId === null && localBusiness) {
    try {
      const qaBusinesses = await fetchQaBusinessList()
      qaBusinessId = findQaBusinessForLocal(localBusiness, qaBusinesses)?.id || null
    } catch (error) {
      qaError = qaBusinessRouteError(error)
    }
  }

  let qaBusiness = null
  if (qaBusinessId !== null) {
    if (!localBusiness) {
      localBusiness = await findLocalBusinessByQaId(context.supabase as any, qaBusinessId)
    }

    try {
      qaBusiness = await fetchQaBusinessDetail(qaBusinessId)
    } catch (error) {
      qaError = qaBusinessRouteError(error)
    }
  }

  if (!localBusiness && qaBusiness) {
    try {
      localBusiness = await ensureLinkedBusiness(context.supabase as any, localProfileId, qaBusiness, qaInitialCodes)
      createdLocalBusiness = !!localBusiness
    } catch (error) {
      qaError = qaError || qaBusinessRouteError(error)
      localBusiness = await findLocalBusinessByQaId(context.supabase as any, qaBusiness.id)
    }
  }

  if (localBusiness) {
    localBusiness = await repairImportedBusinessRecord(context.supabase as any, localProfileId, localBusiness)
    if (!createdLocalBusiness) {
      await ensureImportedBusinessLifecycle(context.supabase as any, localProfileId, localBusiness, qaInitialCodes)
    }
  }

  if (localBusiness && qaBusiness) {
    try {
      const { data: syncedBusiness } = await (context.supabase.from('businesses') as any)
        .update(buildBusinessQaSyncPatch(localBusiness, qaBusiness))
        .eq('id', localBusiness.id)
        .select('*')
        .single()

      localBusiness = (syncedBusiness || localBusiness) as Business
    } catch (error) {
      qaError = qaError || qaBusinessRouteError(error)
    }
  }

  const detail = buildCrmBusinessDetail(localBusiness, qaBusiness, qaError)
  if (!detail) {
    const status = qaError && !/not found/i.test(qaError) ? 502 : 404
    return NextResponse.json(
      { error: qaError || 'Business not found.' },
      { status },
    )
  }

  return NextResponse.json(detail)
}
