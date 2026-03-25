'use client'

import * as React from 'react'
import { Megaphone, Plus, BarChart3, Users, QrCode, Store, Calendar, ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BRANDS } from '@/lib/constants'
import { formatDate } from '@/lib/utils'

const DEMO_CAMPAIGNS = [
  {
    id: 'camp-001', name: 'Atlanta Spring 2026 Launch', brand: 'localvip' as const,
    description: 'Major push to onboard businesses in Midtown, Buckhead, and Decatur.',
    status: 'active', start_date: '2026-02-01', end_date: '2026-05-31',
    owner: 'Kenneth (Super Admin)', city: 'Atlanta',
    stats: { businesses: 24, qr_scans: 3200, stakeholders: 18, materials: 6 },
  },
  {
    id: 'camp-002', name: 'HATO Back to School', brand: 'hato' as const,
    description: 'Partner with schools for the fall semester HATO program.',
    status: 'active', start_date: '2026-03-01', end_date: '2026-08-15',
    owner: 'Rick (Admin)', city: 'Atlanta',
    stats: { businesses: 8, qr_scans: 1450, stakeholders: 6, materials: 4 },
  },
  {
    id: 'camp-003', name: 'Charlotte Pilot', brand: 'localvip' as const,
    description: 'Test market expansion in Charlotte with a small team.',
    status: 'active', start_date: '2026-03-15', end_date: '2026-06-30',
    owner: 'Rick (Admin)', city: 'Charlotte',
    stats: { businesses: 8, qr_scans: 980, stakeholders: 8, materials: 5 },
  },
  {
    id: 'camp-004', name: 'Holiday Giving Drive 2025', brand: 'hato' as const,
    description: 'End-of-year donation campaign through participating businesses.',
    status: 'completed', start_date: '2025-11-01', end_date: '2025-12-31',
    owner: 'Kenneth (Super Admin)', city: 'Atlanta',
    stats: { businesses: 15, qr_scans: 1890, stakeholders: 12, materials: 8 },
  },
]

export default function CampaignsPage() {
  return (
    <div>
      <PageHeader
        title="Campaigns"
        description="Organize outreach efforts by campaign. Track progress, assign stakeholders, and measure results."
        actions={<Button><Plus className="h-4 w-4" /> New Campaign</Button>}
      />

      {DEMO_CAMPAIGNS.length === 0 ? (
        <EmptyState
          icon={<Megaphone className="h-8 w-8" />}
          title="No campaigns yet"
          description="Create a campaign to organize your outreach and track results."
          action={{ label: 'New Campaign', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-4">
          {DEMO_CAMPAIGNS.map(campaign => (
            <Card key={campaign.id} className="group transition-shadow hover:shadow-card-hover">
              <CardContent className="p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-lg font-semibold text-surface-900 group-hover:text-brand-700 transition-colors">
                        {campaign.name}
                      </h3>
                      <Badge variant={campaign.brand === 'hato' ? 'hato' : 'info'}>
                        {BRANDS[campaign.brand].label}
                      </Badge>
                      <Badge variant={campaign.status === 'active' ? 'success' : 'default'} dot>
                        {campaign.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-surface-500">{campaign.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-surface-400">
                      <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(campaign.start_date)} — {formatDate(campaign.end_date)}</span>
                      <span>Owner: {campaign.owner}</span>
                      <span>City: {campaign.city}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-4 lg:gap-6">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-surface-400 mb-0.5">
                        <Store className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-lg font-bold text-surface-800">{campaign.stats.businesses}</p>
                      <p className="text-[10px] text-surface-400 uppercase">Businesses</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-surface-400 mb-0.5">
                        <QrCode className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-lg font-bold text-surface-800">{campaign.stats.qr_scans.toLocaleString()}</p>
                      <p className="text-[10px] text-surface-400 uppercase">QR Scans</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-surface-400 mb-0.5">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-lg font-bold text-surface-800">{campaign.stats.stakeholders}</p>
                      <p className="text-[10px] text-surface-400 uppercase">Team</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-surface-400 mb-0.5">
                        <BarChart3 className="h-3.5 w-3.5" />
                      </div>
                      <p className="text-lg font-bold text-surface-800">{campaign.stats.materials}</p>
                      <p className="text-[10px] text-surface-400 uppercase">Materials</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
