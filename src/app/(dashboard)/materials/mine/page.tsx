'use client'

import * as React from 'react'
import {
  FileText, Download, Eye, ArrowRight, Sparkles, Loader2,
  File, Image, Mail, MessageSquare, Printer, QrCode, FolderOpen,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { BRANDS, MATERIAL_TYPES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import { useMaterials } from '@/lib/supabase/hooks'
import Link from 'next/link'

const TYPE_ICONS: Record<string, React.ReactNode> = {
  one_pager: <File className="h-6 w-6" />,
  flyer: <Image className="h-6 w-6" />,
  pdf: <FileText className="h-6 w-6" />,
  script: <MessageSquare className="h-6 w-6" />,
  email_template: <Mail className="h-6 w-6" />,
  print_asset: <Printer className="h-6 w-6" />,
  qr_asset: <QrCode className="h-6 w-6" />,
  other: <FolderOpen className="h-6 w-6" />,
}

export default function MyMaterialsPage() {
  const { profile } = useAuth()
  const { data: materials, loading, error } = useMaterials({ created_by: profile.id })

  return (
    <div>
      <PageHeader
        title="My Materials"
        description="Your uploaded and assigned marketing materials. Download what you need."
        actions={
          <Link href="/materials/library">
            <Button variant="outline">
              Browse Library <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {/* Recommended action */}
      <Card className="mb-6 border-l-4 border-l-brand-500">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-800">Ready for outreach?</p>
            <p className="text-xs text-surface-500">Download your outreach script and one-pager before visiting businesses.</p>
          </div>
          <Link href="/materials/library">
            <Button size="sm">
              <Download className="h-3.5 w-3.5" /> Browse Materials
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="h-12 w-12 rounded-lg bg-surface-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded bg-surface-100" />
                  <div className="h-3 w-2/3 rounded bg-surface-50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : materials.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No materials yet"
          description="You haven't uploaded any materials yet. Browse the library or upload new materials."
          action={{ label: 'Browse Library', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-3">
          {materials.map(material => (
            <Card key={material.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-100 text-surface-400">
                  {TYPE_ICONS[material.type] || <FileText className="h-6 w-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-surface-800">{material.title}</h3>
                  <p className="text-xs text-surface-500">{material.description}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={material.brand === 'hato' ? 'hato' : 'info'}>
                      {BRANDS[material.brand]?.label ?? material.brand}
                    </Badge>
                    <Badge variant="default">
                      {MATERIAL_TYPES.find(t => t.value === material.type)?.label ?? material.type}
                    </Badge>
                    <span className="text-xs text-surface-400">
                      {formatDate(material.created_at)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  {material.file_url && (
                    <Button variant="ghost" size="icon-sm" title="Preview" asChild>
                      <a href={material.file_url} target="_blank" rel="noopener noreferrer">
                        <Eye className="h-4 w-4" />
                      </a>
                    </Button>
                  )}
                  {material.file_url && (
                    <Button variant="outline" size="sm" asChild>
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
      )}
    </div>
  )
}
