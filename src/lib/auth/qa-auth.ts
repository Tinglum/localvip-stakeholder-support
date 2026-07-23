import type { NextRequest, NextResponse } from 'next/server'
import type { Profile, UserRole, UserRoleSubtype } from '@/lib/types/database'
import { isUuid } from '@/lib/uuid'

type CookieSource = {
  get: (name: string) => { value?: string } | undefined
}

type PublicOriginSource = {
  headers: Headers
  nextUrl?: {
    origin?: string
    protocol?: string
  }
  url?: string
}

export interface QaAuthClaims {
  sub: string
  email: string | null
  name: string | null
  given_name: string | null
  family_name: string | null
  preferred_username: string | null
  roles: string[]
  scopes: string[]
  exp: number | null
  raw: Record<string, unknown>
}

export interface QaSession {
  accessToken: string
  idToken: string | null
  refreshToken: string | null
  expiresAt: number
  claims: QaAuthClaims
  grantedScopes: string[]
}

interface QaOauthStatePayload {
  nonce: string
  verifier: string
  returnTo: string
  createdAt: number
}

function trimToNull(value: string | undefined | null) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

const QA_REQUIRED_SCOPES = [
  'openid',
  'profile',
  'email',
  'LVIPDashboardApiV1',
  'Ten10ApiMobileV1',
  'roles',
] as const

const QA_PREFERRED_SCOPES = [
  'name',
  'offline_access',
] as const

const QA_SCOPE_DEFAULT_ORDER = [
  'openid',
  'profile',
  'email',
  'name',
  'LVIPDashboardApiV1',
  'Ten10ApiMobileV1',
  'roles',
  'offline_access',
] as const

function readScopeTokens(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry) => readScopeTokens(entry))
  }

  if (typeof value !== 'string') return []

  return value
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

export function mergeScopeLists(...scopeLists: unknown[]) {
  const result: string[] = []
  const seen = new Set<string>()

  for (const list of scopeLists) {
    for (const scope of readScopeTokens(list)) {
      const normalized = scope.toLowerCase()
      if (seen.has(normalized)) continue
      seen.add(normalized)
      result.push(scope)
    }
  }

  return result
}

export function getRequiredQaScopes() {
  return [...QA_REQUIRED_SCOPES]
}

export function getPreferredQaScopes() {
  return [...QA_PREFERRED_SCOPES]
}

export function getQaRequestedScopes(configuredScopes?: string | null) {
  return mergeScopeLists(QA_SCOPE_DEFAULT_ORDER, configuredScopes)
}

export function getQaRequestedScopeString(configuredScopes?: string | null) {
  return getQaRequestedScopes(configuredScopes).join(' ')
}

export function getMissingRequiredQaScopes(scopes: string[]) {
  const available = new Set(scopes.map((scope) => scope.toLowerCase()))
  return QA_REQUIRED_SCOPES.filter((scope) => !available.has(scope.toLowerCase()))
}

export function hasRequiredQaScopes(scopes: string[]) {
  return getMissingRequiredQaScopes(scopes).length === 0
}

function getConfiguredAppOrigin(fallbackOrigin?: string) {
  const configured = trimToNull(process.env.NEXT_PUBLIC_APP_URL)
  if (configured) return trimTrailingSlash(configured)
  if (fallbackOrigin) return trimTrailingSlash(fallbackOrigin)
  return null
}

export function getRequestPublicOrigin(source: PublicOriginSource) {
  const forwardedHost = trimToNull(source.headers.get('x-forwarded-host'))?.split(',')[0]?.trim() || null
  const forwardedProto = trimToNull(source.headers.get('x-forwarded-proto'))?.split(',')[0]?.trim() || null
  const host = forwardedHost || trimToNull(source.headers.get('host'))
  const nextProtocol = trimToNull(source.nextUrl?.protocol)?.replace(/:$/, '') || null
  const fallbackOrigin = source.nextUrl?.origin || (source.url ? new URL(source.url).origin : null)
  const fallbackProtocol = fallbackOrigin ? new URL(fallbackOrigin).protocol.replace(/:$/, '') : null
  const protocol = forwardedProto || nextProtocol || fallbackProtocol || 'https'

  if (host) {
    return trimTrailingSlash(`${protocol}://${host}`)
  }

  if (fallbackOrigin) {
    return trimTrailingSlash(fallbackOrigin)
  }

  const configuredOrigin = getConfiguredAppOrigin()
  if (configuredOrigin) {
    return configuredOrigin
  }

  throw new Error('No public dashboard origin is available for QA auth.')
}

export const QA_AUTH_CONFIG = {
  baseUrl: trimTrailingSlash(trimToNull(process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL) || 'https://qa.localvip.com'),
  clientId: trimToNull(process.env.QA_AUTH_CLIENT_ID) || 'lvip_dashboard',
  clientSecret: trimToNull(process.env.QA_AUTH_CLIENT_SECRET),
  scopes: getQaRequestedScopeString(trimToNull(process.env.QA_AUTH_SCOPES)),
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
  scopes: 'lvip_qa_scopes',
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

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function base64UrlToString(value: string) {
  return new TextDecoder().decode(base64UrlToBytes(value))
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

function getQaStateSecret() {
  return process.env.QA_AUTH_STATE_SECRET
    || `${QA_AUTH_CONFIG.clientId}:${QA_AUTH_CONFIG.baseUrl}`
}

export async function signQaStatePayload(payloadBase64Url: string) {
  const secret = new TextEncoder().encode(getQaStateSecret())
  const key = await crypto.subtle.importKey(
    'raw',
    secret,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadBase64Url))
  return bytesToBase64Url(new Uint8Array(signature))
}

/**
 * Generate a deterministic UUID from a non-UUID QA sub claim (e.g. "1").
 * Uses a simple hash so the same QA user always maps to the same local UUID.
 */
function deterministicQaUuid(sub: string | null | undefined, email: string | null | undefined): string {
  const seed = `qa-oauth:${sub || 'anonymous'}:${email || 'no-email'}`
  // Simple deterministic hash → UUID v4-shaped string
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0
  }
  const hex = (v: number, len: number) => ((v >>> 0) % (16 ** len)).toString(16).padStart(len, '0')
  const h = Math.abs(hash)
  return [
    hex(h, 8),
    hex(h ^ 0x1234, 4),
    '4' + hex(h ^ 0x5678, 3),
    ((((h >>> 16) & 0x3f) | 0x80).toString(16)) + hex(h ^ 0x9abc, 2),
    hex(h ^ 0xdef0, 4) + hex(h ^ 0x1357, 4) + hex(h ^ 0x2468, 4),
  ].join('-')
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

function readScopes(payload: Record<string, unknown>) {
  return mergeScopeLists(
    payload.scope,
    payload.scp,
    payload.scopes,
    payload['http://schemas.microsoft.com/identity/claims/scope'],
  )
}

function normalizeQaSignal(value: unknown) {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLowerCase()
  return normalized || null
}

function matchesSysadminSignal(signal: string) {
  return signal.includes('sysadmin')
    || signal.includes('superadmin')
    || signal.includes('sys_admin')
    || signal.includes('systemadmin')
    || (signal.includes('system') && signal.includes('admin'))
    || (signal.includes('sys') && signal.includes('admin'))
}

export function normalizeQaClaims(accessToken: string, idToken?: string | null): QaAuthClaims {
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
    scopes: readScopes(merged),
    exp,
    raw: merged,
  }
}

/**
 * JWT signature verification against the QA IdentityServer JWKS.
 *
 * Claims (roles, sub, …) are otherwise decoded with an *unverified* base64 read,
 * so a forged token could claim any role. This verifies the RS256 signature of a
 * token before its claims are trusted at a mint boundary (e.g. the client-POSTed
 * access token in /api/auth/qa/session).
 *
 * Uses Web Crypto (crypto.subtle) so it runs on both the Node and Edge runtimes
 * without adding a dependency. The JWKS is fetched from the issuer's discovery
 * endpoint and cached in-process by `kid`.
 */
const QA_JWKS_URI = `${QA_AUTH_CONFIG.baseUrl}/.well-known/openid-configuration/jwks`
const QA_JWT_ISSUER = QA_AUTH_CONFIG.baseUrl

interface JwkEntry {
  kid?: string
  kty?: string
  alg?: string
  use?: string
  n?: string
  e?: string
}

let jwksCache: { keys: JwkEntry[]; fetchedAt: number } | null = null
const JWKS_CACHE_TTL_MS = 60 * 60 * 1000 // 1 hour
const importedKeyCache = new Map<string, CryptoKey>()

async function fetchQaJwks(force = false): Promise<JwkEntry[]> {
  const now = Date.now()
  if (!force && jwksCache && now - jwksCache.fetchedAt < JWKS_CACHE_TTL_MS) {
    return jwksCache.keys
  }
  const response = await fetch(QA_JWKS_URI, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Unable to fetch QA JWKS (status ${response.status}).`)
  }
  const json = (await response.json()) as { keys?: JwkEntry[] }
  const keys = Array.isArray(json.keys) ? json.keys : []
  jwksCache = { keys, fetchedAt: now }
  return keys
}

async function importRsaVerifyKey(jwk: JwkEntry): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true } as JsonWebKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )
}

async function getVerifyKeyForKid(kid: string | null): Promise<CryptoKey | null> {
  if (kid && importedKeyCache.has(kid)) return importedKeyCache.get(kid) || null

  // Try the cached JWKS first; if the kid is unknown (e.g. after key rotation),
  // force a refresh once before giving up.
  for (const force of [false, true]) {
    const keys = await fetchQaJwks(force)
    const candidates = keys.filter((k) => (k.kty === 'RSA') && (!kid || !k.kid || k.kid === kid))
    for (const jwk of candidates) {
      if (kid && jwk.kid && jwk.kid !== kid) continue
      const key = await importRsaVerifyKey(jwk)
      if (kid && jwk.kid) importedKeyCache.set(jwk.kid, key)
      return key
    }
    if (kid && keys.some((k) => k.kid === kid)) break
  }
  return null
}

function parseJwtHeader(token: string): Record<string, unknown> {
  const segments = token.split('.')
  if (segments.length < 2) return {}
  try {
    return JSON.parse(base64UrlToString(segments[0])) as Record<string, unknown>
  } catch {
    return {}
  }
}

/**
 * Verify a QA-issued JWT's RS256 signature (and iss/exp) against the QA JWKS.
 * Returns the decoded payload only when the signature is valid; otherwise null.
 */
export async function verifyQaJwt(token: string): Promise<Record<string, unknown> | null> {
  if (!token || typeof token !== 'string') return null
  const segments = token.split('.')
  if (segments.length !== 3) return null

  const header = parseJwtHeader(token)
  const alg = typeof header.alg === 'string' ? header.alg : null
  if (alg !== 'RS256') return null // reject "none" and unexpected algorithms
  const kid = typeof header.kid === 'string' ? header.kid : null

  let key: CryptoKey | null
  try {
    key = await getVerifyKeyForKid(kid)
  } catch {
    return null
  }
  if (!key) return null

  const signingInput = new TextEncoder().encode(`${segments[0]}.${segments[1]}`)
  const signature = base64UrlToBytes(segments[2])

  let valid = false
  try {
    valid = await crypto.subtle.verify(
      { name: 'RSASSA-PKCS1-v1_5' },
      key,
      signature,
      signingInput,
    )
  } catch {
    return null
  }
  if (!valid) return null

  const payload = parseJwtPayload(token)

  // Issuer must match the configured QA IdentityServer.
  const iss = typeof payload.iss === 'string' ? payload.iss.replace(/\/+$/, '') : null
  if (iss !== trimTrailingSlash(QA_JWT_ISSUER)) return null

  // Reject expired tokens (allow a small clock-skew grace).
  const exp = typeof payload.exp === 'number' ? payload.exp : null
  if (exp !== null && exp < Math.floor(Date.now() / 1000) - 60) return null

  return payload
}

export function buildQaSessionFromTokens(tokens: {
  accessToken: string
  idToken?: string | null
  refreshToken?: string | null
  expiresIn?: number | null
  expiresAt?: number | null
  grantedScopes?: string | string[] | null
}) {
  const now = Math.floor(Date.now() / 1000)
  const expiresAt = typeof tokens.expiresAt === 'number' && Number.isFinite(tokens.expiresAt)
    ? tokens.expiresAt
    : now + Math.max(tokens.expiresIn || 3600, 300)
  const claims = normalizeQaClaims(tokens.accessToken, tokens.idToken ?? null)
  const grantedScopes = mergeScopeLists(tokens.grantedScopes, claims.scopes)

  return {
    accessToken: tokens.accessToken,
    idToken: tokens.idToken ?? null,
    refreshToken: tokens.refreshToken ?? null,
    expiresAt,
    claims,
    grantedScopes,
  } satisfies QaSession
}

function mapQaRole(claims: QaAuthClaims): { role: UserRole; roleSubtype?: UserRoleSubtype } {
  const normalizedRoles = claims.roles.map((role) => role.toLowerCase())

  // Super-admin check first (most specific)
  if (normalizedRoles.some(matchesSysadminSignal) || normalizedRoles.some((role) => role.includes('super') && role.includes('admin'))) {
    return { role: 'admin', roleSubtype: 'super' }
  }

  // Entity-type checks come BEFORE the generic admin check so that roles like
  // "BusinessAdmin" or "SchoolAdmin" are not misclassified as platform admins.
  if (normalizedRoles.some((role) => role.includes('business'))) {
    return { role: 'business', roleSubtype: null }
  }

  if (normalizedRoles.some((role) => role.includes('school'))) {
    return { role: 'community', roleSubtype: 'school' }
  }

  if (normalizedRoles.some((role) => role.includes('cause') || (role.includes('community') && !role.includes('admin') && !role.includes('consumer')))) {
    return { role: 'community', roleSubtype: 'cause' }
  }

  if (normalizedRoles.some((role) => role.includes('nonprofit'))) {
    return { role: 'community', roleSubtype: 'cause' }
  }

  // Generic admin — only reached if no entity-type role matched above
  if (normalizedRoles.some((role) => role.includes('admin'))) {
    return { role: 'admin', roleSubtype: 'internal' }
  }

  if (normalizedRoles.some((role) => role.includes('launch') || role.includes('partner') || role.includes('onboarding'))) {
    return { role: 'launch_partner', roleSubtype: null }
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

  // Consumer role = end-user customer. Mapped to 'community' (no subtype) —
  // they're not stakeholders, they're the people LocalVIP serves. Used to
  // default to 'volunteer' which incorrectly labeled every consumer as a
  // volunteer in the dashboard. Customers can be promoted to a stakeholder
  // type (Intern/Volunteer/Influencer/LaunchTeamPartner) by an admin via the
  // /crm/consumers/[id] page or the User type selector.
  if (normalizedRoles.some((role) => role.includes('consumer') || role.includes('customer') || role.includes('client'))) {
    return { role: 'community', roleSubtype: null }
  }

  // Last resort: assume an unknown role is a regular customer rather than
  // a volunteer. Better to under-claim than to mis-label.
  return { role: 'community', roleSubtype: null }
}

export function mapQaRoleFromSignals(options: {
  claims?: QaAuthClaims | null
  accountType?: string | null
  profileRole?: string | null
}): { role: UserRole; roleSubtype?: UserRoleSubtype } {
  const roles = [
    normalizeQaSignal(options.accountType),
    normalizeQaSignal(options.profileRole),
    ...(options.claims?.roles || []).map((role) => role.toLowerCase()),
  ].filter((value): value is string => !!value)

  return mapQaRole({
    sub: options.claims?.sub || '',
    email: options.claims?.email || null,
    name: options.claims?.name || null,
    given_name: options.claims?.given_name || null,
    family_name: options.claims?.family_name || null,
    preferred_username: options.claims?.preferred_username || null,
    roles,
    scopes: [],
    exp: options.claims?.exp || null,
    raw: options.claims?.raw || {},
  })
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
    id: isUuid(claims.sub) ? claims.sub : deterministicQaUuid(claims.sub, claims.email),
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

/**
 * Signed "View As" impersonation payload.
 *
 * The `lvip_view_as` cookie must be tamper-proof: an admin overlay that swaps the
 * effective profile is a privilege boundary. We reuse the same HMAC-SHA256 scheme
 * used for the OAuth state cookie (`signQaStatePayload`) so no new crypto is
 * introduced — the cookie value is `base64url(payload).signature` and any edit to
 * the payload invalidates the signature.
 */
export interface ViewAsSignedPayload {
  userId: number
  email: string
  name: string
  role: string
  accountType?: string | number
  consumerType?: string
  since: string
}

export async function signViewAsPayload(payload: ViewAsSignedPayload): Promise<string> {
  const payloadBase64Url = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await signQaStatePayload(payloadBase64Url)
  return `${payloadBase64Url}.${signature}`
}

export async function readSignedViewAsPayload(value: string | null | undefined): Promise<ViewAsSignedPayload | null> {
  if (!value) return null

  const [payloadBase64Url, signature] = value.split('.')
  if (!payloadBase64Url || !signature) return null

  const expectedSignature = await signQaStatePayload(payloadBase64Url)
  if (signature !== expectedSignature) return null

  try {
    const payload = JSON.parse(base64UrlToString(payloadBase64Url)) as Partial<ViewAsSignedPayload>
    if (typeof payload.userId !== 'number' || !Number.isFinite(payload.userId)) return null
    if (typeof payload.email !== 'string') return null
    if (typeof payload.name !== 'string') return null
    if (typeof payload.role !== 'string' || !payload.role) return null
    if (typeof payload.since !== 'string') return null

    return {
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
      role: payload.role,
      accountType: payload.accountType,
      consumerType: typeof payload.consumerType === 'string' ? payload.consumerType : undefined,
      since: payload.since,
    }
  } catch {
    return null
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

export async function createSignedQaOauthState(options: {
  verifier: string
  returnTo?: string
}) {
  const payload: QaOauthStatePayload = {
    nonce: createOauthState(),
    verifier: options.verifier,
    returnTo: sanitizeReturnTo(options.returnTo),
    createdAt: Math.floor(Date.now() / 1000),
  }
  const payloadBase64Url = bytesToBase64Url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = await signQaStatePayload(payloadBase64Url)
  return `${payloadBase64Url}.${signature}`
}

export async function readSignedQaOauthState(value: string | null | undefined): Promise<QaOauthStatePayload | null> {
  if (!value) return null

  const [payloadBase64Url, signature] = value.split('.')
  if (!payloadBase64Url || !signature) return null

  const expectedSignature = await signQaStatePayload(payloadBase64Url)
  if (signature !== expectedSignature) return null

  try {
    const payload = JSON.parse(base64UrlToString(payloadBase64Url)) as Partial<QaOauthStatePayload>
    if (typeof payload.verifier !== 'string' || !payload.verifier.trim()) return null
    if (typeof payload.returnTo !== 'string') return null
    if (typeof payload.createdAt !== 'number' || !Number.isFinite(payload.createdAt)) return null
    if ((Math.floor(Date.now() / 1000) - payload.createdAt) > (60 * 30)) return null

    return {
      nonce: typeof payload.nonce === 'string' ? payload.nonce : '',
      verifier: payload.verifier,
      returnTo: sanitizeReturnTo(payload.returnTo),
      createdAt: payload.createdAt,
    }
  } catch {
    return null
  }
}

export function getQaRedirectUri(origin?: string) {
  if (QA_AUTH_CONFIG.redirectUri) return QA_AUTH_CONFIG.redirectUri

  const appOrigin = getConfiguredAppOrigin(origin)
  if (!appOrigin) {
    throw new Error('No dashboard origin is available for QA redirect URI generation.')
  }

  // The QA OIDC client is registered against the app URL itself, not a
  // server-only callback path. Middleware reroutes the eventual code/state
  // response into /api/auth/qa/callback for token exchange.
  return `${appOrigin}/`
}

export function getQaPostLogoutRedirectUri(origin?: string) {
  if (QA_AUTH_CONFIG.postLogoutRedirectUri) return QA_AUTH_CONFIG.postLogoutRedirectUri

  const appOrigin = getConfiguredAppOrigin(origin)
  if (!appOrigin) {
    throw new Error('No dashboard origin is available for QA logout redirect URI generation.')
  }

  return `${appOrigin}/`
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
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  }

  if (QA_AUTH_CONFIG.clientSecret) {
    const credentials = btoa(`${QA_AUTH_CONFIG.clientId}:${QA_AUTH_CONFIG.clientSecret}`)
    headers.authorization = `Basic ${credentials}`
  }

  const response = await fetch(tokenUrl.toString(), {
    method: 'POST',
    headers,
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

  return buildQaSessionFromTokens({
    accessToken: String(json.access_token),
    idToken: typeof json.id_token === 'string' ? json.id_token : null,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresIn,
    grantedScopes: typeof json.scope === 'string' ? json.scope : null,
  })
}

// Resource-owner password grant: lets the dashboard authenticate a user with its
// OWN email/password form (no redirect to the QA IdentityServer login page). The
// lvip_dashboard client permits this grant. The token comes straight from QA's
// trusted /connect/token endpoint server-side, so no client-POST verification is
// needed (unlike /api/auth/qa/session).
export async function loginWithPassword(username: string, password: string): Promise<QaSession> {
  const tokenUrl = new URL('/connect/token', QA_AUTH_CONFIG.baseUrl)
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: QA_AUTH_CONFIG.clientId,
    username,
    password,
    scope: QA_AUTH_CONFIG.scopes,
  })
  const headers: Record<string, string> = {
    'content-type': 'application/x-www-form-urlencoded',
  }
  if (QA_AUTH_CONFIG.clientSecret) {
    const credentials = btoa(`${QA_AUTH_CONFIG.clientId}:${QA_AUTH_CONFIG.clientSecret}`)
    headers.authorization = `Basic ${credentials}`
  }

  const response = await fetch(tokenUrl.toString(), {
    method: 'POST',
    headers,
    body: body.toString(),
    cache: 'no-store',
  })

  const json = await response.json().catch(() => null)
  if (!response.ok || !json?.access_token) {
    throw new Error(json?.error_description || json?.error || 'Invalid email or password.')
  }

  const expiresIn = typeof json.expires_in === 'number'
    ? json.expires_in
    : Number.parseInt(String(json.expires_in || '3600'), 10)

  return buildQaSessionFromTokens({
    accessToken: String(json.access_token),
    idToken: typeof json.id_token === 'string' ? json.id_token : null,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : null,
    expiresIn,
    grantedScopes: typeof json.scope === 'string' ? json.scope : null,
  })
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

  if (session.grantedScopes.length > 0) {
    response.cookies.set(QA_COOKIE_NAMES.scopes, session.grantedScopes.join(' '), {
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

export function getQaSessionFromCookieStore(
  cookieStore: CookieSource,
  options?: {
    /**
     * Return the session even if the access token has expired.
     *
     * Only for the refresh path (see resolveQaSessionWithRefresh): an expired
     * access token is recoverable when a refresh token is present, and treating it
     * as "no session" is what logged people out mid-work. Every other caller must
     * leave this off so an expired token is never treated as valid.
     */
    allowExpired?: boolean
  },
): QaSession | null {
  const accessToken = readCookieValue(cookieStore, QA_COOKIE_NAMES.accessToken)
  const expiresAtRaw = readCookieValue(cookieStore, QA_COOKIE_NAMES.expiresAt)
  if (!accessToken || !expiresAtRaw) return null

  const expiresAt = Number.parseInt(expiresAtRaw, 10)
  if (!Number.isFinite(expiresAt)) return null
  if (!options?.allowExpired && expiresAt <= Math.floor(Date.now() / 1000)) {
    return null
  }

  const idToken = readCookieValue(cookieStore, QA_COOKIE_NAMES.idToken)
  const refreshToken = readCookieValue(cookieStore, QA_COOKIE_NAMES.refreshToken)
  const scopeCookie = readCookieValue(cookieStore, QA_COOKIE_NAMES.scopes)
  const claims = normalizeQaClaims(accessToken, idToken)
  const grantedScopes = mergeScopeLists(scopeCookie, claims.scopes)

  if (grantedScopes.length === 0 || !hasRequiredQaScopes(grantedScopes)) {
    return null
  }

  return {
    accessToken,
    idToken,
    refreshToken,
    expiresAt,
    claims,
    grantedScopes,
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
