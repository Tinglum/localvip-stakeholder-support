import { NextResponse } from 'next/server'
import type { QaConsumerListItem } from '@/lib/auth/qa-api'
import { fetchQaApi, parseQaJsonResponse } from '@/lib/auth/qa-api'
import { getAuthenticatedSession, type ResolvedAuthSession } from '@/lib/server/auth-session'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import { qaRouteErrorResponse } from '@/lib/server/qa-route'

function parseConsumerIdCandidate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

async function resolveCurrentConsumerId(session: ResolvedAuthSession) {
  const metadata = ((session.profile.metadata as Record<string, unknown> | null) || {})
  const qaClaims = session.qaClaims?.raw && typeof session.qaClaims.raw === 'object'
    ? session.qaClaims.raw as Record<string, unknown>
    : {}

  const candidates = [
    session.viewingAs?.targetUserId,
    session.qaClaims?.sub,
    metadata.view_as_target_user_id,
    metadata.qa_subject,
    qaClaims.sub,
  ]

  for (const candidate of candidates) {
    const parsed = parseConsumerIdCandidate(candidate)
    if (parsed) return parsed
  }

  const targetEmail = session.viewingAs?.targetEmail || session.profile.email || session.qaClaims?.email || null
  if (!targetEmail) return null

  const listRes = await fetchQaApi('/api/dashboard/v1/Consumer')
  const consumers = await parseQaJsonResponse<QaConsumerListItem[]>(listRes, 'Failed to resolve current consumer.')
  const match = consumers.find((consumer) => consumer.email?.trim().toLowerCase() === targetEmail.trim().toLowerCase())
  return match?.id || null
}

async function readOptionalQaJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const res = await fetchQaApi(path)
    return await parseQaJsonResponse<T>(res, `Failed to load ${path}.`)
  } catch {
    return fallback
  }
}

export async function GET() {
  try {
    const session = await getAuthenticatedSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    if (!session.qaSession) {
      return NextResponse.json({ error: 'A QA session is required.' }, { status: 401 })
    }

    const shell = getStakeholderShell(session.profile)
    if (shell !== 'consumer') {
      return NextResponse.json({ error: 'This dashboard is only available for consumer/client users.' }, { status: 403 })
    }

    const consumerId = await resolveCurrentConsumerId(session)
    if (!consumerId) {
      return NextResponse.json({ error: 'We could not match this QA account to a consumer record yet.' }, { status: 404 })
    }

    const summaryRes = await fetchQaApi(`/api/dashboard/v1/Consumer/${consumerId}/summary`)
    const summary = await parseQaJsonResponse(summaryRes, 'Failed to load consumer summary.')

    const [wallet, transactions, cashback, bonusCash, friends, causes, devices] = await Promise.all([
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/wallet`, null),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/transactions`, []),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/cashback`, null),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/bonuscash`, null),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/five-friends`, []),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/ten-causes`, []),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/devices`, []),
    ])

    return NextResponse.json({
      consumerId,
      summary,
      wallet,
      transactions,
      cashback,
      bonusCash,
      friends,
      causes,
      devices,
    })
  } catch (error) {
    return qaRouteErrorResponse(error, 'The current consumer dashboard could not be loaded.')
  }
}
