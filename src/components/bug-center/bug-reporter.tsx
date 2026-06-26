'use client'

import * as React from 'react'
import { Bug, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  installBugCapture,
  snapshotConsoleErrors,
  snapshotNetworkErrors,
} from '@/lib/bug-center/capture'
import type { BugPriority, BugCategory, BugReportSettings } from '@/lib/bug-center/types'

interface CapturedContext {
  screenshotBase64: string
  pageUrl: string
  userAgent: string
  viewport: string
  consoleErrors: string
  networkErrors: string
}

const PRIORITIES: Array<{ value: BugPriority; label: string; cls: string }> = [
  { value: 'nice', label: 'Nice to have', cls: 'data-[on=true]:bg-surface-700 data-[on=true]:text-white' },
  { value: 'need', label: 'Need to have', cls: 'data-[on=true]:bg-brand-600 data-[on=true]:text-white' },
  { value: 'urgent', label: 'URGENT', cls: 'data-[on=true]:bg-danger-600 data-[on=true]:text-white' },
]
const CATEGORIES: Array<{ value: BugCategory; label: string }> = [
  { value: 'ui_ux', label: 'UI / UX' },
  { value: 'code', label: 'Code' },
  { value: 'functionality', label: 'Functionality' },
]

// App-wide "report a bug" widget. Renders a floating button when the Bug Center
// is enabled for the dashboard; clicking it screenshots the page (html2canvas) +
// captures recent console/network errors, then opens a quick report form.
export function BugReporter() {
  const [enabled, setEnabled] = React.useState(false)
  const [open, setOpen] = React.useState(false)
  const [capturing, setCapturing] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [done, setDone] = React.useState(false)

  const [context, setContext] = React.useState<CapturedContext | null>(null)
  const [whatWrong, setWhatWrong] = React.useState('')
  const [expected, setExpected] = React.useState('')
  const [priority, setPriority] = React.useState<BugPriority>('need')
  const [category, setCategory] = React.useState<BugCategory>('functionality')

  React.useEffect(() => {
    installBugCapture()
  }, [])

  // Read the master toggle (cookie-authenticated, same-origin). Fail closed.
  React.useEffect(() => {
    let cancelled = false
    fetch('/api/qa/bug-report/settings', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((settings: BugReportSettings | null) => {
        if (!cancelled) setEnabled(Boolean(settings?.enabledDashboard))
      })
      .catch(() => {
        if (!cancelled) setEnabled(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function reset() {
    setWhatWrong('')
    setExpected('')
    setPriority('need')
    setCategory('functionality')
    setContext(null)
    setError(null)
    setDone(false)
  }

  async function handleOpen() {
    setCapturing(true)
    try {
      const pageUrl = window.location.href
      const userAgent = navigator.userAgent
      const viewport = `${window.innerWidth}x${window.innerHeight}`
      const consoleErrors = JSON.stringify(snapshotConsoleErrors())
      const networkErrors = JSON.stringify(snapshotNetworkErrors())

      let screenshotBase64 = ''
      try {
        const html2canvas = (await import('html2canvas')).default
        const canvas = await html2canvas(document.body, {
          logging: false,
          useCORS: true,
          scale: Math.min(window.devicePixelRatio || 1, 2),
        })
        screenshotBase64 = canvas.toDataURL('image/png')
      } catch {
        screenshotBase64 = ''
      }

      setContext({ screenshotBase64, pageUrl, userAgent, viewport, consoleErrors, networkErrors })
      setOpen(true)
    } finally {
      setCapturing(false)
    }
  }

  async function handleSubmit() {
    if (!context) return
    if (!whatWrong.trim()) {
      setError('Please describe what went wrong.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/qa/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          app: 'dashboard',
          whatWrong: whatWrong.trim(),
          expectedBehavior: expected.trim(),
          priority,
          category,
          pageUrl: context.pageUrl,
          userAgent: context.userAgent,
          viewport: context.viewport,
          consoleErrors: context.consoleErrors,
          networkErrors: context.networkErrors,
          screenshotBase64: context.screenshotBase64,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || `Could not send report (${res.status}).`)
      }
      setDone(true)
      window.setTimeout(() => {
        setOpen(false)
        reset()
      }, 1100)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send bug report.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!enabled) return null

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        disabled={capturing}
        aria-label="Report a bug"
        title="Report a bug"
        className="fixed bottom-5 right-5 z-[70] flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 ring-1 ring-white/20 transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
      >
        {capturing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bug className="h-5 w-5" />}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-surface-100 px-5 py-4">
              <h2 className="flex items-center gap-2 text-base font-semibold text-surface-900">
                <Bug className="h-5 w-5 text-brand-600" /> Report a bug
              </h2>
              <button onClick={() => { setOpen(false); reset() }} className="text-surface-400 hover:text-surface-600">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] space-y-4 overflow-y-auto p-5">
              <p className="text-xs text-surface-500">A screenshot + recent console/network errors were captured automatically.</p>
              {context?.screenshotBase64 ? (
                <div className="overflow-hidden rounded-xl border border-surface-200 bg-surface-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={context.screenshotBase64} alt="Screenshot preview" className="max-h-48 w-full object-contain" />
                </div>
              ) : (
                <p className="text-xs text-surface-400">Screenshot unavailable — your report will still be sent.</p>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">What was wrong?</label>
                <Textarea value={whatWrong} onChange={(e) => setWhatWrong(e.target.value)} rows={3} placeholder="Describe the problem you ran into" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">What should have happened?</label>
                <Textarea value={expected} onChange={(e) => setExpected(e.target.value)} rows={2} placeholder="Describe the expected behavior" />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-surface-600">Priority</label>
                  <div className="flex gap-1.5">
                    {PRIORITIES.map((p) => (
                      <button
                        key={p.value}
                        type="button"
                        data-on={priority === p.value}
                        onClick={() => setPriority(p.value)}
                        className={cn('flex-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs font-medium text-surface-600 transition-colors', p.cls)}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-surface-600">Category</label>
                  <div className="flex gap-1.5">
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        data-on={category === c.value}
                        onClick={() => setCategory(c.value)}
                        className="flex-1 rounded-lg border border-surface-200 px-2 py-1.5 text-xs font-medium text-surface-600 transition-colors data-[on=true]:bg-brand-600 data-[on=true]:text-white"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {error && <p className="text-sm text-danger-600">{error}</p>}
              {done && <p className="text-sm font-medium text-success-700">Bug report sent. Thank you!</p>}
            </div>

            <div className="flex justify-end gap-2 border-t border-surface-100 px-5 py-4">
              <Button variant="outline" onClick={() => { setOpen(false); reset() }} disabled={submitting}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={submitting || done}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit report
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
