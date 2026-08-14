import { NextRequest, NextResponse } from 'next/server'
import { getAdminRouteContext } from '@/lib/server/admin-access'
import {
  clearRepublishRunLog,
  getRepublishPlan,
  normalizeTemplateSource,
  recordRepublishBatch,
  REPUBLISH_BATCH_SIZE,
  RepublishEndpointMissingError,
  runRepublishBatch,
} from '@/lib/server/template-republish'

/**
 * Run ONE batch of the cascade republish.
 *
 * Deliberately one batch per request: hundreds of PDF re-renders will not
 * finish inside a single serverless invocation, and a request that times out
 * mid-write is how you get a half-republished template with no record of where
 * it stopped. The caller loops until `complete`, and because the queue is
 * derived from the data (copies still behind the template version), stopping
 * and re-calling later resumes exactly where it left off.
 *
 * Body: { batchSize?: number, reset?: boolean, source?: string }
 *   reset  — clear the display-only run log before the first batch of a new run.
 *   source — 'material_template' (default) or 'dashboard_material'. The id alone
 *            does not identify a template: the two tables have independent id
 *            sequences, so republishing the wrong one is a real outcome, not a
 *            theoretical one.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const context = await getAdminRouteContext()
  if ('error' in context) return context.error

  let body: { batchSize?: number; reset?: boolean; source?: string } = {}
  try {
    body = (await request.json()) as typeof body
  } catch {
    // No body is fine — defaults apply.
  }

  const source = normalizeTemplateSource(body.source)

  if (body.reset) clearRepublishRunLog(params.id, source)

  try {
    const result = await runRepublishBatch(params.id, {
      batchSize: body.batchSize ?? REPUBLISH_BATCH_SIZE,
      source,
    })
    const run = recordRepublishBatch(params.id, result, source)

    return NextResponse.json({ batch: result, run })
  } catch (error) {
    if (error instanceof RepublishEndpointMissingError) {
      return NextResponse.json({ error: error.message, endpointMissing: true }, { status: 501 })
    }
    const message = error instanceof Error ? error.message : 'Could not republish this batch.'

    // Report what is genuinely still outstanding rather than an opaque failure.
    // If even the plan call fails we say so instead of guessing a number.
    let remaining: number | null = null
    try {
      remaining = (await getRepublishPlan(params.id, source)).outdatedCopies
    } catch {
      remaining = null
    }

    return NextResponse.json({ error: message, remaining }, { status: 400 })
  }
}
