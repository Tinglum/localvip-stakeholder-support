'use client'

/**
 * Drives the two-step auto-login from the invite email. See welcome/page.tsx.
 *
 * The OIDC initiation here mirrors startQaLogin in qa-login-page.tsx (same PKCE
 * storage keys and authorize params) so the existing callback handler on /login can
 * complete the exchange unchanged. Kept separate rather than shared because this
 * page runs it unattended, with no login UI.
 */
import * as React from 'react'

const QA_STORAGE_KEYS = {
  state: 'lvip_qa_browser_state',
  verifier: 'lvip_qa_browser_verifier',
  returnTo: 'lvip_qa_browser_return_to',
} as const

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((value) => { binary += String.fromCharCode(value) })
  return window.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function randomBase64Url(byteLength: number) {
  const bytes = new Uint8Array(byteLength)
  window.crypto.getRandomValues(bytes)
  return bytesToBase64Url(bytes)
}

async function sha256Base64Url(value: string) {
  const digest = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  return bytesToBase64Url(new Uint8Array(digest))
}

export function WelcomeAutoLogin({
  token,
  ready,
  qaBaseUrl,
  clientId,
  scopes,
}: {
  token: string | null
  ready: boolean
  qaBaseUrl: string
  clientId: string
  scopes: string
}) {
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const base = qaBaseUrl.replace(/\/+$/, '')

    // Step 1: redeem the token at the QA backend, which sets the SSO cookie and
    // redirects back here with ?ready=1.
    if (token) {
      window.location.assign(`${base}/account/magic?token=${encodeURIComponent(token)}`)
      return
    }

    // Step 2: the SSO cookie now exists, so a normal authorize request returns a
    // code without prompting. After set-password the owner is where they belong,
    // so returnTo is just the dashboard home.
    if (ready) {
      void (async () => {
        try {
          const verifier = randomBase64Url(64)
          const state = randomBase64Url(32)
          const challenge = await sha256Base64Url(verifier)
          window.sessionStorage.setItem(QA_STORAGE_KEYS.state, state)
          window.sessionStorage.setItem(QA_STORAGE_KEYS.verifier, verifier)
          window.sessionStorage.setItem(QA_STORAGE_KEYS.returnTo, '/dashboard')

          const authorizeUrl = new URL('/connect/authorize', base)
          authorizeUrl.searchParams.set('client_id', clientId)
          authorizeUrl.searchParams.set('response_type', 'code')
          authorizeUrl.searchParams.set('redirect_uri', `${window.location.origin}/`)
          authorizeUrl.searchParams.set('scope', scopes)
          authorizeUrl.searchParams.set('code_challenge', challenge)
          authorizeUrl.searchParams.set('code_challenge_method', 'S256')
          authorizeUrl.searchParams.set('state', state)
          window.location.assign(authorizeUrl.toString())
        } catch {
          setError('We could not finish signing you in. Please use the password from your email.')
        }
      })()
      return
    }

    // Neither param — nothing to do; send them to the normal login.
    window.location.assign('/login')
  }, [token, ready, qaBaseUrl, clientId, scopes])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-50 px-6 text-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      <p className="text-sm text-surface-600">
        {error ? error : 'Signing you in…'}
      </p>
      {error ? (
        <a href="/login" className="text-sm font-medium text-brand-700 hover:underline">Go to sign in</a>
      ) : null}
    </div>
  )
}
