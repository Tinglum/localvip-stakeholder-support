import { mapQaRoleFromSignals, QA_AUTH_CONFIG, signQaStatePayload, type QaSession } from './qa-auth'

export const PIN_COOKIES = { device: 'lvip_admin_device', unlocked: 'lvip_admin_unlocked', login: 'lvip_admin_full_login' } as const
export const DEVICE_SECONDS = 365 * 24 * 60 * 60
type CookieSource = { get(name: string): { value: string } | undefined }
export const isSysadminSession = (session: QaSession | null) => !!session && mapQaRoleFromSignals({ claims: session.claims }).roleSubtype === 'super'

// Domain-separated from OAuth state and scoped to this environment's issuer.
export async function signPinGrant(kind: 'login' | 'unlock', sub: string, device: string, seconds: number) {
  const payload = btoa(JSON.stringify({ kind, sub, device, issuer: QA_AUTH_CONFIG.baseUrl, exp: Date.now() + seconds * 1000 }))
  return `${payload}.${await signQaStatePayload(`sysadmin-pin:${payload}`)}`
}

export async function validPinGrant(raw: string | undefined, kind: 'login' | 'unlock', sub: string, device: string) {
  try {
    if (!raw || raw.length > 2048) return false
    const [payload, signature, extra] = raw.split('.')
    if (extra || !signature) return false
    const expected = await signQaStatePayload(`sysadmin-pin:${payload}`)
    let difference = expected.length ^ signature.length
    for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ (signature.charCodeAt(i) || 0)
    if (difference) return false
    const grant = JSON.parse(atob(payload))
    return grant.kind === kind && grant.sub === sub && grant.device === device && grant.issuer === QA_AUTH_CONFIG.baseUrl && grant.exp > Date.now()
  } catch { return false }
}

export async function hasSysadminPinAccess(cookies: CookieSource, session: QaSession | null) {
  if (!isSysadminSession(session)) return true
  return validPinGrant(cookies.get(PIN_COOKIES.unlocked)?.value, 'unlock', session!.claims.sub,
    cookies.get(PIN_COOKIES.device)?.value || '')
}
