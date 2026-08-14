/**
 * Cascade republish: push a corrected template design out to every account that
 * already generated a copy of it.
 *
 * WHY THIS LIVES HERE AND NOT IN material-engine.ts
 * -------------------------------------------------
 * `material-engine.ts` renders through `createServiceClient()` from
 * `@/lib/supabase/server`, which is a STUB — every query resolves to
 * `{ data: [], error: null }`. Nothing it writes reaches a database. The real
 * generated_materials / material_templates rows live in the .NET QA backend
 * (SQL Server), reached over `/api/dashboard/v1/...`. So a republish built on
 * the material engine would report success and change nothing — precisely the
 * failure mode this feature exists to avoid. Everything here talks to the QA
 * backend directly.
 *
 * RESUMABILITY MODEL
 * ------------------
 * There is deliberately no job table. The work queue is DERIVED from the data:
 * "every copy of template T whose templateVersion < T.version". Re-rendering a
 * copy stamps the new version onto it, so it drops out of the queue. If a run
 * dies halfway, the copies it did not reach are still stale and the next run
 * picks up exactly those. Running twice is therefore safe and idempotent, and
 * progress cannot drift out of sync with a separate bookkeeping table.
 *
 * The in-memory run log below is *display only* — it holds the per-account
 * result rows for the admin UI while the browser is driving the batches. The
 * authoritative "how much is left" number always comes from a fresh plan call.
 */

import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'

/** Backend endpoints this feature depends on. See REQUIRED_ENDPOINTS docs below. */
const TEMPLATE_ENDPOINT = '/api/dashboard/v1/MaterialTemplate'

/**
 * WHICH TABLE A TEMPLATE ID NAMES
 * -------------------------------
 * A generated copy's templateId is ambiguous — it is either a MaterialTemplates
 * row or a DashboardMaterials row flagged is_template (the "Use This As an
 * Automation Template" panel in the Materials Library upload dialog). The two
 * tables have independent id sequences, so id 42 can mean two different designs.
 *
 * `dashboard_material` is the path that actually matters: MaterialTemplates has
 * one unused row on QA, while the materials-library templates are what real
 * businesses have generated copies from. It is not the default only because
 * omitting the discriminator has to keep meaning what it meant before.
 */
export const TEMPLATE_SOURCES = ['material_template', 'dashboard_material'] as const
export type TemplateSource = (typeof TEMPLATE_SOURCES)[number]
export const DEFAULT_TEMPLATE_SOURCE: TemplateSource = 'material_template'

/** Anything unrecognised (or absent) means the MaterialTemplates path. */
export function normalizeTemplateSource(value: unknown): TemplateSource {
  return value === 'dashboard_material' ? 'dashboard_material' : DEFAULT_TEMPLATE_SOURCE
}

/**
 * Run logs and plans are keyed by BOTH id and source — keying on id alone would
 * merge the progress of two unrelated templates that happen to share a number.
 */
function templateKey(templateId: string | number, source: TemplateSource): string {
  return `${source}:${templateId}`
}

/** Default accounts per batch. Small enough that a serverless request finishes. */
export const REPUBLISH_BATCH_SIZE = 25
export const REPUBLISH_MAX_BATCH_SIZE = 100

export interface RepublishTargetSummary {
  generatedMaterialId: number
  businessAccountId: number | null
  causeAccountId: number | null
  accountName: string | null
  currentTemplateVersion: number
  versionNumber: number
  generationStatus: string
  isActive: boolean
}

export interface RepublishPlan {
  templateId: number
  templateName: string
  /** Which table templateId names. Echoed by the backend, never inferred here. */
  templateSource: TemplateSource
  templateVersion: number
  /** Copies that exist at all, across every account. */
  totalCopies: number
  /** Copies whose templateVersion is behind templateVersion — the actual work. */
  outdatedCopies: number
  /** Distinct accounts behind the current version. */
  affectedAccounts: number
  /** First page of the queue, for showing the admin who is affected. */
  sample: RepublishTargetSummary[]
}

export type RepublishItemStatus = 'republished' | 'failed' | 'skipped'

export interface RepublishItemResult {
  generatedMaterialId: number
  accountId: number | null
  accountName: string | null
  status: RepublishItemStatus
  /** Populated for `failed` and `skipped`. Never collapsed into a boolean. */
  message: string | null
  newGeneratedMaterialId?: number | null
  newVersionNumber?: number | null
}

export interface RepublishBatchResult {
  templateId: number
  templateSource: TemplateSource
  templateVersion: number
  attempted: number
  succeeded: number
  failed: number
  skipped: number
  /** Copies still behind the template version AFTER this batch. */
  remaining: number
  /** True when `remaining` is 0 and there is nothing left to do. */
  complete: boolean
  items: RepublishItemResult[]
}

/**
 * Raised when the QA backend does not (yet) expose the republish endpoints.
 * Surfaced to the admin as a clear "not deployed" message rather than a silent
 * no-op or a generic 500.
 */
export class RepublishEndpointMissingError extends Error {
  readonly endpoint: string

  constructor(endpoint: string) {
    super(
      `The QA backend does not expose ${endpoint}. Cascade republish needs the `
      + `MaterialTemplate republish endpoints (see REQUIRED_ENDPOINTS in `
      + `src/lib/server/template-republish.ts) to be deployed first.`,
    )
    this.name = 'RepublishEndpointMissingError'
    this.endpoint = endpoint
  }
}

async function callQa<T>(path: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  const response = await fetchQaApi(path, init)
  // A 404/405 here means the route itself is absent, not that a template is
  // missing — the backend 404s a missing template with a JSON body, while an
  // unrouted path returns the framework's empty 404. Distinguish on the body so
  // a genuine "template not found" still reads as such.
  if (response.status === 404 || response.status === 405) {
    const body = await response.clone().text().catch(() => '')
    if (!body.trim() || !body.includes('"')) {
      throw new RepublishEndpointMissingError(path)
    }
  }
  return (await parseQaResponse<T>(response, fallback)) as T
}

/**
 * Dry run. Answers "how many accounts would this touch" without changing
 * anything, so the admin can look before committing.
 */
export async function getRepublishPlan(
  templateId: string | number,
  source: TemplateSource = DEFAULT_TEMPLATE_SOURCE,
): Promise<RepublishPlan> {
  return callQa<RepublishPlan>(
    `${TEMPLATE_ENDPOINT}/${encodeURIComponent(String(templateId))}/republish-plan`
      + `?templateSource=${encodeURIComponent(source)}`,
    { method: 'GET' },
    'Could not build the republish plan.',
  )
}

/**
 * Re-render the next `batchSize` outdated copies.
 *
 * The backend picks the batch itself (oldest-updated first) so two concurrent
 * runs cannot both claim the same rows — the dashboard never sends an offset,
 * because an offset over a shrinking queue silently skips rows.
 */
export async function runRepublishBatch(
  templateId: string | number,
  options?: { batchSize?: number; source?: TemplateSource },
): Promise<RepublishBatchResult> {
  const requested = Number(options?.batchSize ?? REPUBLISH_BATCH_SIZE)
  const batchSize = Number.isFinite(requested)
    ? Math.min(Math.max(Math.trunc(requested), 1), REPUBLISH_MAX_BATCH_SIZE)
    : REPUBLISH_BATCH_SIZE

  return callQa<RepublishBatchResult>(
    `${TEMPLATE_ENDPOINT}/${encodeURIComponent(String(templateId))}/republish-batch`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // templateSource travels in the body rather than the route so the backend
      // keeps one implementation for both tables and old callers still work.
      body: JSON.stringify({ batchSize, templateSource: options?.source ?? DEFAULT_TEMPLATE_SOURCE }),
    },
    'Could not republish this batch.',
  )
}

/* ------------------------------------------------------------------------- */
/* Run log (display only — see the resumability note at the top of the file)  */
/* ------------------------------------------------------------------------- */

export interface RepublishRunLog {
  templateId: number
  templateSource: TemplateSource
  startedAt: string
  updatedAt: string
  batches: number
  attempted: number
  succeeded: number
  failed: number
  skipped: number
  /** Every failure, kept in full. Successes are kept capped (see MAX_KEPT). */
  failures: RepublishItemResult[]
  recent: RepublishItemResult[]
  remaining: number | null
  complete: boolean
}

const MAX_KEPT = 200
const runLogs = new Map<string, RepublishRunLog>()

export function recordRepublishBatch(
  templateId: string | number,
  result: RepublishBatchResult,
  source: TemplateSource = DEFAULT_TEMPLATE_SOURCE,
): RepublishRunLog {
  const key = templateKey(templateId, source)
  const now = new Date().toISOString()
  const existing = runLogs.get(key)

  const log: RepublishRunLog = existing ?? {
    templateId: Number(templateId),
    templateSource: source,
    startedAt: now,
    updatedAt: now,
    batches: 0,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    skipped: 0,
    failures: [],
    recent: [],
    remaining: null,
    complete: false,
  }

  log.updatedAt = now
  log.batches += 1
  log.attempted += result.attempted
  log.succeeded += result.succeeded
  log.failed += result.failed
  log.skipped += result.skipped
  log.remaining = result.remaining
  log.complete = result.complete
  // Failures are the whole point of this screen, so they are never trimmed away
  // in favour of successes.
  log.failures = [...log.failures, ...result.items.filter((item) => item.status === 'failed')].slice(-MAX_KEPT)
  log.recent = [...result.items, ...log.recent].slice(0, MAX_KEPT)

  runLogs.set(key, log)
  return log
}

export function getRepublishRunLog(
  templateId: string | number,
  source: TemplateSource = DEFAULT_TEMPLATE_SOURCE,
): RepublishRunLog | null {
  return runLogs.get(templateKey(templateId, source)) ?? null
}

export function clearRepublishRunLog(templateId: string | number, source: TemplateSource = DEFAULT_TEMPLATE_SOURCE) {
  runLogs.delete(templateKey(templateId, source))
}

/**
 * REQUIRED_ENDPOINTS — the exact backend contract this file is written against.
 *
 * Schema additions (SQL Server, via EF migration):
 *   MaterialTemplates.Version           int           NOT NULL DEFAULT 1
 *   DashboardMaterials.Version          int           NOT NULL DEFAULT 1  (pre-existing)
 *   GeneratedMaterials.TemplateVersion  int           NOT NULL DEFAULT 1
 *   GeneratedMaterials.IsOutdated       bit           NOT NULL DEFAULT 0
 *   GeneratedMaterials.TemplateSource   nvarchar(32)  NOT NULL DEFAULT 'material_template'
 *
 * TemplateSource is the discriminator that makes TemplateVersion meaningful:
 * TemplateId names EITHER a MaterialTemplates row or a DashboardMaterials row
 * flagged IsTemplate, and the two id sequences are independent. Every query
 * below is scoped by (TemplateSource, TemplateId) — never TemplateId alone.
 * The backend stamps it at generation time from whichever branch it rendered.
 *
 * 1. PUT /api/dashboard/v1/MaterialTemplate/{id}
 *    (existing endpoint, behaviour change) — when SourcePath, QrPositionJson or
 *    OutputFormat changes, increment Version and set IsOutdated = 1 on every
 *    GeneratedMaterials row with TemplateSource = 'material_template' and that
 *    TemplateId. Must attach explicitly (global NoTracking) or the write
 *    silently does nothing.
 *
 * 1b. PUT /api/dashboard/v1/Material/{id}
 *    The same behaviour for a materials-library template: FileUrl and Metadata
 *    are its SourcePath / QrPositionJson equivalents, and a change to either
 *    bumps DashboardMaterials.Version and flags copies with TemplateSource =
 *    'dashboard_material'. Version is NOT client-settable — the dashboard PUTs
 *    the whole entity back, so honouring it would overwrite the bump.
 *
 * 2. GET /api/dashboard/v1/MaterialTemplate/{id}/republish-plan?templateSource=…
 *    Operator/SysAdmin only. Cross-account by design — the account-scope rule on
 *    GeneratedMaterialController.GetAll must NOT apply here.
 *    templateSource: 'material_template' (default when absent) | 'dashboard_material'.
 *    200 -> RepublishPlan (see interface above).
 *
 * 3. POST /api/dashboard/v1/MaterialTemplate/{id}/republish-batch
 *    Body: { batchSize: number, templateSource?: string }   (batchSize 1..100)
 *    Operator/SysAdmin only. Selects the next `batchSize` GeneratedMaterials
 *    rows where TemplateSource = templateSource AND TemplateId = id AND
 *    TemplateVersion < template.Version, oldest UpdatedAt first, and for EACH one:
 *      a. archive the current row into GeneratedMaterialVersions
 *         (GeneratedMaterialId, VersionNumber, FileUrl, FileName, Metadata)
 *         so the previous render stays retrievable;
 *      b. re-render from the template's CURRENT SourcePath + QrPositionJson,
 *         reusing that account's own QR selection and logo — the QrCodeId /
 *         QrContent / QrImageBase64 recorded in the row's Metadata, falling back
 *         to the account's owner join QR exactly as Generate does. This is a
 *         re-render per account, never a copy of one file to everyone;
 *      c. write the new file, then update the row in place: GeneratedFileUrl,
 *         GeneratedFileName, VersionNumber + 1, TemplateVersion = template.Version,
 *         IsOutdated = 0, GenerationStatus = "completed", GeneratedAt, UpdatedAt.
 *    A per-item render failure must NOT abort the batch: leave that row's
 *    TemplateVersion untouched (so a re-run retries it), set GenerationError,
 *    and report it in `items` with a human-readable `message`.
 *    200 -> RepublishBatchResult (see interface above). `remaining` must be
 *    recounted from the database after the batch, not inferred.
 */
export const REQUIRED_ENDPOINTS = [
  'PUT  /api/dashboard/v1/MaterialTemplate/{id}          (bump Version, flag copies outdated)',
  'PUT  /api/dashboard/v1/Material/{id}                  (same, for a materials-library template)',
  'GET  /api/dashboard/v1/MaterialTemplate/{id}/republish-plan?templateSource=…',
  'POST /api/dashboard/v1/MaterialTemplate/{id}/republish-batch  { batchSize, templateSource }',
] as const
