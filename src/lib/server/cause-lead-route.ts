import { NextResponse } from 'next/server'
import { QaApiError } from '@/lib/auth/qa-api'

/** Path prefix for the backend's cause sign-up review endpoints. */
export const CAUSE_LEAD_API = '/api/dashboard/v1/CauseLead'

export const CAUSE_LEAD_UNAVAILABLE_MESSAGE =
  'The cause sign-up endpoint is not available on this backend yet.'

/**
 * Recognises "the backend does not have this endpoint yet".
 *
 * CauseLeadController is written but not yet deployed, so until it ships the QA
 * host answers 404 (no such route) or 405 (route exists, verb does not). That
 * must never be flattened into an empty list or a generic failure: "nobody has
 * signed up" and "the queue cannot be reached" are opposite facts, and a
 * reviewer has to be able to tell them apart.
 *
 * The controller itself also answers 404 with "Lead not found." when an id does
 * not exist, which is a real answer from a deployed endpoint — so that body is
 * excluded here and surfaces as an ordinary error instead.
 */
export function isCauseLeadEndpointMissing(error: unknown): error is QaApiError {
  if (!(error instanceof QaApiError)) return false
  if (error.status === 405) return true
  if (error.status !== 404) return false
  return !/lead not found/i.test(`${error.message} ${error.body ?? ''}`)
}

export function causeLeadUnavailableResponse() {
  return NextResponse.json(
    { error: CAUSE_LEAD_UNAVAILABLE_MESSAGE, unavailable: true },
    { status: 503 },
  )
}
