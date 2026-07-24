'use client'

/**
 * First-login "set your password" step for invited owners.
 *
 * Deliberately outside the (dashboard) route group: that layout redirects here
 * whenever forcePasswordReset is set, so this page must not itself sit under that
 * layout or it would redirect to itself forever.
 *
 * The user is already authenticated (they signed in with the temporary password),
 * so this only collects a new password and posts it to the QA backend, which clears
 * the force-reset flag. On success we send them to the dashboard.
 */
import * as React from 'react'
import { useRouter } from 'next/navigation'

export default function SetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = React.useState('')
  const [confirm, setConfirm] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [checking, setChecking] = React.useState(true)

  // Guard direct navigation: only a signed-in user who still needs to set a
  // password belongs here. Anyone else is sent where they should be.
  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/auth/session', { cache: 'no-store' })
        const s = res.ok ? await res.json() : null
        if (cancelled) return
        if (!s?.authenticated) { window.location.assign('/login'); return }
        if (s.forcePasswordReset !== true) { window.location.assign('/dashboard'); return }
        setChecking(false)
      } catch {
        if (!cancelled) window.location.assign('/login')
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('The two passwords do not match.'); return }

    setSaving(true)
    try {
      const res = await fetch('/api/qa/user/set-initial-password', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ newPassword: password }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError(data?.error || 'The password could not be set.')
        return
      }
      // Flag is cleared server-side; a full navigation re-runs the layout guard.
      window.location.assign('/dashboard')
    } catch {
      setError('The password could not be set.')
    } finally {
      setSaving(false)
    }
  }

  if (checking) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-surface-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-semibold text-surface-900">Set your password</h1>
        <p className="mt-2 text-sm leading-6 text-surface-600">
          Welcome to LocalVIP. Choose a password to finish setting up your account —
          you won&apos;t need the temporary one again.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="pw" className="block text-sm font-medium text-surface-700">New password</label>
            <input
              id="pw"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-surface-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="At least 8 characters"
            />
          </div>
          <div>
            <label htmlFor="pw2" className="block text-sm font-medium text-surface-700">Confirm password</label>
            <input
              id="pw2"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-surface-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Re-enter your password"
            />
          </div>

          {error ? <p className="text-sm text-danger-600">{error}</p> : null}

          <button
            type="submit"
            disabled={saving}
            className="h-10 w-full rounded-lg bg-brand-600 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Set password and continue'}
          </button>
        </form>
      </div>
    </div>
  )
}
