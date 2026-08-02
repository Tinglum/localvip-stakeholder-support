'use client'

import * as React from 'react'
import { ExternalLink, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

interface OpenInWebappButtonProps {
  userId: string | number | null
  userName: string | null
  stakeholderType: 'Business' | 'Cause' | 'Consumer'
  /**
   * Business account this webapp session is being launched from. Without it the
   * webapp re-derives the business from the user alone, so an owner of several
   * businesses lands in whichever one the backend returns first. The server
   * verifies the user really belongs to this account before passing it on.
   */
  businessAccountId?: string | number | null
  /**
   * Cause account this webapp session is being launched from. Same problem and
   * same guarantee as `businessAccountId`: without it the cause portal re-derives
   * the nonprofit from the user alone, so a leader of several causes lands in
   * whichever one the backend returns first. The server verifies membership
   * before passing it on.
   */
  causeAccountId?: string | number | null
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'default' | 'sm' | 'lg' | 'icon'
}

export function OpenInWebappButton({
  userId,
  userName,
  stakeholderType,
  businessAccountId = null,
  causeAccountId = null,
  variant = 'default',
  size = 'sm',
}: OpenInWebappButtonProps) {
  const { isAdmin } = useAuth()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const numericId = userId !== null && /^\d+$/.test(String(userId).trim())
    ? Number(String(userId).trim())
    : null
  const numericBusinessAccountId =
    businessAccountId != null && /^\d+$/.test(String(businessAccountId).trim())
      ? Number(String(businessAccountId).trim())
      : null
  const numericCauseAccountId =
    causeAccountId != null && /^\d+$/.test(String(causeAccountId).trim())
      ? Number(String(causeAccountId).trim())
      : null

  if (!isAdmin || numericId === null) return null

  async function handleClick() {
    const confirmed = window.confirm(
      `Open my.localvip.com as ${userName || `this ${stakeholderType.toLowerCase()}`}?`,
    )
    if (!confirmed) return

    // Open before awaiting the API so browser popup protection does not block it.
    const appTab = window.open('about:blank', '_blank')
    setBusy(true)
    setError(null)

    try {
      const response = await fetch('/api/dashboard/open-in-app', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: numericId,
          ...(numericBusinessAccountId != null ? { businessAccountId: numericBusinessAccountId } : {}),
          ...(numericCauseAccountId != null ? { causeAccountId: numericCauseAccountId } : {}),
        }),
      })
      const payload = await response.json().catch(() => ({ error: 'Request failed.' }))
      if (!response.ok || !payload.url) {
        appTab?.close()
        setError(payload.error || `Could not open the ${stakeholderType.toLowerCase()} webapp.`)
        return
      }

      if (appTab) {
        appTab.location.href = payload.url
      } else {
        window.location.href = payload.url
      }
    } catch {
      appTab?.close()
      setError(`Could not open the ${stakeholderType.toLowerCase()} webapp.`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant={variant} size={size} onClick={handleClick} disabled={busy}>
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
        {busy ? 'Opening webapp...' : `Log in as ${stakeholderType} in webapp`}
      </Button>
      {error && <span className="max-w-64 text-xs text-danger-500">{error}</span>}
    </div>
  )
}
