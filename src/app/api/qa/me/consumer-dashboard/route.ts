import { NextResponse } from 'next/server'
import type { QaConsumerListItem } from '@/lib/auth/qa-api'
import { fetchQaApi, getQaUserProfile, parseQaJsonResponse } from '@/lib/auth/qa-api'
import { getAuthenticatedSession, type ResolvedAuthSession } from '@/lib/server/auth-session'
import { getStakeholderShell } from '@/lib/stakeholder-access'
import { qaRouteErrorResponse } from '@/lib/server/qa-route'

function parseConsumerIdCandidate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

async function fetchConsumerDetailOptional(consumerId: number) {
  try {
    const detailRes = await fetchQaApi(`/api/dashboard/v1/Consumer/${consumerId}`)
    return await parseQaJsonResponse<Record<string, unknown>>(detailRes, 'Failed to load consumer detail.')
  } catch {
    return null
  }
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
    if (!parsed) continue
    const detail = await fetchConsumerDetailOptional(parsed)
    if (detail) return parsed
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

function toNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

function buildSummaryFallback(
  consumerId: number,
  detail: Record<string, unknown> | null,
  wallet: unknown,
  transactions: unknown,
  cashback: unknown,
  bonusCash: unknown,
  friends: unknown,
  causes: unknown,
  devices: unknown,
) {
  const walletRecord = (wallet && typeof wallet === 'object') ? wallet as Record<string, unknown> : {}
  const cashbackRecord = (cashback && typeof cashback === 'object') ? cashback as Record<string, unknown> : {}
  const bonusCashRecord = (bonusCash && typeof bonusCash === 'object') ? bonusCash as Record<string, unknown> : {}
  const transactionList = Array.isArray(transactions) ? transactions : []
  const friendList = Array.isArray(friends) ? friends : []
  const causeList = Array.isArray(causes) ? causes : []
  const deviceList = Array.isArray(devices) ? devices : []
  const consumer = detail || {}

  return {
    consumer: {
      id: consumerId,
      firstName: typeof consumer.firstName === 'string' ? consumer.firstName : '',
      lastName: typeof consumer.lastName === 'string' ? consumer.lastName : '',
      email: typeof consumer.email === 'string' ? consumer.email : '',
      phoneNumber: typeof consumer.phoneNumber === 'string' ? consumer.phoneNumber : null,
      city: typeof consumer.city === 'string' ? consumer.city : null,
      state: typeof consumer.state === 'string' ? consumer.state : null,
      country: typeof consumer.country === 'string' ? consumer.country : null,
      referralCode: typeof consumer.referralCode === 'string' ? consumer.referralCode : null,
      sharedURL: typeof consumer.sharedURL === 'string' ? consumer.sharedURL : null,
      createdDate: typeof consumer.createdDate === 'string' ? consumer.createdDate : new Date(0).toISOString(),
      isEnabled: typeof consumer.isEnabled === 'boolean' ? consumer.isEnabled : true,
      consumerType: typeof consumer.consumerType === 'string' ? consumer.consumerType : 'Normal',
    },
    wallet: {
      availableAmount: toNumber(walletRecord.availableAmount),
      currentAmount: toNumber(walletRecord.currentAmount),
      walletStatus: typeof walletRecord.walletStatus === 'string' ? walletRecord.walletStatus : '',
    },
    stripeOnboarded:
      typeof walletRecord.hasStripeOnboarding === 'boolean'
        ? walletRecord.hasStripeOnboarding
        : typeof consumer.hasStripeOnboarding === 'boolean'
          ? consumer.hasStripeOnboarding
          : false,
    lifetimeCashback: toNumber(cashbackRecord.lifetimeTotal ?? cashbackRecord.totalAmount),
    lifetimeBonusCash: toNumber(bonusCashRecord.lifetimeTotal ?? bonusCashRecord.totalAmount),
    counts: {
      transactions: transactionList.length,
      friends: friendList.length,
      causes: causeList.length,
      devices: deviceList.length,
    },
  }
}

async function buildProfileOnlyFallback(session: ResolvedAuthSession) {
  const qaProfile = await getQaUserProfile().catch(() => null)
  const profile = session.profile
  const email = qaProfile?.email || profile.email || session.qaClaims?.email || ''
  const firstName = qaProfile?.firstName || profile.full_name?.split(' ')[0] || ''
  const lastName = qaProfile?.lastName || profile.full_name?.split(' ').slice(1).join(' ') || ''
  const createdDate = profile.created_at || new Date(0).toISOString()
  const referralCode = qaProfile?.referralCode || profile.referral_code || null
  const sharedURL = qaProfile?.sharedURL || null
  const accountType = qaProfile?.accountType || null
  const consumerType = typeof (profile.metadata as Record<string, unknown> | null)?.view_as_consumer_type === 'string'
    ? String((profile.metadata as Record<string, unknown>).view_as_consumer_type)
    : 'Normal'

  return {
    consumerId: null,
    summary: {
      consumer: {
        id: 0,
        firstName,
        lastName,
        email,
        phoneNumber: qaProfile?.phoneNumber || null,
        city: qaProfile?.city || null,
        state: qaProfile?.state || null,
        country: qaProfile?.country || null,
        referralCode,
        sharedURL,
        createdDate,
        isEnabled: true,
        consumerType,
      },
      wallet: { availableAmount: 0, currentAmount: 0, walletStatus: accountType ? `QA ${accountType}` : 'Connecting' },
      stripeOnboarded: !!qaProfile?.isStripeOnboardingComplete,
      lifetimeCashback: 0,
      lifetimeBonusCash: 0,
      counts: { transactions: 0, friends: 0, causes: 0, devices: 0 },
    },
    wallet: null,
    transactions: [],
    cashback: null,
    bonusCash: null,
    friends: [],
    causes: [],
    devices: [],
    unresolvedConsumer: true,
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
      const fallback = await buildProfileOnlyFallback(session)
      return NextResponse.json(fallback)
    }

    const consumerDetail = await fetchConsumerDetailOptional(consumerId)
    if (!consumerDetail) {
      const fallback = await buildProfileOnlyFallback(session)
      return NextResponse.json({ ...fallback, consumerId, unresolvedConsumer: true })
    }

    const [wallet, transactions, cashback, bonusCash, friends, causes, devices] = await Promise.all([
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/wallet`, null),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/transactions`, []),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/cashback`, null),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/bonuscash`, null),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/five-friends`, []),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/ten-causes`, []),
      readOptionalQaJson(`/api/dashboard/v1/Consumer/${consumerId}/devices`, []),
    ])

    let summary: unknown = null
    try {
      const summaryRes = await fetchQaApi(`/api/dashboard/v1/Consumer/${consumerId}/summary`)
      summary = await parseQaJsonResponse(summaryRes, 'Failed to load consumer summary.')
    } catch {
      summary = buildSummaryFallback(
        consumerId,
        consumerDetail,
        wallet,
        transactions,
        cashback,
        bonusCash,
        friends,
        causes,
        devices,
      )
    }

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
