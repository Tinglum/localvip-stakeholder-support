'use client'

import * as React from 'react'
import { CheckCircle2, LayoutTemplate, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { Textarea } from '@/components/ui/textarea'
import { MATERIAL_LIBRARY_FOLDERS } from '@/lib/material-engine'
import {
  useAuth,
} from '@/lib/auth/context'
import {
  useMaterialTemplateInsert,
  useMaterialTemplates,
  useMaterialTemplateUpdate,
} from '@/lib/supabase/hooks'
import type { MaterialTemplateOutputFormat, StakeholderType } from '@/lib/types/database'

const STAKEHOLDER_OPTIONS: StakeholderType[] = ['business', 'school', 'cause', 'community', 'launch_partner', 'field', 'influencer']

function parseList(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function MaterialEngineTemplatesPage() {
  const { profile } = useAuth()
  const { data: templates, loading, refetch } = useMaterialTemplates()
  const { insert, loading: inserting } = useMaterialTemplateInsert()
  const { update, loading: updating } = useMaterialTemplateUpdate()
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState({
    name: '',
    sourcePath: '',
    outputFormat: 'svg' as MaterialTemplateOutputFormat,
    stakeholderTypes: 'business',
    audienceTags: 'customers',
    libraryFolder: 'share_with_customers',
    qrX: '760',
    qrY: '930',
    qrWidth: '220',
    qrHeight: '220',
    eyebrow: 'LocalVIP',
    headline: '{{stakeholder_name}}',
    subheadline: '{{capture_offer_headline}}',
    body: '{{capture_offer_description}}',
    cta: 'Scan to get started',
    footer: '{{support_label}}',
    qrCaption: 'Scan with your phone',
  })

  const saving = inserting || updating

  function startEditing(templateId: string) {
    const template = templates.find((item) => item.id === templateId)
    if (!template) return
    const metadata = (template.metadata as Record<string, unknown> | null) || {}
    const qr = (template.qr_position_json as Record<string, unknown>) || {}

    setEditingId(template.id)
    setForm({
      name: template.name,
      sourcePath: template.source_path || '',
      outputFormat: template.output_format,
      stakeholderTypes: template.stakeholder_types.join(', '),
      audienceTags: template.audience_tags.join(', '),
      libraryFolder: template.library_folder,
      qrX: `${qr.x || 760}`,
      qrY: `${qr.y || 930}`,
      qrWidth: `${qr.width || 220}`,
      qrHeight: `${qr.height || 220}`,
      eyebrow: `${metadata.eyebrow || 'LocalVIP'}`,
      headline: `${metadata.headline || '{{stakeholder_name}}'}`,
      subheadline: `${metadata.subheadline || '{{capture_offer_headline}}'}`,
      body: `${metadata.body || '{{capture_offer_description}}'}`,
      cta: `${metadata.cta || 'Scan to get started'}`,
      footer: `${metadata.footer || '{{support_label}}'}`,
      qrCaption: `${metadata.qrCaption || 'Scan with your phone'}`,
    })
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setFeedback(null)

    const payload = {
      name: form.name,
      source_path: form.sourcePath || null,
      template_type: 'structured_svg',
      output_format: form.outputFormat,
      audience_tags: parseList(form.audienceTags),
      stakeholder_types: parseList(form.stakeholderTypes) as StakeholderType[],
      library_folder: form.libraryFolder,
      qr_position_json: {
        x: Number(form.qrX),
        y: Number(form.qrY),
        width: Number(form.qrWidth),
        height: Number(form.qrHeight),
        canvas_width: 1080,
        canvas_height: 1440,
      },
      is_active: true,
      created_by: profile.id,
      metadata: {
        eyebrow: form.eyebrow,
        headline: form.headline,
        subheadline: form.subheadline,
        body: form.body,
        cta: form.cta,
        footer: form.footer,
        qrCaption: form.qrCaption,
        titlePattern: '{{stakeholder_name}} - {{template_name}}',
        descriptionPattern: '{{capture_offer_headline}}',
      },
    }

    const result = editingId
      ? await update(editingId, payload as any)
      : await insert(payload as any)

    if (!result) return

    setFeedback(editingId ? 'Template updated.' : 'Template created.')
    setEditingId(null)
    setForm({
      name: '',
      sourcePath: '',
      outputFormat: 'svg',
      stakeholderTypes: 'business',
      audienceTags: 'customers',
      libraryFolder: 'share_with_customers',
      qrX: '760',
      qrY: '930',
      qrWidth: '220',
      qrHeight: '220',
      eyebrow: 'LocalVIP',
      headline: '{{stakeholder_name}}',
      subheadline: '{{capture_offer_headline}}',
      body: '{{capture_offer_description}}',
      cta: 'Scan to get started',
      footer: '{{support_label}}',
      qrCaption: 'Scan with your phone',
    })
    refetch({ silent: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Material Templates"
        description="Manage the reusable templates that the engine personalizes with stakeholder-specific QR codes and copy."
      />

      {feedback && (
        <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {feedback}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr,1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Template' : 'New Template'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Template name</label>
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Source path or background asset URL</label>
                <Input value={form.sourcePath} onChange={(event) => setForm((current) => ({ ...current, sourcePath: event.target.value }))} placeholder="Optional background image URL" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Output format</label>
                  <select
                    value={form.outputFormat}
                    onChange={(event) => setForm((current) => ({ ...current, outputFormat: event.target.value as MaterialTemplateOutputFormat }))}
                    className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  >
                    <option value="svg">SVG</option>
                    <option value="png">PNG</option>
                    <option value="pdf">PDF (future renderer)</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Library folder</label>
                  <select
                    value={form.libraryFolder}
                    onChange={(event) => setForm((current) => ({ ...current, libraryFolder: event.target.value }))}
                    className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  >
                    {MATERIAL_LIBRARY_FOLDERS.map((folder) => (
                      <option key={folder.value} value={folder.value}>{folder.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Stakeholder types</label>
                  <Input value={form.stakeholderTypes} onChange={(event) => setForm((current) => ({ ...current, stakeholderTypes: event.target.value }))} placeholder="business, school" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Audience tags</label>
                  <Input value={form.audienceTags} onChange={(event) => setForm((current) => ({ ...current, audienceTags: event.target.value }))} placeholder="customers, parents" />
                </div>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">QR X</label>
                  <Input value={form.qrX} onChange={(event) => setForm((current) => ({ ...current, qrX: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">QR Y</label>
                  <Input value={form.qrY} onChange={(event) => setForm((current) => ({ ...current, qrY: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">QR Width</label>
                  <Input value={form.qrWidth} onChange={(event) => setForm((current) => ({ ...current, qrWidth: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">QR Height</label>
                  <Input value={form.qrHeight} onChange={(event) => setForm((current) => ({ ...current, qrHeight: event.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Eyebrow</label>
                  <Input value={form.eyebrow} onChange={(event) => setForm((current) => ({ ...current, eyebrow: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">CTA</label>
                  <Input value={form.cta} onChange={(event) => setForm((current) => ({ ...current, cta: event.target.value }))} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Headline</label>
                <Textarea value={form.headline} onChange={(event) => setForm((current) => ({ ...current, headline: event.target.value }))} rows={2} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Subheadline</label>
                <Textarea value={form.subheadline} onChange={(event) => setForm((current) => ({ ...current, subheadline: event.target.value }))} rows={2} />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Body</label>
                <Textarea value={form.body} onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} rows={4} />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Footer</label>
                  <Textarea value={form.footer} onChange={(event) => setForm((current) => ({ ...current, footer: event.target.value }))} rows={2} />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">QR caption</label>
                  <Textarea value={form.qrCaption} onChange={(event) => setForm((current) => ({ ...current, qrCaption: event.target.value }))} rows={2} />
                </div>
              </div>
              <div className="flex gap-3">
                <Button type="submit" disabled={saving}>
                  <Plus className="h-4 w-4" /> {editingId ? 'Save Template' : 'Create Template'}
                </Button>
                {editingId && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel Edit
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Template Library</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <p className="text-sm text-surface-500">Loading templates...</p>
            ) : templates.length === 0 ? (
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
                No templates yet.
              </div>
            ) : (
              templates.map((template) => (
                <div key={template.id} className="rounded-3xl border border-surface-200 bg-surface-0 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-surface-900">{template.name}</p>
                        <Badge variant={template.is_active ? 'success' : 'default'}>
                          {template.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="info">{template.output_format}</Badge>
                      </div>
                      <p className="mt-2 text-sm text-surface-500">
                        {template.stakeholder_types.join(', ') || 'all stakeholders'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => startEditing(template.id)}>
                      <LayoutTemplate className="h-4 w-4" /> Edit
                    </Button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {template.audience_tags.map((tag) => (
                      <Badge key={tag} variant="default">{tag}</Badge>
                    ))}
                  </div>
                  {template.output_format === 'pdf' && (
                    <div className="mt-3 rounded-2xl border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                      PDF output is reserved for the future server-side PDF renderer. SVG and PNG generate automatically today.
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="flex items-start gap-3 p-5">
          <CheckCircle2 className="mt-0.5 h-5 w-5 text-success-600" />
          <div className="text-sm text-surface-600">
            Structured SVG and PNG templates are live end-to-end today. PDF output is wired into the schema and admin UI,
            and will activate once a server-side PDF renderer dependency is added.
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
