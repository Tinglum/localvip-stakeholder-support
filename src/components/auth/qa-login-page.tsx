'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const QA_STORAGE_KEYS = {
  state: 'lvip_qa_browser_state',
  verifier: 'lvip_qa_browser_verifier',
  returnTo: 'lvip_qa_browser_return_to',
} as const

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = ''
  bytes.forEach((value) => {
    binary += String.fromCharCode(value)
  })
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

export function QaLoginPage({
  returnTo,
  error,
  code,
  state,
  manual,
  signout,
  qaBaseUrl,
  clientId,
  scopes,
}: {
  returnTo: string
  error?: string
  code?: string
  state?: string
  manual?: boolean
  signout?: boolean
  qaBaseUrl: string
  clientId: string
  scopes: string
}) {
  const [redirecting, setRedirecting] = React.useState(false)
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null)
  const [clientError, setClientError] = React.useState<string | null>(null)
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const isOidcCallback = !!code && !!state
  // Never auto-bounce to the QA login page: the dashboard has its own sign-in
  // form below. The QA OAuth flow stays available as a fallback button, and the
  // OIDC callback (isOidcCallback) is still handled if someone returns from it.
  const shouldAutoRedirect = false

  // Native dashboard sign-in via the QA password grant — no redirect to QA.
  const handlePasswordLogin = React.useCallback(async (event: React.FormEvent) => {
    event.preventDefault()
    setClientError(null)
    if (!email.trim() || !password) {
      setClientError('Enter your email and password.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        throw new Error((json as { error?: string }).error || 'Invalid email or password.')
      }
      window.location.assign(returnTo || '/dashboard')
    } catch (err) {
      setClientError(err instanceof Error ? err.message : 'Could not sign in.')
      setSubmitting(false)
    }
  }, [email, password, returnTo])

  const startQaLogin = React.useCallback(async (idp?: string) => {
    setClientError(null)
    setStatusMessage(idp ? `Continuing with ${idp}…` : 'Opening the secure QA sign-in page...')
    setRedirecting(true)

    const verifier = randomBase64Url(64)
    const nextState = randomBase64Url(32)
    const challenge = await sha256Base64Url(verifier)
    const redirectUri = `${window.location.origin}/`

    window.sessionStorage.setItem(QA_STORAGE_KEYS.state, nextState)
    window.sessionStorage.setItem(QA_STORAGE_KEYS.verifier, verifier)
    window.sessionStorage.setItem(QA_STORAGE_KEYS.returnTo, returnTo)

    const authorizeUrl = new URL('/connect/authorize', qaBaseUrl.replace(/\/+$/, ''))
    authorizeUrl.searchParams.set('client_id', clientId)
    authorizeUrl.searchParams.set('response_type', 'code')
    authorizeUrl.searchParams.set('redirect_uri', redirectUri)
    authorizeUrl.searchParams.set('scope', scopes)
    authorizeUrl.searchParams.set('code_challenge', challenge)
    authorizeUrl.searchParams.set('code_challenge_method', 'S256')
    authorizeUrl.searchParams.set('state', nextState)
    // acr_values=idp:<scheme> tells IdentityServer to skip its login page and go
    // straight to the external provider (e.g. Google). Same code+PKCE callback.
    if (idp) authorizeUrl.searchParams.set('acr_values', `idp:${idp}`)

    window.location.assign(authorizeUrl.toString())
  }, [clientId, qaBaseUrl, returnTo, scopes])

  React.useEffect(() => {
    if (isOidcCallback) {
      const run = async () => {
        try {
          setClientError(null)
          setStatusMessage('Finishing sign-in and bringing you back to your dashboard...')
          setRedirecting(true)

          const storedState = window.sessionStorage.getItem(QA_STORAGE_KEYS.state)
          const verifier = window.sessionStorage.getItem(QA_STORAGE_KEYS.verifier)
          const storedReturnTo = window.sessionStorage.getItem(QA_STORAGE_KEYS.returnTo) || returnTo
          const redirectUri = `${window.location.origin}/`

          if (!storedState || !verifier) {
            throw new Error('We could not find your secure sign-in state. Please try again.')
          }

          if (state !== storedState) {
            throw new Error('Your secure sign-in session expired. Please try again.')
          }

          const tokenBody = new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: clientId,
            code,
            redirect_uri: redirectUri,
            code_verifier: verifier,
          })

          const tokenResponse = await fetch(`${qaBaseUrl.replace(/\/+$/, '')}/connect/token`, {
            method: 'POST',
            headers: {
              'content-type': 'application/x-www-form-urlencoded',
            },
            body: tokenBody.toString(),
          })

          const tokenJson = await tokenResponse.json().catch(() => null) as {
            access_token?: string
            id_token?: string
            refresh_token?: string
            expires_in?: number
            scope?: string
            error?: string
            error_description?: string
          } | null

          if (!tokenResponse.ok || !tokenJson?.access_token) {
            throw new Error(tokenJson?.error_description || tokenJson?.error || 'Sign-in could not be completed.')
          }

          const sessionResponse = await fetch('/api/auth/qa/session', {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              accessToken: tokenJson.access_token,
              idToken: tokenJson.id_token || null,
              refreshToken: tokenJson.refresh_token || null,
              expiresIn: tokenJson.expires_in || null,
              scope: tokenJson.scope || null,
              returnTo: storedReturnTo,
            }),
          })

          const sessionJson = await sessionResponse.json().catch(() => null) as {
            ok?: boolean
            redirectTo?: string
            error?: string
          } | null

          if (!sessionResponse.ok || !sessionJson?.ok) {
            throw new Error(sessionJson?.error || 'We could not create your dashboard session yet.')
          }

          window.sessionStorage.removeItem(QA_STORAGE_KEYS.state)
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.verifier)
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.returnTo)
          window.location.assign(sessionJson.redirectTo || storedReturnTo || '/dashboard')
        } catch (callbackError) {
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.state)
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.verifier)
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.returnTo)
          const message = callbackError instanceof Error ? callbackError.message : 'Sign-in failed.'
          setClientError(message)
          setStatusMessage(null)
          setRedirecting(false)
          window.history.replaceState({}, document.title, `/login?error=${encodeURIComponent(message)}`)
        }
      }

      void run()
      return
    }

    if (shouldAutoRedirect) {
      setStatusMessage('You will be taken to secure sign-in in a moment.')
      const timer = window.setTimeout(() => {
        startQaLogin().catch((startError) => {
          setClientError(startError instanceof Error ? startError.message : 'Unable to start secure sign-in.')
          setStatusMessage(null)
          setRedirecting(false)
        })
      }, 900)

      return () => window.clearTimeout(timer)
    }
  }, [clientId, code, isOidcCallback, qaBaseUrl, returnTo, scopes, shouldAutoRedirect, startQaLogin, state])

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.18),_transparent_28%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_45%,_#eef6ff_100%)] px-6 py-10">
      <div className="mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            LocalVIP Secure Sign-In
          </div>

          <div className="space-y-4">
            <h1 className="max-w-xl text-4xl font-bold tracking-tight text-surface-900 sm:text-5xl">
              Sign in once. Get straight back to work.
            </h1>
            <p className="max-w-2xl text-base leading-7 text-surface-600 sm:text-lg">
              We send you to the LocalVIP QA sign-in page, confirm your identity there, and bring you back here
              automatically. No technical setup is needed.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile
              icon={<LockKeyhole className="h-4 w-4" />}
              title="Secure"
              description="Your sign-in stays on the QA identity server."
            />
            <InfoTile
              icon={<ArrowRight className="h-4 w-4" />}
              title="Simple"
              description="Log in there, then come straight back here."
            />
            <InfoTile
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Ready"
              description="Once you are back, your dashboard session is ready to use."
            />
          </div>

          <div className="rounded-3xl border border-surface-200 bg-white/85 p-5 shadow-sm">
            <p className="text-sm font-semibold text-surface-900">What happens next</p>
            <ol className="mt-3 space-y-3 text-sm leading-6 text-surface-600">
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">1</span>
                <span>Choose <strong>Continue to secure sign-in</strong>.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">2</span>
                <span>Enter your QA login details on the secure page.</span>
              </li>
              <li className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">3</span>
                <span>We bring you back here and open your dashboard automatically.</span>
              </li>
            </ol>
          </div>
        </section>

        <section className="w-full max-w-xl justify-self-center">
          <div className="rounded-[2rem] border border-surface-200 bg-white/95 p-8 shadow-xl shadow-brand-100/40">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">Dashboard access</p>
            <h2 className="mt-3 text-3xl font-bold text-surface-900">Sign in to your dashboard</h2>
            <p className="mt-3 text-sm leading-6 text-surface-600">
              Enter your LocalVIP email and password.
            </p>

            {statusMessage && !error && !clientError ? (
              <div className="mt-5 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
                {statusMessage}
              </div>
            ) : null}

            {signout && !error ? (
              <div className="mt-5 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
                You have been signed out. When you are ready, sign in again below.
              </div>
            ) : null}

            {clientError || error ? (
              <div className="mt-5 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
                {clientError || error}
              </div>
            ) : null}

            <form onSubmit={handlePasswordLogin} className="mt-6 space-y-3">
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <><Loader2 className="h-4 w-4 animate-spin" /> Signing in…</> : <>Sign in <ArrowRight className="h-4 w-4" /></>}
              </Button>
            </form>

            <div className="mt-6 flex items-center gap-3 text-xs text-surface-400">
              <span className="h-px flex-1 bg-surface-200" /> or <span className="h-px flex-1 bg-surface-200" />
            </div>

            <Button
              variant="outline"
              className="mt-4 w-full gap-2"
              onClick={() => { void startQaLogin('Google') }}
              disabled={submitting || redirecting}
            >
              <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
              </svg>
              Continue with Google
            </Button>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Button variant="ghost" className="sm:flex-1 text-surface-500" onClick={() => { void startQaLogin() }} disabled={submitting}>
                {redirecting && !isOidcCallback ? 'Opening QA sign-in…' : 'Sign in via QA page'}
              </Button>
              <Button variant="ghost" className="sm:flex-1 text-surface-500" asChild>
                <Link href="/demo">Demo login</Link>
              </Button>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

function InfoTile({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="rounded-3xl border border-surface-200 bg-white/80 p-4 shadow-sm">
      <div className="inline-flex rounded-2xl bg-brand-50 p-2 text-brand-700">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-surface-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p>
    </div>
  )
}
