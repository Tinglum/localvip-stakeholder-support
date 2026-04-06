import { NextResponse } from 'next/server'
import { clearQaSessionCookies } from '@/lib/auth/qa-auth'

export async function POST(request: Request) {
  const redirectTo = new URL('/login', request.url)
  const response = NextResponse.json({ ok: true, redirectTo: redirectTo.toString() })
  clearQaSessionCookies(response)
  return response
}
