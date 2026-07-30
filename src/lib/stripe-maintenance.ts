/**
 * Admin repair controls for the dead-Stripe-id problem.
 *
 * The Stripe platform was replaced, so a large share of the Stripe ids stored
 * against local rows now point at nothing. Two SysAdmin-only operations fix
 * that, both mutating and both dangerous enough that the UI treats a failure as
 * a failure — never as an empty, cheerful success.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Upstream QA endpoints
//
// EDIT HERE if the backend lands on a different path. These two constants are
// the only place either path is written; the proxy routes import them.
//
// Both paths are confirmed against the deployed backend. The repair route is
// named force-test-ready to match the pre-existing cookie-authenticated action
// on StripeBulkOnboardController; the two share one implementation
// (StripeTestReadyService), and this bearer-authenticated twin exists because
// the dashboard talks to QA with a bearer token and cannot use the cookie one.
// ─────────────────────────────────────────────────────────────────────────────

export const STRIPE_PURGE_STALE_REFERENCES_PATH =
  '/api/dashboard/v1/StripeConnect/purge-stale-references'

export const STRIPE_REPAIR_QA_ACCOUNTS_PATH =
  '/api/dashboard/v1/StripeConnect/force-test-ready'

// ─────────────────────────────────────────────────────────────────────────────
// Shapes
// ─────────────────────────────────────────────────────────────────────────────

/** ok = id resolves upstream, stale = dead id, unknown = could not be checked. */
export type StripeReferenceClassification = 'ok' | 'stale' | 'unknown'

export interface StripeMaintenanceRow {
  /** Business, Cause, Consumer… whatever table the id was stored on. */
  entityType: string
  /** Local primary key, as text — ids differ in type between tables. */
  entityId: string | null
  name: string
  /** The stored Stripe id, before the operation ran. */
  stripeId: string | null
  classification: StripeReferenceClassification
  /** True only when this row's stored id was actually nulled. */
  cleared: boolean
  /** Repair only: the test-mode account created for this row. */
  newStripeId: string | null
  detail: string | null
}

export interface StripeMaintenanceSuccess {
  ok: true
  /** False for a dry run. A dry run must never report anything as cleared. */
  applied: boolean
  scanned: number
  staleCount: number
  changedCount: number
  rows: StripeMaintenanceRow[]
  message: string | null
}

export interface StripeMaintenanceFailure {
  ok: false
  /** Upstream HTTP status, or 0 when the call never completed. */
  status: number
  error: string
}

export type StripeMaintenanceOutcome = StripeMaintenanceSuccess | StripeMaintenanceFailure

export function stripeMaintenanceFailure(error: string, status = 0): StripeMaintenanceFailure {
  return { ok: false, status, error }
}

// ─────────────────────────────────────────────────────────────────────────────
// Normalisation
// ─────────────────────────────────────────────────────────────────────────────

function asString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function asIdString(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value)
  return asString(value)
}

function asCount(value: unknown) {
  const parsed = typeof value === 'string' ? Number(value) : value
  return typeof parsed === 'number' && Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null
}

function asClassification(value: unknown): StripeReferenceClassification {
  const raw = asString(value)?.toLowerCase()
  if (raw === 'ok' || raw === 'valid' || raw === 'live') return 'ok'
  if (raw === 'stale' || raw === 'dead' || raw === 'missing') return 'stale'
  return 'unknown'
}

function normalizeRow(value: unknown): StripeMaintenanceRow | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>

  const entityType = asString(record.entityType) || asString(record.entity) || 'Unknown'
  const entityId = asIdString(record.entityId ?? record.localId ?? record.accountId ?? record.id)
  const name = asString(record.name) || asString(record.businessName) || (entityId ? `${entityType} #${entityId}` : entityType)
  const classification = asClassification(record.classification ?? record.status)

  return {
    entityType,
    entityId,
    name,
    stripeId: asString(record.stripeId ?? record.stripeAccountId ?? record.staleStripeId),
    classification,
    cleared: record.cleared === true || record.wasCleared === true,
    newStripeId: asString(record.newStripeId ?? record.createdStripeAccountId),
    detail: asString(record.detail ?? record.reason ?? record.message),
  }
}

/**
 * Returns null when the payload is not recognisably a maintenance result, so
 * the caller reports a failure rather than inventing an empty success.
 */
export function normalizeStripeMaintenanceResult(
  value: unknown,
  fallbackApplied: boolean,
): StripeMaintenanceSuccess | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>

  // purge-stale-references returns `references`; force-test-ready returns
  // `results`. Both are accepted so neither endpoint has to rename its payload.
  const rawRows = Array.isArray(record.references)
    ? record.references
    : Array.isArray(record.rows)
      ? record.rows
      : Array.isArray(record.results)
        ? record.results
        : Array.isArray(record.items)
          ? record.items
          : null
  if (!rawRows) return null

  const rows = rawRows
    .map(normalizeRow)
    .filter((row): row is StripeMaintenanceRow => row !== null)

  const applied = typeof record.applied === 'boolean' ? record.applied : fallbackApplied
  const stale = rows.filter((row) => row.classification === 'stale').length
  const changed = rows.filter((row) => row.cleared || row.newStripeId).length

  return {
    ok: true,
    applied,
    scanned: asCount(record.scanned ?? record.totalScanned ?? record.total) ?? rows.length,
    staleCount: asCount(record.staleCount) ?? stale,
    // Trust the rows over the served count: the rows are what we render.
    changedCount: changed || asCount(record.clearedCount ?? record.changedCount) || 0,
    rows,
    message: asString(record.message ?? record.summary),
  }
}

/** Reads either outcome shape off a proxy response body. */
export function readStripeMaintenanceOutcome(value: unknown): StripeMaintenanceOutcome {
  if (!value || typeof value !== 'object') {
    return stripeMaintenanceFailure('The server returned an unreadable response.')
  }

  const record = value as Record<string, unknown>
  if (record.ok === true && Array.isArray(record.rows)) {
    return record as unknown as StripeMaintenanceSuccess
  }

  const error = asString(record.error) || asString(record.message) || 'The operation failed.'
  return stripeMaintenanceFailure(error, asCount(record.status) ?? 0)
}

export function classificationLabel(classification: StripeReferenceClassification) {
  if (classification === 'ok') return 'Live'
  if (classification === 'stale') return 'Dead'
  return 'Unknown'
}

export function classificationBadgeVariant(classification: StripeReferenceClassification) {
  if (classification === 'ok') return 'success' as const
  if (classification === 'stale') return 'danger' as const
  return 'warning' as const
}
