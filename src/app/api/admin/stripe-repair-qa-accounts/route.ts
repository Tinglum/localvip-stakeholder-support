import { NextResponse } from 'next/server'
import { proxyStripeMaintenance } from '@/lib/server/stripe-maintenance-proxy'
import { STRIPE_REPAIR_QA_ACCOUNTS_PATH } from '@/lib/stripe-maintenance'

export const dynamic = 'force-dynamic'

// Admin-only. Recreates test-mode Connect accounts for businesses that lost
// theirs, so they become chargeable again. The test-key guard lives on the
// backend — this proxy never decides that a live environment is safe to touch.
//
// The upstream path is still being confirmed: it is defined once, in
// STRIPE_REPAIR_QA_ACCOUNTS_PATH (src/lib/stripe-maintenance.ts).
export async function POST() {
  return proxyStripeMaintenance(STRIPE_REPAIR_QA_ACCOUNTS_PATH, {}, true)
}

export function GET() {
  return NextResponse.json({ error: 'Method not allowed.' }, { status: 405 })
}
