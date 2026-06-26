'use client'

import * as React from 'react'
import { Loader2, Upload, Plus, RefreshCw, QrCode, Trash2, Sparkles, ExternalLink } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toProxiedMaterialUrl } from '@/lib/materials/proxy-url'

interface QaTemplate {
  id: number | string
  name: string
  sourcePath?: string | null
  outputFormat?: string | null
  qrPositionJson?: string | null
  isActive?: boolean
}

// Self-contained, QA-only template studio: upload a design, place the QR, create
// the template on the QA backend, then each business gets a customized material
// (their QR + the design) when they generate. No Supabase, no stakeholders.
export function QaTemplateStudio() {
  const [templates, setTemplates] = React.useState<QaTemplate[]>([])
  const [loading, setLoading] = React.useState(true)
  const [msg, setMsg] = React.useState<string | null>(null)
  const [err, setErr] = React.useState<string | null>(null)

  // Create form
  const [name, setName] = React.useState('')
  const [outputFormat, setOutputFormat] = React.useState<'pdf' | 'png'>('pdf')
  const [file, setFile] = React.useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const [qx, setQx] = React.useState(0.6)
  const [qy, setQy] = React.useState(0.62)
  const [qs, setQs] = React.useState(0.28)
  const [creating, setCreating] = React.useState(false)
  const [testingId, setTestingId] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/qa/dashboard/material_templates?is_active=true', { cache: 'no-store' })
      const json = res.ok ? await res.json() : []
      const items = Array.isArray(json) ? json : (json.items || [])
      setTemplates(items.filter((t: QaTemplate) => t.isActive !== false))
    } finally {
      setLoading(false)
    }
  }, [])
  React.useEffect(() => { void load() }, [load])

  function pickFile(f?: File) {
    if (!f) return
    setFile(f)
    if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(URL.createObjectURL(f))
    if (!name) setName(f.name.replace(/\.[^/.]+$/, ''))
  }

  async function create() {
    setErr(null); setMsg(null)
    if (!name.trim()) { setErr('Give the template a name.'); return }
    if (!file) { setErr('Upload a design to use as the template.'); return }
    setCreating(true)
    try {
      // 1) upload the design to QA → /uploads/materials/...
      const fd = new FormData()
      fd.append('file', file)
      const up = await fetch('/api/qa/material-asset/upload?folder=templates', { method: 'POST', body: fd })
      const upJson = await up.json().catch(() => ({}))
      if (!up.ok || !upJson.fileUrl) throw new Error(upJson.error || 'Design upload failed.')
      // 2) create the template referencing the uploaded design + the QR position
      const res = await fetch('/api/qa/dashboard/material_templates', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          sourcePath: upJson.fileUrl,
          templateType: 'flyer',
          outputFormat,
          is_active: true,
          qrPositionJson: JSON.stringify({ x: qx, y: qy, size: qs }),
        }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        throw new Error(b.error || `Template create failed (${res.status}).`)
      }
      setMsg(`Template "${name.trim()}" created. Businesses can now generate it.`)
      setName(''); setFile(null)
      if (previewUrl?.startsWith('blob:')) URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not create the template.')
    } finally {
      setCreating(false)
    }
  }

  async function deactivate(id: string | number) {
    if (!confirm('Remove this template?')) return
    await fetch(`/api/qa/dashboard/material_templates/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: false }),
    })
    setTemplates((p) => p.filter((t) => String(t.id) !== String(id)))
  }

  // Test-generate against Barre Pizza (business 1) so you can confirm the stamping.
  async function testGenerate(id: string | number) {
    setTestingId(String(id)); setErr(null); setMsg(null)
    try {
      const res = await fetch('/api/qa/dashboard/generated_materials', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessAccountId: 1, templateId: Number(id) }),
      })
      const json: { generatedFileUrl?: string; error?: string } = res.ok ? await res.json() : { error: `Generate failed (${res.status}).` }
      if (json?.generatedFileUrl) {
        window.open(toProxiedMaterialUrl(json.generatedFileUrl), '_blank')
        setMsg('Generated a sample for Barre Pizza (opened in a new tab).')
      } else {
        setErr(json?.error || 'Generation did not return a file.')
      }
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template Studio"
        description="Upload a design, place the QR, and create a template. Each business generates a customized copy (their QR on your design) into their library."
        actions={<Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh</Button>}
      />

      {msg && <div className="rounded-xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">{msg}</div>}
      {err && <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{err}</div>}

      {/* Create */}
      <Card>
        <CardContent className="grid gap-6 p-5 lg:grid-cols-[1fr,360px]">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-surface-900"><Plus className="h-4 w-4 text-brand-600" /> New template</div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-surface-600">Design file (PNG / JPG)</label>
              <input type="file" accept="image/*" onChange={(e) => pickFile(e.target.files?.[0])}
                className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-brand-700 hover:file:bg-brand-100 file:cursor-pointer" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Name</label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Counter flyer" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-surface-600">Output</label>
                <select value={outputFormat} onChange={(e) => setOutputFormat(e.target.value as 'pdf' | 'png')} className="h-9 w-full rounded-lg border border-surface-300 bg-white px-2 text-sm">
                  <option value="pdf">PDF</option>
                  <option value="png">PNG</option>
                </select>
              </div>
            </div>
            <div className="space-y-2 rounded-xl border border-surface-200 bg-surface-50 p-3">
              <div className="flex items-center gap-2 text-xs font-medium text-surface-600"><QrCode className="h-3.5 w-3.5" /> QR placement (drag the sliders, watch the preview)</div>
              <Slider label="Left" value={qx} onChange={setQx} />
              <Slider label="Top" value={qy} onChange={setQy} />
              <Slider label="Size" value={qs} onChange={setQs} min={0.08} max={0.6} />
            </div>
            <Button onClick={create} disabled={creating}>
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Create template
            </Button>
          </div>

          {/* Live preview with QR box overlay */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-surface-500">Preview</p>
            <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-surface-200 bg-surface-100">
              {previewUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="Design" className="h-full w-full object-contain" />
                  <div className="absolute border-2 border-brand-500 bg-white/70" style={{ left: `${qx * 100}%`, top: `${qy * 100}%`, width: `${qs * 100}%`, aspectRatio: '1 / 1' }}>
                    <QrCode className="h-full w-full p-1 text-surface-700" />
                  </div>
                </>
              ) : (
                <div className="flex h-full w-full items-center justify-center text-surface-400"><span className="text-xs">Upload a design to preview</span></div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <div>
        <p className="mb-2 text-sm font-semibold text-surface-900">Active templates ({templates.length})</p>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-surface-400" /></div>
        ) : templates.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-surface-400">No templates yet — upload a design above to create your first.</CardContent></Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => (
              <Card key={t.id} className="overflow-hidden">
                <div className="relative h-40 border-b border-surface-100 bg-surface-50">
                  {t.sourcePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={toProxiedMaterialUrl(t.sourcePath)} alt={t.name} className="h-full w-full object-contain" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-surface-400">No design source</div>
                  )}
                </div>
                <CardContent className="space-y-2 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-surface-900">{t.name}</span>
                    <Badge variant={t.sourcePath ? 'success' : 'warning'}>{t.sourcePath ? 'Ready' : 'No design'}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => void testGenerate(t.id)} disabled={testingId === String(t.id) || !t.sourcePath}>
                      {testingId === String(t.id) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Test
                    </Button>
                    <Button variant="ghost" size="sm" className="text-danger-600" onClick={() => void deactivate(t.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Slider({ label, value, onChange, min = 0, max = 1 }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-surface-500">{label}</span>
      <input type="range" min={min} max={max} step={0.01} value={value} onChange={(e) => onChange(Number(e.target.value))} className="flex-1" />
      <span className="w-10 text-right tabular-nums text-surface-500">{Math.round(value * 100)}%</span>
    </div>
  )
}
