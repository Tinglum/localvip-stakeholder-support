import { NextRequest, NextResponse } from 'next/server'
import { QaApiError } from '@/lib/auth/qa-api'
import { mapQaRoleFromSignals } from '@/lib/auth/qa-auth'
import { getAuthenticatedSession } from '@/lib/server/auth-session'
import { getStakeholderShell, type StakeholderShell } from '@/lib/stakeholder-access'

export async function requireQaRouteAccess(allowedShells?: StakeholderShell[]) {
  const session = await getAuthenticatedSession()
  if (!session) {
    return { error: NextResponse.json({ error: 'Unauthorized.' }, { status: 401 }) }
  }

  if (!session.qaSession) {
    return { error: NextResponse.json({ error: 'A QA session is required.' }, { status: 401 }) }
  }

  const shell = getStakeholderShell(session.profile)

  // Portal account selection changes the active shell. An administrator who
  // selected a cause can therefore look like a cause here even though the
  // signed QA session still belongs to the administrator. That made the CRM's
  // "Log in as Cause" action fail with Forbidden. Authorize admin-only routes
  // from the signed identity when there is no active View As session, while
  // continuing to use the active shell for every other stakeholder route.
  const profileIdentityShell = getStakeholderShell({ ...session.profile, metadata: null })
  const signedRole = mapQaRoleFromSignals({ claims: session.qaClaims })
  const signedIdentityShell = getStakeholderShell({
    ...session.profile,
    role: signedRole.role,
    role_subtype: signedRole.roleSubtype ?? null,
    metadata: null,
  })
  const hasAllowedAdminIdentity =
    !session.viewingAs
    && allowedShells?.includes('admin') === true
    && (profileIdentityShell === 'admin' || signedIdentityShell === 'admin')

  if (allowedShells && !allowedShells.includes(shell) && !hasAllowedAdminIdentity) {
    return { error: NextResponse.json({ error: 'Forbidden.' }, { status: 403 }) }
  }

  return { session, shell }
}

export function parseQaRouteId(value: string) {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null
  return Number(trimmed)
}

export async function parseJsonRequest<T>(request: NextRequest): Promise<T | null> {
  return request.json().catch(() => null)
}

export function qaRouteErrorResponse(error: unknown, fallbackMessage: string) {
  if (error instanceof QaApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : fallbackMessage
  return NextResponse.json({ error: message || fallbackMessage }, { status: 500 })
}
