import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { getQaSessionFromCookieStore, QA_COOKIE_NAMES, setQaSessionCookies } from '@/lib/auth/qa-auth'
import { resolveQaSessionWithRefresh } from '@/lib/auth/qa-api'
import { DEVICE_SECONDS, isSysadminSession, PIN_COOKIES, validPinGrant } from '@/lib/auth/sysadmin-pin'
import { adminDevices, clearPinBrowserSession, deviceToken, pinCookieOptions, unlockAdmin, verifyCurrentSysadmin } from '@/lib/server/sysadmin-pin'
import { hashDevicePin, matchesDevicePin } from '@/lib/server/sysadmin-device-store'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET(request: NextRequest) {
  try {
    const token = deviceToken(request)
    if (!token) return json({ mode: 'login' })
    const session = getQaSessionFromCookieStore(request.cookies, { allowExpired: true })
    if (isSysadminSession(session) && await validPinGrant(request.cookies.get(PIN_COOKIES.login)?.value, 'login', session!.claims.sub, token)) {
      return json({ mode: 'setup' })
    }
    const record = await adminDevices().read(token)
    return json({ mode: record && record.expires > Date.now() && record.failures < 5 ? 'unlock' : 'login' })
  } catch { return json({ error: 'PIN access is temporarily unavailable. You can sign in with your password.' }, 503) }
}

export async function POST(request: NextRequest) {
  // JSON + strict same-origin check protects setup, unlock, lock and forget.
  const origin = request.headers.get('origin')
  const expected = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  if (!origin || new URL(origin).origin !== new URL(expected).origin || !request.headers.get('content-type')?.startsWith('application/json')) {
    return json({ error: 'Invalid request origin.' }, 403)
  }
  try {
    const body = await request.json()
    const token = deviceToken(request)
    if (!token) return json({ error: 'Sign in with your password to register this browser.', loginRequired: true }, 401)
    const store = adminDevices()
    return await store.locked(token, async () => {
      const response = json({ ok: true })
      if (body.action === 'forget') {
        await store.remove(token)
        clearPinBrowserSession(response)
        response.cookies.set(PIN_COOKIES.device, '', { ...pinCookieOptions, maxAge: 0 })
        return response
      }
      if (body.action === 'lock') {
        clearPinBrowserSession(response)
        return response
      }
      const pin = typeof body.pin === 'string' ? body.pin : ''
      if (!/^\d{4}$/.test(pin)) return json({ error: 'Enter exactly four digits.' }, 400)
      if (body.action === 'setup') {
        if (body.confirmPin !== pin) return json({ error: 'The PINs do not match.' }, 400)
        const current = await resolveQaSessionWithRefresh(request.cookies)
        const session = current?.session
        if (!session || !isSysadminSession(session) || !await validPinGrant(request.cookies.get(PIN_COOKIES.login)?.value, 'login', session.claims.sub, token)) {
          return json({ error: 'Sign in again before setting a device PIN.', loginRequired: true }, 401)
        }
        if (!session.refreshToken) return json({ error: 'Your login did not include a persistent session. Sign in again.', loginRequired: true }, 401)
        if (!await verifyCurrentSysadmin(session)) return json({ error: 'This feature is only available to sysadmin.', loginRequired: true }, 403)
        // A setup grant cannot be replayed to reset an already-enrolled device.
        if (await store.read(token)) return json({ error: 'This browser already has a PIN. Sign in again to reset it.' }, 409)
        const salt = randomBytes(16).toString('hex')
        await store.save(token, { sub: session.claims.sub, session, salt, pinHash: hashDevicePin(pin, salt), failures: 0, expires: Date.now() + DEVICE_SECONDS * 1000 })
        setQaSessionCookies(response, session, { persistent: true })
        await unlockAdmin(response, session, token)
        return response
      }
      if (body.action !== 'unlock') return json({ error: 'Invalid PIN action.' }, 400)
      const record = await store.read(token)
      if (!record || record.expires <= Date.now() || record.failures >= 5) {
        return json({ error: 'Sign in with your password to register this browser again.', loginRequired: true }, 401)
      }
      if (!matchesDevicePin(pin, record)) {
        record.failures++
        await store.save(token, record)
        const failure = json({ error: record.failures >= 5 ? 'Too many incorrect attempts. Sign in with your password.' : `Incorrect PIN. ${5 - record.failures} attempts remaining.`, loginRequired: record.failures >= 5 }, record.failures >= 5 ? 429 : 401)
        clearPinBrowserSession(failure)
        return failure
      }
      // Restore and refresh the real backend session only AFTER the server checks
      // the PIN. No password or token is exposed to browser JavaScript.
      const saved = record.session
      const values: Record<string, string> = {
        [QA_COOKIE_NAMES.accessToken]: saved.accessToken, [QA_COOKIE_NAMES.expiresAt]: String(saved.expiresAt),
        [QA_COOKIE_NAMES.refreshToken]: saved.refreshToken || '', [QA_COOKIE_NAMES.idToken]: saved.idToken || '',
        [QA_COOKIE_NAMES.scopes]: saved.grantedScopes.join(' '),
      }
      const refreshed = await resolveQaSessionWithRefresh({ get: name => values[name] ? { value: values[name] } : undefined })
      const session = refreshed?.session
      if (!session || session.claims.sub !== record.sub || !await verifyCurrentSysadmin(session)) {
        await store.remove(token)
        const failure = json({ error: 'Your saved login has expired or been revoked. Sign in with your password.', loginRequired: true }, 401)
        clearPinBrowserSession(failure)
        return failure
      }
      await store.save(token, { ...record, session, failures: 0, expires: Date.now() + DEVICE_SECONDS * 1000 })
      setQaSessionCookies(response, session, { persistent: true })
      await unlockAdmin(response, session, token)
      return response
    })
  } catch {
    return json({ error: 'PIN access is temporarily unavailable. Try again or sign in with your password.' }, 503)
  }
}
