import { NextRequest, NextResponse } from 'next/server'
import { loginWithPassword, setQaSessionCookies } from '@/lib/auth/qa-auth'

export const dynamic = 'force-dynamic'

// Native dashboard sign-in: authenticate with our own email/password form via the
// QA password grant and set the dashboard session cookies directly — no redirect
// to the QA IdentityServer login page.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password) {
      return NextResponse.json({ error: 'Enter your email and password.' }, { status: 400 })
    }

    const session = await loginWithPassword(email, password)
    const response = NextResponse.json({ ok: true })
    setQaSessionCookies(response, session)
    return response
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not sign in.' },
      { status: 401 },
    )
  }
}
