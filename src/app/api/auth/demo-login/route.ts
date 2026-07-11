import { NextRequest, NextResponse } from 'next/server'
import { getDemoProfileByEmail, setDemoSessionCookie } from '@/lib/auth/demo-auth'
import { sanitizeReturnTo } from '@/lib/auth/qa-auth'

export async function POST(request: NextRequest) {
  // Demo login accepts a static password and issues a real session, so it must
  // never be reachable in production. It is enabled only when ENABLE_DEMO_LOGIN
  // is explicitly set to "true" (production is assumed not to set this flag).
  if (process.env.ENABLE_DEMO_LOGIN !== 'true') {
    return NextResponse.json({ ok: false, error: 'Not found.' }, { status: 404 })
  }

  const body = await request.json().catch(() => null)
  const email = typeof body?.email === 'string' ? body.email : null
  const password = typeof body?.password === 'string' ? body.password : null
  const returnTo = sanitizeReturnTo(typeof body?.returnTo === 'string' ? body.returnTo : '/dashboard')

  const profile = getDemoProfileByEmail(email)
  if (!profile) {
    return NextResponse.json({ ok: false, error: 'That demo account is not available.' }, { status: 400 })
  }

  if (password && password !== 'demo1234') {
    return NextResponse.json({ ok: false, error: 'Use password demo1234 for manual demo login.' }, { status: 401 })
  }

  const response = NextResponse.json({
    ok: true,
    redirectTo: returnTo,
    profile: {
      email: profile.email,
      fullName: profile.full_name,
    },
  })

  setDemoSessionCookie(response, profile.email)
  return response
}
