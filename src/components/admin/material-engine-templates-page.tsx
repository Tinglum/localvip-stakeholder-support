'use client'

import * as React from 'react'
import Link from 'next/link'
import { Eye, FolderOpen, QrCode, Upload } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { useMaterials } from '@/lib/supabase/hooks'
import type { Material } from '@/lib/types/database'

export function MaterialEngineTemplatesPage() {
  const { data: materials, loading } = useMaterials()
  const [previewMaterial, setPreviewMaterial] = React.useState<Material | null>(null)

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Automation Template Sources"
        description="Reusable stakeholder templates now come directly from the Materials Library. Upload a real material, save its QR layout, then mark it as an automation template there."
        actions={
          <Link href="/materials/library">
            <Button>
              <Upload className="h-4 w-4" /> Open Materials Library
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

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Template-ready materials</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">{templateMaterials.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Active automation templates</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">
              {templateMaterials.filter((item) => item.config.enabled && item.config.isActive && item.supportsAutomation).length}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Blocked sources</p>
            <p className="mt-2 text-3xl font-semibold text-surface-900">
              {templateMaterials.filter((item) => item.config.enabled && !item.supportsAutomation).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-5 text-sm text-surface-600">
          <p className="font-medium text-surface-900">How this works now</p>
          <div className="mt-3 space-y-2">
            <p>1. Upload the source material in <span className="font-medium">Materials Library</span>.</p>
            <p>2. Save the QR zones with the existing QR chooser.</p>
            <p>3. Mark the material as an automation template in its Edit dialog.</p>
            <p>4. The engine uses that source asset directly when it generates personalized business or cause materials.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Template Source Materials</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-surface-500">Loading source materials...</p>
          ) : templateMaterials.length === 0 ? (
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
              No source materials have been marked as automation templates yet.
            </div>
          ) : (
            templateMaterials.map(({ material, config, qrZoneCount, supportsAutomation }) => (
              <div key={material.id} className="rounded-3xl border border-surface-200 bg-surface-0 p-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-28 w-24 overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
                      <MaterialPreviewFrame
                        src={material.file_url || material.thumbnail_url}
                        mimeType={material.mime_type}
                        title={material.title}
                        showPdfBadge
                        className="h-full w-full"
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-surface-900">{material.title}</p>
                        <Badge variant={config.enabled && supportsAutomation ? 'success' : 'warning'}>
                          {config.enabled && supportsAutomation ? 'active source' : 'needs attention'}
                        </Badge>
                        <Badge variant="info">{getMaterialLibraryFolderMeta(config.libraryFolder).label}</Badge>
                      </div>
                      <p className="text-sm text-surface-500">
                        Stakeholders: {config.stakeholderTypes.join(', ') || 'none'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getMaterialAutomationAudienceTags(material).map((tag) => (
                          <Badge key={tag} variant="default">{tag}</Badge>
                        ))}
                      </div>
                      <div className="text-xs text-surface-500">
                        {qrZoneCount} QR {qrZoneCount === 1 ? 'zone' : 'zones'}
                        {!supportsAutomation && ' • Add at least one QR zone and a file URL'}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => setPreviewMaterial(material)}>
                      <Eye className="h-4 w-4" /> Preview
                    </Button>
                    <Link href="/materials/library">
                      <Button variant="outline">
                        <FolderOpen className="h-4 w-4" /> Manage in Materials
                      </Button>
                    </Link>
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
