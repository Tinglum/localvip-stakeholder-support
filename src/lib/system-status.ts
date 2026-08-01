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
  /**
   * Platform switch for the featured-businesses carousel on my.localvip.com.
   * Defaults to true everywhere — a missing field or an unreachable backend
   * must read as "carousel on", never as "carousel hidden".
   */
  featuredCarouselEnabled: boolean
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
  setFeaturedCarouselEnabled: (next: boolean) => Promise<void>
}

const POLL_INTERVAL_MS = 45_000
const IDLE_STATUS: SystemStatus = {
  workInProgress: false,
  featuredCarouselEnabled: true,
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
      // Note the inverted test: only an explicit `false` hides the carousel.
      // An older backend that does not send the field reads as "on".
      featuredCarouselEnabled: record.featuredCarouselEnabled !== false,
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

  /**
   * Optimistically apply `patch`, PUT it, roll back on any failure.
   *
   * Each control sends only the field it owns. `featuredCarouselEnabled` is
   * omitted unless the carousel toggle is the thing being changed, and the
   * backend treats an absent field as "leave it alone" — so flipping the
   * maintenance pill can never reset the carousel switch, and vice versa.
   */
  const save = React.useCallback(async (patch: Partial<SystemStatus>) => {
    const previous = status
    const optimistic = { ...previous, ...patch }
    savingRef.current = true
    setSaving(true)
    setError(null)
    setStatus(optimistic)

    try {
      const res = await fetch('/api/system-status', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workInProgress: optimistic.workInProgress,
          message: previous.message,
          ...('featuredCarouselEnabled' in patch
            ? { featuredCarouselEnabled: optimistic.featuredCarouselEnabled }
            : {}),
        }),
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

  const setWorkInProgress = React.useCallback(
    (next: boolean) => save({ workInProgress: next }),
    [save],
  )

  const setFeaturedCarouselEnabled = React.useCallback(
    (next: boolean) => save({ featuredCarouselEnabled: next }),
    [save],
  )

  return {
    status,
    unavailable,
    loading,
    saving,
    error,
    setWorkInProgress,
    setFeaturedCarouselEnabled,
  }
}
