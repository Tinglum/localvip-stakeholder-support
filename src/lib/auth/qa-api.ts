import { cookies } from 'next/headers'
import { getQaSessionFromCookieStore, QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'

function buildQaApiUrl(path: string) {
  return path.startsWith('http')
    ? path
    : `${QA_AUTH_CONFIG.baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export async function getQaAccessToken() {
  const session = getQaSessionFromCookieStore(cookies())
  return session?.accessToken || null
}

export async function fetchQaApi(path: string, init?: RequestInit) {
  const accessToken = await getQaAccessToken()
  if (!accessToken) {
    throw new Error('No QA access token available.')
  }

  const url = buildQaApiUrl(path)

  const headers = new Headers(init?.headers || {})
  headers.set('authorization', `Bearer ${accessToken}`)

  return fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  })
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

export type QaConsumerListItem = Record<string, unknown>
export type QaConsumerDetail = Record<string, unknown>

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
