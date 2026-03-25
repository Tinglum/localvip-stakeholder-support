'use client'

import * as React from 'react'
import { FolderOpen, Plus, QrCode, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

const DEMO_COLLECTIONS = [
  { id: 'col-001', name: 'Atlanta Spring 2026', brand: 'localvip' as const, qr_count: 18, description: 'All QR codes for the Atlanta spring campaign push.', created_at: '2026-01-15' },
  { id: 'col-002', name: 'HATO School Program', brand: 'hato' as const, qr_count: 12, description: 'QR codes for school leaders and HATO flyers.', created_at: '2026-02-01' },
  { id: 'col-003', name: 'Business One-Pager QRs', brand: 'localvip' as const, qr_count: 8, description: 'QR codes embedded in the business one-pager handout.', created_at: '2026-02-20' },
  { id: 'col-004', name: 'Volunteer Field Kit', brand: 'localvip' as const, qr_count: 6, description: 'QR codes for volunteer table tents and door hangers.', created_at: '2026-03-01' },
  { id: 'col-005', name: 'Holiday Giving Drive', brand: 'hato' as const, qr_count: 10, description: 'Holiday campaign posters and donation links.', created_at: '2025-11-01' },
]

export default function QrCollectionsPage() {
  return (
    <div>
      <PageHeader
        title="QR Collections"
        description="Organize QR codes into groups — by campaign, event, material, or team."
        actions={<Button><Plus className="h-4 w-4" /> New Collection</Button>}
      />

      {DEMO_COLLECTIONS.length === 0 ? (
        <EmptyState
          icon={<FolderOpen className="h-8 w-8" />}
          title="No collections yet"
          description="Create a collection to organize your QR codes by campaign or purpose."
          action={{ label: 'New Collection', onClick: () => {} }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_COLLECTIONS.map(col => (
            <Card key={col.id} className="group cursor-pointer transition-shadow hover:shadow-card-hover">
              <CardContent className="p-5">
                <div className="mb-3 flex items-center justify-between">
                  <div className="rounded-lg bg-surface-100 p-2 text-surface-400 group-hover:bg-brand-50 group-hover:text-brand-600 transition-colors">
                    <FolderOpen className="h-5 w-5" />
                  </div>
                  <Badge variant={col.brand === 'hato' ? 'hato' : 'info'}>
                    {BRANDS[col.brand].label}
                  </Badge>
                </div>
                <h3 className="text-base font-semibold text-surface-800 group-hover:text-brand-700 transition-colors">
                  {col.name}
                </h3>
                <p className="mt-1 text-xs text-surface-500 line-clamp-2">{col.description}</p>
                <div className="mt-4 flex items-center justify-between border-t border-surface-100 pt-3">
                  <div className="flex items-center gap-1 text-xs text-surface-500">
                    <QrCode className="h-3.5 w-3.5" />
                    <span className="font-medium text-surface-700">{col.qr_count}</span> QR codes
                  </div>
                  <span className="text-xs text-surface-400">{formatDate(col.created_at)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
