'use client'

import * as React from 'react'
import { Download, Eye, FolderOpen, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import { useAuth } from '@/lib/auth/context'
import {
  getAudienceLabel,
  getMaterialLibraryFolderMeta,
  MATERIAL_LIBRARY_FOLDERS,
} from '@/lib/material-engine'
import {
  useGeneratedMaterials,
  useMaterials,
  useStakeholders,
} from '@/lib/supabase/hooks'
import type { GeneratedMaterial, Material, MaterialLibraryFolder, Stakeholder } from '@/lib/types/database'
import { formatDate } from '@/lib/utils'

function resolveCurrentStakeholder(profile: ReturnType<typeof useAuth>['profile'], stakeholders: Stakeholder[]) {
  return stakeholders.find((stakeholder) => {
    if (stakeholder.profile_id === profile.id || stakeholder.owner_user_id === profile.id) return true
    if (profile.business_id && stakeholder.business_id === profile.business_id) return true
    if (profile.organization_id && stakeholder.organization_id === profile.organization_id) return true
    return false
  }) || null
}

export function StakeholderGeneratedMaterialsPage() {
  const { profile, shell } = useAuth()
  const { data: stakeholders, loading: stakeholdersLoading } = useStakeholders()
  const { data: generatedMaterials, loading: generatedLoading } = useGeneratedMaterials()
  const { data: materials, loading: materialsLoading } = useMaterials()
  const [search, setSearch] = React.useState('')
  const [selectedFolder, setSelectedFolder] = React.useState<MaterialLibraryFolder | 'all'>('all')
  const [previewMaterial, setPreviewMaterial] = React.useState<Material | null>(null)

  const stakeholder = React.useMemo(
    () => resolveCurrentStakeholder(profile, stakeholders),
    [profile, stakeholders],
  )

  const linkedGenerated = React.useMemo(() => {
    if (!stakeholder) return []
    return generatedMaterials
      .filter((item) => item.stakeholder_id === stakeholder.id && item.generation_status === 'generated')
      .map((item) => ({
        generated: item,
        material: materials.find((material) => material.id === item.material_id) || null,
      }))
      .filter((item) => item.material)
  }, [generatedMaterials, materials, stakeholder])

  const filtered = React.useMemo(() => {
    return linkedGenerated.filter(({ generated, material }) => {
      if (selectedFolder !== 'all' && generated.library_folder !== selectedFolder) return false
      if (!search) return true
      const query = search.toLowerCase()
      return (
        material!.title.toLowerCase().includes(query)
        || (material!.description || '').toLowerCase().includes(query)
        || generated.tags.join(' ').toLowerCase().includes(query)
      )
    })
  }, [linkedGenerated, search, selectedFolder])

  const grouped = React.useMemo(() => {
    const map = new Map<MaterialLibraryFolder, Array<{ generated: GeneratedMaterial; material: Material }>>()
    for (const item of filtered) {
      const existing = map.get(item.generated.library_folder) || []
      existing.push(item as { generated: GeneratedMaterial; material: Material })
      map.set(item.generated.library_folder, existing)
    }
    return map
  }, [filtered])

  const loading = stakeholdersLoading || generatedLoading || materialsLoading

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Materials" description="Loading your personalized materials..." />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Card key={index} className="animate-pulse">
              <div className="h-44 bg-surface-100" />
              <CardContent className="space-y-2 p-4">
                <div className="h-4 w-2/3 rounded bg-surface-100" />
                <div className="h-3 w-full rounded bg-surface-50" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (!stakeholder) {
    return (
      <div className="space-y-6">
        <PageHeader title="Materials" description="Your personalized library will appear here as soon as your stakeholder setup is complete." />
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="No stakeholder library yet"
          description="An admin still needs to connect your setup codes and generate your first materials."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Materials"
        description="Your personalized materials are already generated and organized by who you should share them with."
      />

      <MaterialPreviewDialog
        material={previewMaterial}
        open={!!previewMaterial}
        onOpenChange={(open) => {
          if (!open) setPreviewMaterial(null)
        }}
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-brand-50 via-white to-lime-50 px-6 py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-surface-900">{stakeholder.name}</p>
              <p className="mt-1 max-w-2xl text-sm text-surface-600">
                {shell === 'business'
                  ? 'These are ready-to-use customer and partner materials with your QR already built in.'
                  : 'These are your ready-to-share materials, already personalized and sorted into the right folders.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/90 bg-white/85 px-4 py-3 text-center shadow-sm">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Generated</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900">{linkedGenerated.length}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your materials..."
            className="pl-9"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedFolder('all')}
          className={`rounded-full px-4 py-2 text-sm ${selectedFolder === 'all' ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
        >
          All folders
        </button>
        {MATERIAL_LIBRARY_FOLDERS.map((folder) => (
          <button
            key={folder.value}
            onClick={() => setSelectedFolder(folder.value)}
            className={`rounded-full px-4 py-2 text-sm ${selectedFolder === folder.value ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
          >
            {folder.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="No materials in this folder yet"
          description="When your admin generates more materials, they will show up here automatically."
        />
      ) : (
        Array.from(grouped.entries()).map(([folder, items]) => {
          const folderMeta = getMaterialLibraryFolderMeta(folder)
          return (
            <div key={folder} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-surface-900">{folderMeta.label}</h2>
                <p className="mt-1 text-sm text-surface-500">{folderMeta.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map(({ generated, material }) => (
                  <Card key={generated.id} className="overflow-hidden transition-shadow hover:shadow-card-hover">
                    <div className="relative h-48 border-b border-surface-100 bg-surface-50">
                      <MaterialPreviewFrame
                        src={material.file_url || material.thumbnail_url}
                        mimeType={material.mime_type}
                        title={material.title}
                        className="h-full w-full"
                        fit="contain"
                        showPdfBadge
                        pdfClassName="h-full w-full"
                      />
                    </div>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="success">{getAudienceLabel(generated.tags)}</Badge>
                        <Badge variant="info">{folderMeta.label}</Badge>
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-surface-900">{material.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs text-surface-500">
                          {material.description || 'No description available yet.'}
                        </p>
                      </div>
                      <div className="flex items-center justify-between text-xs text-surface-400">
                        <span>{formatDate(generated.generated_at || generated.updated_at)}</span>
                        <span>Ready</span>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setPreviewMaterial(material)}>
                          <Eye className="h-3.5 w-3.5" /> Preview
                        </Button>
                        {material.file_url && (
                          <Button size="sm" asChild>
                            <a href={material.file_url} download>
                              <Download className="h-3.5 w-3.5" /> Download
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
