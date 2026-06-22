'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Eye, X } from 'lucide-react'

interface ViewAsPayload {
  userId: number
  email: string
  name: string
  consumerType?: string
  since: string
}

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.split('=')[1]) : null
}

export function ViewAsBanner() {
  const router = useRouter()
  const [viewingAs, setViewingAs] = React.useState<ViewAsPayload | null>(null)
  // Real impersonation = a genuine session as the target (lvip_real_impersonation
  // flag set by /api/dashboard/real-login-as). This is NOT the read-only overlay.
  const [realImpersonation, setRealImpersonation] = React.useState(false)
  const [returning, setReturning] = React.useState(false)

  React.useEffect(() => {
    setRealImpersonation(readCookie('lvip_real_impersonation') === '1')
    const raw = readCookie('lvip_view_as')
    if (!raw) return
    try {
      setViewingAs(JSON.parse(raw))
    } catch {
      setViewingAs(null)
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
            <span className="font-medium">Real session as another user</span>
            <span className="rounded-full bg-rose-200 px-2 py-0.5 text-xs font-medium text-rose-900">
              impersonating
            </span>
          </div>
          <button
            type="button"
            onClick={handleRealReturn}
            disabled={returning}
            className="inline-flex items-center gap-1 rounded-md bg-rose-900 px-3 py-1 text-xs font-medium text-rose-50 hover:bg-rose-800 disabled:opacity-50"
          >
            <X className="h-3 w-3" />
            {returning ? 'Returning…' : 'Return to admin'}
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
      router.refresh()
    } finally {
      setReturning(false)
    }
  }

  return (
    <div className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50/95 backdrop-blur supports-[backdrop-filter]:bg-amber-50/80">
      <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-amber-900">
          <Eye className="h-4 w-4" />
          <span className="font-medium">Viewing as {viewingAs.name}</span>
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
          {returning ? 'Returning…' : 'Return to admin'}
        </button>
      </div>
    </div>
  )
}
