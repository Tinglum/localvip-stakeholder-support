'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

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
  const isOidcCallback = !!code && !!state
  const shouldAutoRedirect = !manual && !signout && !error && !isOidcCallback

  const startQaLogin = React.useCallback(async () => {
    setClientError(null)
    setStatusMessage('Redirecting you to the QA sign-in page...')
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

    window.location.assign(authorizeUrl.toString())
  }, [clientId, qaBaseUrl, returnTo, scopes])

  React.useEffect(() => {
    if (isOidcCallback) {
      const run = async () => {
        try {
          setClientError(null)
          setStatusMessage('Completing QA login and exchanging your authorization code...')
          setRedirecting(true)

          const storedState = window.sessionStorage.getItem(QA_STORAGE_KEYS.state)
          const verifier = window.sessionStorage.getItem(QA_STORAGE_KEYS.verifier)
          const storedReturnTo = window.sessionStorage.getItem(QA_STORAGE_KEYS.returnTo) || returnTo
          const redirectUri = `${window.location.origin}/`

          if (!storedState || !verifier) {
            throw new Error('Missing QA browser login state. Please try again.')
          }

          if (state !== storedState) {
            throw new Error('QA login state mismatch. Please try again.')
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
            throw new Error(tokenJson?.error_description || tokenJson?.error || 'QA login failed.')
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
            throw new Error(sessionJson?.error || 'Unable to create dashboard session.')
          }

          window.sessionStorage.removeItem(QA_STORAGE_KEYS.state)
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.verifier)
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.returnTo)
          window.location.assign(sessionJson.redirectTo || storedReturnTo || '/dashboard')
        } catch (callbackError) {
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.state)
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.verifier)
          window.sessionStorage.removeItem(QA_STORAGE_KEYS.returnTo)
          const message = callbackError instanceof Error ? callbackError.message : 'QA login failed.'
          setClientError(message)
          setStatusMessage(null)
          setRedirecting(false)
          window.history.replaceState({}, document.title, `/login?error=${encodeURIComponent(message)}`)
        }
      }

      run()
      return
    }

    if (shouldAutoRedirect) {
      const timer = window.setTimeout(() => {
        startQaLogin().catch((startError) => {
          setClientError(startError instanceof Error ? startError.message : 'Unable to start QA login.')
          setStatusMessage(null)
          setRedirecting(false)
        })
      }, 50)

      return () => window.clearTimeout(timer)
    }
  }, [clientId, code, isOidcCallback, qaBaseUrl, returnTo, scopes, shouldAutoRedirect, startQaLogin, state])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-surface-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">LocalVIP QA Login</p>
        <h1 className="mt-3 text-3xl font-bold text-surface-900">Continue on qa.localvip.com</h1>
        <p className="mt-3 text-sm leading-6 text-surface-600">
          Dashboard sign-in now runs through the QA identity server. After you log in there, you will come right back here with a secure access token for API calls.
        </p>
        {statusMessage && !error && !clientError && (
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
            {statusMessage}
          </div>
        )}
        {signout && !error && (
          <div className="mt-4 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
            You have been signed out. Start QA login again when you are ready.
          </div>
        )}
        {(clientError || error) && (
          <div className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {clientError || error}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={() => { void startQaLogin() }}>
            {redirecting
              ? (isOidcCallback ? 'Completing QA login...' : 'Redirecting to QA login...')
              : 'Continue to QA login'}
          </Button>
          <Button variant="outline" asChild>
            <Link href="/demo">Use demo login instead</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
