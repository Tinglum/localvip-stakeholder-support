'use client'

import * as React from 'react'
import { Fingerprint, Loader2, ShieldCheck, TriangleAlert } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  clearBiometricEnrollment,
  enrolBiometricUnlock,
  hasPersistentSessionCookie,
  isPlatformAuthenticatorAvailable,
  readBiometricEnrollment,
  type BiometricEnrollment,
} from '@/lib/auth/biometric-unlock'

/**
 * Opt-in toggle for the local biometric device lock.
 *
 * The copy here is deliberate and should not be loosened into security language:
 * this locks the session that is already stored in this browser, it is not a second
 * sign-in and the server is not involved. See src/lib/auth/biometric-unlock.ts.
 */
export function BiometricUnlockSetting({
  accountKey,
  label,
}: {
  accountKey: string
  label?: string | null
}) {
  const [supported, setSupported] = React.useState<boolean | null>(null)
  const [hasPersistentSession, setHasPersistentSession] = React.useState(false)
  const [enrollment, setEnrollment] = React.useState<BiometricEnrollment | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    void isPlatformAuthenticatorAvailable().then((available) => {
      if (active) setSupported(available)
    })
    setHasPersistentSession(hasPersistentSessionCookie())
    setEnrollment(readBiometricEnrollment())
    return () => {
      active = false
    }
  }, [])

  const enable = React.useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      setEnrollment(await enrolBiometricUnlock({ accountKey, label }))
    } catch (err) {
      // A cancelled prompt throws too; there is nothing to recover, just say so.
      setError(err instanceof Error && err.name === 'NotAllowedError'
        ? 'The biometric prompt was dismissed, so nothing was changed.'
        : err instanceof Error ? err.message : 'Biometric unlock could not be set up.')
    } finally {
      setBusy(false)
    }
  }, [accountKey, label])

  const disable = React.useCallback(() => {
    clearBiometricEnrollment()
    setEnrollment(null)
    setError(null)
  }, [])

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Fingerprint className="h-5 w-5 text-brand-600" />
              Unlock with biometrics
            </CardTitle>
            <CardDescription>
              Lock this browser with your device&apos;s fingerprint or face unlock, so the dashboard asks
              for it before showing your session again on this device.
            </CardDescription>
          </div>
          {enrollment ? (
            <Badge variant="success">
              <ShieldCheck className="h-3 w-3" />
              On for this device
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm leading-6 text-surface-600">
          This is a lock on this device, not a new way of signing in. It does not send anything to
          LocalVIP and does not change your password or your account security - it only decides whether
          the session already saved in this browser is shown. You can always sign out and sign back in
          with your email and password instead.
        </div>

        {error ? (
          <div className="flex items-start gap-2 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {supported === null ? (
          <div className="flex items-center gap-2 text-sm text-surface-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking this device...
          </div>
        ) : !supported ? (
          <p className="text-sm text-surface-500">
            This device or browser does not offer a built-in fingerprint or face unlock, so there is
            nothing for the dashboard to use here.
          </p>
        ) : enrollment ? (
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={disable}>Turn off on this device</Button>
            <span className="text-xs text-surface-500">
              Turning it off leaves you signed in - it only stops the unlock prompt.
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            {!hasPersistentSession ? (
              <p className="text-sm text-surface-500">
                There is nothing to lock yet: this browser is not keeping you signed in. Sign in again
                with &quot;Keep me logged in on this device&quot; ticked, then turn this on.
              </p>
            ) : null}
            <Button onClick={() => { void enable() }} disabled={busy || !hasPersistentSession}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fingerprint className="h-4 w-4" />}
              Turn on for this device
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
