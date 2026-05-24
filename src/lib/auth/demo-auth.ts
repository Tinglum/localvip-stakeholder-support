import type { NextRequest, NextResponse } from 'next/server'
import { DEMO_PROFILES } from '@/lib/auth/demo-profiles'
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

export function getDemoSessionEmailFromCookieStore(cookieStore: CookieSource) {
  return normalizeEmail(cookieStore.get(DEMO_COOKIE_NAMES.email)?.value)
}

export function hasDemoSession(request: NextRequest) {
  return !!getDemoSessionEmailFromCookieStore(request.cookies)
}

export function setDemoSessionCookie(response: NextResponse, email: string) {
  const normalized = normalizeEmail(email)
  if (!normalized || !DEMO_PROFILES_BY_EMAIL.has(normalized)) {
    throw new Error('Invalid demo account.')
  }

  response.cookies.set(DEMO_COOKIE_NAMES.email, normalized, {
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
