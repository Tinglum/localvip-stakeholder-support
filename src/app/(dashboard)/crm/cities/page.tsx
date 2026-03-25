'use client'

import * as React from 'react'
import { MapPin, Plus, Store, Heart, Users, Loader2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { useCities, useCityInsert, useCount } from '@/lib/supabase/hooks'
import type { City, EntityStatus } from '@/lib/types/database'

// ─── Per-city count component ────────────────────────────────

function CityStatCounts({ cityId }: { cityId: string }) {
  const businessCount = useCount('businesses', { city_id: cityId })
  const causeCount = useCount('causes', { city_id: cityId })
  const profileCount = useCount('profiles', { city_id: cityId })

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex items-center gap-2 text-sm">
        <Store className="h-4 w-4 text-surface-400" />
        <span className="font-medium text-surface-700">{businessCount}</span>
        <span className="text-surface-400">businesses</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Heart className="h-4 w-4 text-surface-400" />
        <span className="font-medium text-surface-700">{causeCount}</span>
        <span className="text-surface-400">causes</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <Users className="h-4 w-4 text-surface-400" />
        <span className="font-medium text-surface-700">{profileCount}</span>
        <span className="text-surface-400">team</span>
      </div>
    </div>
  )
}

// ─── Add City Dialog ─────────────────────────────────────────

function AddCityDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const { insert, loading, error } = useCityInsert()
  const [name, setName] = React.useState('')
  const [state, setState] = React.useState('')
  const [country, setCountry] = React.useState('US')
  const [status, setStatus] = React.useState<EntityStatus>('active')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const result = await insert({ name, state, country, status })
    if (result) {
      setName('')
      setState('')
      setCountry('US')
      setStatus('active')
      onOpenChange(false)
      onCreated()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add City</DialogTitle>
          <DialogDescription>Add a new city or market to track expansion.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">City Name</label>
            <Input
              placeholder="e.g. Atlanta"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">State</label>
            <Input
              placeholder="e.g. GA"
              value={state}
              onChange={(e) => setState(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">Country</label>
            <Input
              placeholder="e.g. US"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">Status</label>
            <Select value={status} onValueChange={(v) => setStatus(v as EntityStatus)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-danger-500">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !name || !state}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add City'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ─── Page ────────────────────────────────────────────────────

export default function CitiesPage() {
  const { data: cities, loading, error, refetch } = useCities()
  const [dialogOpen, setDialogOpen] = React.useState(false)

  return (
    <div>
      <PageHeader
        title="Cities & Markets"
        description="Track expansion by city. See business density, stakeholder coverage, and cause presence."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add City
          </Button>
        }
      />

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          Failed to load cities: {error}
        </div>
      )}

      {!loading && !error && cities.length === 0 && (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No cities yet"
          description="Add your first city to start tracking market expansion."
        />
      )}

      {!loading && !error && cities.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cities.map((city) => (
            <Card key={city.id} className="group transition-shadow hover:shadow-card-hover">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-brand-500" />
                    <h3 className="text-lg font-semibold text-surface-900">
                      {city.name}, {city.state}
                    </h3>
                  </div>
                  <Badge variant={city.status === 'active' ? 'success' : 'warning'} dot>
                    {city.status}
                  </Badge>
                </div>
                <CityStatCounts cityId={city.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AddCityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={refetch}
      />
    </div>
  )
}
