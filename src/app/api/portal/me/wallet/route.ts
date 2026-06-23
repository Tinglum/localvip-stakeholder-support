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

  const [available, cashback, bonusCash, causeImpact] = await Promise.all([
    readOptionalQaJson('/api/mobile/v1/Wallet/available').catch(() => null),
    readOptionalQaJson('/api/mobile/v1/Payment/cashback/lifetime').catch(() => null),
    readOptionalQaJson('/api/mobile/v1/Payment/bonuscash/lifetime').catch(() => null),
    readOptionalQaJson('/api/mobile/v1/Payment/CauseImpactSummary').catch(() => null),
  ])

  // Available balance should stay cashback-only. Network/bonus earnings are
  // displayed separately on the wallet/network pages so the same money is not
  // double-counted in the customer-facing earnings card.
  const pickNumber = (payload: unknown, keys: string[]): number => {
    if (typeof payload === 'number') return Number.isFinite(payload) ? payload : 0
    if (payload && typeof payload === 'object') {
      for (const key of keys) {
        const raw = (payload as Record<string, unknown>)[key]
        if (typeof raw === 'number' && Number.isFinite(raw)) return raw
        if (typeof raw === 'string' && raw.trim() && Number.isFinite(Number(raw))) return Number(raw)
      }
    }
    return 0
  }
  const availableBase = pickNumber(available, ['availableAmount', 'amount', 'Amount'])

  return NextResponse.json({
    available: availableBase,
    cashback,
    bonusCash,
    causeImpact,
  })
}
