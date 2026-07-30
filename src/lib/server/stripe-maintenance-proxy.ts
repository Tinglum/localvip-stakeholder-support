import { NextResponse } from 'next/server'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { fetchQaApi } from '@/lib/auth/qa-api'
import { isAdminProfile } from '@/lib/stakeholder-access'
import {
  normalizeStripeMaintenanceResult,
  stripeMaintenanceFailure,
} from '@/lib/stripe-maintenance'

/**
 * Shared body for the two Stripe maintenance proxies.
 *
 * These are mutating admin operations, so the degradation rule is the opposite
 * of the readiness report's: a broken call resolves to an explicit
 * `{ ok: false, error }` at HTTP 200 — never a crash, and never an empty
 * success the admin could mistake for "nothing needed fixing".
 */
export async function proxyStripeMaintenance(
  upstreamPath: string,
  body: Record<string, unknown>,
  fallbackApplied: boolean,
) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }
  if (!isAdminProfile(session.profile)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (session.source !== 'qa') {
    return NextResponse.json(
      stripeMaintenanceFailure('This session is not connected to the QA backend, so Stripe data cannot be changed.'),
    )
  }

  try {
    const res = await fetchQaApi(upstreamPath, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    })

    const raw = await res.text().catch(() => '')

    if (!res.ok) {
      return NextResponse.json(
        stripeMaintenanceFailure(upstreamErrorMessage(raw, res.status, upstreamPath), res.status),
      )
    }

    let parsed: unknown = null
    try {
      parsed = raw.trim() ? JSON.parse(raw) : null
    } catch {
      return NextResponse.json(
        stripeMaintenanceFailure('The backend replied with a response we could not read as JSON.', res.status),
      )
    }

    const result = normalizeStripeMaintenanceResult(parsed, fallbackApplied)
    if (!result) {
      return NextResponse.json(
        stripeMaintenanceFailure(
          'The backend replied, but not with a result we recognise. Nothing here can be trusted as done.',
          res.status,
        ),
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error && error.message ? error.message : 'The request to the backend failed.'
    return NextResponse.json(stripeMaintenanceFailure(message))
  }
}

function upstreamErrorMessage(raw: string, status: number, upstreamPath: string) {
  if (status === 404) {
    return `The backend has no endpoint at ${upstreamPath} (404). It may not be deployed yet, or the path may have changed.`
  }

  const trimmed = raw.trim()
  if (trimmed) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>
      for (const key of ['error', 'message', 'detail', 'title']) {
        const value = parsed[key]
        if (typeof value === 'string' && value.trim()) return `${value.trim()} (HTTP ${status})`
      }
    } catch {
      // Plain text body — use it as-is, truncated.
    }
    return `${trimmed.slice(0, 400)} (HTTP ${status})`
  }

  return `The backend rejected the request with HTTP ${status}.`
}
