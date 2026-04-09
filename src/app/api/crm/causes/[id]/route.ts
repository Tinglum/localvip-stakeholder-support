import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { createCauseLifecycle } from '@/lib/server/stakeholder-lifecycle'
import {
  buildCrmCauseDetail,
  fetchQaCauseDetail,
  fetchQaCauseList,
  findQaCauseForLocal,
  parseQaCauseId,
  qaCauseRouteError,
} from '@/lib/server/qa-dashboard-causes'
import { buildQaAccountMetadata, joinAddress, resolveImageUrl } from '@/lib/server/qa-dashboard-shared'
import type { Cause } from '@/lib/types/database'

function buildCauseCreatePayload(
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
    owner_id: null,
    source: 'qa_server',
    source_detail: 'linked_on_open',
    campaign_id: null,
    duplicate_of: null,
    external_id: String(qaCause.id),
    status: qaCause.active ? ('active' as const) : ('inactive' as const),
    metadata: buildCauseMetadata(null, qaCause),
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

async function ensureLinkedCause(supabase: any, actorId: string, qaCause: Awaited<ReturnType<typeof fetchQaCauseDetail>>) {
  const created = await createCauseLifecycle(supabase as any, {
    actorId,
    shell: 'admin',
    cause: buildCauseCreatePayload(qaCause),
  })

  try {
    await supabase
      .from('stakeholders')
      .update({
        owner_user_id: null,
        profile_id: null,
        metadata: {
          auto_created: true,
          source: 'crm_cause_create',
          qa_auto_linked: true,
        },
      })
      .eq('cause_id', created.id)
  } catch {
    // Keep the linked cause usable even if newer stakeholder columns are missing.
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error

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
      localCause = await ensureLinkedCause(context.supabase as any, context.profile.id, qaCause)
    } catch (error) {
      qaError = qaError || qaCauseRouteError(error)
      localCause = await findLocalCauseByQaId(context.supabase as any, qaCause.id)
    }
  } else if (localCause && qaCause) {
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
