import { NextResponse } from 'next/server'
import { proxyStripeMaintenance } from '@/lib/server/stripe-maintenance-proxy'
import { STRIPE_PURGE_STALE_REFERENCES_PATH } from '@/lib/stripe-maintenance'

export const dynamic = 'force-dynamic'

// Admin-only. Scans stored Stripe ids and, with `apply: true`, nulls the dead
// ones. `apply` defaults to false so a malformed request can only ever dry-run.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { apply?: unknown } | null
  const apply = body?.apply === true

  return proxyStripeMaintenance(STRIPE_PURGE_STALE_REFERENCES_PATH, { apply }, apply)
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
}
