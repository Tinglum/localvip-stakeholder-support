/**
 * Biometric unlock — a LOCAL device lock, not a second sign-in.
 *
 * What this is, precisely, because the distinction matters both for the copy and
 * for anyone reading this later:
 *
 *   - It uses the device's own platform authenticator (Touch ID, Face ID, Windows
 *     Hello, an Android fingerprint sensor) to decide whether the session ALREADY
 *     stored in this browser may be used.
 *   - It does NOT authenticate anything with the server. No assertion is sent
 *     anywhere, the QA IdentityServer never sees it, and passing it grants no
 *     access the browser did not already hold. Anyone with the session cookie and
 *     devtools can bypass it — that is inherent to a local lock, and it is why the
 *     UI must never describe it as re-authentication or as extra account security.
 *   - Its value is the shoulder-surfing case: a shared or unattended laptop where
 *     the dashboard should not simply be open.
 *
 * It is therefore only offered on top of a persistent ("keep me logged in")
 * session, and there is always an escape hatch: sign out and sign in normally.
 */

const ENABLED_STORAGE_KEY = 'lvip_biometric_unlock'
/** Per-tab, so closing the browser re-locks even though the session persists. */
const UNLOCKED_STORAGE_KEY = 'lvip_biometric_unlocked'
const PERSISTENT_COOKIE_NAME = 'lvip_qa_persistent'

export interface BiometricEnrollment {
  /** base64url credential id, replayed as allowCredentials at unlock time. */
  credentialId: string
  /** Who enrolled, so a different account signing in here does not inherit the lock. */
  accountKey: string
  label: string | null
  enrolledAt: string
}

function isBrowser() {
  return typeof window !== 'undefined'
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function base64UrlToBytes(value: string) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
  const binary = window.atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length)
  window.crypto.getRandomValues(bytes)
  return bytes
}

/** Does this browser expose WebAuthn at all? */
export function isWebAuthnAvailable() {
  return isBrowser()
    && typeof window.PublicKeyCredential === 'function'
    && !!navigator.credentials?.create
}

/**
 * Is a *platform* authenticator (built-in biometrics) actually present?
 *
 * Distinct from isWebAuthnAvailable: plenty of browsers support WebAuthn with only
 * a roaming security key, and offering "unlock with biometrics" there is a dead
 * end. Resolves false rather than throwing on older browsers.
 */
export async function isPlatformAuthenticatorAvailable() {
  if (!isWebAuthnAvailable()) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

/** Does this device hold a "keep me logged in" session for the lock to gate? */
export function hasPersistentSessionCookie() {
  if (!isBrowser()) return false
  return document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .some((entry) => entry === `${PERSISTENT_COOKIE_NAME}=1`)
}

export function readBiometricEnrollment(): BiometricEnrollment | null {
  if (!isBrowser()) return null
  try {
    const raw = window.localStorage.getItem(ENABLED_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<BiometricEnrollment>
    if (typeof parsed.credentialId !== 'string' || !parsed.credentialId) return null
    if (typeof parsed.accountKey !== 'string' || !parsed.accountKey) return null
    return {
      credentialId: parsed.credentialId,
      accountKey: parsed.accountKey,
      label: typeof parsed.label === 'string' ? parsed.label : null,
      enrolledAt: typeof parsed.enrolledAt === 'string' ? parsed.enrolledAt : '',
    }
  } catch {
    return null
  }
}

export function clearBiometricEnrollment() {
  if (!isBrowser()) return
  window.localStorage.removeItem(ENABLED_STORAGE_KEY)
  window.sessionStorage.removeItem(UNLOCKED_STORAGE_KEY)
}

export function isUnlockedThisSession() {
  if (!isBrowser()) return false
  return window.sessionStorage.getItem(UNLOCKED_STORAGE_KEY) === '1'
}

export function markUnlockedThisSession() {
  if (!isBrowser()) return
  window.sessionStorage.setItem(UNLOCKED_STORAGE_KEY, '1')
}

/**
 * Enrol this device's platform authenticator.
 *
 * The keypair it creates is never registered with the server — only the credential
 * id is kept, so the same authenticator can be challenged again at unlock time. The
 * challenge is random client-side data for exactly that reason: there is no server
 * verification to bind it to, and pretending otherwise would be security theatre.
 */
export async function enrolBiometricUnlock(options: {
  accountKey: string
  label?: string | null
}): Promise<BiometricEnrollment> {
  if (!isWebAuthnAvailable()) {
    throw new Error('This browser does not support biometric unlock.')
  }

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: randomBytes(32),
      rp: { name: 'LocalVIP Dashboard', id: window.location.hostname },
      user: {
        id: randomBytes(32),
        name: options.label || options.accountKey,
        displayName: options.label || options.accountKey,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },   // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60_000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null

  if (!credential) {
    throw new Error('Biometric unlock could not be set up on this device.')
  }

  const enrollment: BiometricEnrollment = {
    credentialId: bytesToBase64Url(new Uint8Array(credential.rawId)),
    accountKey: options.accountKey,
    label: options.label || null,
    enrolledAt: new Date().toISOString(),
  }

  window.localStorage.setItem(ENABLED_STORAGE_KEY, JSON.stringify(enrollment))
  markUnlockedThisSession()
  return enrollment
}

/**
 * Challenge the enrolled authenticator. Resolves true only on a successful
 * user-verified assertion; throws with a readable message otherwise.
 */
export async function verifyBiometricUnlock(enrollment: BiometricEnrollment): Promise<boolean> {
  if (!isWebAuthnAvailable()) {
    throw new Error('This browser does not support biometric unlock.')
  }

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: window.location.hostname,
      allowCredentials: [
        { type: 'public-key', id: base64UrlToBytes(enrollment.credentialId) },
      ],
      userVerification: 'required',
      timeout: 60_000,
    },
  }) as PublicKeyCredential | null

  if (!assertion) return false
  markUnlockedThisSession()
  return true
}
