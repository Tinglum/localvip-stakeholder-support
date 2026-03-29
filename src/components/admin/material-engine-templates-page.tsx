'use client'

import * as React from 'react'
import Link from 'next/link'
import { Check, Eye, FolderOpen, Loader2, RefreshCw, Settings2, Upload, Zap } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { PageHeader } from '@/components/ui/page-header'
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import {
  getMaterialAutomationAudienceTags,
  getMaterialAutomationTemplateConfig,
  materialSupportsAutomationTemplate,
} from '@/lib/materials/automation-template'
import { getMaterialLibraryFolderMeta } from '@/lib/material-engine'
import { getQrPlacements } from '@/lib/materials/qr-placement'
import { useMaterials, useMaterialTemplates, useMaterialTemplateUpdate } from '@/lib/supabase/hooks'
import type { Material, MaterialTemplate, TemplateTier } from '@/lib/types/database'
import { cn } from '@/lib/utils'
import { MaterialEngineQuestionnaire, type Answers } from './material-engine-questionnaire'

const TIER_LABELS: Record<TemplateTier, { label: string; color: string }> = {
  auto: { label: 'Auto-generate', color: 'bg-success-100 text-success-700 border-success-200' },
  assignable: { label: 'Admin-assignable', color: 'bg-brand-100 text-brand-700 border-brand-200' },
  selfserve: { label: 'Self-serve', color: 'bg-hato-100 text-hato-700 border-hato-200' },
}

function TierBadge({ tier }: { tier: TemplateTier }) {
  const config = TIER_LABELS[tier]
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold', config.color)}>
      {config.label}
    </span>
  )
}

function TierToggle({
  tier,
  active,
  onToggle,
}: {
  tier: TemplateTier
  active: boolean
  onToggle: () => void
}) {
  const config = TIER_LABELS[tier]
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2 rounded-lg border-2 px-3 py-2 text-sm font-medium transition-all',
        active
          ? `${config.color} border-current`
          : 'border-surface-200 bg-surface-50 text-surface-400 hover:border-surface-300'
      )}
    >
      <div
        className={cn(
          'flex h-4 w-4 items-center justify-center rounded border transition-colors',
          active ? 'border-current bg-current' : 'border-surface-300'
        )}
      >
        {active && <Check className="h-3 w-3 text-white" />}
      </div>
      {config.label}
    </button>
  )
}

export function MaterialEngineTemplatesPage() {
  const { data: materials, loading: materialsLoading } = useMaterials()
  const { data: templates, loading: templatesLoading, refetch: refetchTemplates } = useMaterialTemplates()
  const updateTemplate = useMaterialTemplateUpdate()
  const [previewMaterial, setPreviewMaterial] = React.useState<Material | null>(null)
  const [showQuestionnaire, setShowQuestionnaire] = React.useState(false)
  const [editingTemplate, setEditingTemplate] = React.useState<MaterialTemplate | null>(null)
  const [editTiers, setEditTiers] = React.useState<TemplateTier[]>([])
  const [saving, setSaving] = React.useState(false)
  const [backfilling, setBackfilling] = React.useState(false)

  const loading = materialsLoading || templatesLoading

  const templateMaterials = React.useMemo(() => {
    return materials
      .filter((material) => {
        const config = getMaterialAutomationTemplateConfig(material)
        return config.enabled || material.is_template
      })
      .map((material) => ({
        material,
        config: getMaterialAutomationTemplateConfig(material),
        qrZoneCount: getQrPlacements(material.metadata as Record<string, unknown> | null).length,
        supportsAutomation: materialSupportsAutomationTemplate(material),
      }))
      .sort((left, right) => Number(right.config.enabled) - Number(left.config.enabled))
  }, [materials])

  const autoTemplates = templates.filter((t) => t.tiers?.includes('auto'))
  const selfserveTemplates = templates.filter((t) => t.tiers?.includes('selfserve'))
  const assignableTemplates = templates.filter((t) => t.tiers?.includes('assignable'))

  function handleQuestionnaireComplete(answers: Answers) {
    setShowQuestionnaire(false)
    console.log('Material engine configuration:', JSON.stringify(answers))
  }

  function openTierEditor(template: MaterialTemplate) {
    setEditingTemplate(template)
    setEditTiers(template.tiers || ['auto'])
  }

  async function saveTiers() {
    if (!editingTemplate || editTiers.length === 0) return
    setSaving(true)
    try {
      await updateTemplate.update(editingTemplate.id, { tiers: editTiers })
      await refetchTemplates()
      setEditingTemplate(null)
    } catch (error) {
      console.error('Failed to update tiers:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleBackfill() {
    setBackfilling(true)
    try {
      const res = await fetch('/api/admin/material-engine/backfill', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Backfill failed.')
        return
      }
      toast.success(data.message || 'Backfill complete.')
    } catch {
      toast.error('Something went wrong during backfill.')
    } finally {
      setBackfilling(false)
    }
  }

  const meta = (t: MaterialTemplate) => (t.metadata || {}) as Record<string, string>

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template Engine"
        description="Manage auto-generation, admin-assignable, and self-serve templates. Control which materials are created automatically when businesses and causes are onboarded."
        actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowQuestionnaire(true)}>
              <Settings2 className="h-4 w-4" /> Configure
            </Button>
            <Button variant="outline" onClick={handleBackfill} disabled={backfilling}>
              {backfilling ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {backfilling ? 'Backfilling...' : 'Backfill All'}
            </Button>
            <Link href="/materials/library">
              <Button>
                <Upload className="h-4 w-4" /> Materials Library
              </Button>
            </Link>
          </div>
        }
      />

      <MaterialEngineQuestionnaire
        open={showQuestionnaire}
        onOpenChange={setShowQuestionnaire}
        onComplete={handleQuestionnaireComplete}
      />

      <MaterialPreviewDialog
        material={previewMaterial}
        open={!!previewMaterial}
        onOpenChange={(open) => {
          if (!open) setPreviewMaterial(null)
        }}
      />

      {/* Tier editor dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => { if (!open) setEditingTemplate(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Template Tiers</DialogTitle>
            <DialogDescription>
              {editingTemplate?.name} &mdash; choose how this template is distributed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            {(['auto', 'assignable', 'selfserve'] as TemplateTier[]).map((tier) => (
              <TierToggle
                key={tier}
                tier={tier}
                active={editTiers.includes(tier)}
                onToggle={() =>
                  setEditTiers((prev) =>
                    prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
                  )
                }
              />
            ))}
          </div>
          <div className="space-y-1 text-xs text-surface-500">
            <p><strong>Auto-generate:</strong> Created automatically when a business or cause is onboarded.</p>
            <p><strong>Admin-assignable:</strong> Admin can push this template to specific businesses.</p>
            <p><strong>Self-serve:</strong> Business owners can browse and activate from their template library.</p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingTemplate(null)}>Cancel</Button>
            <Button onClick={saveTiers} disabled={saving || editTiers.length === 0}>
              {saving ? 'Saving...' : 'Save Tiers'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stats */}
      <div className="grid gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Total templates</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{templates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-success-600">Auto-generate</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{autoTemplates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-brand-600">Admin-assignable</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{assignableTemplates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-hato-600">Self-serve</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{selfserveTemplates.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Templates list */}
      <Card>
        <CardHeader>
          <CardTitle>All Templates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-surface-500">Loading templates...</p>
          ) : templates.length === 0 ? (
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
              No templates configured yet. Templates are created from the Materials Library or by the material engine.
            </div>
          ) : (
            templates.map((template) => (
              <div key={template.id} className="rounded-xl border border-surface-200 bg-surface-0 p-4">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="space-y-2 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-surface-900">{template.name}</p>
                      <Badge variant={template.is_active ? 'success' : 'warning'}>
                        {template.is_active ? 'active' : 'inactive'}
                      </Badge>
                      <Badge variant="info">v{template.version || 1}</Badge>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {(template.tiers || ['auto']).map((tier) => (
                        <TierBadge key={tier} tier={tier as TemplateTier} />
                      ))}
                    </div>
                    <p className="text-sm text-surface-500">
                      {meta(template).headline || meta(template).eyebrow || 'No headline set'}
                      {' · '}
                      {getMaterialLibraryFolderMeta(template.library_folder).label}
                    </p>
                    <div className="flex flex-wrap gap-2 text-xs text-surface-400">
                      <span>Types: {template.stakeholder_types.join(', ') || 'all'}</span>
                      <span>·</span>
                      <span>Format: {template.output_format}</span>
                      <span>·</span>
                      <span>Scope: {template.scope_global ? 'global' : 'filtered'}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => openTierEditor(template)}>
                      <Zap className="h-3.5 w-3.5" /> Tiers
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Material source templates (legacy view) */}
      {templateMaterials.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Material-Based Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {templateMaterials.map(({ material, config, qrZoneCount, supportsAutomation }) => (
              <div key={material.id} className="rounded-xl border border-surface-200 bg-surface-0 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-20 w-16 overflow-hidden rounded-lg border border-surface-200 bg-surface-50">
                      <MaterialPreviewFrame
                        src={material.file_url || material.thumbnail_url}
                        mimeType={material.mime_type}
                        title={material.title}
                        showPdfBadge
                        className="h-full w-full"
                      />
                    </div>
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-surface-900">{material.title}</p>
                        <Badge variant={config.enabled && supportsAutomation ? 'success' : 'warning'}>
                          {config.enabled && supportsAutomation ? 'active' : 'needs setup'}
                        </Badge>
                      </div>
                      <p className="text-xs text-surface-500">
                        {config.stakeholderTypes.join(', ') || 'no types'} · {qrZoneCount} QR zone{qrZoneCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => setPreviewMaterial(material)}>
                      <Eye className="h-3.5 w-3.5" /> Preview
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
