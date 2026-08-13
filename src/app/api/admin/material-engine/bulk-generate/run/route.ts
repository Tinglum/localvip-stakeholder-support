import { NextRequest, NextResponse } from 'next/server'
import { getAdminRouteContext } from '@/lib/server/admin-access'
import {
  BULK_BATCH_LIMIT,
  fetchBulkTargetsByIds,
  fetchBulkTemplate,
  isBoomerangRun,
  runBulkGenerationBatch,
  type BulkQrPurpose,
} from '@/lib/server/bulk-material-generation'

export const dynamic = 'force-dynamic'
// Generation renders a PDF per account; a full batch needs longer than the
// platform default before it starts returning partial nothing.
export const maxDuration = 300

/**
 * Generate one template for one batch of accounts.
 *
 * Deliberately batch-sized rather than "run the whole audience": the caller
 * walks its reviewed list a batch at a time, so a run of several hundred
 * accounts is resumable and never one giant request that either finishes or
 * loses everything.
 *
 * Every account comes back with its own outcome — generated, skipped with the
 * reason, or failed with the error. There is no run-level boolean.
 */
export async function POST(request: NextRequest) {
  const context = await getAdminRouteContext()
  if ('error' in context) return context.error

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'A JSON body is required.' }, { status: 400 })
  }

  const templateId = body.templateId == null ? '' : String(body.templateId).trim()
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required.' }, { status: 400 })
  }

  const requested = Array.isArray(body.accounts) ? body.accounts : []
  const ids = requested
    .map((entry) => {
      const row = entry as Record<string, unknown>
      const accountId = row?.accountId == null ? '' : String(row.accountId).trim()
      const accountType = row?.accountType === 'cause' ? 'cause' as const : 'business' as const
      return accountId ? { accountId, accountType } : null
    })
    .filter((row): row is { accountId: string; accountType: 'business' | 'cause' } => !!row)

  if (!ids.length) {
    return NextResponse.json({ error: 'No accounts were supplied for this batch.' }, { status: 400 })
  }
  if (ids.length > BULK_BATCH_LIMIT) {
    return NextResponse.json(
      { error: `A batch may contain at most ${BULK_BATCH_LIMIT} accounts.` },
      { status: 400 },
    )
  }

  const qrPurpose = readQrPurpose(body.qrPurpose)

  try {
    const template = await fetchBulkTemplate(templateId)
    if (!template) {
      return NextResponse.json({ error: 'That template could not be found.' }, { status: 404 })
    }
    if (!template.is_active) {
      return NextResponse.json({ error: 'That template is not active.' }, { status: 400 })
    }

    const targets = await fetchBulkTargetsByIds(ids)
    // An id the backend no longer returns is reported rather than dropped —
    // "generated 20 of 25" with no explanation for the other five is exactly the
    // reporting this surface exists to avoid.
    const found = new Set(targets.map((t) => `${t.accountType}:${t.accountId}`))
    const missing = ids
      .filter((id) => !found.has(`${id.accountType}:${id.accountId}`))
      .map((id) => ({
        accountId: id.accountId,
        accountType: id.accountType,
        name: `${id.accountType === 'cause' ? 'Cause' : 'Business'} ${id.accountId}`,
        status: 'failed' as const,
        reasonCode: null,
        message: 'This account is no longer in the backend account list.',
        generatedMaterialId: null,
        generatedFileUrl: null,
      }))

    const results = await runBulkGenerationBatch(targets, {
      templateId,
      qrPurpose,
      boomerangRun: isBoomerangRun(qrPurpose, template),
      regenerateExisting: body.regenerateExisting === true,
      requireLogo: body.requireLogo === true,
      libraryFolder: typeof body.libraryFolder === 'string' ? body.libraryFolder : template.library_folder,
    })

    const all = [...results, ...missing]
    return NextResponse.json({
      results: all,
      generated: all.filter((r) => r.status === 'generated').length,
      skipped: all.filter((r) => r.status === 'skipped').length,
      failed: all.filter((r) => r.status === 'failed').length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The batch could not be run.' },
      { status: 400 },
    )
  }
}

function readQrPurpose(value: unknown): BulkQrPurpose {
  if (value === 'business_capture' || value === 'business_network_referral' || value === 'owner_default') {
    return value
  }
  return 'business_network_referral'
}
