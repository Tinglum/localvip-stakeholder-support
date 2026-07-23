'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
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

// Find the visible, open modal on top of the page so we can screenshot it
// directly (avoids html2canvas's position:fixed crop issues). Looks for Radix
// dialogs and generic role="dialog"/aria-modal nodes; returns the largest
// visible one (the topmost), or null when no modal is open.
function findTopmostOpenModal(): HTMLElement | null {
  const selectors = [
    '[data-radix-dialog-content][data-state="open"]',
    '[role="dialog"][data-state="open"]',
    '[role="alertdialog"][data-state="open"]',
    '[role="dialog"][aria-modal="true"]',
    '[role="dialog"]',
  ]
  const seen = new Set<HTMLElement>()
  let best: HTMLElement | null = null
  let bestArea = 0
  for (const sel of selectors) {
    document.querySelectorAll<HTMLElement>(sel).forEach((el) => {
      if (seen.has(el)) return
      seen.add(el)
      const rect = el.getBoundingClientRect()
      const style = getComputedStyle(el)
      const visible = rect.width > 40 && rect.height > 40 && style.visibility !== 'hidden' && style.display !== 'none'
      if (!visible) return
      const area = rect.width * rect.height
      if (area > bestArea) { bestArea = area; best = el }
    })
    if (best) break
  }
  return best
}

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
  const [reporterName, setReporterName] = React.useState('')

  React.useEffect(() => {
    installBugCapture()
  }, [])

  // Prefill the reporter's name from the session (still required + editable).
  React.useEffect(() => {
    fetch('/api/auth/session', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((sx) => { const n = sx?.profile?.full_name; if (n) setReporterName(n) })
      .catch(() => {})
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

  // Keyboard shortcut: Alt+B opens the reporter from anywhere.
  React.useEffect(() => {
    if (!enabled) return
    function onKey(e: KeyboardEvent) {
      if (e.altKey && (e.key === 'b' || e.key === 'B')) {
        e.preventDefault()
        if (!open && !capturing) void handleOpen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, open, capturing])

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
        // Try native screen-capture API first: pixel-perfect screenshot of what
        // the user sees. One-time permission dialog, then pixel-accurate capture.
        let captured = false
        try {
          // Ask Chrome for THIS tab, not "pick a surface".
          //
          // Plain getDisplayMedia({video:true}) produces the full three-tab picker
          // (Chrome tab / Window / Entire screen) — and, because Chrome defaults
          // selfBrowserSurface to "exclude", the one tab it leaves out is the very
          // tab being captured. So the reporter asked the user to hunt for the page
          // they were already on, and it wasn't in the list.
          //
          // preferCurrentTab + selfBrowserSurface:"include" collapse that into a
          // single "Share this tab?" confirm. The monitor/window surfaces are
          // excluded because a bug report wants the page, never the whole desktop
          // (which would also capture whatever else is on screen).
          const displayMediaOptions = {
            video: { displaySurface: 'browser' },
            audio: false,
            preferCurrentTab: true,
            selfBrowserSurface: 'include',
            monitorTypeSurfaces: 'exclude',
            surfaceSwitching: 'exclude',
          } as unknown as DisplayMediaStreamOptions
          const stream = await navigator.mediaDevices.getDisplayMedia(displayMediaOptions)
          const video = document.createElement('video')
          video.srcObject = stream
          video.play()
          await new Promise((r) => { video.onloadedmetadata = r })
          const canvas = document.createElement('canvas')
          canvas.width = video.videoWidth
          canvas.height = video.videoHeight
          const ctx = canvas.getContext('2d')
          if (ctx) ctx.drawImage(video, 0, 0)
          screenshotBase64 = canvas.toDataURL('image/jpeg', 0.72)
          stream.getTracks().forEach((t) => t.stop())
          captured = true
        } catch {
          // User denied permission or API not available — fall back to html2canvas.
        }

        // Fallback: reconstruct from DOM if native capture didn't work.
        if (!captured) {
          const html2canvas = (await import('html2canvas')).default
          const modalEl = findTopmostOpenModal()
          const canvas = modalEl
            ? await html2canvas(modalEl, { logging: false, useCORS: true, scale: 1.5, backgroundColor: '#ffffff', allowTaint: true })
            : await html2canvas(document.body, {
                logging: false,
                useCORS: true,
                scale: 1,
                x: window.scrollX,
                y: window.scrollY,
                width: window.innerWidth,
                height: window.innerHeight,
                windowWidth: window.innerWidth,
                windowHeight: window.innerHeight,
              })
          screenshotBase64 = canvas.toDataURL('image/jpeg', 0.72)
        }
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
    if (!reporterName.trim()) {
      setError('Please enter your name.')
      return
    }
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
          reporterName: reporterName.trim(),
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

  return createPortal(
    <>
      <button
        type="button"
        onClick={handleOpen}
        // Radix modals listen on document for pointer-down-outside and dismiss.
        // The button is portaled outside the modal, so a normal click would close
        // it before we screenshot. Stop the pointer event from reaching Radix's
        // document listener so the open modal stays put and gets captured.
        onPointerDownCapture={(e) => e.stopPropagation()}
        onMouseDownCapture={(e) => e.stopPropagation()}
        disabled={capturing}
        aria-label="Report a bug"
        title="Report a bug (Alt+B)"
        style={{ pointerEvents: 'auto' }}
        className="pointer-events-auto fixed bottom-5 right-5 z-[2147483640] flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg shadow-brand-600/30 ring-1 ring-white/20 transition-transform hover:scale-105 active:scale-95 disabled:opacity-70"
      >
        {capturing ? <Loader2 className="h-5 w-5 animate-spin" /> : <Bug className="h-5 w-5" />}
      </button>

      {open && (
        <div className="pointer-events-auto fixed inset-0 z-[2147483645] flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" style={{ pointerEvents: 'auto' }}>
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
                <label className="text-xs font-medium text-surface-600">Your name <span className="text-danger-500">*</span></label>
                <input value={reporterName} onChange={(e) => setReporterName(e.target.value)} placeholder="Who is reporting this?" className="h-9 w-full rounded-lg border border-surface-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
              </div>
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
    </>,
    document.body,
  )
}
