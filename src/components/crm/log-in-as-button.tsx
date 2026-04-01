'use client'

import * as React from 'react'
import { LogIn, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { useImpersonation } from '@/lib/impersonation-context'

interface LogInAsButtonProps {
  userId: string | null
  userName: string | null
  stakeholderType: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function LogInAsButton({
  userId,
  userName,
  stakeholderType,
  variant = 'outline',
  size = 'sm',
}: LogInAsButtonProps) {
  const { profile, isAdmin } = useAuth()
  const { startImpersonation } = useImpersonation()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  if (!isAdmin || !userId) return null

  async function handleClick() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      const payload = await response.json().catch(() => ({ error: 'Request failed.' }))
      if (!response.ok) {
        setError(payload.error || 'Could not generate login link.')
        return
      }

      // Store impersonation metadata before opening the new tab
      startImpersonation({
        adminName: profile.full_name,
        adminEmail: profile.email,
        stakeholderName: userName,
        stakeholderType,
        returnUrl: window.location.href,
      })

      window.open(payload.link, '_blank', 'noopener,noreferrer')
    } catch {
      setError('Failed to impersonate.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant={variant} size={size} onClick={handleClick} disabled={busy}>
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <LogIn className="h-3.5 w-3.5" />
        )}
        {busy ? 'Opening...' : `Log in as ${stakeholderType}`}
      </Button>
      {error && <span className="text-xs text-danger-500">{error}</span>}
    </div>
  )
}
