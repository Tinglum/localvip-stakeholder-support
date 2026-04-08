import type { NextRequest, NextResponse } from 'next/server'
import type { Profile, UserRole, UserRoleSubtype } from '@/lib/types/database'

type CookieSource = {
  get: (name: string) => { value?: string } | undefined
}

export interface QaAuthClaims {
  sub: string
  email: string | null
  name: string | null
  given_name: string | null
  family_name: string | null
  preferred_username: string | null
  roles: string[]
  exp: number | null
  raw: Record<string, unknown>
}

export interface QaSession {
  accessToken: string
  idToken: string | null
  refreshToken: string | null
  expiresAt: number
  claims: QaAuthClaims
}

function trimToNull(value: string | undefined | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function getConfiguredAppOrigin(fallbackOrigin?: string) {
  const configured = trimToNull(process.env.NEXT_PUBLIC_APP_URL)
  if (configured) return trimTrailingSlash(configured)
  if (fallbackOrigin) return trimTrailingSlash(fallbackOrigin)
  return null
}

export const QA_AUTH_CONFIG = {
  baseUrl: trimTrailingSlash(trimToNull(process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL) || 'https://qa.localvip.com'),
  clientId: trimToNull(process.env.QA_AUTH_CLIENT_ID) || 'lvip_dashboard',
  scopes: trimToNull(process.env.QA_AUTH_SCOPES) || 'openid profile email name LVIPDashboardApiV1 roles offline_access',
  redirectUri: trimToNull(process.env.QA_AUTH_REDIRECT_URI),
  postLogoutRedirectUri: trimToNull(process.env.QA_AUTH_POST_LOGOUT_REDIRECT_URI),
}

export const QA_COOKIE_NAMES = {
  state: 'lvip_qa_oauth_state',
  verifier: 'lvip_qa_oauth_verifier',
  returnTo: 'lvip_qa_oauth_return_to',
  accessToken: 'lvip_qa_access_token',
  idToken: 'lvip_qa_id_token',
  refreshToken: 'lvip_qa_refresh_token',
  expiresAt: 'lvip_qa_expires_at',
} as const

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

function parseJwtPayload(token: string): Record<string, unknown> {
  const segments = token.split('.')
  if (segments.length < 2) return {}
  try {
    const normalized = segments[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const json = atob(padded)
    return JSON.parse(json) as Record<string, unknown>
  } catch {
    return {}
  }
}

function readStringClaim(payload: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function readRoles(payload: Record<string, unknown>) {
  const raw = payload.roles ?? payload.role ?? payload['http://schemas.microsoft.com/ws/2008/06/identity/claims/role']
  if (Array.isArray(raw)) {
    return raw.map((value) => String(value)).filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(/[,\s]+/).map((value) => value.trim()).filter(Boolean)
  }
  return []
}

function normalizeQaClaims(accessToken: string, idToken?: string | null): QaAuthClaims {
  const idPayload = idToken ? parseJwtPayload(idToken) : {}
  const accessPayload = parseJwtPayload(accessToken)
  const merged = { ...accessPayload, ...idPayload }
  const exp = typeof merged.exp === 'number' ? merged.exp : null

  return {
    sub: readStringClaim(merged, 'sub') || '',
    email: readStringClaim(merged, 'email'),
    name: readStringClaim(merged, 'name'),
    given_name: readStringClaim(merged, 'given_name'),
    family_name: readStringClaim(merged, 'family_name'),
    preferred_username: readStringClaim(merged, 'preferred_username', 'preferred_username'),
    roles: readRoles(merged),
    exp,
    raw: merged,
  }
}

function mapQaRole(claims: QaAuthClaims): { role: UserRole; roleSubtype?: UserRoleSubtype } {
  const normalizedRoles = claims.roles.map((role) => role.toLowerCase())

  if (normalizedRoles.some((role) => role.includes('super') && role.includes('admin'))) {
    return { role: 'admin', roleSubtype: 'super' }
  }

  if (normalizedRoles.some((role) => role.includes('admin'))) {
    return { role: 'admin', roleSubtype: 'internal' }
  }

  if (normalizedRoles.some((role) => role.includes('launch') || role.includes('partner') || role.includes('onboarding'))) {
    return { role: 'launch_partner', roleSubtype: null }
  }

  if (normalizedRoles.some((role) => role.includes('business'))) {
    return { role: 'business', roleSubtype: null }
  }

  if (normalizedRoles.some((role) => role.includes('school'))) {
    return { role: 'community', roleSubtype: 'school' }
  }

  if (normalizedRoles.some((role) => role.includes('cause') || role.includes('community'))) {
    return { role: 'community', roleSubtype: 'cause' }
  }

  if (normalizedRoles.some((role) => role.includes('intern'))) {
    return { role: 'field', roleSubtype: 'intern' }
  }

  if (normalizedRoles.some((role) => role.includes('volunteer'))) {
    return { role: 'field', roleSubtype: 'volunteer' }
  }

  if (normalizedRoles.some((role) => role.includes('influencer'))) {
    return { role: 'influencer', roleSubtype: null }
  }

  return { role: 'field', roleSubtype: 'volunteer' }
}

export function buildFallbackQaProfile(claims: QaAuthClaims): Profile {
  const { role, roleSubtype } = mapQaRole(claims)
  const fullName = claims.name
    || [claims.given_name, claims.family_name].filter(Boolean).join(' ').trim()
    || claims.preferred_username
    || claims.email?.split('@')[0]
    || 'LocalVIP User'
  const now = new Date().toISOString()

  return {
    id: claims.sub || `qa-${randomBase64Url(12)}`,
    email: claims.email || '',
    full_name: fullName,
    avatar_url: null,
    role,
    role_subtype: roleSubtype ?? null,
    brand_context: 'localvip',
    organization_id: null,
    city_id: null,
    business_id: null,
    phone: null,
    referral_code: null,
    status: 'active',
    metadata: {
      auth_source: 'qa_oauth',
      qa_roles: claims.roles,
      qa_claims: claims.raw,
    },
    created_at: now,
    updated_at: now,
  }
}

export function sanitizeReturnTo(value: string | null | undefined) {
  if (!value) return '/dashboard'
  if (!value.startsWith('/')) return '/dashboard'
  if (value.startsWith('//')) return '/dashboard'
  return value
}

export function createPkcePair() {
  const verifier = randomBase64Url(64)
  return { verifier }
}

export function createOauthState() {
  return randomBase64Url(32)
}

export function getQaRedirectUri(origin?: string) {
  if (QA_AUTH_CONFIG.redirectUri) return QA_AUTH_CONFIG.redirectUri

  const appOrigin = getConfiguredAppOrigin(origin)
  if (!appOrigin) {
    throw new Error('No dashboard origin is available for QA redirect URI generation.')
  }

  return `${appOrigin}/api/auth/qa/callback`
}

export function getQaPostLogoutRedirectUri(origin?: string) {
  if (QA_AUTH_CONFIG.postLogoutRedirectUri) return QA_AUTH_CONFIG.postLogoutRedirectUri

  const appOrigin = getConfiguredAppOrigin(origin)
  if (!appOrigin) {
    throw new Error('No dashboard origin is available for QA logout redirect URI generation.')
  }

  return `${appOrigin}/login`
}

export function getQaLogoutUrl(origin?: string, idToken?: string | null) {
  const postLogoutRedirectUri = getQaPostLogoutRedirectUri(origin)
  const url = new URL('/connect/endsession', QA_AUTH_CONFIG.baseUrl)
  url.searchParams.set('post_logout_redirect_uri', postLogoutRedirectUri)

  if (idToken) {
    url.searchParams.set('id_token_hint', idToken)
  }

  return url.toString()
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64Url(new Uint8Array(digest))
}

export async function getQaAuthorizationUrl(origin: string, options?: { returnTo?: string; state?: string; verifier?: string; challenge?: string }) {
  const state = options?.state || createOauthState()
  const verifier = options?.verifier || createPkcePair().verifier
  const challenge = options?.challenge || await sha256Base64Url(verifier)
  const redirectUri = getQaRedirectUri(origin)
  const url = new URL('/connect/authorize', QA_AUTH_CONFIG.baseUrl)
  url.searchParams.set('client_id', QA_AUTH_CONFIG.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('scope', QA_AUTH_CONFIG.scopes)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)

  return {
    url: url.toString(),
    state,
    verifier,
    redirectUri,
    returnTo: sanitizeReturnTo(options?.returnTo),
  }
}

export async function exchangeCodeForSession(options: {
  code: string
  verifier: string
  redirectUri: string
}): Promise<QaSession> {
  const tokenUrl = new URL('/connect/token', QA_AUTH_CONFIG.baseUrl)
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: QA_AUTH_CONFIG.clientId,
    code: options.code,
    redirect_uri: options.redirectUri,
    code_verifier: options.verifier,
  })

  const response = await fetch(tokenUrl.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
    cache: 'no-store',
  })

  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.access_token) {
    throw new Error(json?.error_description || json?.error || 'QA login token exchange failed.')
  }

  const expiresIn = typeof json.expires_in === 'number'
    ? json.expires_in
    : Number.parseInt(String(json.expires_in || '3600'), 10)
  const expiresAt = Math.floor(Date.now() / 1000) + Math.max(expiresIn || 3600, 300)
  const claims = normalizeQaClaims(String(json.access_token), typeof json.id_token === 'string' ? json.id_token : null)

  return {
    accessToken: String(json.access_token),
    idToken: typeof json.id_token === 'string' ? json.id_token : null,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresAt,
    claims,
  }
}

export function setQaSessionCookies(response: NextResponse, session: QaSession) {
  const secure = process.env.NODE_ENV === 'production'
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
  }

  response.cookies.set(QA_COOKIE_NAMES.accessToken, session.accessToken, {
    ...cookieOptions,
    maxAge: Math.max(session.expiresAt - Math.floor(Date.now() / 1000), 300),
  })
  response.cookies.set(QA_COOKIE_NAMES.expiresAt, String(session.expiresAt), {
    ...cookieOptions,
    maxAge: Math.max(session.expiresAt - Math.floor(Date.now() / 1000), 300),
  })

  if (session.idToken) {
    response.cookies.set(QA_COOKIE_NAMES.idToken, session.idToken, {
      ...cookieOptions,
      maxAge: Math.max(session.expiresAt - Math.floor(Date.now() / 1000), 300),
    })
  }

  if (session.refreshToken) {
    response.cookies.set(QA_COOKIE_NAMES.refreshToken, session.refreshToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    })
  }
}

export function clearQaSessionCookies(response: NextResponse) {
  const secure = process.env.NODE_ENV === 'production'
  const expired = {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: 0,
  }

  Object.values(QA_COOKIE_NAMES).forEach((name) => {
    response.cookies.set(name, '', expired)
  })
}

function readCookieValue(source: CookieSource, name: string) {
  return source.get(name)?.value || null
}

export function getQaSessionFromCookieStore(cookieStore: CookieSource): QaSession | null {
  const accessToken = readCookieValue(cookieStore, QA_COOKIE_NAMES.accessToken)
  const expiresAtRaw = readCookieValue(cookieStore, QA_COOKIE_NAMES.expiresAt)
  if (!accessToken || !expiresAtRaw) return null

  const expiresAt = Number.parseInt(expiresAtRaw, 10)
  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return null
  }

  const idToken = readCookieValue(cookieStore, QA_COOKIE_NAMES.idToken)
  const refreshToken = readCookieValue(cookieStore, QA_COOKIE_NAMES.refreshToken)

  return {
    accessToken,
    idToken,
    refreshToken,
    expiresAt,
    claims: normalizeQaClaims(accessToken, idToken),
  }
}

export function hasQaSession(request: NextRequest) {
  return !!getQaSessionFromCookieStore(request.cookies)
}

export async function resolveProfileForQaSession(
  claims: QaAuthClaims,
  profileLoader: (email: string) => Promise<Profile | null>,
): Promise<Profile> {
  const email = claims.email?.toLowerCase() || null
  if (email) {
    const profile = await profileLoader(email)
    if (profile) return profile
  }

  return buildFallbackQaProfile(claims)
}
