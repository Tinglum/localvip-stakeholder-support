import { NextRequest, NextResponse } from 'next/server'
import {
  buildQaSessionFromTokens,
  QA_COOKIE_NAMES,
  sanitizeReturnTo,
  setQaSessionCookies,
} from '@/lib/auth/qa-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as {
      accessToken?: string
      idToken?: string | null
      refreshToken?: string | null
      expiresIn?: number | null
      expiresAt?: number | null
      scope?: string | null
      returnTo?: string | null
    } | null

    if (!body?.accessToken) {
      return NextResponse.json({ ok: false, error: 'Missing access token.' }, { status: 400 })
    }

    const session = buildQaSessionFromTokens({
      accessToken: body.accessToken,
      idToken: body.idToken ?? null,
      refreshToken: body.refreshToken ?? null,
      expiresIn: typeof body.expiresIn === 'number' ? body.expiresIn : null,
      expiresAt: typeof body.expiresAt === 'number' ? body.expiresAt : null,
      grantedScopes: body.scope ?? null,
    })

    const response = NextResponse.json({
      ok: true,
      redirectTo: sanitizeReturnTo(body.returnTo),
      expiresAt: session.expiresAt,
    })

    setQaSessionCookies(response, session)
    response.cookies.set(QA_COOKIE_NAMES.state, '', { path: '/', maxAge: 0 })
    response.cookies.set(QA_COOKIE_NAMES.verifier, '', { path: '/', maxAge: 0 })
    response.cookies.set(QA_COOKIE_NAMES.returnTo, '', { path: '/', maxAge: 0 })

    return response
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'Unable to create QA session.' },
      { status: 500 },
    )
  }
}
