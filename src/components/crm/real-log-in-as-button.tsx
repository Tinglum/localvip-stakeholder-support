'use client'

/**
 * "Real log in as" — starts a GENUINE authenticated session as the target user
 * (not the read-only `lvip_view_as` overlay used by <LogInAsButton />).
 *
 * Calls POST /api/dashboard/real-login-as, which has the backend mint a real
 * IdentityServer-signed token for the target and swaps it into the live QA
 * session cookies. On success we hard-navigate to /dashboard, where the app now
 * resolves the session AS the target user — exactly what they see when they log
 * in themselves. No password is ever requested, handled, or displayed.
 *
 * Only rendered for admins, and only for QA users (numeric backend id). The
 * server route independently enforces super-admin access, so this client gate is
 * a convenience, not the security boundary.
 */
import * as React from 'react'
import { ShieldCheck, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

interface RealLogInAsButtonProps {
  /** Numeric QA backend user id of the target (string or number). */
  userId: string | number | null
  userName: string | null
  stakeholderType: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function RealLogInAsButton({
  userId,
  userName,
  stakeholderType,
  variant = 'default',
  size = 'sm',
}: RealLogInAsButtonProps) {
  const { isAdmin } = useAuth()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Real login-as requires a numeric QA backend id (the token-minting path).
  const numericId = userId !== null && /^\d+$/.test(String(userId).trim())
    ? Number(String(userId).trim())
    : null

  if (!isAdmin || numericId === null) return null

  async function handleClick() {
    const confirmed = window.confirm(
      `Start a REAL login session as ${userName || 'this user'} (${stakeholderType})?\n\n` +
        'You will be signed in exactly as they are, seeing their real profile and data. ' +
        'Use "Return to admin" to come back to your own account.',
    )
    if (!confirmed) return

    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/dashboard/real-login-as', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetUserId: numericId }),
      })
      const payload = await response.json().catch(() => ({ error: 'Request failed.' }))
      if (!response.ok) {
        setError(payload.error || 'Could not start a real session.')
        return
      }
      // Session cookies are swapped server-side; hard reload so the app resolves
      // the genuine session as the target user.
      window.location.href = '/dashboard'
    } catch {
      setError('Failed to start a real session.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant={variant} size={size} onClick={handleClick} disabled={busy} title="Start a genuine authenticated session as this user">
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ShieldCheck className="h-3.5 w-3.5" />
        )}
        {busy ? 'Signing in...' : `Real log in as ${stakeholderType}`}
      </Button>
      {error && <span className="text-xs text-danger-500">{error}</span>}
    </div>
  )
}
