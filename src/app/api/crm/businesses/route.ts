import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import { createBusinessLifecycle } from '@/lib/server/stakeholder-lifecycle'
import {
  buildCrmBusinessList,
  fetchQaBusinessList,
  qaBusinessRouteError,
} from '@/lib/server/qa-dashboard-businesses'
import type { Brand, Business, OnboardingStage } from '@/lib/types/database'

export async function GET() {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error

  const [{ data: localBusinessesData }, qaResult] = await Promise.all([
    context.supabase
      .from('businesses')
      .select('*')
      .order('updated_at', { ascending: false }),
    fetchQaBusinessList()
      .then(data => ({ data, error: null as string | null }))
      .catch(error => ({ data: [] as Awaited<ReturnType<typeof fetchQaBusinessList>>, error: qaBusinessRouteError(error) })),
  ])

  const localBusinesses = (localBusinessesData || []) as Business[]
  const items = buildCrmBusinessList(localBusinesses, qaResult.data)

  return NextResponse.json({
    items,
    qaError: qaResult.error,
  })
}

export async function POST(request: NextRequest) {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A business payload is required.' }, { status: 400 })
  }

  const name = asOptionalString(body.name)
  if (!name) {
    return NextResponse.json({ error: 'Business name is required.' }, { status: 400 })
  }

  try {
    const business = await createBusinessLifecycle(context.supabase, {
      actorId: context.profile.id,
      shell: context.shell as 'admin' | 'field' | 'launch_partner',
      business: {
        name,
        email: asOptionalString(body.email),
        phone: asOptionalString(body.phone),
        website: asOptionalString(body.website),
        category: asOptionalString(body.category),
        source: asOptionalString(body.source),
        city_id: asOptionalString(body.city_id),
        brand: isBrand(body.brand) ? body.brand : 'localvip',
        stage: isOnboardingStage(body.stage) ? body.stage : 'lead',
        owner_id: context.profile.id,
        owner_user_id: null,
        status: 'active',
        metadata: {
          created_from: 'crm_business_create',
          created_by_shell: context.shell,
          created_by: context.profile.id,
        },
      },
    })

    return NextResponse.json(business)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Business could not be created.'
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
