'use client'

import * as React from 'react'
import { MapPin, Plus, Store, Heart, Users, QrCode } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'

const DEMO_CITIES = [
  { id: 'city-001', name: 'Atlanta', state: 'GA', businesses: 34, causes: 8, stakeholders: 42, qr_scans: 4200, status: 'active' },
  { id: 'city-002', name: 'Charlotte', state: 'NC', businesses: 8, causes: 3, stakeholders: 12, qr_scans: 980, status: 'active' },
  { id: 'city-003', name: 'Nashville', state: 'TN', businesses: 5, causes: 2, stakeholders: 8, qr_scans: 620, status: 'active' },
  { id: 'city-004', name: 'Birmingham', state: 'AL', businesses: 3, causes: 2, stakeholders: 6, qr_scans: 340, status: 'active' },
  { id: 'city-005', name: 'Savannah', state: 'GA', businesses: 0, causes: 0, stakeholders: 0, qr_scans: 0, status: 'pending' },
]

export default function CitiesPage() {
  return (
    <div>
      <PageHeader
        title="Cities & Markets"
        description="Track expansion by city. See business density, stakeholder coverage, and QR performance."
        actions={<Button><Plus className="h-4 w-4" /> Add City</Button>}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DEMO_CITIES.map(city => (
          <Card key={city.id} className="group transition-shadow hover:shadow-card-hover">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-brand-500" />
                  <h3 className="text-lg font-semibold text-surface-900">{city.name}, {city.state}</h3>
                </div>
                <Badge variant={city.status === 'active' ? 'success' : 'warning'} dot>{city.status}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Store className="h-4 w-4 text-surface-400" />
                  <span className="font-medium text-surface-700">{city.businesses}</span>
                  <span className="text-surface-400">businesses</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Heart className="h-4 w-4 text-surface-400" />
                  <span className="font-medium text-surface-700">{city.causes}</span>
                  <span className="text-surface-400">causes</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Users className="h-4 w-4 text-surface-400" />
                  <span className="font-medium text-surface-700">{city.stakeholders}</span>
                  <span className="text-surface-400">team</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <QrCode className="h-4 w-4 text-surface-400" />
                  <span className="font-medium text-surface-700">{city.qr_scans.toLocaleString()}</span>
                  <span className="text-surface-400">scans</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
