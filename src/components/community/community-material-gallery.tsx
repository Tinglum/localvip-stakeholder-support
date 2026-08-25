'use client'

import { Download, FileText, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useMaterials } from '@/lib/supabase/hooks'
import type { Material } from '@/lib/types/database'

type CommunityMaterialAudience = 'business' | 'supporter'

function materialAudience(material: Material): CommunityMaterialAudience {
  const metadata = (material.metadata as Record<string, unknown> | null) || {}
  const flyerType = typeof metadata.flyer_type === 'string' ? metadata.flyer_type.toLowerCase() : ''
  const useCase = (material.use_case || '').toLowerCase()
  const roles = material.target_roles || []
  if (flyerType === 'business' || roles.includes('business') || useCase.includes('business')) return 'business'
  return 'supporter'
}

export function CommunityMaterialGallery({ audience }: { audience: CommunityMaterialAudience }) {
  const { data: materials, loading } = useMaterials()
  const templates = materials.filter((material) => (
    material.is_template
    && material.status === 'active'
    && materialAudience(material) === audience
  ))

  if (loading) {
    return <div className="flex min-h-40 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
  }

  if (templates.length === 0) {
    return (
      <EmptyState
        icon={<FileText className="h-8 w-8" />}
        title={audience === 'business' ? 'No business flyers yet' : 'No supporter flyers yet'}
        description="Approved materials will appear here automatically when they are published."
      />
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((material) => (
        <div key={material.id} className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
          <div className="aspect-[7/9] bg-surface-100">
            {material.thumbnail_url || material.file_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={material.thumbnail_url || material.file_url || ''} alt={material.title} className="h-full w-full object-cover object-top" />
            ) : (
              <div className="flex h-full items-center justify-center"><FileText className="h-10 w-10 text-surface-300" /></div>
            )}
          </div>
          <div className="space-y-3 p-4">
            <div>
              <p className="line-clamp-2 text-sm font-semibold text-surface-900">{material.title}</p>
              <div className="mt-2 flex gap-1.5"><Badge variant="default">{material.type}</Badge><Badge variant="outline">Template</Badge></div>
            </div>
            {material.file_url && (
              <Button asChild variant="outline" size="sm" className="w-full">
                <a href={material.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /> Open flyer</a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
