'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  FileText,
  Heart,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { useCauses, useGeneratedMaterials, useStakeholders } from '@/lib/supabase/hooks'

export default function CommunityMaterialsPage() {
  const { profile } = useAuth()
  const { data: causes } = useCauses()

  const scopedCause = React.useMemo(
    () => causes.find(c => c.owner_id === profile.id || c.organization_id === profile.organization_id) || null,
    [causes, profile.id, profile.organization_id],
  )

  const { data: stakeholderRecords } = useStakeholders({ cause_id: scopedCause?.id || '__none__' })
  const scopedStakeholder = stakeholderRecords.find(s => s.cause_id === scopedCause?.id) || null
  const { data: generatedMaterials } = useGeneratedMaterials({ stakeholder_id: scopedStakeholder?.id || '__none__' })

  const activeMaterials = generatedMaterials.filter(m => m.generation_status === 'generated' && m.is_active !== false)
  const archivedMaterials = generatedMaterials.filter(m => m.is_active === false || m.generation_status !== 'generated')
  const [showArchived, setShowArchived] = React.useState(false)

  const isSchool = scopedCause?.type === 'school'

  if (!scopedCause) {
    return <EmptyState icon={<Heart className="h-8 w-8" />} title="No cause linked" description="Materials will appear once a cause or school is linked to your account." />
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Materials"
        description={`Materials for ${scopedCause.name} — flyers, outreach cards, and generated assets`}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href="/materials/mine">
              <ExternalLink className="h-3.5 w-3.5" /> Full material library
            </Link>
          </Button>
        }
      />

      {/* Active context chip */}
      <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-4 py-2">
        <Heart className="h-4 w-4 text-brand-600" />
        <span className="text-sm font-medium text-brand-800">
          Showing materials for: {scopedCause.name}
        </span>
        <Badge variant="outline" className="ml-2">{isSchool ? 'School' : 'Cause'}</Badge>
      </div>

      {activeMaterials.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="mx-auto mb-3 h-10 w-10 text-surface-300" />
              <h3 className="text-base font-semibold text-surface-800">No materials ready yet</h3>
              <p className="mx-auto mt-1 max-w-md text-sm text-surface-500">
                Materials are generated once your codes and QR are set up. Check your dashboard readiness checklist to see what is still needed.
              </p>
              <div className="mt-4">
                <Button asChild size="sm" variant="outline">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeMaterials.map(mat => (
            <Card key={mat.id} className="group transition-shadow hover:shadow-card-hover">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-surface-900">
                      {(mat.metadata as any)?.template_name || 'Generated Material'}
                    </p>
                    <p className="text-xs text-surface-500 mt-0.5">
                      {((mat.metadata as any)?.output_format || 'PDF').toUpperCase()} &middot; Version {mat.version_number || 1}
                    </p>
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                {mat.generated_file_url && (
                  <a
                    href={mat.generated_file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700"
                  >
                    <ExternalLink className="h-3 w-3" /> Download / View
                  </a>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Archived toggle */}
      {archivedMaterials.length > 0 && (
        <div>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className="text-sm font-medium text-surface-500 hover:text-surface-700"
          >
            {showArchived ? 'Hide' : 'Show'} archived ({archivedMaterials.length})
          </button>
          {showArchived && (
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {archivedMaterials.map(mat => (
                <Card key={mat.id} className="opacity-60">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <p className="text-sm font-medium text-surface-700">
                        {(mat.metadata as any)?.template_name || 'Material'}
                      </p>
                      <Badge variant="default">v{mat.version_number || 1}</Badge>
                    </div>
                    {mat.generated_file_url && (
                      <a
                        href={mat.generated_file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-surface-400 hover:text-surface-600"
                      >
                        View archived version
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
