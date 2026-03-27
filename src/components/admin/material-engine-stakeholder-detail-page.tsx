'use client'

import * as React from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Download, Eye, QrCode, RefreshCw, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog'
import { PageHeader } from '@/components/ui/page-header'
import {
  useAdminTasks,
  useGeneratedMaterials,
  useMaterials,
  useMaterialTemplates,
  useRecord,
  useStakeholderCodes,
} from '@/lib/supabase/hooks'
import { getMaterialLibraryFolderMeta } from '@/lib/material-engine'
import type { Material, Stakeholder } from '@/lib/types/database'
import { formatDate } from '@/lib/utils'

function badgeForStatus(status: string) {
  if (status === 'generated') return 'success'
  if (status === 'ready_to_generate') return 'info'
  if (status === 'failed') return 'danger'
  return 'warning'
}

export function MaterialEngineStakeholderDetailPage({ stakeholderId }: { stakeholderId: string }) {
  const { data: stakeholder, loading: stakeholderLoading } = useRecord<Stakeholder>('stakeholders', stakeholderId)
  const { data: codeRows, refetch: refetchCodes } = useStakeholderCodes({ stakeholder_id: stakeholderId })
  const { data: taskRows, refetch: refetchTasks } = useAdminTasks({ stakeholder_id: stakeholderId })
  const { data: generatedRows, refetch: refetchGenerated } = useGeneratedMaterials({ stakeholder_id: stakeholderId })
  const { data: materials, refetch: refetchMaterials } = useMaterials()
  const { data: templates } = useMaterialTemplates()
  const [previewMaterial, setPreviewMaterial] = React.useState<Material | null>(null)
  const [savingCodes, setSavingCodes] = React.useState(false)
  const [generating, setGenerating] = React.useState(false)
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [referralCode, setReferralCode] = React.useState('')
  const [connectionCode, setConnectionCode] = React.useState('')

  const codes = codeRows[0] || null
  const task = taskRows[0] || null

  React.useEffect(() => {
    setReferralCode(codes?.referral_code || '')
    setConnectionCode(codes?.connection_code || '')
  }, [codes?.id, codes?.referral_code, codes?.connection_code])

  const linkedGenerated = React.useMemo(() => {
    return generatedRows.map((generated) => ({
      generated,
      material: materials.find((material) => material.id === generated.material_id) || null,
      template: templates.find((template) => template.id === generated.template_id) || null,
    }))
  }, [generatedRows, materials, templates])

  const matchingTemplates = React.useMemo(() => {
    if (!stakeholder) return []
    return templates.filter((template) =>
      template.stakeholder_types.length === 0
      || template.stakeholder_types.includes(stakeholder.type)
      || (stakeholder.type === 'school' && template.stakeholder_types.includes('community'))
      || (stakeholder.type === 'cause' && template.stakeholder_types.includes('community'))
    )
  }, [templates, stakeholder])

  async function refreshAll() {
    refetchCodes({ silent: true })
    refetchTasks({ silent: true })
    refetchGenerated({ silent: true })
    refetchMaterials({ silent: true })
  }

  async function handleSaveCodes(event: React.FormEvent) {
    event.preventDefault()
    setSavingCodes(true)
    setFeedback(null)
    setError(null)

    const response = await fetch(`/api/admin/material-engine/stakeholders/${stakeholderId}/codes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        referralCode,
        connectionCode,
      }),
    })

    const payload = await response.json().catch(() => ({ error: 'Could not save codes.' }))
    setSavingCodes(false)

    if (!response.ok) {
      setError(payload.error || 'Could not save codes.')
      return
    }

    if (payload?.result?.generationStatus === 'failed') {
      setFeedback('Codes saved.')
      setError(payload?.result?.generationError || 'Codes saved, but material generation is still blocked.')
    } else {
      setFeedback('Codes saved and materials generated.')
    }
    refreshAll()
  }

  async function handleGenerateAll() {
    setGenerating(true)
    setFeedback(null)
    setError(null)

    const response = await fetch(`/api/admin/material-engine/stakeholders/${stakeholderId}/generate`, {
      method: 'POST',
    })

    const payload = await response.json().catch(() => ({ error: 'Could not generate materials.' }))
    setGenerating(false)

    if (!response.ok) {
      setError(payload.error || 'Could not generate materials.')
      return
    }

    setFeedback('Materials regenerated.')
    refreshAll()
  }

  async function handleRegenerateOne(generatedId: string) {
    setGenerating(true)
    setFeedback(null)
    setError(null)

    const response = await fetch(`/api/admin/material-engine/generated-materials/${generatedId}/regenerate`, {
      method: 'POST',
    })

    const payload = await response.json().catch(() => ({ error: 'Could not regenerate this material.' }))
    setGenerating(false)

    if (!response.ok) {
      setError(payload.error || 'Could not regenerate this material.')
      return
    }

    setFeedback('Material regenerated.')
    refreshAll()
  }

  if (stakeholderLoading || !stakeholder) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Stakeholder Setup"
          description="Loading stakeholder..."
          breadcrumb={[
            { label: 'Admin', href: '/admin/users' },
            { label: 'Stakeholders', href: '/admin/stakeholders' },
            { label: 'Loading' },
          ]}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={stakeholder.name}
        description="Complete code setup, monitor generation status, and manage the stakeholder’s personalized material outputs."
        breadcrumb={[
          { label: 'Admin', href: '/admin/users' },
          { label: 'Stakeholders', href: '/admin/stakeholders' },
          { label: stakeholder.name },
        ]}
        actions={
          <Link href="/admin/stakeholders">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
          </Link>
        }
      />

      <MaterialPreviewDialog
        material={previewMaterial}
        open={!!previewMaterial}
        onOpenChange={(open) => {
          if (!open) setPreviewMaterial(null)
        }}
      />

      {feedback && (
        <div className="rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          {feedback}
        </div>
      )}

      {error && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Task Status</p>
            <div className="mt-3">
              <Badge variant={badgeForStatus(task?.status || 'needs_setup') as 'default' | 'info' | 'success' | 'warning' | 'danger'}>
                {(task?.status || 'needs_setup').replace(/_/g, ' ')}
              </Badge>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Matching Templates</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{matchingTemplates.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Generated</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">
              {generatedRows.filter((item) => item.generation_status === 'generated').length}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Code Setup</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveCodes} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Referral code</label>
                <Input
                  value={referralCode}
                  onChange={(event) => setReferralCode(event.target.value)}
                  placeholder="tinglum-cafe"
                  required
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Connection code</label>
                <Input
                  value={connectionCode}
                  onChange={(event) => setConnectionCode(event.target.value)}
                  placeholder="main-street-bakery"
                  required
                />
              </div>
              {codes?.join_url && (
                <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
                  Join URL: <span className="font-medium text-surface-900">{codes.join_url.replace(/^https?:\/\//, '')}</span>
                </div>
              )}
              {matchingTemplates.length === 0 && (
                <div className="rounded-2xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
                  Codes can still be saved now, but material generation will stay blocked until this stakeholder has at least one active matching template.
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                <Button type="submit" disabled={savingCodes}>
                  <QrCode className="h-4 w-4" /> Save Codes + Generate
                </Button>
                <Button type="button" variant="outline" onClick={() => void handleGenerateAll()} disabled={generating}>
                  <Sparkles className="h-4 w-4" /> Generate Materials
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Setup Task</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
              <p className="text-sm font-semibold text-surface-900">{task?.title || `Complete setup for ${stakeholder.name}`}</p>
              <div className="mt-3 space-y-2 text-sm text-surface-600">
                <p>1. Add referral code</p>
                <p>2. Add connection code</p>
                <p>3. Generate materials</p>
              </div>
            </div>
            <div className="rounded-2xl border border-surface-200 bg-surface-0 px-4 py-4 text-sm text-surface-500">
              Last updated {task ? formatDate(task.updated_at) : 'today'}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matching Templates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {matchingTemplates.map((template) => (
            <div key={template.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-surface-900">{template.name}</p>
                <Badge variant="default">{getMaterialLibraryFolderMeta(template.library_folder).label}</Badge>
              </div>
              <p className="mt-2 text-sm text-surface-500">
                {template.audience_tags.join(', ') || 'No audience tags yet'}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Generated Materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {linkedGenerated.length === 0 ? (
            <p className="text-sm text-surface-500">No materials generated yet for this stakeholder.</p>
          ) : (
            linkedGenerated.map(({ generated, material, template }) => (
              <div key={generated.id} className="rounded-3xl border border-surface-200 bg-surface-0 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-28 w-24 overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
                      {material ? (
                        <Image
                          src={material.thumbnail_url || material.file_url || ''}
                          alt={material.title}
                          width={96}
                          height={112}
                          unoptimized
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-surface-400">No preview</div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-surface-900">{material?.title || template?.name || 'Generated material'}</p>
                        <Badge variant={badgeForStatus(generated.generation_status) as 'default' | 'info' | 'success' | 'warning' | 'danger'}>
                          {generated.generation_status}
                        </Badge>
                      </div>
                      <p className="text-sm text-surface-500">
                        {getMaterialLibraryFolderMeta(generated.library_folder).label}
                      </p>
                      {generated.generation_error && (
                        <p className="text-sm text-danger-600">{generated.generation_error}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {material && (
                      <Button variant="outline" onClick={() => setPreviewMaterial(material)}>
                        <Eye className="h-4 w-4" /> Preview
                      </Button>
                    )}
                    {material?.file_url && (
                      <Button variant="outline" asChild>
                        <a href={material.file_url} download>
                          <Download className="h-4 w-4" /> Download
                        </a>
                      </Button>
                    )}
                    <Button onClick={() => void handleRegenerateOne(generated.id)} disabled={generating}>
                      <RefreshCw className="h-4 w-4" /> Regenerate
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}
