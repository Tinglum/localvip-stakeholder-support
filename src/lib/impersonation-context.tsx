'use client'

import * as React from 'react'

const IMPERSONATION_KEY = 'localvip_impersonation'
const IMPERSONATION_PENDING_KEY = 'localvip_impersonation_pending'

interface ImpersonationState {
  active: boolean
  adminName: string | null
  adminEmail: string | null
  stakeholderName: string | null
  stakeholderType: string | null
  returnUrl: string | null
}

interface ImpersonationContextValue extends ImpersonationState {
  startImpersonation: (meta: Omit<ImpersonationState, 'active'>) => void
  endImpersonation: () => void
}

const defaultState: ImpersonationState = {
  active: false,
  adminName: null,
  adminEmail: null,
  stakeholderName: null,
  stakeholderType: null,
  returnUrl: null,
}

const ImpersonationContext = React.createContext<ImpersonationContextValue>({
  ...defaultState,
  startImpersonation: () => {},
  endImpersonation: () => {},
})

export function ImpersonationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<ImpersonationState>(() => {
    if (typeof window === 'undefined') return defaultState
    try {
      // Check sessionStorage first (for same-tab persistence)
      const stored = sessionStorage.getItem(IMPERSONATION_KEY)
      if (stored) return JSON.parse(stored)
      // Check localStorage for cross-tab handoff from admin
      const pending = localStorage.getItem(IMPERSONATION_PENDING_KEY)
      if (pending) {
        const parsed = JSON.parse(pending) as ImpersonationState
        // Move to sessionStorage and remove from localStorage
        sessionStorage.setItem(IMPERSONATION_KEY, pending)
        localStorage.removeItem(IMPERSONATION_PENDING_KEY)
        return parsed
      }
    } catch {}
    return defaultState
  })

  const startImpersonation = React.useCallback((meta: Omit<ImpersonationState, 'active'>) => {
    const next: ImpersonationState = { ...meta, active: true }
    // Write to localStorage so the newly opened tab picks it up
    try { localStorage.setItem(IMPERSONATION_PENDING_KEY, JSON.stringify(next)) } catch {}
  }, [])

  const endImpersonation = React.useCallback(() => {
    setState(defaultState)
    try {
      sessionStorage.removeItem(IMPERSONATION_KEY)
      localStorage.removeItem(IMPERSONATION_PENDING_KEY)
    } catch {}
  }, [])

  const value = React.useMemo<ImpersonationContextValue>(
    () => ({ ...state, startImpersonation, endImpersonation }),
    [state, startImpersonation, endImpersonation],
  )

  return (
    <ImpersonationContext.Provider value={value}>
      {children}
    </ImpersonationContext.Provider>
  )
}

export function useImpersonation() {
  return React.useContext(ImpersonationContext)
}
