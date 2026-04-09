import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { createBusinessLifecycle } from '@/lib/server/stakeholder-lifecycle'
import {
  buildCrmBusinessDetail,
  fetchQaBusinessDetail,
  fetchQaBusinessList,
  findQaBusinessForLocal,
  parseQaBusinessId,
  qaBusinessRouteError,
} from '@/lib/server/qa-dashboard-businesses'
import { buildQaAccountMetadata, joinAddress, resolveImageUrl } from '@/lib/server/qa-dashboard-shared'
import type { Business } from '@/lib/types/database'

function buildBusinessCreatePayload(
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
    owner_id: null,
    source: 'qa_server',
    source_detail: 'linked_on_open',
    campaign_id: null,
    duplicate_of: null,
    external_id: String(qaBusiness.id),
    status: qaBusiness.active ? ('active' as const) : ('inactive' as const),
    metadata: buildBusinessMetadata(null, qaBusiness),
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

async function ensureLinkedBusiness(supabase: any, actorId: string, qaBusiness: Awaited<ReturnType<typeof fetchQaBusinessDetail>>) {
  const created = await createBusinessLifecycle(supabase as any, {
    actorId,
    shell: 'admin',
    business: buildBusinessCreatePayload(qaBusiness),
  })

  try {
    await supabase
      .from('stakeholders')
      .update({
        owner_user_id: null,
        profile_id: null,
        metadata: {
          auto_created: true,
          source: 'crm_business_create',
          qa_auto_linked: true,
        },
      })
      .eq('business_id', created.id)
  } catch {
    // Keep the linked business usable even if newer stakeholder columns are missing.
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error

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
      localBusiness = await ensureLinkedBusiness(context.supabase as any, context.profile.id, qaBusiness)
    } catch (error) {
      qaError = qaError || qaBusinessRouteError(error)
      localBusiness = await findLocalBusinessByQaId(context.supabase as any, qaBusiness.id)
    }
  } else if (localBusiness && qaBusiness) {
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
