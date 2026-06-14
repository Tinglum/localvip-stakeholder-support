import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

async function readOptionalQaJson<T = Record<string, unknown>>(path: string): Promise<T | null> {
  try {
    const res = await fetchQaApi(path)
    return await parseQaJsonResponse<T>(res, `Failed to load ${path}.`)
  } catch {
    return null
  }
}

export async function GET() {
  const access = await requireQaRouteAccess([
    'consumer',
    'admin',
    'field',
    'launch_partner',
    'business',
  ])
  if ('error' in access) {
    return access.error
  }

  const [available, cashback, bonusCash, socialImpact] = await Promise.all([
    readOptionalQaJson('/api/mobile/v1/Wallet/available').catch(() => null),
    readOptionalQaJson('/api/mobile/v1/Payment/cashback/lifetime').catch(() => null),
    readOptionalQaJson('/api/mobile/v1/Payment/bonuscash/lifetime').catch(() => null),
    readOptionalQaJson('/api/mobile/v1/Payment/SocialImpact').catch(() => null),
  ])

  return NextResponse.json({
    available,
    cashback,
    bonusCash,
    socialImpact,
  })
}
