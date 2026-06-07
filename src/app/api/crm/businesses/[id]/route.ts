import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import {
  ensureBusinessOnboardingFlow,
  ensureBusinessStakeholderSetup,
  createBusinessLifecycle,
} from '@/lib/server/stakeholder-lifecycle'
import {
  buildCrmBusinessDetail,
  fetchQaBusinessDetail,
  fetchQaBusinessList,
  findQaBusinessForLocal,
  parseQaBusinessId,
  qaBusinessRouteError,
} from '@/lib/server/qa-dashboard-businesses'
import { getQaAccountIdFromLocal } from '@/lib/server/qa-dashboard-shared'
import {
  buildImportedBusinessPayload,
  buildImportedBusinessSyncPatch,
} from '@/lib/server/qa-business-stakeholders'
import type { Business } from '@/lib/types/database'

function asProfileUuid(value: string | null | undefined) {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
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

async function ensureImportedBusinessLifecycle(
  supabase: any,
  actorId: string | null,
  business: Business,
) {
  await Promise.allSettled([
    ensureBusinessOnboardingFlow(supabase as any, business, actorId),
    ensureBusinessStakeholderSetup(supabase as any, business, actorId),
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

  const canReadQa = !!context.session.qaSession
  const localProfileId = asProfileUuid(context.profile.id)
  let createdLocalBusiness = false

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
    qaBusinessId = getQaAccountIdFromLocal(localBusiness)
  }

  if (canReadQa && qaBusinessId === null && localBusiness) {
    try {
      qaBusinessId = findQaBusinessForLocal(localBusiness, await fetchQaBusinessList())?.id || null
    } catch (error) {
      qaError = qaBusinessRouteError(error)
    }
  }

  let qaBusiness = null
  if (canReadQa && qaBusinessId !== null) {
    if (!localBusiness) {
      localBusiness = await findLocalBusinessByQaId(context.supabase as any, qaBusinessId)
    }

    try {
      qaBusiness = await fetchQaBusinessDetail(qaBusinessId)
    } catch (error) {
      qaError = qaBusinessRouteError(error)
    }
  }

  if (canReadQa && !localBusiness && qaBusiness) {
    try {
      localBusiness = await createBusinessLifecycle(context.supabase as any, {
        business: buildImportedBusinessPayload(localProfileId, qaBusiness),
        actorId: localProfileId,
        shell: context.shell as 'admin' | 'field' | 'launch_partner',
      })
      createdLocalBusiness = !!localBusiness
    } catch (error) {
      qaError = qaError || qaBusinessRouteError(error)
      localBusiness = await findLocalBusinessByQaId(context.supabase as any, qaBusiness.id)
    }
  }

  if (localBusiness) {
    localBusiness = await repairImportedBusinessRecord(context.supabase as any, localProfileId, localBusiness)
    if (!createdLocalBusiness) {
      await ensureImportedBusinessLifecycle(context.supabase as any, localProfileId, localBusiness)
    }
  }

  if (canReadQa && localBusiness && qaBusiness) {
    try {
      const { data: syncedBusiness } = await (context.supabase.from('businesses') as any)
        .update(buildImportedBusinessSyncPatch(localBusiness, qaBusiness))
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
