'use client'

/**
 * Live "work in progress" flag for the whole dashboard.
 *
 * Resolved once in the app shell and passed down, so the topbar indicator and
 * any future consumer share one poll instead of each fetching their own.
 * Readable by everyone; only admins can write (the route and QA both enforce it).
 */

import * as React from 'react'

export interface SystemStatus {
  workInProgress: boolean
  message: string | null
  updatedOn: string | null
  updatedBy: string | null
}

export interface SystemStatusState {
  status: SystemStatus
  /** Upstream is not reachable yet — render neutral, never red, never an error. */
  unavailable: boolean
  loading: boolean
  saving: boolean
  /** Set when a write was rejected and the optimistic state was rolled back. */
  error: string | null
  setWorkInProgress: (next: boolean) => Promise<void>
}

const POLL_INTERVAL_MS = 45_000
const IDLE_STATUS: SystemStatus = {
  workInProgress: false,
  message: null,
  updatedOn: null,
  updatedBy: null,
}

function parseStatus(payload: unknown): { status: SystemStatus; unavailable: boolean } {
  const record = (payload && typeof payload === 'object' ? payload : {}) as Record<string, unknown>
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null)

  return {
    unavailable: record.unavailable === true,
    status: {
      workInProgress: record.workInProgress === true,
      message: text(record.message),
      updatedOn: text(record.updatedOn),
      updatedBy: text(record.updatedBy),
    },
  }
}

export function useSystemStatus(): SystemStatusState {
  const [status, setStatus] = React.useState<SystemStatus>(IDLE_STATUS)
  const [unavailable, setUnavailable] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // A write in flight owns the displayed state; a poll landing mid-save would
  // otherwise flip the indicator back to the pre-toggle value.
  const savingRef = React.useRef(false)
  const mountedRef = React.useRef(true)
  React.useEffect(() => () => { mountedRef.current = false }, [])

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/system-status', { cache: 'no-store' })
      const payload = await res.json().catch(() => null)
      if (!mountedRef.current || savingRef.current) return

      const parsed = parseStatus(payload)
      // The route never returns a non-200, so a non-ok here means the proxy
      // itself is down: degrade quietly rather than inventing a state.
      setUnavailable(!res.ok || parsed.unavailable)
      setStatus(res.ok ? parsed.status : IDLE_STATUS)
    } catch {
      if (!mountedRef.current || savingRef.current) return
      setUnavailable(true)
      setStatus(IDLE_STATUS)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()

    const interval = window.setInterval(() => { void refresh() }, POLL_INTERVAL_MS)
    // A tester with the tab already open should see the flip without reloading.
    const onFocus = () => { void refresh() }
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh() }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [refresh])

  const setWorkInProgress = React.useCallback(async (next: boolean) => {
    const previous = status
    savingRef.current = true
    setSaving(true)
    setError(null)
    setStatus({ ...previous, workInProgress: next })

    try {
      const res = await fetch('/api/system-status', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ workInProgress: next, message: previous.message }),
      })
      const payload = await res.json().catch(() => null)

      if (!res.ok) {
        const reason = payload && typeof payload === 'object' && typeof (payload as { error?: unknown }).error === 'string'
          ? (payload as { error: string }).error
          : 'Status not saved.'
        if (mountedRef.current) {
          setStatus(previous)
          setError(reason)
        }
        return
      }

      // Trust the server's echo, not the optimistic guess.
      const parsed = parseStatus(payload)
      if (mountedRef.current) {
        setStatus(parsed.status)
        setUnavailable(parsed.unavailable)
      }
    } catch {
      if (mountedRef.current) {
        setStatus(previous)
        setError('Status not saved.')
      }
    } finally {
      savingRef.current = false
      if (mountedRef.current) setSaving(false)
    }
  }, [status])

  return { status, unavailable, loading, saving, error, setWorkInProgress }
}
