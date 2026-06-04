import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import {
  buildCrmCauseList,
  fetchQaCauseList,
  qaCauseRouteError,
} from '@/lib/server/qa-dashboard-causes'
import type { Brand, Cause, OnboardingStage } from '@/lib/types/database'

export async function GET() {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error
  if (!context.session.qaSession) {
    return NextResponse.json({ error: 'A QA session is required.' }, { status: 401 })
  }

  const qaResult = await fetchQaCauseList()
    .then(data => ({ data, error: null as string | null }))
    .catch(error => ({ data: [] as Awaited<ReturnType<typeof fetchQaCauseList>>, error: qaCauseRouteError(error) }))

  const items = buildCrmCauseList([], qaResult.data)

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
    return NextResponse.json({ error: 'A cause payload is required.' }, { status: 400 })
  }

  const name = asOptionalString(body.name)
  if (!name) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
  }

  return NextResponse.json(
    {
      error: 'Cause creation is not available until the QA API exposes a create nonprofit/cause endpoint. Local-only cause creation has been disabled.',
      requested: {
        name,
        type: isCauseType(body.type) ? body.type : 'school',
        brand: isBrand(body.brand) ? body.brand : 'localvip',
        stage: isOnboardingStage(body.stage) ? body.stage : 'lead',
        email: asOptionalString(body.email),
        phone: asOptionalString(body.phone),
        website: asOptionalString(body.website),
        city_id: asOptionalString(body.city_id),
        source: asOptionalString(body.source),
        source_detail: asOptionalString(body.source_detail) || 'Added from CRM',
      },
    },
    { status: 501 },
  )
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
