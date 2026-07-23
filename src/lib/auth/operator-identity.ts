/**
 * Operator identity for shared logins.
 *
 * The SuperAdmin account is used by several people, so every action taken from it
 * (bug notes, status changes) would otherwise be attributed to one anonymous shared
 * account. When signed in as super_admin the UI offers a picker — the chosen
 * operator is remembered for that browser, for that login session only.
 *
 * Binding rules (why the payload carries `subject`):
 *   - The choice is signed and pinned to the QA subject of the login that made it.
 *   - On read we require the stored subject to equal the *current* session subject.
 *     If someone signs out and signs into a different account in the same browser,
 *     the stale cookie no longer matches and is ignored, so one person's identity
 *     can never bleed onto another account's actions.
 *   - The cookie is a session cookie (no maxAge): closing the browser clears it.
 */
import { cookies } from 'next/headers'
import { signQaStatePayload } from '@/lib/auth/qa-auth'
import type { Profile } from '@/lib/types/database'

export const OPERATOR_COOKIE_NAME = 'lvip_operator'

/** People who share the SuperAdmin login. */
export const OPERATORS = ['Rick', 'Kenneth', 'Jamaica'] as const

export type OperatorName = (typeof OPERATORS)[number]

export interface OperatorSignedPayload {
  /** Chosen display name. */
  operator: OperatorName
  /** QA subject (`qa_subject`) of the login session that made the choice. */
  subject: string
  /** When it was chosen — surfaced in the UI so a stale pick is obvious. */
  since: string
}

export function isOperatorName(value: unknown): value is OperatorName {
  return typeof value === 'string' && (OPERATORS as readonly string[]).includes(value)
}

function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToString(value: string): string {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
}

export async function signOperatorPayload(payload: OperatorSignedPayload): Promise<string> {
  const payloadBase64Url = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await signQaStatePayload(payloadBase64Url)
  return `${payloadBase64Url}.${signature}`
}

/**
 * Verify + decode the cookie. `expectedSubject` is the current session's QA subject;
 * a payload signed by a different login is rejected (returns null) so the choice
 * never carries over to another account signed in on the same computer.
 */
export async function readSignedOperatorPayload(
  value: string | null | undefined,
  expectedSubject: string | null | undefined,
): Promise<OperatorSignedPayload | null> {
  if (!value) return null

  const [payloadBase64Url, signature] = value.split('.')
  if (!payloadBase64Url || !signature) return null

  const expectedSignature = await signQaStatePayload(payloadBase64Url)
  if (signature !== expectedSignature) return null

  try {
    const payload = JSON.parse(base64UrlToString(payloadBase64Url)) as Partial<OperatorSignedPayload>
    if (!isOperatorName(payload.operator)) return null
    if (typeof payload.subject !== 'string' || !payload.subject) return null
    if (typeof payload.since !== 'string') return null

    // The binding check: a choice made under a different login is not ours.
    if (!expectedSubject || payload.subject !== expectedSubject) return null

    return { operator: payload.operator, subject: payload.subject, since: payload.since }
  } catch {
    return null
  }
}

/**
 * Resolve the operator behind the current request, or null when the session isn't a
 * shared super-admin login (or nothing has been chosen yet). Server-only.
 *
 * Use this to attribute writes — e.g. the bug-note author — to the actual person
 * rather than the shared account.
 */
export async function getSessionOperator(profile: Profile | null | undefined): Promise<OperatorName | null> {
  if (!profile || profile.role !== 'super_admin') return null

  const subject = (profile.metadata as Record<string, unknown> | null)?.qa_subject
  if (typeof subject !== 'string' || !subject) return null

  const cookie = cookies().get(OPERATOR_COOKIE_NAME)?.value
  const payload = await readSignedOperatorPayload(cookie, subject)
  return payload?.operator ?? null
}
