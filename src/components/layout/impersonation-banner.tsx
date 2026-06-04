'use client'

import * as React from 'react'
import { ArrowLeft, Eye, X } from 'lucide-react'
import { useImpersonation } from '@/lib/impersonation-context'

export function ImpersonationBanner() {
  const { active, adminName, stakeholderName, stakeholderType, returnUrl, endImpersonation } = useImpersonation()

  if (!active) return null

  async function handleReturnToAdmin() {
    endImpersonation()
    // Also clear the QA "View As" cookie in case both systems were active.
    try { await fetch('/api/admin/view-as', { method: 'DELETE' }) } catch {}
    // Then drop the auth session via the canonical logout route.
    try { await fetch('/api/auth/logout', { method: 'POST' }) } catch {}
    window.location.href = returnUrl || '/login'
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between gap-3 bg-warning-500 px-4 py-2 text-white shadow-lg">
      <div className="flex items-center gap-2.5">
        <Eye className="h-4 w-4 shrink-0" />
        <span className="text-sm font-medium">
          Impersonating{' '}
          <strong>{stakeholderName || 'stakeholder'}</strong>
          {stakeholderType ? (
            <span className="ml-1.5 rounded bg-white/20 px-1.5 py-0.5 text-xs font-medium">
              {stakeholderType}
            </span>
          ) : null}
          {adminName ? (
            <span className="ml-2 text-xs opacity-80">
              (admin: {adminName})
            </span>
          ) : null}
        </span>
      </div>

      <button
        onClick={handleReturnToAdmin}
        className="flex items-center gap-1.5 rounded-md bg-white/20 px-3 py-1 text-sm font-medium transition-colors hover:bg-white/30"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Return to Admin
      </button>
    </div>
  )
}
