import { cookies } from 'next/headers'
import { getQaSessionFromCookieStore, QA_AUTH_CONFIG } from '@/lib/auth/qa-auth'

export async function getQaAccessToken() {
  const session = getQaSessionFromCookieStore(cookies())
  return session?.accessToken || null
}

export async function fetchQaApi(path: string, init?: RequestInit) {
  const accessToken = await getQaAccessToken()
  if (!accessToken) {
    throw new Error('No QA access token available.')
  }

  const url = path.startsWith('http')
    ? path
    : `${QA_AUTH_CONFIG.baseUrl}${path.startsWith('/') ? path : `/${path}`}`

  const headers = new Headers(init?.headers || {})
  headers.set('authorization', `Bearer ${accessToken}`)

  return fetch(url, {
    ...init,
    headers,
    cache: 'no-store',
  })
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

export async function fetchQaUserProfile(): Promise<QaUserProfile | null> {
  try {
    const res = await fetchQaApi('/api/dashboard/v1/User/profile')
    if (!res.ok) return null
    return res.json() as Promise<QaUserProfile>
  } catch {
    return null
  }
}
