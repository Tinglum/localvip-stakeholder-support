import type { NextRequest, NextResponse } from 'next/server'
import { DEMO_PROFILES } from '@/lib/auth/demo-profiles'
import { readSignedDemoSessionPayload, signDemoSessionPayload } from '@/lib/auth/qa-auth'
import type { Profile } from '@/lib/types/database'

type CookieSource = {
  get: (name: string) => { value?: string } | undefined
}

export const DEMO_COOKIE_NAMES = {
  email: 'lvip_demo_profile_email',
} as const

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() || null
}

/**
 * Demo login issues a real session from a static password, so the kill switch has
 * to hold on every read as well as at login. Checking it only in the login route
 * left an already-issued cookie working forever — including after the flag was
 * turned off, and in any environment that inherited the cookie.
 */
export function isDemoLoginEnabled() {
  return process.env.ENABLE_DEMO_LOGIN === 'true'
}

function cloneDemoProfile(profile: Profile): Profile {
  return {
    ...profile,
    metadata: profile.metadata ? { ...profile.metadata } : null,
  }
}

const DEMO_PROFILES_BY_EMAIL = new Map(
  Object.values(DEMO_PROFILES)
    .map((profile) => [normalizeEmail(profile.email), profile] as const)
    .filter((entry): entry is [string, Profile] => !!entry[0]),
)

export function getDemoProfileByEmail(email: string | null | undefined): Profile | null {
  const normalized = normalizeEmail(email)
  if (!normalized) return null
  const profile = DEMO_PROFILES_BY_EMAIL.get(normalized)
  return profile ? cloneDemoProfile(profile) : null
}

/**
 * The demo session email, or null.
 *
 * Async because the cookie is HMAC-signed (see `signDemoSessionPayload`): it used
 * to be a plaintext email, so anyone could mint an admin session with a single
 * `document.cookie` write. A value that fails signature verification, or names an
 * account that is no longer a demo profile, is treated as no session at all.
 */
export async function getDemoSessionEmailFromCookieStore(cookieStore: CookieSource): Promise<string | null> {
  if (!isDemoLoginEnabled()) return null

  const payload = await readSignedDemoSessionPayload(cookieStore.get(DEMO_COOKIE_NAMES.email)?.value)
  const normalized = normalizeEmail(payload?.email)
  if (!normalized || !DEMO_PROFILES_BY_EMAIL.has(normalized)) return null
  return normalized
}

export async function hasDemoSession(request: NextRequest) {
  return !!(await getDemoSessionEmailFromCookieStore(request.cookies))
}

export async function setDemoSessionCookie(response: NextResponse, email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized || !DEMO_PROFILES_BY_EMAIL.has(normalized)) {
    throw new Error('Invalid demo account.')
  }

  const value = await signDemoSessionPayload({ email: normalized, since: new Date().toISOString() })

  response.cookies.set(DEMO_COOKIE_NAMES.email, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  })
}

export function clearDemoSessionCookie(response: NextResponse) {
  response.cookies.set(DEMO_COOKIE_NAMES.email, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  })
}
