'use client'

import * as React from 'react'
import { Fingerprint, Loader2, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  clearBiometricEnrollment,
  isUnlockedThisSession,
  readBiometricEnrollment,
  verifyBiometricUnlock,
  type BiometricEnrollment,
} from '@/lib/auth/biometric-unlock'

/**
 * Covers the dashboard until the local biometric lock is satisfied.
 *
 * Renders nothing at all unless the user opted in on this device, so the default
 * experience is untouched. Always escapable: "Sign in with your password instead"
 * clears the enrolment, signs out, and returns to the normal login — the path to
 * take when the device changes, the sensor fails, or the enrolment was made on a
 * fingerprint that no longer exists.
 */
export function BiometricLockGate({ children }: { children: React.ReactNode }) {
  // null = still deciding. Rendering children before this resolves would flash the
  // dashboard behind the lock, which defeats the point of it.
  const [enrollment, setEnrollment] = React.useState<BiometricEnrollment | null | undefined>(undefined)
  const [unlocked, setUnlocked] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    const stored = readBiometricEnrollment()
    setEnrollment(stored)
    setUnlocked(!stored || isUnlockedThisSession())
  }, [])

  const unlock = React.useCallback(async () => {
    if (!enrollment) return
    setBusy(true)
    setError(null)
    try {
      if (await verifyBiometricUnlock(enrollment)) {
        setUnlocked(true)
      } else {
        setError('That did not unlock the dashboard. Try again, or sign in with your password.')
      }
    } catch (err) {
      setError(err instanceof Error && err.name === 'NotAllowedError'
        ? 'The unlock prompt was dismissed. Try again, or sign in with your password.'
        : err instanceof Error ? err.message : 'Biometric unlock failed on this device.')
    } finally {
      setBusy(false)
    }
  }, [enrollment])

  const signInInstead = React.useCallback(async () => {
    // Drop the enrolment first: whatever is wrong with it, the user should not be
    // trapped behind it again after signing back in.
    clearBiometricEnrollment()
    const res = await fetch('/api/auth/logout', { method: 'POST' }).catch(() => null)
    const json = await res?.json().catch(() => null) as { redirectTo?: string } | null
    window.location.assign(json?.redirectTo || '/login')
  }, [])

  // Prompt as soon as the gate mounts, so the common case is one touch and no click.
  React.useEffect(() => {
    if (enrollment && !unlocked) void unlock()
    // Deliberately only on the transition into "locked" — re-running on every
    // `unlock` identity change would re-prompt in a loop after a cancelled prompt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollment])

  if (enrollment === undefined) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
      </div>
    )
  }

  if (!enrollment || unlocked) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-50 px-6 py-10">
      <div className="w-full max-w-md rounded-[2rem] border border-surface-200 bg-white p-8 text-center shadow-xl">
        <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Fingerprint className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-2xl font-bold text-surface-900">Dashboard locked</h1>
        <p className="mt-3 text-sm leading-6 text-surface-600">
          You are still signed in on this device. Use your fingerprint or face unlock to show your
          dashboard again.
        </p>

        {error ? (
          <div className="mt-5 flex items-start gap-2 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-left text-sm text-danger-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <Button className="mt-6 w-full" onClick={() => { void unlock() }} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
          Unlock
        </Button>

        <Button
          variant="ghost"
          className="mt-2 w-full text-surface-500"
          onClick={() => { void signInInstead() }}
        >
          Sign in with your password instead
        </Button>
      </div>
    </div>
  )
}
