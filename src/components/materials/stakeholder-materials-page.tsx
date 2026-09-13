'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Download, Eye, FileText, Loader2, Search, Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import { MaterialPreviewDialog } from '@/components/materials/material-preview-dialog'
import { PageHeader } from '@/components/ui/page-header'
import { useAuth } from '@/lib/auth/context'
import { useGeneratedMaterials, useMaterialTemplates, useMaterials } from '@/lib/supabase/hooks'
import {
  explainMaterialAvailability,
  getMaterialDelivery,
  getStakeholderMaterialCopy,
  materialIsAvailableToProfile,
} from '@/lib/materials/stakeholder-library'
import type { GeneratedMaterial, Material, MaterialTemplate } from '@/lib/types/database'

function generatedToMaterial(row: GeneratedMaterial, template?: MaterialTemplate): Material {
  const meta = (row.metadata || template?.metadata || {}) as Record<string, unknown>
  const generatedAt = row.generated_at || row.updated_at || new Date().toISOString()
  return {
    id: `generated-${row.id}`,
    title: template?.name || row.generated_file_name?.replace(/\.[^/.]+$/, '') || 'Personalized material',
    description: typeof meta.description === 'string' ? meta.description : 'Prepared with your account details and QR code.',
    type: template?.output_format === 'png' ? 'print_asset' : 'pdf',
    brand: 'localvip', file_url: row.generated_file_url, file_name: row.generated_file_name,
    file_size: null, mime_type: template?.output_format === 'png' ? 'image/png' : 'application/pdf',
    thumbnail_url: row.generated_file_url, category: row.library_folder || template?.library_folder || 'generated',
    use_case: 'generated_template', target_roles: [], target_subtypes: [], campaign_id: null, city_id: null,
    is_template: false, version: row.version_number || row.template_version || 1, status: 'active',
    created_by: 'system', metadata: { ...meta, delivery_method: 'automatic' }, created_at: generatedAt,
    updated_at: row.updated_at || generatedAt,
  }
}

function MaterialCard({ material, profile, actionLabel, actionHref, onPreview }: {
  material: Material
  profile: ReturnType<typeof useAuth>['profile']
  actionLabel?: string
  actionHref?: string
  onPreview: () => void
}) {
  const source = material.file_url || material.thumbnail_url
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-card-hover">
      <button type="button" onClick={onPreview} className="block h-40 w-full border-b border-surface-100 bg-surface-50 text-left">
        <MaterialPreviewFrame src={source} mimeType={material.mime_type} title={material.title} className="h-full w-full" fit="contain" showPdfBadge />
      </button>
      <CardContent className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant={getMaterialDelivery(material) === 'automatic' ? 'success' : getMaterialDelivery(material) === 'customizable' ? 'info' : 'default'}>
            {getMaterialDelivery(material) === 'automatic' ? 'Made for you' : getMaterialDelivery(material) === 'customizable' ? 'Customizable' : 'Ready to use'}
          </Badge>
          <span className="text-xs text-surface-400">{material.type.replaceAll('_', ' ')}</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-surface-900">{material.title}</h3>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-surface-500">{material.description || 'Approved LocalVIP material.'}</p>
        </div>
        <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs leading-5 text-surface-600">
          {explainMaterialAvailability(material, profile)}
        </p>
        <div className="flex flex-wrap gap-2">
          {source && <Button size="sm" variant="outline" onClick={onPreview}><Eye className="h-3.5 w-3.5" /> Preview</Button>}
          {actionHref ? (
            <Button size="sm" asChild><Link href={actionHref}>{actionLabel}<ArrowRight className="h-3.5 w-3.5" /></Link></Button>
          ) : material.file_url ? (
            <Button size="sm" asChild><a href={material.file_url} download><Download className="h-3.5 w-3.5" /> {actionLabel || 'Download'}</a></Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

function MaterialSection({ title, description, materials, profile, customize, empty, onPreview }: {
  title: string
  description: string
  materials: Material[]
  profile: ReturnType<typeof useAuth>['profile']
  customize?: boolean
  empty: string
  onPreview: (material: Material) => void
}) {
  return (
    <section className="space-y-3" aria-label={title}>
      <div>
        <h2 className="text-lg font-semibold text-surface-900">{title}</h2>
        <p className="mt-1 text-sm text-surface-500">{description}</p>
      </div>
      {materials.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {materials.map(material => (
            <MaterialCard key={material.id} material={material} profile={profile} onPreview={() => onPreview(material)}
              actionLabel={customize ? 'Customize' : undefined}
              actionHref={customize ? `/portal/materials?tab=templates&generateTemplate=${encodeURIComponent(String((material.metadata as Record<string, unknown> | null)?.generation_template_id || material.id))}` : undefined} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 px-5 py-6 text-sm text-surface-600">{empty}</div>
      )}
    </section>
  )
}

export function StakeholderMaterialsPage({ embedded = false }: { embedded?: boolean }) {
  const { profile, shell, localProfileId } = useAuth()
  const copy = getStakeholderMaterialCopy(shell)
  const { data: allMaterials, loading: materialsLoading, error } = useMaterials()
  const { data: generated, loading: generatedLoading } = useGeneratedMaterials()
  const { data: templates, loading: templateLoading } = useMaterialTemplates({ is_active: 'true' })
  const [search, setSearch] = React.useState('')
  const [preview, setPreview] = React.useState<Material | null>(null)

  const templateMap = React.useMemo(() => new Map(templates.map(item => [String(item.id), item])), [templates])
  const accountIds = React.useMemo(() => new Set([
    profile.business_id, profile.organization_id, profile.id, localProfileId,
  ].filter(Boolean).map(String)), [localProfileId, profile.business_id, profile.id, profile.organization_id])

  const generatedMaterials = React.useMemo(() => generated.filter(row => {
    if (row.generation_status !== 'generated' || row.is_active === false || row.is_outdated || !row.generated_file_url) return false
    const ids = [row.business_id, row.cause_id, row.stakeholder_id].filter(Boolean).map(String)
    return ids.some(id => accountIds.has(id))
  }).map(row => generatedToMaterial(row, templateMap.get(String(row.template_id)))), [accountIds, generated, templateMap])

  const eligible = React.useMemo(() => allMaterials.filter(material => materialIsAvailableToProfile(material, profile)), [allMaterials, profile])
  const customizableMaterials = React.useMemo(() => eligible
    .filter(item => getMaterialDelivery(item) === 'customizable')
    .map(item => {
      const match = templates.find(template => template.is_active && (
        template.source_path === item.file_url
        || template.source_path === item.thumbnail_url
        || template.name.trim().toLowerCase() === item.title.trim().toLowerCase()
      ))
      return match ? { ...item, metadata: { ...(item.metadata || {}), generation_template_id: match.id } } : item
    }), [eligible, templates])
  const matches = React.useCallback((material: Material) => {
    if (!search.trim()) return true
    const value = `${material.title} ${material.description || ''} ${material.category || ''} ${material.use_case || ''}`.toLowerCase()
    return value.includes(search.trim().toLowerCase())
  }, [search])

  const madeForYou = generatedMaterials.filter(matches)
  const customizable = customizableMaterials.filter(matches)
  const saved = eligible.filter(item => !item.is_template && !!localProfileId && item.created_by === localProfileId).filter(matches)
  const savedIds = new Set(saved.map(item => item.id))
  const resources = eligible.filter(item => getMaterialDelivery(item) === 'ready' && !savedIds.has(item.id)).filter(matches)
  const loading = materialsLoading || generatedLoading || templateLoading

  return (
    <div className="space-y-8">
      {!embedded && <PageHeader title={copy.pageTitle} description={copy.pageDescription} />}
      <MaterialPreviewDialog material={preview} open={!!preview} onOpenChange={open => { if (!open) setPreview(null) }} />
      <div className="rounded-2xl border border-surface-200 bg-white p-4">
        <div className="relative max-w-xl">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
          <Input value={search} onChange={event => setSearch(event.target.value)} placeholder={`Search ${copy.pageTitle.toLowerCase()}...`} className="pl-9" />
        </div>
      </div>
      {error && <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center rounded-2xl border border-surface-200 bg-white py-16 text-surface-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Preparing your materials...</div>
      ) : madeForYou.length + customizable.length + resources.length + saved.length === 0 ? (
        <div className="rounded-3xl border border-brand-100 bg-brand-50/40 px-6 py-12 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-brand-500" />
          <h2 className="mt-3 text-lg font-semibold text-surface-900">{copy.emptyTitle}</h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-surface-600">{copy.emptyDescription}</p>
        </div>
      ) : (
        <>
          <MaterialSection title={copy.madeTitle} description={copy.madeDescription} materials={madeForYou} profile={profile} empty="Personalized materials will appear here when they are ready." onPreview={setPreview} />
          <MaterialSection title={copy.customizeTitle} description={copy.customizeDescription} materials={customizable} profile={profile} customize empty="No optional templates match your account yet." onPreview={setPreview} />
          <MaterialSection title={copy.resourceTitle} description={copy.resourceDescription} materials={resources} profile={profile} empty="No general resources match your account yet." onPreview={setPreview} />
          <MaterialSection title={copy.savedTitle} description={copy.savedDescription} materials={saved} profile={profile} empty="Materials you save or create will appear here." onPreview={setPreview} />
        </>
      )}
    </div>
  )
}
