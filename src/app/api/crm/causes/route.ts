import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import {
  buildCrmCauseList,
  createQaCause,
  fetchQaCauseList,
  qaCauseCreateError,
  qaCauseRouteError,
} from '@/lib/server/qa-dashboard-causes'
import type { QaCreateCauseInput } from '@/lib/crm-api'
import type { OnboardingStage } from '@/lib/types/database'

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
  if (!context.session.qaSession) {
    return NextResponse.json({ error: 'A QA session is required.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'A cause payload is required.' }, { status: 400 })
  }

  const name = asOptionalString(body.name)
  if (!name) {
    return NextResponse.json({ error: 'Organization name is required.' }, { status: 400 })
  }

  const primaryUserId = asPositiveInteger(body.primaryUserId)
  const ownerFirstName = asOptionalString(body.ownerFirstName)
  const ownerLastName = asOptionalString(body.ownerLastName)
  const ownerEmail = asOptionalString(body.ownerEmail ?? body.email)
  if (!primaryUserId && (!ownerFirstName || !ownerLastName || !ownerEmail)) {
    return NextResponse.json(
      { error: 'Choose an existing primary contact or provide the owner first name, last name, and email.' },
      { status: 400 },
    )
  }

  const address1 = asOptionalString(body.address1)
  const city = asOptionalString(body.city)
  const state = asOptionalString(body.state)
  const zipCode = asOptionalString(body.zipCode)
  const country = asOptionalString(body.country)
  if (!address1 || !city || !state || !zipCode || !country) {
    return NextResponse.json(
      { error: 'Street address, city, state, ZIP code, and country are required.' },
      { status: 400 },
    )
  }

  const payload = {
    name,
    headline: asOptionalString(body.headline),
    description: asOptionalString(body.description),
    category: asOptionalString(body.category ?? body.type),
    crmStage: isOnboardingStage(body.stage) ? body.stage : 'lead',
    ownerFirstName,
    ownerLastName,
    ownerTitle: asOptionalString(body.ownerTitle),
    ownerName: primaryUserId
      ? null
      : asOptionalString(body.ownerName) || [ownerFirstName, ownerLastName].filter(Boolean).join(' ') || null,
    ownerEmail,
    ownerPhone: asOptionalString(body.ownerPhone ?? body.phone),
    primaryUserId,
    sendInvite: body.sendInvite === true,
    address1,
    address2: asOptionalString(body.address2),
    city,
    state,
    zipCode,
    country,
  } satisfies QaCreateCauseInput

  try {
    const result = await createQaCause(payload)
    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    const normalized = qaCauseCreateError(error)
    return NextResponse.json({ error: normalized.message }, { status: normalized.status })
  }
}

function asOptionalString(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function asPositiveInteger(value: unknown) {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
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
