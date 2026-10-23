import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { buildQaSessionFromTokens, QA_COOKIE_NAMES, setQaSessionCookies } from '../src/lib/auth/qa-auth'
import { hasSysadminPinAccess, PIN_COOKIES } from '../src/lib/auth/sysadmin-pin'
import { beginSysadminPinLogin } from '../src/lib/server/sysadmin-pin'
import { sysadminDeviceStore } from '../src/lib/server/sysadmin-device-store'
import { GET, POST } from '../src/app/api/auth/sysadmin-pin/route'
import { updateSession } from '../src/lib/supabase/middleware'

test('sysadmin enrollment, encrypted persistence, lock, refresh, lockout and recovery', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'localvip-pin-'))
  process.env.SYSADMIN_DEVICE_STORE_DIR = directory
  process.env.QA_AUTH_STATE_SECRET = randomBytes(32).toString('hex')
  process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
  const originalFetch = globalThis.fetch
  let refreshed = 0
  const access = (role = 'SysAdmin', exp = Math.floor(Date.now() / 1000) + 3600) =>
    `header.${Buffer.from(JSON.stringify({ sub: '1', role, scope: 'openid profile email offline_access LVIPDashboardApiV1 Ten10ApiMobileV1 roles', exp })).toString('base64url')}.signature`
  const session = (role = 'SysAdmin') => buildQaSessionFromTokens({ accessToken: access(role), refreshToken: 'test-refresh-secret', expiresIn: 3600, grantedScopes: 'openid profile email offline_access LVIPDashboardApiV1 Ten10ApiMobileV1 roles' })
  globalThis.fetch = async input => {
    if (String(input).endsWith('/connect/token')) {
      refreshed++
      return Response.json({ access_token: access(), expires_in: 3600 })
    }
    return Response.json({ role: 'SysAdmin' })
  }
  let jar = new Map<string, string>()
  const request = (path: string, body?: unknown, origin = 'http://localhost:3000') => new NextRequest(`http://localhost:3000${path}`, {
    method: body ? 'POST' : 'GET', headers: { cookie: [...jar].map(([key, value]) => `${key}=${value}`).join('; '), origin, 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const apply = (response: NextResponse) => { for (const cookie of response.cookies.getAll()) { if (cookie.maxAge === 0) jar.delete(cookie.name); else jar.set(cookie.name, cookie.value) } }
  const mode = async () => (await (await GET(request('/api/auth/sysadmin-pin'))).json()).mode
  const post = (body: unknown) => POST(request('/api/auth/sysadmin-pin', body))
  try {
    assert.equal(await mode(), 'login')
    const userLogin = NextResponse.json({})
    setQaSessionCookies(userLogin, session('BusinessAdmin'))
    assert.ok(userLogin.cookies.get(QA_COOKIE_NAMES.accessToken)?.maxAge, 'other accounts retain persistent login')
    await beginSysadminPinLogin(request('/api/auth/login'), userLogin, session('BusinessAdmin'))
    assert.equal(userLogin.cookies.get(PIN_COOKIES.device), undefined, 'non-sysadmin never enrolled')
    for (const role of ['BusinessAdmin', 'SchoolAdmin', 'Admin', 'Consumer']) assert.equal(await hasSysadminPinAccess({ get: () => undefined }, session(role)), true)
    const login = async () => {
      const result = NextResponse.json({})
      setQaSessionCookies(result, session())
      assert.equal(result.cookies.get(QA_COOKIE_NAMES.accessToken)?.maxAge, undefined, 'sysadmin backend credentials are browser-session only')
      await beginSysadminPinLogin(request('/api/auth/login'), result, session())
      apply(result)
    }
    await login()
    assert.equal(await mode(), 'setup')
    assert.equal((await updateSession(request('/api/qa/users'))).status, 403, 'API blocked until PIN setup')
    assert.equal((await updateSession(request('/dashboard'))).headers.get('location')?.includes('/sysadmin-pin'), true)
    assert.equal((await post({ action: 'setup', pin: '1234', confirmPin: '9999' })).status, 400)
    assert.equal((await POST(request('/api/auth/sysadmin-pin', { action: 'setup', pin: '1234', confirmPin: '1234' }, 'https://other.test'))).status, 403)
    const setup = await post({ action: 'setup', pin: '1234', confirmPin: '1234' })
    assert.equal(setup.status, 200, await setup.clone().text())
    apply(setup)
    assert.equal(await hasSysadminPinAccess({ get: name => jar.has(name) ? { value: jar.get(name)! } : undefined }, session()), true)
    assert.equal((await post({ action: 'setup', pin: '1234', confirmPin: '1234' })).status, 401, 'setup grant consumed')
    const token = jar.get(PIN_COOKIES.device)!
    const store = sysadminDeviceStore(directory, process.env.QA_AUTH_STATE_SECRET!)
    const files = await readdir(directory)
    const raw = await readFile(join(directory, files[0]), 'utf8')
    assert.equal(raw.includes('"pin"'), false)
    assert.equal(raw.includes('test-refresh-secret'), false)
    assert.equal(raw.includes(token), false)
    const record = (await store.read(token))!
    // Simulate browser closure, including lost access cookies and an expired token.
    record.session.expiresAt = 1
    await store.save(token, record)
    jar = new Map([[PIN_COOKIES.device, token]])
    assert.equal(await mode(), 'unlock')
    const unlock = await post({ action: 'unlock', pin: '1234' })
    assert.equal(unlock.status, 200, await unlock.clone().text())
    apply(unlock)
    assert.equal(refreshed, 1, 'expired saved session refreshed after PIN')
    assert.ok(jar.get(QA_COOKIE_NAMES.accessToken))
    const goodGrant = jar.get(PIN_COOKIES.unlocked)!
    jar.set(PIN_COOKIES.unlocked, goodGrant + 'x')
    assert.equal((await updateSession(request('/api/auth/session'))).status, 403, 'tampered grant blocked')
    jar.set(PIN_COOKIES.unlocked, goodGrant)
    const lock = await post({ action: 'lock' }); apply(lock)
    assert.equal(jar.has(QA_COOKIE_NAMES.accessToken), false)
    for (let i = 1; i <= 5; i++) {
      const wrong = await post({ action: 'unlock', pin: '9999' })
      assert.equal(wrong.status, i === 5 ? 429 : 401)
      apply(wrong)
    }
    assert.equal((await post({ action: 'unlock', pin: '1234' })).status, 401, 'correct PIN cannot bypass lockout')
    assert.equal(await mode(), 'login')
    await login()
    assert.equal(await mode(), 'setup', 'full login allows PIN reset')
    assert.equal(await store.read(token), null, 'old device revoked after full login')
    const newSetup = await post({ action: 'setup', pin: '5678', confirmPin: '5678' }); assert.equal(newSetup.status, 200); apply(newSetup)
    const forgotten = jar.get(PIN_COOKIES.device)!
    const forget = await post({ action: 'forget' }); assert.equal(forget.status, 200); apply(forget)
    assert.equal(jar.has(PIN_COOKIES.device), false)
    assert.equal(await store.read(forgotten), null)
    // Atomic lock refuses concurrent mutations instead of losing failed attempts.
    await store.locked(forgotten, async () => { await assert.rejects(store.locked(forgotten, async () => {}), /in progress/) })
  } finally {
    globalThis.fetch = originalFetch
    await rm(directory, { recursive: true, force: true })
  }
})
