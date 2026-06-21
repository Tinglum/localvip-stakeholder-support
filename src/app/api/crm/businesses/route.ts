import { NextRequest, NextResponse } from 'next/server'
import { getOperatorRouteContext } from '@/lib/server/operator-access'
import {
  buildCrmBusinessList,
  fetchQaBusinessDetail,
  fetchQaBusinessList,
  qaBusinessRouteError,
} from '@/lib/server/qa-dashboard-businesses'
import type { QaBusinessListItem } from '@/lib/crm-api'
import type { Brand, OnboardingStage } from '@/lib/types/database'

export async function GET() {
  const context = await getOperatorRouteContext(['admin', 'field', 'launch_partner'])
  if ('error' in context) return context.error
  if (!context.session.qaSession) {
    return NextResponse.json({ error: 'A QA session is required.' }, { status: 401 })
  }

  const qaResult = await fetchQaBusinessList()
    .then(data => ({ data, error: null as string | null }))
    .catch(error => ({ data: [] as Awaited<ReturnType<typeof fetchQaBusinessList>>, error: qaBusinessRouteError(error) }))

  const enrichedQaBusinesses = await enrichQaBusinessesWithStripe(qaResult.data)
  const items = buildCrmBusinessList([], enrichedQaBusinesses)

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

  return NextResponse.json(
    {
      error: 'Business creation is not available until the QA API exposes a create business endpoint. Local-only business creation has been disabled.',
      requested: {
        name,
        email: asOptionalString(body.email),
        phone: asOptionalString(body.phone),
        website: asOptionalString(body.website),
        category: asOptionalString(body.category),
        source: asOptionalString(body.source),
        city_id: asOptionalString(body.city_id),
        brand: isBrand(body.brand) ? body.brand : 'localvip',
        stage: isOnboardingStage(body.stage) ? body.stage : 'lead',
      },
    },
    { status: 501 },
  )
}

async function enrichQaBusinessesWithStripe(qaBusinesses: QaBusinessListItem[]) {
  const detailedResults = await Promise.allSettled(
    qaBusinesses.map(async (business) => {
      if (typeof business.hasStripeOnboarding === 'boolean') return business

      try {
        const detail = await fetchQaBusinessDetail(business.id)
        return {
          ...business,
          hasStripeOnboarding: detail.hasStripeOnboarding,
        }
      } catch {
        return business
      }
    }),
  )

  return detailedResults.map((result, index) =>
    result.status === 'fulfilled' ? result.value : qaBusinesses[index],
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
