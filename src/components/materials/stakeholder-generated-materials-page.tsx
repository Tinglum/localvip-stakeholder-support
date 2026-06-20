'use client'

import * as React from 'react'
import { AlertTriangle, Download, Eye, FolderOpen, RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MaterialEditDialog } from '@/components/materials/material-edit-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import { useAuth } from '@/lib/auth/context'
import {
  getAudienceLabel,
  MATERIAL_LIBRARY_FOLDERS,
} from '@/lib/material-engine'
import {
  getMaterialCustomTags,
  getMaterialVisibilityRoleLabels,
  getMaterialVisibilitySubtypeLabels,
} from '@/lib/materials/material-targeting'
import {
  useGeneratedMaterials,
  useMaterials,
  useStakeholders,
} from '@/lib/supabase/hooks'
import type { GeneratedMaterial, Material, MaterialLibraryFolder, Stakeholder } from '@/lib/types/database'
import { formatDate } from '@/lib/utils'

// QA's GeneratedMaterial is self-contained (its own file url/name) and is not
// joined to a separate Material row the way the Supabase model was. When there
// is no linked Material, synthesize one from the generated record so the card
// UI (preview / download / title) still renders.
function materialFromGenerated(generated: GeneratedMaterial): Material {
  const fileName = generated.generated_file_name || 'Material'
  const title = fileName.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Material'
  const url = generated.generated_file_url
  const isPdf = !!url && url.toLowerCase().endsWith('.pdf')
  return {
    id: generated.id,
    title,
    description: null,
    type: isPdf ? 'pdf' : 'other',
    brand: 'localvip',
    file_url: url,
    file_name: fileName,
    file_size: null,
    mime_type: isPdf ? 'application/pdf' : null,
    thumbnail_url: null,
    category: null,
    use_case: null,
    target_roles: [],
    campaign_id: null,
    city_id: null,
    is_template: false,
    version: generated.version_number ?? 1,
    status: 'active',
    created_by: '',
    metadata: null,
    created_at: generated.generated_at || generated.updated_at,
    updated_at: generated.updated_at,
  }
}

// Generated materials carry the template's folder, which on QA uses a
// format-based taxonomy (flyers, qr_posters, signage, social) rather than the
// dashboard's audience-based MATERIAL_LIBRARY_FOLDERS. Resolve a friendly
// label/description for whatever value actually comes back.
function folderMetaFor(folder: MaterialLibraryFolder | string | null | undefined): { label: string; description: string } {
  const known = MATERIAL_LIBRARY_FOLDERS.find((item) => item.value === folder)
  if (known) return { label: known.label, description: known.description }
  if (!folder) return { label: 'Materials', description: '' }
  const label = String(folder).replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()).trim()
  return { label: label || 'Materials', description: '' }
}

function resolveCurrentStakeholder(
  profile: ReturnType<typeof useAuth>['profile'],
  localProfileId: string | null,
  stakeholders: Stakeholder[],
) {
  return stakeholders.find((stakeholder) => {
    if (localProfileId && (stakeholder.profile_id === localProfileId || stakeholder.owner_user_id === localProfileId)) return true
    if (profile.business_id && stakeholder.business_id === profile.business_id) return true
    if (profile.organization_id && stakeholder.organization_id === profile.organization_id) return true
    return false
  }) || null
}

export function StakeholderGeneratedMaterialsPage() {
  const { profile, shell, isAdmin, localProfileId } = useAuth()
  const { data: stakeholders, loading: stakeholdersLoading, refetch: refetchStakeholders } = useStakeholders()
  const { data: generatedMaterials, loading: generatedLoading, refetch: refetchGenerated } = useGeneratedMaterials()
  const { data: materials, loading: materialsLoading, refetch } = useMaterials()
  const [provisioning, setProvisioning] = React.useState(false)
  const provisionAttempted = React.useRef(false)
  // The QA stakeholder id resolved server-side by /api/portal/ensure-materials.
  // Needed because an impersonated/QA business profile carries no business_id,
  // localProfileId, or organization_id, so resolveCurrentStakeholder can't match
  // on its own — we resolve by this id instead.
  const [ensuredStakeholderId, setEnsuredStakeholderId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')
  const [selectedFolder, setSelectedFolder] = React.useState<MaterialLibraryFolder | 'all'>('all')
  const [previewMaterial, setPreviewMaterial] = React.useState<Material | null>(null)
  const [editingMaterial, setEditingMaterial] = React.useState<Material | null>(null)
  const [updatingId, setUpdatingId] = React.useState<string | null>(null)
  const [confirmUpdate, setConfirmUpdate] = React.useState<{ generated: GeneratedMaterial; material: Material } | null>(null)

  const stakeholder = React.useMemo(() => {
    const resolved = resolveCurrentStakeholder(profile, localProfileId, stakeholders)
    if (resolved) return resolved
    // QA fallback: match the stakeholder the server provisioned for this session.
    if (ensuredStakeholderId) {
      return stakeholders.find((item) => String(item.id) === ensuredStakeholderId) || null
    }
    return null
  }, [localProfileId, profile, stakeholders, ensuredStakeholderId])

  // Auto-provision a business's materials on first view (QA only) — no admin,
  // no "added as a stakeholder" step. Ensures the QA context + generates the
  // default materials, then refetches.
  React.useEffect(() => {
    if (provisionAttempted.current) return
    if (stakeholdersLoading || generatedLoading || materialsLoading) return
    if (stakeholder) return
    if (profile.role !== 'business') return
    provisionAttempted.current = true
    setProvisioning(true)
    void (async () => {
      try {
        const res = await fetch('/api/portal/ensure-materials', { method: 'POST' })
        if (res.ok) {
          const data = await res.json().catch(() => null)
          if (data?.stakeholderId != null) setEnsuredStakeholderId(String(data.stakeholderId))
          refetchStakeholders?.({ silent: true })
          refetchGenerated?.({ silent: true })
          refetch?.({ silent: true })
        }
      } finally {
        setProvisioning(false)
      }
    })()
  }, [stakeholder, stakeholdersLoading, generatedLoading, materialsLoading, profile.role, refetchStakeholders, refetchGenerated, refetch])

  const linkedGenerated = React.useMemo(() => {
    if (!stakeholder) return []
    return generatedMaterials
      .filter((item) => String(item.stakeholder_id) === String(stakeholder.id) && item.generation_status === 'generated')
      .map((item) => ({
        generated: item,
        material:
          (item.material_id ? materials.find((material) => material.id === item.material_id) : null)
          || materialFromGenerated(item),
      }))
      .filter((item) => item.material)
  }, [generatedMaterials, materials, stakeholder])

  const filtered = React.useMemo(() => {
    return linkedGenerated.filter(({ generated, material }) => {
      if (selectedFolder !== 'all' && generated.library_folder !== selectedFolder) return false
      if (!search) return true
      const query = search.toLowerCase()
      const customTags = getMaterialCustomTags(material!).join(' ').toLowerCase()
      return (
        material!.title.toLowerCase().includes(query)
        || (material!.description || '').toLowerCase().includes(query)
        || generated.tags.join(' ').toLowerCase().includes(query)
        || customTags.includes(query)
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

  const presentFolders = React.useMemo(() => {
    const set = new Set<string>()
    for (const { generated } of linkedGenerated) {
      if (generated.library_folder) set.add(String(generated.library_folder))
    }
    return Array.from(set)
  }, [linkedGenerated])

  const outdatedCount = linkedGenerated.filter(({ generated }) => generated.is_outdated).length

  async function handleAcceptUpdate(generatedId: string) {
    setUpdatingId(generatedId)
    setConfirmUpdate(null)
    try {
      const res = await fetch('/api/portal/accept-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ generatedMaterialId: generatedId }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update material.')
        return
      }
      toast.success('Material updated to the latest version.')
      refetchGenerated({ silent: true })
      refetch({ silent: true })
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setUpdatingId(null)
    }
  }

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
    const isBusiness = profile.role === 'business'
    return (
      <div className="space-y-6">
        <PageHeader
          title="Materials"
          description={isBusiness ? 'Setting up your material library…' : 'Your personalized library will appear here once your setup is connected.'}
        />
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title={isBusiness ? 'Preparing your materials…' : 'No material library yet'}
          description={
            isBusiness
              ? 'We are generating your materials now — this only takes a moment. Refresh in a few seconds if they do not appear.'
              : 'Your materials will appear here once your setup is connected.'
          }
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

      <MaterialEditDialog
        material={editingMaterial}
        open={!!editingMaterial}
        onOpenChange={(open) => {
          if (!open) setEditingMaterial(null)
        }}
        onSaved={() => {
          setEditingMaterial(null)
          refetch()
        }}
      />

      <Dialog open={!!confirmUpdate} onOpenChange={(open) => { if (!open) setConfirmUpdate(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Material</DialogTitle>
            <DialogDescription>
              A newer version of the template for &ldquo;{confirmUpdate?.material.title}&rdquo; is available.
              Accepting will regenerate this material with the latest template design while keeping your QR code.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmUpdate(null)}>Cancel</Button>
            <Button onClick={() => confirmUpdate && handleAcceptUpdate(confirmUpdate.generated.id)}>
              Accept Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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

      {outdatedCount > 0 && (
        <div className="flex items-center gap-3 rounded-2xl border border-warning-200 bg-warning-50 px-5 py-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-warning-600" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-warning-800">
              {outdatedCount} material{outdatedCount !== 1 ? 's have' : ' has'} an update available
            </p>
            <p className="mt-0.5 text-xs text-warning-600">
              A newer version of the template is available. Review and accept the update to get the latest design.
            </p>
          </div>
        </div>
      )}

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
        {presentFolders.map((folder) => (
          <button
            key={folder}
            onClick={() => setSelectedFolder(folder as MaterialLibraryFolder)}
            className={`rounded-full px-4 py-2 text-sm ${selectedFolder === folder ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
          >
            {folderMetaFor(folder).label}
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
          const folderMeta = folderMetaFor(folder)
          return (
            <div key={folder} className="space-y-4">
              <div>
                <h2 className="text-lg font-semibold text-surface-900">{folderMeta.label}</h2>
                <p className="mt-1 text-sm text-surface-500">{folderMeta.description}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {items.map(({ generated, material }) => (
                  (() => {
                    const customTags = getMaterialCustomTags(material)
                    const visibilityLabels = getMaterialVisibilityRoleLabels(material)
                    const subtypeLabels = getMaterialVisibilitySubtypeLabels(material)
                    const canEdit = isAdmin || (!!localProfileId && material.created_by === localProfileId)

                    return (
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
                            <Badge variant="success">{getAudienceLabel(customTags.length > 0 ? customTags : generated.tags)}</Badge>
                            <Badge variant="info">{folderMeta.label}</Badge>
                            {generated.is_outdated && (
                              <Badge variant="warning">Update available</Badge>
                            )}
                          </div>
                          {(visibilityLabels.length > 0 || subtypeLabels.length > 0 || customTags.length > 0) && (
                            <div className="flex flex-wrap gap-1.5">
                              {visibilityLabels.slice(0, 3).map((label) => (
                                <Badge key={label} variant="info">{label}</Badge>
                              ))}
                              {subtypeLabels.slice(0, 2).map((label) => (
                                <Badge key={label} variant="success">{label}</Badge>
                              ))}
                              {customTags.slice(0, 2).map((tag) => (
                                <Badge key={tag} variant="default">{tag}</Badge>
                              ))}
                            </div>
                          )}
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
                            {generated.is_outdated && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setConfirmUpdate({ generated, material: material! })}
                                disabled={updatingId === generated.id}
                              >
                                <RefreshCw className={`h-3.5 w-3.5 ${updatingId === generated.id ? 'animate-spin' : ''}`} />
                                {updatingId === generated.id ? 'Updating...' : 'Accept Update'}
                              </Button>
                            )}
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
                            {canEdit && (
                              <Button variant="ghost" size="sm" onClick={() => setEditingMaterial(material)}>
                                Edit
                              </Button>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )
                  })()
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
