import { randomBytes } from 'node:crypto'
import { resolve } from 'node:path'
import { NextRequest, NextResponse } from 'next/server'
import { clearQaSessionCookies, QA_AUTH_CONFIG, type QaSession } from '../auth/qa-auth'
import { DEVICE_SECONDS, isSysadminSession, PIN_COOKIES, signPinGrant } from '../auth/sysadmin-pin'
import { sysadminDeviceStore } from './sysadmin-device-store'

export const pinCookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/' }
export function adminDevices() {
  return sysadminDeviceStore(process.env.SYSADMIN_DEVICE_STORE_DIR || resolve(process.cwd(), '.private/sysadmin-devices'),
    process.env.QA_AUTH_STATE_SECRET || (process.env.NODE_ENV !== 'production' ? 'local-development-only' : ''))
}
export const deviceToken = (request: NextRequest) => {
  const token = request.cookies.get(PIN_COOKIES.device)?.value || ''
  return /^[a-f0-9]{64}$/.test(token) ? token : null
}

export async function unlockAdmin(response: NextResponse, session: QaSession, token: string) {
  response.cookies.set(PIN_COOKIES.device, token, { ...pinCookieOptions, maxAge: DEVICE_SECONDS })
  // Browser-session cookie: closing the browser locks the saved device; 12-hour
  // ceiling also prevents a permanently-open browser staying unlocked forever.
  response.cookies.set(PIN_COOKIES.unlocked, await signPinGrant('unlock', session.claims.sub, token, 12 * 60 * 60), pinCookieOptions)
  response.cookies.set(PIN_COOKIES.login, '', { ...pinCookieOptions, maxAge: 0 })
}

// Only call after an actual password/OIDC login, never from token refresh.
export async function beginSysadminPinLogin(request: NextRequest, response: NextResponse, session: QaSession) {
  response.cookies.set(PIN_COOKIES.unlocked, '', { ...pinCookieOptions, maxAge: 0 })
  response.cookies.set(PIN_COOKIES.login, '', { ...pinCookieOptions, maxAge: 0 })
  if (!isSysadminSession(session)) return
  const store = adminDevices(), token = deviceToken(request)
  if (token) {
    const known = await store.read(token)
    if (known?.sub === session.claims.sub) {
      await store.locked(token, async () => {
        await store.remove(token)
      })
    }
  }
  const nextToken = randomBytes(32).toString('hex')
  response.cookies.set(PIN_COOKIES.device, nextToken, { ...pinCookieOptions, maxAge: DEVICE_SECONDS })
  response.cookies.set(PIN_COOKIES.login, await signPinGrant('login', session.claims.sub, nextToken, 600), { ...pinCookieOptions, maxAge: 600 })
}

export async function verifyCurrentSysadmin(session: QaSession) {
  if (!isSysadminSession(session)) return false
  const response = await fetch(`${QA_AUTH_CONFIG.baseUrl}/api/dashboard/v1/User/profile`, {
    headers: { authorization: `Bearer ${session.accessToken}` }, cache: 'no-store', signal: AbortSignal.timeout(10000),
  })
  if (!response.ok) return false
  const profile = await response.json()
  // The backend, rather than client-supplied claims, confirms the current role.
  const role = String(profile.role || profile.accountType || '').replace(/[^a-z]/gi, '').toLowerCase()
  return role === 'sysadmin' || role === 'systemadmin' || role === 'superadmin'
}

export function clearPinBrowserSession(response: NextResponse) {
  clearQaSessionCookies(response)
  response.cookies.set(PIN_COOKIES.unlocked, '', { ...pinCookieOptions, maxAge: 0 })
  response.cookies.set(PIN_COOKIES.login, '', { ...pinCookieOptions, maxAge: 0 })
}
