'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Loader2, Plus, QrCode, RefreshCw, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface PortalTemplate {
  id: number | string
  name: string
  sourcePath: string | null
  outputFormat?: string | null | undefined
}

interface PortalQr {
  id: number | string
  name: string
  targetUrl: string | null
  code: string | null
  qrImageUrl: string | null
}

// The "default" choice = let the backend stamp the business's default join QR.
type QrChoice = 'default' | 'new' | string

// Business-portal template browser: pick a template, preview the design, choose
// which QR to embed (a saved business QR, the default join QR, or a brand-new
// one), then generate — the finished material lands in the business's library.
export function TemplateLibraryPage() {
  const [templates, setTemplates] = React.useState<PortalTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [doneIds, setDoneIds] = React.useState<Set<string>>(new Set())
  const [error, setError] = React.useState<string | null>(null)
  const [active, setActive] = React.useState<PortalTemplate | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/portal/templates', { cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not load templates.')
      setTemplates(json.templates || [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load templates.')
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => { void load() }, [load])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template Library"
        description="Pick a template, preview it, and choose which QR code to add — then generate. The finished material lands in your library."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
            </Button>
            <Link href="/materials/mine"><Button variant="outline">My Materials <ArrowRight className="h-4 w-4" /></Button></Link>
          </div>
        }
      />

      {error && <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>}

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><div className="h-44 bg-surface-100" /><CardContent className="space-y-2 p-4"><div className="h-4 w-2/3 rounded bg-surface-100" /><div className="h-8 w-full rounded bg-surface-50" /></CardContent></Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-8 w-8" />}
          title="No templates available yet"
          description="Your team hasn't published any templates yet. Once they do, you'll be able to generate them here with your QR code."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => {
            const done = doneIds.has(String(t.id))
            return (
              <Card key={t.id} className="group overflow-hidden transition-shadow hover:shadow-card-hover">
                <button
                  type="button"
                  onClick={() => setActive(t)}
                  className="relative block h-44 w-full border-b border-surface-100 bg-surface-50 text-left"
                  title="Preview and generate"
                >
                  {t.sourcePath ? (
                    <MaterialPreviewFrame
                      src={t.sourcePath}
                      mimeType={t.outputFormat}
                      title={t.name}
                      className="h-full w-full"
                      fit="contain"
                    />
                  ) : null}
                </button>
                <CardContent className="space-y-3 p-4">
                  <h3 className="truncate text-sm font-semibold text-surface-900">{t.name}</h3>
                  {done ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-success-700"><CheckCircle2 className="h-4 w-4" /> Added to your library</span>
                      <Link href="/materials/mine" className="text-xs font-medium text-brand-600 hover:underline">View</Link>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={() => setActive(t)}>
                      <Sparkles className="h-4 w-4" /> Preview &amp; generate
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <TemplateGenerateDialog
        template={active}
        onClose={() => setActive(null)}
        onGenerated={(id) => {
          setDoneIds((prev) => new Set(prev).add(String(id)))
          setActive(null)
        }}
      />
    </div>
  )
}

function TemplateGenerateDialog({
  template,
  onClose,
  onGenerated,
}: {
  template: PortalTemplate | null
  onClose: () => void
  onGenerated: (templateId: number | string) => void
}) {
  const open = !!template
  const [qrCodes, setQrCodes] = React.useState<PortalQr[]>([])
  const [qrLoading, setQrLoading] = React.useState(false)
  const [qrError, setQrError] = React.useState<string | null>(null)
  const [choice, setChoice] = React.useState<QrChoice>('default')
  const [newName, setNewName] = React.useState('')
  const [newUrl, setNewUrl] = React.useState('')
  const [generating, setGenerating] = React.useState(false)
  const [genError, setGenError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setChoice('default')
    setNewName('')
    setNewUrl('')
    setGenError(null)
    setQrError(null)
    setQrLoading(true)
    fetch('/api/portal/qrcodes', { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}))
        if (!r.ok) throw new Error(j.error || 'Could not load your QR codes.')
        setQrCodes(j.qrCodes || [])
      })
      .catch((e) => setQrError(e instanceof Error ? e.message : 'Could not load your QR codes.'))
      .finally(() => setQrLoading(false))
  }, [open])

  async function handleGenerate() {
    if (!template) return
    setGenerating(true)
    setGenError(null)
    try {
      const payload: Record<string, unknown> = { templateId: String(template.id) }

      if (choice === 'new') {
        if (!newUrl.trim()) throw new Error('Enter a destination URL for the new QR code.')
        const cRes = await fetch('/api/portal/qrcodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName.trim(), targetUrl: newUrl.trim() }),
        })
        const cJson = await cRes.json().catch(() => ({}))
        if (!cRes.ok || cJson.error) throw new Error(cJson.error || 'Could not create the QR code.')
        if (cJson.qrCode?.id != null) payload.qrCodeId = cJson.qrCode.id
        else if (cJson.qrCode?.targetUrl) payload.qrContent = cJson.qrCode.targetUrl
      } else if (choice !== 'default') {
        payload.qrCodeId = choice
      }

      const res = await fetch('/api/portal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Could not generate this material.')
      onGenerated(template.id)
    } catch (e) {
      setGenError(e instanceof Error ? e.message : 'Could not generate this material.')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-brand-500" />
            {template?.name || 'Generate material'}
          </DialogTitle>
          <DialogDescription>
            Preview the design, choose which QR code to add, then generate. The finished material is saved to your library.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr),320px]">
          {/* PDF / image preview */}
          <div className="h-[60vh] overflow-hidden rounded-2xl border border-surface-200 bg-white">
            {template?.sourcePath ? (
              <MaterialPreviewFrame
                src={template.sourcePath}
                mimeType={template.outputFormat}
                title={template?.name || 'Template preview'}
                className="h-full w-full"
                fit="contain"
                interactive
                pdfClassName="h-full w-full"
              />
            ) : null}
          </div>

          {/* QR selector */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-surface-900">
              <QrCode className="h-4 w-4 text-brand-500" /> QR code to add
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              <QrOption
                active={choice === 'default'}
                onClick={() => setChoice('default')}
                title="My default join QR"
                subtitle="Your business's standard join QR code"
              />

              {qrLoading && (
                <div className="flex items-center gap-2 px-1 py-2 text-sm text-surface-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your QR codes…
                </div>
              )}
              {qrError && <p className="px-1 text-xs text-danger-600">{qrError}</p>}

              {qrCodes.map((q) => (
                <QrOption
                  key={q.id}
                  active={choice === String(q.id)}
                  onClick={() => setChoice(String(q.id))}
                  title={q.name}
                  subtitle={q.targetUrl || q.code || ''}
                />
              ))}

              <QrOption
                active={choice === 'new'}
                onClick={() => setChoice('new')}
                title="Create a new QR code"
                subtitle="Point a fresh QR at any destination"
                icon={<Plus className="h-4 w-4" />}
              />

              {choice === 'new' && (
                <div className="space-y-2 rounded-xl border border-brand-200 bg-brand-50/50 p-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-surface-600">Name (optional)</label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="e.g. Summer flyer QR"
                      className="h-9 w-full rounded-lg border border-surface-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-surface-600">Destination URL <span className="text-danger-500">*</span></label>
                    <input
                      value={newUrl}
                      onChange={(e) => setNewUrl(e.target.value)}
                      placeholder="https://…"
                      className="h-9 w-full rounded-lg border border-surface-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {genError && <p className="text-sm text-danger-600">{genError}</p>}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={generating}>Cancel</Button>
          <Button onClick={() => void handleGenerate()} disabled={generating}>
            {generating ? <><Loader2 className="h-4 w-4 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4" /> Generate with this QR</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function QrOption({
  active,
  onClick,
  title,
  subtitle,
  icon,
}: {
  active: boolean
  onClick: () => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-start gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors',
        active ? 'border-brand-500 bg-brand-50' : 'border-surface-200 bg-white hover:border-brand-300',
      )}
    >
      <span className={cn('mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border', active ? 'border-brand-500 bg-brand-500 text-white' : 'border-surface-300 text-surface-400')}>
        {icon || (active ? <CheckCircle2 className="h-4 w-4" /> : null)}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-surface-900">{title}</span>
        {subtitle ? <span className="block truncate text-xs text-surface-500">{subtitle}</span> : null}
      </span>
    </button>
  )
}
