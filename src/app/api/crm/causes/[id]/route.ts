import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import {
  ensureCauseOnboardingFlow,
  ensureCauseStakeholderSetup,
} from '@/lib/server/stakeholder-lifecycle'
import {
  buildCrmCauseDetail,
  fetchQaCauseDetail,
  fetchQaCauseList,
  findQaCauseForLocal,
  parseQaCauseId,
  qaCauseRouteError,
} from '@/lib/server/qa-dashboard-causes'
import { buildQaAccountMetadata, joinAddress, resolveImageUrl } from '@/lib/server/qa-dashboard-shared'
import { buildStakeholderJoinUrl, normalizeStakeholderCode } from '@/lib/material-engine'
import type { Cause } from '@/lib/types/database'

function asProfileUuid(value: string | null | undefined) {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

function buildCauseCreatePayload(
  actorId: string | null,
  qaCause: Awaited<ReturnType<typeof fetchQaCauseDetail>>,
) {
  return {
    name: qaCause.name,
    type: 'nonprofit' as const,
    organization_id: null,
    website: null,
    email: qaCause.ownerEmail || null,
    phone: qaCause.ownerPhone || null,
    address:
      qaCause.fullAddress ||
      joinAddress([
        qaCause.address1,
        qaCause.address2,
        qaCause.city,
        qaCause.state,
        qaCause.zipCode,
        qaCause.country,
      ]) ||
      null,
    city_id: null,
    brand: 'localvip' as const,
    stage: 'lead' as const,
    owner_id: actorId,
    source: 'qa_server',
    source_detail: 'Imported from QA on first open',
    campaign_id: null,
    duplicate_of: null,
    external_id: String(qaCause.id),
    status: qaCause.active ? ('active' as const) : ('inactive' as const),
    metadata: {
      created_from: 'qa_cause_import',
      qa_import_mode: 'first_open',
      imported_by: actorId,
      ...buildCauseMetadata(null, qaCause),
    },
  } satisfies Partial<Cause>
}

async function findLocalCauseByQaId(supabase: any, qaCauseId: number) {
  const externalId = String(qaCauseId)

  const { data: byExternalId } = await supabase
    .from('causes')
    .select('*')
    .eq('external_id', externalId)
    .maybeSingle()

  if (byExternalId) return byExternalId as Cause

  const { data: byMetadata } = await supabase
    .from('causes')
    .select('*')
    .contains('metadata', { qaAccountId: qaCauseId })
    .maybeSingle()

  return (byMetadata || null) as Cause | null
}

function buildCauseMetadata(
  existing: Cause['metadata'],
  qaCause: Awaited<ReturnType<typeof fetchQaCauseDetail>>,
) {
  return {
    ...((existing as Record<string, unknown> | null) || {}),
    qaAccountId: qaCause.id,
    qaCauseId: qaCause.id,
    qaImportedAt: new Date().toISOString(),
    qaApi: buildQaAccountMetadata(qaCause),
  }
}

function buildCauseQaSyncPatch(
  localCause: Cause | null,
  qaCause: Awaited<ReturnType<typeof fetchQaCauseDetail>>,
) {
  return {
    name: qaCause.name,
    email: qaCause.ownerEmail || localCause?.email || null,
    phone: qaCause.ownerPhone || localCause?.phone || null,
    address:
      qaCause.fullAddress ||
      joinAddress([
        qaCause.address1,
        qaCause.address2,
        qaCause.city,
        qaCause.state,
        qaCause.zipCode,
        qaCause.country,
      ]) ||
      localCause?.address ||
      null,
    external_id: String(qaCause.id),
    status:
      localCause?.status === 'archived'
        ? 'archived'
        : qaCause.active
          ? 'active'
          : 'inactive',
    metadata: buildCauseMetadata(localCause?.metadata || null, qaCause),
  } satisfies Partial<Cause>
}

async function createImportedCauseRecord(
  supabase: any,
  actorId: string | null,
  qaCause: Awaited<ReturnType<typeof fetchQaCauseDetail>>,
) {
  const { data, error } = await (supabase.from('causes') as any)
    .insert(buildCauseCreatePayload(actorId, qaCause))
    .select('*')
    .single()

  if (error || !data) {
    throw new Error(error?.message || 'Cause could not be imported.')
  }

  return data as Cause
}

async function ensureLinkedCause(
  supabase: any,
  actorId: string | null,
  qaCause: Awaited<ReturnType<typeof fetchQaCauseDetail>>,
  initialCodes?: { referral_code?: string | null; connection_code?: string | null; join_url?: string | null },
) {
  const created = await createImportedCauseRecord(supabase, actorId, qaCause)

  const lifecycleResults = await Promise.allSettled([
    ensureCauseOnboardingFlow(supabase as any, created, actorId),
    ensureCauseStakeholderSetup(supabase as any, created, actorId, initialCodes),
  ])

  for (const result of lifecycleResults) {
    if (result.status === 'rejected') {
      console.warn('[qa-cause-import] lightweight lifecycle setup failed', {
        qaCauseId: qaCause.id,
        localCauseId: created.id,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      })
    }
  }

  try {
    const { data: syncedCause } = await (supabase.from('causes') as any)
      .update(buildCauseQaSyncPatch(created, qaCause))
      .eq('id', created.id)
      .select('*')
      .single()

    return (syncedCause || created) as Cause
  } catch {
    return created as Cause
  }
}

async function ensureImportedCauseLifecycle(
  supabase: any,
  actorId: string | null,
  cause: Cause,
  initialCodes?: { referral_code?: string | null; connection_code?: string | null; join_url?: string | null },
) {
  await Promise.allSettled([
    ensureCauseOnboardingFlow(supabase as any, cause, actorId),
    ensureCauseStakeholderSetup(supabase as any, cause, actorId, initialCodes),
  ])
}

async function repairImportedCauseRecord(supabase: any, actorId: string | null, cause: Cause) {
  const patch: Partial<Cause> = {}
  if (!cause.owner_id && actorId) patch.owner_id = actorId
  if (!cause.source) patch.source = 'qa_server'
  if (!cause.source_detail) patch.source_detail = 'Imported from QA on first open'

  if (Object.keys(patch).length === 0) return cause

  try {
    const { data } = await (supabase.from('causes') as any)
      .update(patch)
      .eq('id', cause.id)
      .select('*')
      .single()

    return (data || cause) as Cause
  } catch {
    return cause
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error
  const localProfileId = asProfileUuid(context.profile.id)
  let createdLocalCause = false

  // Seed codes from the operator's QA profile (synced at login by syncQaReferralToProfile).
  // referral_code   = profile.referral_code   (e.g. "B3275049")
  // connection_code = last segment of qa_shared_url (e.g. "mskyS8Kto2b")
  // join_url        = qa_referral_link with /join/ replaced by /support/
  let qaInitialCodes: { referral_code: string; connection_code: string; join_url: string } | undefined
  const profileMeta = (context.profile.metadata || {}) as Record<string, unknown>
  const profileReferralCode = context.profile.referral_code
  if (profileReferralCode) {
    const sharedUrl = typeof profileMeta.qa_shared_url === 'string' ? profileMeta.qa_shared_url : null
    const referralLink = typeof profileMeta.qa_referral_link === 'string' ? profileMeta.qa_referral_link : null
    const connectionCode = sharedUrl
      ? normalizeStakeholderCode(sharedUrl.split('/').pop() || '') || normalizeStakeholderCode(profileReferralCode)
      : normalizeStakeholderCode(profileReferralCode)
    if (connectionCode) {
      qaInitialCodes = {
        referral_code: profileReferralCode,
        connection_code: connectionCode,
        // Causes use /support/<code>, not /join/<code>
        join_url: referralLink
          ? referralLink.replace('/join/', '/support/')
          : buildStakeholderJoinUrl('cause', connectionCode),
      }
    }
  }

  const searchParams = request.nextUrl.searchParams
  const routeId = params.id
  const qaRouteId = routeId.startsWith('qa-') ? routeId.slice(3) : routeId

  let localCause: Cause | null = null
  if (!routeId.startsWith('qa-')) {
    const { data } = await context.supabase
      .from('causes')
      .select('*')
      .eq('id', routeId)
      .maybeSingle()

    localCause = (data || null) as Cause | null
  }

  let qaCauseId = parseQaCauseId(searchParams.get('qaId')) || parseQaCauseId(qaRouteId)
  let qaError: string | null = null

  if (qaCauseId === null && localCause) {
    try {
      const qaCauses = await fetchQaCauseList()
      qaCauseId = findQaCauseForLocal(localCause, qaCauses)?.id || null
    } catch (error) {
      qaError = qaCauseRouteError(error)
    }
  }

  let qaCause = null
  if (qaCauseId !== null) {
    if (!localCause) {
      localCause = await findLocalCauseByQaId(context.supabase as any, qaCauseId)
    }

    try {
      qaCause = await fetchQaCauseDetail(qaCauseId)
    } catch (error) {
      qaError = qaCauseRouteError(error)
    }
  }

  if (!localCause && qaCause) {
    try {
      localCause = await ensureLinkedCause(context.supabase as any, localProfileId, qaCause, qaInitialCodes)
      createdLocalCause = !!localCause
    } catch (error) {
      qaError = qaError || qaCauseRouteError(error)
      localCause = await findLocalCauseByQaId(context.supabase as any, qaCause.id)
    }
  }

  if (localCause) {
    localCause = await repairImportedCauseRecord(context.supabase as any, localProfileId, localCause)
    if (!createdLocalCause) {
      await ensureImportedCauseLifecycle(context.supabase as any, localProfileId, localCause, qaInitialCodes)
    }
  }

  if (localCause && qaCause) {
    try {
      const { data: syncedCause } = await (context.supabase.from('causes') as any)
        .update(buildCauseQaSyncPatch(localCause, qaCause))
        .eq('id', localCause.id)
        .select('*')
        .single()

      localCause = (syncedCause || localCause) as Cause
    } catch (error) {
      qaError = qaError || qaCauseRouteError(error)
    }
  }

  const detail = buildCrmCauseDetail(localCause, qaCause, qaError)
  if (!detail) {
    const status = qaError && !/not found/i.test(qaError) ? 502 : 404
    return NextResponse.json(
      { error: qaError || 'Cause not found.' },
      { status },
    )
  }

  return NextResponse.json(detail)
}
