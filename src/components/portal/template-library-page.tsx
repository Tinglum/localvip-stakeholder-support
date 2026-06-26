'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'

interface PortalTemplate {
  id: number | string
  name: string
  sourcePath: string | null
  outputFormat?: string | null
}

// Business-portal template browser: shows each available template (with its
// design), and one click generates a customized copy — the business's QR stamped
// on the design — straight into their materials library. No pre-creation.
export function TemplateLibraryPage() {
  const [templates, setTemplates] = React.useState<PortalTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busyId, setBusyId] = React.useState<string | null>(null)
  const [doneIds, setDoneIds] = React.useState<Set<string>>(new Set())
  const [error, setError] = React.useState<string | null>(null)

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

  async function generate(t: PortalTemplate) {
    setBusyId(String(t.id))
    setError(null)
    try {
      const res = await fetch('/api/portal/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: String(t.id) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Could not generate this material.')
      setDoneIds((prev) => new Set(prev).add(String(t.id)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate this material.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template Library"
        description="Pick a template and generate it — your business QR code is added to the design and the finished material lands in your library."
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
                <div className="relative h-44 border-b border-surface-100 bg-surface-50">
                  {t.sourcePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={toProxiedMaterialUrl(t.sourcePath)} alt={t.name} className="h-full w-full object-contain" />
                  ) : null}
                </div>
                <CardContent className="space-y-3 p-4">
                  <h3 className="truncate text-sm font-semibold text-surface-900">{t.name}</h3>
                  {done ? (
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-medium text-success-700"><CheckCircle2 className="h-4 w-4" /> Added to your library</span>
                      <Link href="/materials/mine" className="text-xs font-medium text-brand-600 hover:underline">View</Link>
                    </div>
                  ) : (
                    <Button className="w-full" onClick={() => void generate(t)} disabled={busyId === String(t.id)}>
                      {busyId === String(t.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Generate with my QR
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
