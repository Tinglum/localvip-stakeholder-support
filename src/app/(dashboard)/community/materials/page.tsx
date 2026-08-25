'use client'

import * as React from 'react'
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { useAuth } from '@/lib/auth/context'
import { resolveCommunityCause } from '@/lib/community-support'
import { useCauses, useGeneratedMaterials, useMaterials } from '@/lib/supabase/hooks'
import type { Material } from '@/lib/types/database'

function isCauseTemplate(material: Material, causeType: string | null) {
  if (!material.is_template || material.status !== 'active') return false
  const roles = material.target_roles || []
  const subtypes = material.target_subtypes || []
  const visibleToCommunity = roles.length === 0 || roles.some((role) => ['community', 'cause'].includes(role))
  const matchingSubtype = subtypes.length === 0 || subtypes.some((subtype) => (
    subtype === 'cause' || (causeType === 'school' && subtype === 'school')
  ))
  return visibleToCommunity && matchingSubtype
}

export default function CommunityMaterialsPage() {
  const { profile } = useAuth()
  const { data: causes, loading: causesLoading } = useCauses()
  const cause = React.useMemo(() => resolveCommunityCause(causes, profile), [causes, profile])
  const { data: generatedMaterials, loading: generatedLoading } = useGeneratedMaterials(
    { cause_id: cause?.id || '__none__' },
    { enabled: !!cause },
  )
  const { data: materials, loading: materialsLoading } = useMaterials()
  const materialById = React.useMemo(() => new Map(materials.map((material) => [material.id, material])), [materials])
  const readyMaterials = React.useMemo(
    () => generatedMaterials.filter((material) => material.is_active && material.generation_status === 'generated' && !!material.generated_file_url),
    [generatedMaterials],
  )
  const availableTemplates = React.useMemo(
    () => materials.filter((material) => isCauseTemplate(material, cause?.type || null)),
    [cause?.type, materials],
  )

  if (causesLoading || generatedLoading || materialsLoading) {
    return <div className="flex min-h-[360px] items-center justify-center"><Loader2 className="h-7 w-7 animate-spin text-brand-500" /></div>
  }

  if (!cause) {
    return <EmptyState icon={<FileText className="h-8 w-8" />} title="Materials are not connected yet" description="A school or cause must be linked to this account before its materials can be shown." />
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Materials" description={`Flyers, outreach assets, and campaign files for ${cause.name}.`} />

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div><CardTitle>Ready for your school</CardTitle><p className="mt-1 text-sm text-surface-500">Personalized files already prepared for sharing.</p></div>
            <Badge variant={readyMaterials.length > 0 ? 'success' : 'default'}>{readyMaterials.length} ready</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {readyMaterials.length === 0 ? (
            <div className="rounded-xl border border-dashed border-surface-200 bg-surface-50 px-6 py-10 text-center">
              <FileText className="mx-auto mb-3 h-9 w-9 text-surface-300" />
              <p className="text-sm font-semibold text-surface-800">No personalized files yet</p>
              <p className="mx-auto mt-1 max-w-lg text-sm text-surface-500">Available templates appear below. Personalized versions will show here after they are prepared for {cause.name}.</p>
            </div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {readyMaterials.map((generated) => {
                const source = generated.material_id ? materialById.get(generated.material_id) : null
                return (
                  <div key={generated.id} className="flex items-center justify-between gap-4 rounded-xl border border-surface-200 bg-white p-4">
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-surface-900">{source?.title || generated.generated_file_name || 'Campaign material'}</p><p className="mt-1 text-xs text-surface-500">Version {generated.version_number || 1} · Ready to share</p></div>
                    <Button asChild variant="outline" size="sm"><a href={generated.generated_file_url || ''} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /> Open</a></Button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div><CardTitle>Available templates</CardTitle><p className="mt-1 text-sm text-surface-500">Approved materials your team can use for business and community outreach.</p></div>
            <Badge variant="default">{availableTemplates.length} templates</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {availableTemplates.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} title="No templates available yet" description="Approved school and cause templates will appear here automatically." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {availableTemplates.map((material) => (
                <div key={material.id} className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
                  <div className="aspect-[7/10] bg-surface-100">
                    {material.thumbnail_url || material.file_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={material.thumbnail_url || material.file_url || ''} alt={material.title} className="h-full w-full object-cover object-top" />
                    ) : <div className="flex h-full items-center justify-center"><FileText className="h-10 w-10 text-surface-300" /></div>}
                  </div>
                  <div className="space-y-3 p-4">
                    <div><p className="line-clamp-2 text-sm font-semibold text-surface-900">{material.title}</p><div className="mt-2 flex flex-wrap gap-1.5"><Badge variant="default">{material.type}</Badge>{material.target_subtypes?.slice(0, 2).map((subtype) => <Badge key={subtype} variant="outline">{subtype}</Badge>)}</div></div>
                    {material.file_url && <Button asChild variant="outline" size="sm" className="w-full"><a href={material.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /> Open template</a></Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
