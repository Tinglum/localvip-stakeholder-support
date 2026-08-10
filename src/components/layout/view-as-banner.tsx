'use client'

import * as React from 'react'
import { Eye, X } from 'lucide-react'

/** Where to send an admin when they leave a View-As session. Written by LogInAsButton. */
export const VIEW_AS_RETURN_KEY = 'lvip_view_as_return'

interface ViewAsPayload {
  email: string
  name: string
  consumerType?: string
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

export function ViewAsBanner() {
  const [viewingAs, setViewingAs] = React.useState<ViewAsPayload | null>(null)
  // Real impersonation = a genuine session as the target (lvip_real_impersonation
  // flag set by /api/dashboard/real-login-as). This is NOT the read-only overlay.
  const [realImpersonation, setRealImpersonation] = React.useState(false)
  const [returning, setReturning] = React.useState(false)

  React.useEffect(() => {
    setRealImpersonation(readCookie('lvip_real_impersonation') === '1')
    // The `lvip_view_as` cookie is now httpOnly + signed, so it can't be read
    // from document.cookie. Read the resolved impersonation identity from the
    // server session instead.
    let cancelled = false
    void fetch('/api/auth/session', { credentials: 'include', cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((session) => {
        if (cancelled || !session?.viewingAs) return
        setViewingAs({
          email: session.viewingAs.targetEmail,
          name: session.viewingAs.targetName,
          consumerType: session.viewingAs.targetConsumerType || undefined,
        })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  // ── Real impersonation banner (genuine session) ──
  if (realImpersonation) {
    const handleRealReturn = async () => {
      setReturning(true)
      try {
        await fetch('/api/dashboard/real-login-as', { method: 'DELETE' })
        setRealImpersonation(false)
        // Hard navigate so the restored admin session is picked up cleanly.
        window.location.href = '/dashboard'
      } finally {
        setReturning(false)
      }
    }

    return (
      <div className="sticky top-0 z-40 border-b border-rose-300 bg-rose-50/95 backdrop-blur supports-[backdrop-filter]:bg-rose-50/80">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2 text-sm">
          <div className="flex items-center gap-2 text-rose-900">
            <Eye className="h-4 w-4" />
            <span className="font-medium">Admin previewing this business portal</span>
            <span className="rounded-full bg-rose-200 px-2 py-0.5 text-xs font-medium text-rose-900">
              live account view
            </span>
          </div>
          <button
            type="button"
            onClick={handleRealReturn}
            disabled={returning}
            className="inline-flex items-center gap-1 rounded-md bg-rose-900 px-3 py-1 text-xs font-medium text-rose-50 hover:bg-rose-800 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            {returning ? 'Returning...' : 'Return to admin'}
          </button>
        </div>
      </div>
    )
  }

  if (!viewingAs) return null

  const handleReturn = async () => {
    setReturning(true)
    try {
      await fetch('/api/admin/view-as', { method: 'DELETE' })
      setViewingAs(null)
      // router.refresh() only re-runs server components. The client auth context,
      // the cached session and every piece of client state still held the
      // impersonated profile, so the admin stayed "inside" the business until
      // they reloaded by hand. The real-impersonation path above already hard
      // navigates for exactly this reason; do the same here.
      //
      // Go back to the page the session was started from - usually the CRM record
      // the admin clicked - instead of dumping them on a generic dashboard.
      let destination = '/dashboard'
      try {
        const stored = window.sessionStorage.getItem(VIEW_AS_RETURN_KEY)
        window.sessionStorage.removeItem(VIEW_AS_RETURN_KEY)
        // Same-origin, path-only. A stored value is attacker-influencable in
        // principle, and this runs an unattended navigation.
        if (stored && stored.startsWith('/') && !stored.startsWith('//')) {
          destination = stored
        }
      } catch {
        /* sessionStorage unavailable (private mode, blocked storage) - use the default. */
      }
      window.location.assign(destination)
    } catch {
      setReturning(false)
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50/95 backdrop-blur supports-[backdrop-filter]:bg-amber-50/80">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-amber-900">
          <Eye className="h-4 w-4" />
          <span className="font-medium">Admin previewing {viewingAs.name}</span>
          <span className="text-amber-700">({viewingAs.email})</span>
          {viewingAs.consumerType && (
            <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-medium text-amber-900">
              {viewingAs.consumerType}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleReturn}
          disabled={returning}
          className="inline-flex items-center gap-1 rounded-md bg-amber-900 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-800 disabled:opacity-50"
        >
          <X className="h-3 w-3" />
          {returning ? 'Returning...' : 'Return to admin'}
        </button>
      </div>
    </div>
  )
}
