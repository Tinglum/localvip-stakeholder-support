import type { QaConsumerListItem } from '@/lib/auth/qa-api'
import { fetchQaApi, fetchQaApiWithAccessToken, parseQaJsonResponse } from '@/lib/auth/qa-api'
import type { ResolvedAuthSession } from '@/lib/server/auth-session'

type RawConsumerTransaction = {
  Id?: number | string
  id?: number | string
  AccountId?: number | string
  accountId?: number | string
  Title?: string | null
  title?: string | null
  Amount?: number | string
  amount?: number | string
  MerchantId?: number | string | null
  merchantId?: number | string | null
  Tip?: number | string
  tip?: number | string
  Cashback?: number | string
  cashback?: number | string
  WalletAmount?: number | string
  walletAmount?: number | string
  TransactionStatus?: string | null
  transactionStatus?: string | null
  TransactionType?: string | null
  transactionType?: string | null
  DateTime?: string | null
  dateTime?: string | null
  CreatedDate?: string | null
  createdDate?: string | null
  FinalAmount?: number | string
  finalAmount?: number | string
}

export interface QaConsumerTransaction {
  id: number
  accountId: number | null
  title: string | null
  amount: number
  tip: number
  cashback: number
  walletAmount: number
  finalAmount: number
  transactionStatus: string | null
  transactionType: string | null
  dateTime: string | null
}

export function toQaNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export function parseConsumerIdCandidate(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) return Number(value.trim())
  return null
}

export async function fetchConsumerDetailOptional(consumerId: number) {
  try {
    const detailRes = await fetchQaApi(`/api/dashboard/v1/Consumer/${consumerId}`)
    return await parseQaJsonResponse<Record<string, unknown>>(detailRes, 'Failed to load consumer detail.')
  } catch {
    return null
  }
}

export async function resolveCurrentConsumerId(session: ResolvedAuthSession) {
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

export function normalizeQaConsumerTransaction(raw: RawConsumerTransaction, index: number): QaConsumerTransaction {
  return {
    id: Number(raw.Id ?? raw.id ?? index),
    accountId: parseConsumerIdCandidate(raw.AccountId ?? raw.accountId ?? raw.MerchantId ?? raw.merchantId),
    title: raw.Title ?? raw.title ?? null,
    amount: toQaNumber(raw.Amount ?? raw.amount),
    tip: toQaNumber(raw.Tip ?? raw.tip),
    cashback: toQaNumber(raw.Cashback ?? raw.cashback),
    walletAmount: toQaNumber(raw.WalletAmount ?? raw.walletAmount),
    finalAmount: toQaNumber(raw.FinalAmount ?? raw.finalAmount),
    transactionStatus: raw.TransactionStatus ?? raw.transactionStatus ?? null,
    transactionType: raw.TransactionType ?? raw.transactionType ?? null,
    dateTime: raw.DateTime ?? raw.dateTime ?? raw.CreatedDate ?? raw.createdDate ?? null,
  }
}

/**
 * Read a consumer's transactions from the SAME endpoint the WebApp uses.
 *
 * Bug #114: the dashboard totalled tips from /api/dashboard/v1/Consumer/{id}/
 * transactions while the WebApp read /api/mobile/v1/Payment/transactions. Two
 * implementations, so two answers - that one capped at 1000 rows (the caller
 * never passed a limit), applied no TransactionStatus filter, and did no
 * timezone conversion. Rather than reconcile them, both surfaces now read the
 * one endpoint, so the numbers agree by construction.
 *
 * The mobile endpoint resolves the consumer from the bearer token, not from a
 * route id, so viewing another customer requires impersonating them through
 * Admin/LoginAs - the same mechanism the wallet and causes routes use.
 */
export async function fetchQaConsumerTransactionsForSession(session: {
  viewingAs?: { targetUserId?: number | null } | null
}) {
  let fetcher: (path: string) => Promise<Response> = fetchQaApi
  const targetUserId = session.viewingAs?.targetUserId
  if (targetUserId) {
    const loginAsRes = await fetchQaApi('/api/dashboard/v1/Admin/LoginAs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    })
    const loginAs = await parseQaJsonResponse<{ accessToken: string }>(
      loginAsRes,
      'Unable to read the selected customer transactions.',
    )
    fetcher = (path) => fetchQaApiWithAccessToken(path, loginAs.accessToken)
  }

  const res = await fetcher('/api/mobile/v1/Payment/transactions')
  const payload = await parseQaJsonResponse<RawConsumerTransaction[]>(res, 'Failed to load transactions.')
  const rows = Array.isArray(payload) ? payload : []
  return rows.map(normalizeQaConsumerTransaction)
}

export async function fetchQaConsumerTransactions(consumerId: number) {
  const res = await fetchQaApi(`/api/dashboard/v1/Consumer/${consumerId}/transactions`)
  const payload = await parseQaJsonResponse<RawConsumerTransaction[]>(res, 'Failed to load transactions.')
  const rows = Array.isArray(payload) ? payload : []
  return rows.map(normalizeQaConsumerTransaction)
}

export function resolveTransactionSpendAmount(transaction: Pick<QaConsumerTransaction, 'amount' | 'finalAmount'>) {
  if (transaction.amount > 0) return transaction.amount
  if (transaction.finalAmount > 0) return transaction.finalAmount
  return 0
}
