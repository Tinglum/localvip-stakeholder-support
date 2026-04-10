import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { createCauseLifecycle } from '@/lib/server/stakeholder-lifecycle'
import {
  buildCrmCauseList,
  fetchQaCauseList,
  qaCauseRouteError,
} from '@/lib/server/qa-dashboard-causes'
import type { Brand, Cause, OnboardingStage } from '@/lib/types/database'

function asProfileUuid(value: string | null | undefined) {
  if (!value) return null
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null
}

export async function GET() {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error

  const [{ data: localCausesData }, qaResult] = await Promise.all([
    context.supabase
      .from('causes')
      .select('*')
      .order('updated_at', { ascending: false }),
    fetchQaCauseList()
      .then(data => ({ data, error: null as string | null }))
      .catch(error => ({ data: [] as Awaited<ReturnType<typeof fetchQaCauseList>>, error: qaCauseRouteError(error) })),
  ])

  const localCauses = (localCausesData || []) as Cause[]
  const items = buildCrmCauseList(localCauses, qaResult.data)

  return NextResponse.json({
    items,
    qaError: qaResult.error,
  })
}

export async function POST(request: NextRequest) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error
  const localProfileId = asProfileUuid(context.profile.id)

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A cause payload is required.' }, { status: 400 })
  }

  const name = asOptionalString(body.name)
  if (!name) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
  }

  try {
    const cause = await createCauseLifecycle(context.supabase, {
      actorId: localProfileId,
      shell: context.shell as 'admin' | 'field' | 'launch_partner',
      cause: {
        name,
        type: isCauseType(body.type) ? body.type : 'school',
        brand: isBrand(body.brand) ? body.brand : 'localvip',
        stage: isOnboardingStage(body.stage) ? body.stage : 'lead',
        status: 'active',
        owner_id: localProfileId,
        email: asOptionalString(body.email),
        phone: asOptionalString(body.phone),
        website: asOptionalString(body.website),
        city_id: asOptionalString(body.city_id),
        source: asOptionalString(body.source),
        source_detail: asOptionalString(body.source_detail) || 'Added from CRM',
        address: null,
        organization_id: null,
        campaign_id: null,
        duplicate_of: null,
        external_id: null,
        metadata: {
          created_from: 'crm_cause_create',
          created_by_shell: context.shell,
          created_by: context.profile.id,
        },
      },
    })

    return NextResponse.json(cause)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Cause could not be created.'
    const status = /active owner/i.test(message) ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function isBrand(value: unknown): value is Brand {
  return value === 'localvip' || value === 'hato'
}

function isOnboardingStage(value: unknown): value is OnboardingStage {
  return value === 'lead'
    || value === 'contacted'
    || value === 'interested'
    || value === 'in_progress'
    || value === 'onboarded'
    || value === 'live'
    || value === 'paused'
    || value === 'declined'
}

function isCauseType(value: unknown): value is Cause['type'] {
  return value === 'school'
    || value === 'nonprofit'
    || value === 'church'
    || value === 'community'
    || value === 'other'
}
