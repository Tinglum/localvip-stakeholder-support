import { NextRequest, NextResponse } from 'next/server'
import { QaApiError } from '@/lib/auth/qa-api'
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
  if (allowedShells && !allowedShells.includes(shell)) {
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
