import { cookies } from 'next/headers'
import {
  getQaSessionFromCookieStore,
  hasRequiredQaScopes,
  mergeScopeLists,
  normalizeQaClaims,
  QA_AUTH_CONFIG,
  type QaSession,
} from '@/lib/auth/qa-auth'

type CachedQaToken = {
  accessToken: string
  expiresAt: number
  /** Refreshed id_token, when the server returned one. Null if it did not. */
  idToken?: string | null
}

const qaRefreshTokenCache = new Map<string, CachedQaToken>()

function buildQaApiUrl(path: string) {
  return path.startsWith('http')
    ? path
    : `${QA_AUTH_CONFIG.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function getQaAccessToken() {
  // Read with allowExpired so the refresh cache is still consulted once the cookie
  // has expired. With the strict read this returned null in exactly that window --
  // between a refresh and the cookies being persisted -- and outbound calls went
  // out unauthenticated instead of using the freshly refreshed token.
  const session = getQaSessionFromCookieStore(cookies(), { allowExpired: true })
  const refreshToken = session?.refreshToken || null
  const now = Math.floor(Date.now() / 1000)

  if (refreshToken) {
    const cached = qaRefreshTokenCache.get(refreshToken)
    if (cached && cached.expiresAt > now + 30) {
      return cached.accessToken
    }
  }

  // May be an expired token: that yields a 401, which fetchQaApi already handles by
  // refreshing and retrying, so it self-heals.
  return session?.accessToken || null
}

/**
 * Resolve the QA session, refreshing the access token if it has expired.
 *
 * Why this exists: getQaSessionFromCookieStore returns null the moment the access
 * token expires, which made getAuthenticatedSession report "not authenticated" and
 * bounced the user to the QA login — while a perfectly good refresh token sat in
 * the cookie. The existing refresh only ran on a 401 from an API call, so it never
 * covered session resolution itself.
 *
 * Fails safe: any refresh problem returns null, i.e. exactly the previous
 * behaviour (log in again). It can only turn a forced logout into a working
 * session, never the reverse.
 *
 * `refreshed` tells the caller the cookies need rewriting. Only a Route Handler or
 * Server Action may set cookies, so persistence is the caller's job — a Server
 * Component still benefits from the refreshed token in-process, and the cache in
 * getQaAccessToken keeps that token usable until a route handler persists it.
 */
export async function resolveQaSessionWithRefresh(
  cookieStore: Parameters<typeof getQaSessionFromCookieStore>[0],
): Promise<{ session: QaSession; refreshed: boolean } | null> {
  const live = getQaSessionFromCookieStore(cookieStore)
  if (live) return { session: live, refreshed: false }

  // Expired (or unreadable). Only an expired-but-refreshable session is recoverable.
  const expired = getQaSessionFromCookieStore(cookieStore, { allowExpired: true })
  if (!expired?.refreshToken) return null

  try {
    const next = await refreshQaAccessToken(expired.refreshToken)
    // Prefer a freshly issued id_token; keep the old one when the server did not
    // send a new one, since a stale hint is still better than none.
    const idToken = next.idToken || expired.idToken
    const claims = normalizeQaClaims(next.accessToken, idToken)
    const grantedScopes = mergeScopeLists(expired.grantedScopes.join(' '), claims.scopes)
    if (grantedScopes.length === 0 || !hasRequiredQaScopes(grantedScopes)) return null

    return {
      session: {
        ...expired,
        accessToken: next.accessToken,
        expiresAt: next.expiresAt,
        idToken,
        claims,
        grantedScopes,
      },
      refreshed: true,
    }
  } catch {
    // Refresh token rejected/expired — genuinely needs a fresh login.
    return null
  }
}

async function refreshQaAccessToken(refreshToken: string) {
  const tokenUrl = buildQaApiUrl('/connect/token')
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: QA_AUTH_CONFIG.clientId,
    refresh_token: refreshToken,
  })

  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  }

  if (QA_AUTH_CONFIG.clientSecret) {
    const credentials = Buffer.from(`${QA_AUTH_CONFIG.clientId}:${QA_AUTH_CONFIG.clientSecret}`).toString('base64')
    headers.authorization = `Basic ${credentials}`
  }

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers,
    body: body.toString(),
    cache: 'no-store',
  })

  const json = await response.json().catch(() => null) as {
    access_token?: string
    id_token?: string
    expires_in?: number | string
    error?: string
    error_description?: string
  } | null

  if (!response.ok || !json?.access_token) {
    throw new Error(json?.error_description || json?.error || 'QA access-token refresh failed.')
  }

  const expiresIn = typeof json.expires_in === 'number'
    ? json.expires_in
    : Number.parseInt(String(json.expires_in || '3600'), 10)
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(expiresIn || 3600, 300)
  const next = {
    accessToken: String(json.access_token),
    expiresAt,
    // Capture a refreshed id_token when the server sends one. It is the
    // id_token_hint used at logout, and its lifetime is only an hour — letting it
    // go stale is what makes IdentityServer refuse to redirect back to us on
    // sign-out (see isIdTokenUsableAsHint).
    idToken: typeof json.id_token === 'string' && json.id_token ? json.id_token : null,
  } satisfies CachedQaToken

  qaRefreshTokenCache.set(refreshToken, next)
  // Returns the whole token record, not just the string: the session resolver needs
  // expiresAt to rebuild a valid session (and to write the cookie).
  return next
}

export async function fetchQaApi(path: string, init?: RequestInit) {
  const session = getQaSessionFromCookieStore(cookies())
  const accessToken = session?.accessToken || null
  if (!accessToken) {
    throw new Error('No QA access token available.')
  }

  const url = buildQaApiUrl(path)

  const makeHeaders = (token: string) => {
    const headers = new Headers(init?.headers || {})
    headers.set('authorization', `Bearer ${token}`)
    return headers
  }

  const response = await fetch(url, {
    ...init,
    headers: makeHeaders(accessToken),
    cache: 'no-store',
  })

  if (response.status !== 401 || !session?.refreshToken) {
    return response
  }

  try {
    const refreshed = await refreshQaAccessToken(session.refreshToken)
    return fetch(url, {
      ...init,
      headers: makeHeaders(refreshed.accessToken),
      cache: 'no-store',
    })
  } catch {
    return response
  }
}

export async function fetchQaPublicApi(path: string, init?: RequestInit) {
  const url = buildQaApiUrl(path)

  return fetch(url, {
    ...init,
    cache: 'no-store',
  })
}

export class QaApiError extends Error {
  status: number
  body: string | null

  constructor(message: string, status: number, body: string | null = null) {
    super(message)
    this.name = 'QaApiError'
    this.status = status
    this.body = body
  }
}

function getQaErrorMessage(payload: unknown) {
  if (!payload || typeof payload !== 'object') return null

  const record = payload as Record<string, unknown>
  const candidates = [
    record.error,
    record.message,
    record.detail,
    record.title,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  return null
}

async function createQaApiError(response: Response, fallbackMessage: string) {
  const contentType = response.headers.get('content-type') || ''
  const rawBody = await response.text().catch(() => '')

  if (contentType.includes('application/json') && rawBody.trim()) {
    try {
      const parsed = JSON.parse(rawBody) as unknown
      const message = getQaErrorMessage(parsed) || fallbackMessage
      return new QaApiError(message, response.status, rawBody)
    } catch {
      // fall through to plain-text handling
    }
  }

  const message = rawBody.trim() || fallbackMessage
  return new QaApiError(message, response.status, rawBody || null)
}

export async function parseQaResponse<T = unknown>(
  response: Response,
  fallbackMessage: string,
): Promise<T | null> {
  if (!response.ok) {
    throw await createQaApiError(response, fallbackMessage)
  }

  if (response.status === 204) return null

  const contentType = response.headers.get('content-type') || ''
  const rawBody = await response.text().catch(() => '')
  if (!rawBody.trim()) return null

  if (contentType.includes('application/json')) {
    return JSON.parse(rawBody) as T
  }

  return rawBody as T
}

export async function parseQaJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const parsed = await parseQaResponse<T>(response, fallbackMessage)
  if (parsed === null) {
    throw new QaApiError(fallbackMessage, response.status)
  }
  return parsed
}

export interface QaUserProfile {
  email: string
  phoneNumber: string | null
  firstName: string
  middleName: string | null
  lastName: string
  accountType: string
  role: string
  address1?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zipCode?: string | null
  referralCode: string | null
  sharedURL: string | null
  referralLink: string | null
  isStripeOnboardingComplete: boolean
}

export interface QaUserProfileUpdateInput {
  firstName: string
  lastName: string
  phoneNumber: string
  city: string
  state: string
  zipCode: string
  country: string
}

export interface QaUserReferralCodeInput {
  referralCode: string
}

export interface QaUserChangePasswordInput {
  currentPassword: string
  newPassword: string
}

export interface QaUserForgotPasswordInput {
  email: string
}

export interface QaConsumerType {
  id: number
  name: string
}

export interface QaConsumerListItem {
  id: number
  firstName: string
  lastName: string
  email: string
  phoneNumber: string | null
  city: string | null
  state: string | null
  country: string | null
  createdDate: string
  isEnabled: boolean
  consumerType: string
  consumerTypeId: number
}

export interface QaConsumerDetail {
  id: number
  firstName: string
  middleName: string | null
  lastName: string
  email: string
  phoneNumber: string | null
  address1: string | null
  address2: string | null
  city: string | null
  state: string | null
  zipCode: string | null
  country: string | null
  referralCode: string | null
  sharedURL: string | null
  createdDate: string
  isEnabled: boolean
  consumerType: string
  consumerTypeId: number
  hasStripeOnboarding: boolean
}

export async function getQaUserProfile(): Promise<QaUserProfile> {
  const res = await fetchQaApi('/api/dashboard/v1/User/profile')
  return parseQaJsonResponse<QaUserProfile>(res, 'The QA user profile request failed.')
}

export async function fetchQaUserProfile(): Promise<QaUserProfile | null> {
  try {
    return await getQaUserProfile()
  } catch {
    return null
  }
}

export async function updateQaUserProfile(payload: QaUserProfileUpdateInput) {
  const res = await fetchQaApi('/api/dashboard/v1/User/profile', {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseQaResponse(res, 'The QA user profile update failed.')
}

export async function submitQaReferralCode(payload: QaUserReferralCodeInput) {
  const res = await fetchQaApi('/api/dashboard/v1/User/referral-code', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseQaResponse(res, 'The QA referral code request failed.')
}

export async function changeQaUserPassword(payload: QaUserChangePasswordInput) {
  const res = await fetchQaApi('/api/dashboard/v1/User/change-password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseQaResponse(res, 'The QA password change request failed.')
}

export async function forgotQaUserPassword(payload: QaUserForgotPasswordInput) {
  const res = await fetchQaPublicApi('/api/dashboard/v1/User/forgot-password', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  return parseQaResponse(res, 'The QA forgot-password request failed.')
}

export async function fetchQaConsumerList() {
  const res = await fetchQaApi('/api/dashboard/v1/Consumer')
  return parseQaJsonResponse<QaConsumerListItem[]>(res, 'The QA consumer list request failed.')
}

export async function fetchQaConsumerDetail(id: number) {
  const res = await fetchQaApi(`/api/dashboard/v1/Consumer/${id}`)
  return parseQaJsonResponse<QaConsumerDetail>(res, 'The QA consumer detail request failed.')
}

export async function fetchQaConsumerTypes() {
  const res = await fetchQaApi('/api/dashboard/v1/Consumer/types')
  return parseQaJsonResponse<QaConsumerType[]>(res, 'The QA consumer types request failed.')
}

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard network + nodes + admin login-as (new QA endpoints)
// ─────────────────────────────────────────────────────────────────────────────

export interface QaNetworkNode {
  id: number | string
  parentId: number | string | null
  level: number
  name: string
  type?: 'customer' | 'business' | 'cause' | string
  city: string | null
  state: string | null
  joinedAt: string | null
}

export interface QaNetworkBranchSize {
  id: number | string
  directReferrals: number
}

export interface QaNetworkEarnings {
  id: number | string
  earnings: number
}

export interface QaNetworkSpend {
  id: number | string
  spend: number
}

export interface QaNetworkMonthlySpend {
  year: number
  month: number
  spend: number
}

export interface QaNetworkProjectionPoint {
  monthLabel: string
  projectedSpend: number
  projectedIncome: number | null
}

export interface QaNetworkProjection {
  basis: 'all_time_average' | 'selected_period'
  period: 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'
  startDate: string | null
  endDate: string | null
  currentWindowSpend: number
  previousWindowSpend: number | null
  currentMonthlySpendRate: number
  currentMonthlyIncomeRate: number | null
  previousMonthlySpendRate: number | null
  observedGrowthRate: number
  incomeConversionRate: number | null
  projected12MonthSpend: number
  projected12MonthIncome: number | null
  next12Months: QaNetworkProjectionPoint[]
}

export interface QaNetworkTree {
  rootId: number | string
  depth: number
  totalNodes: number
  nodes: QaNetworkNode[]
  period?: 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'
  startDate?: string | null
  endDate?: string | null
  branchSizes?: QaNetworkBranchSize[]
  earningsById?: QaNetworkEarnings[]
  totalNetworkEarnings?: number
  spendById?: QaNetworkSpend[]
  totalNetworkSpend?: number
  monthlyNetworkSpend?: QaNetworkMonthlySpend[]
  projection?: QaNetworkProjection
}

export type QaNodeType = 'all' | 'customer' | 'business' | 'cause'

export interface QaNodeListItem {
  accountId: number | string
  userId: number | string
  name: string
  email: string | null
  phone: string | null
  city: string | null
  state: string | null
  type: Exclude<QaNodeType, 'all'> | string
  referralCode: string | null
  joinedAt: string | null
  directReferralCount: number
}

export interface QaNodeList {
  items: QaNodeListItem[]
  totalCount: number
  page: number
  pageSize: number
}

export interface QaLoginAsResult {
  accessToken: string
  tokenType: string
  expiresIn: number
  /** Space-delimited scopes stamped on the minted impersonation token. */
  scope?: string
  user: {
    id: number | string
    email: string
    accountType: string | number
  }
}

export async function fetchQaNetworkTree(
  accountId: number | string,
  depth = 10,
  window?: { startDate?: string | null; endDate?: string | null },
): Promise<QaNetworkTree> {
  const params = new URLSearchParams({ accountId: String(accountId), depth: String(depth) })
  if (window?.startDate) params.set('startDate', window.startDate)
  if (window?.endDate) params.set('endDate', window.endDate)
  const res = await fetchQaApi(`/api/dashboard/v1/Network/Tree?${params.toString()}`)
  return parseQaJsonResponse<QaNetworkTree>(res, 'The QA network tree could not be loaded.')
}

export async function fetchQaNodes(params: {
  type?: QaNodeType
  search?: string
  page?: number
  pageSize?: number
}): Promise<QaNodeList> {
  const query = new URLSearchParams()
  query.set('type', params.type || 'all')
  if (params.search) query.set('search', params.search)
  query.set('page', String(params.page ?? 1))
  query.set('pageSize', String(params.pageSize ?? 25))

  const res = await fetchQaApi(`/api/dashboard/v1/Nodes?${query.toString()}`)
  return parseQaJsonResponse<QaNodeList>(res, 'The QA nodes list could not be loaded.')
}

/** Full detail for one node, from GET /api/dashboard/v1/Nodes/{userId}. */
export interface QaNodeDetail {
  userId: number
  accountId: number
  name: string
  type: string
  accountType: number
  accountTypeName: string
  /** Null for nodes with no Accounts row — ConsumerType lives on Accounts. */
  consumerType: number | null
  consumerTypeName: string | null
  roles: string[]
  contact: {
    firstName: string | null
    lastName: string | null
    email: string | null
    phone: string | null
    city: string | null
    state: string | null
    zipCode: string | null
    country: string | null
  }
  status: {
    isEnabled: boolean
    isLockedOut: boolean
    emailConfirmed: boolean
    accountActive: boolean | null
    joinedAt: string | null
  }
  network: {
    referralCode: string | null
    sharedUrl: string | null
    directReferralCount: number
    networkDepth: number
    referrer: { userId: number; name: string; email: string | null; referralCode: string | null } | null
  }
  account: {
    id: number
    name: string | null
    headline: string | null
    active: boolean | null
    city: string | null
    state: string | null
    latitude: number | null
    longitude: number | null
    linkedCauseAccountId: number | null
  } | null
  accessGrants: string[]
}

export interface QaNodeAccess {
  userId: number
  roles: string[]
  catalog: { key: string; area: string; label: string }[]
  /** Implied by role — always on, cannot be revoked by editing explicit grants. */
  inherited: string[]
  /** Explicit rows only; this is what the PUT replaces. */
  granted: string[]
  effective: string[]
}

export async function fetchQaNodeDetail(userId: number | string): Promise<QaNodeDetail> {
  const res = await fetchQaApi(`/api/dashboard/v1/Nodes/${encodeURIComponent(String(userId))}`)
  return parseQaJsonResponse<QaNodeDetail>(res, 'The customer could not be loaded.')
}

export async function fetchQaNodeAccess(userId: number | string): Promise<QaNodeAccess> {
  const res = await fetchQaApi(`/api/dashboard/v1/Nodes/${encodeURIComponent(String(userId))}/access`)
  return parseQaJsonResponse<QaNodeAccess>(res, 'Access grants could not be loaded.')
}

export async function updateQaNodeAccess(
  userId: number | string,
  grants: string[],
  grantedByName?: string | null,
): Promise<QaNodeAccess> {
  const res = await fetchQaApi(`/api/dashboard/v1/Nodes/${encodeURIComponent(String(userId))}/access`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ grants, grantedByName: grantedByName || null }),
  })
  return parseQaJsonResponse<QaNodeAccess>(res, 'Access grants could not be saved.')
}

export async function qaAdminLoginAs(targetUserId: number | string): Promise<QaLoginAsResult> {
  const res = await fetchQaApi('/api/dashboard/v1/Admin/LoginAs', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ targetUserId }),
  })
  return parseQaJsonResponse<QaLoginAsResult>(res, 'Login-as could not be completed.')
}

export async function updateQaConsumerType(id: number, consumerTypeId: number) {
  const res = await fetchQaApi(`/api/dashboard/v1/Consumer/${id}/consumer-type`, {
    method: 'PATCH',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ consumerTypeId }),
  })

  return parseQaJsonResponse<{ id: number; consumerType: string; consumerTypeId: number }>(
    res,
    'The QA consumer type update failed.',
  )
}
