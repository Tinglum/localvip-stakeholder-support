'use client'

import * as React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

export function QaLoginPage({
  returnTo,
  error,
  code,
  state,
}: {
  returnTo: string
  error?: string
  code?: string
  state?: string
}) {
  const [redirecting, setRedirecting] = React.useState(false)
  const isOidcCallback = !!code && !!state

  React.useEffect(() => {
    if (isOidcCallback) {
      const params = new URLSearchParams({
        code,
        state,
      })
      const target = `/api/auth/qa/callback?${params.toString()}`
      setRedirecting(true)
      window.location.assign(target)
      return
    }

    if (error) return
    const target = `/api/auth/qa/start?returnTo=${encodeURIComponent(returnTo)}`
    setRedirecting(true)
    window.location.assign(target)
  }, [code, error, isOidcCallback, returnTo, state])

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 px-6">
      <div className="w-full max-w-lg rounded-3xl border border-surface-200 bg-white p-8 shadow-xl">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-600">LocalVIP QA Login</p>
        <h1 className="mt-3 text-3xl font-bold text-surface-900">Continue on qa.localvip.com</h1>
        <p className="mt-3 text-sm leading-6 text-surface-600">
          Dashboard sign-in now runs through the QA identity server. After you log in there, you will come right back here with a secure access token for API calls.
        </p>
        {isOidcCallback && !error && (
          <div className="mt-4 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-700">
            Completing QA login and exchanging your authorization code...
          </div>
        )}
        {error && (
          <div className="mt-4 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <a href={`/api/auth/qa/start?returnTo=${encodeURIComponent(returnTo)}`}>
              {redirecting
                ? (isOidcCallback ? 'Completing QA login...' : 'Redirecting to QA login...')
                : 'Continue to QA login'}
            </a>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/demo">Use demo login instead</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
