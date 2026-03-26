'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Heart,
  Loader2,
  MapPin,
  Megaphone,
  Plus,
  Search,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getEntityTheme } from '@/lib/entity-themes'
import {
  useBusinesses,
  useCampaigns,
  useCauses,
  useCities,
  useCityInsert,
  useOutreach,
  useProfiles,
} from '@/lib/supabase/hooks'
import type { City, EntityStatus } from '@/lib/types/database'

const businessTheme = getEntityTheme('business')
const causeTheme = getEntityTheme('cause')

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
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Atlanta" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">State</label>
            <Input value={state} onChange={e => setState(e.target.value)} placeholder="e.g. GA" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">Country</label>
            <Input value={country} onChange={e => setCountry(e.target.value)} placeholder="e.g. US" required />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-surface-700">Status</label>
            <Select value={status} onValueChange={value => setStatus(value as EntityStatus)}>
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

export default function CitiesPage() {
  const { data: cities, loading, error, refetch } = useCities()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()
  const { data: campaigns } = useCampaigns()
  const { data: profiles } = useProfiles()
  const { data: outreach } = useOutreach()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const filteredCities = React.useMemo(() => {
    if (!search) return cities
    const query = search.toLowerCase()
    return cities.filter(city =>
      city.name.toLowerCase().includes(query)
      || (city.state || '').toLowerCase().includes(query)
      || city.country.toLowerCase().includes(query)
    )
  }, [cities, search])

  const totals = React.useMemo(() => ({
    cities: cities.length,
    businesses: businesses.length,
    causes: causes.length,
    campaigns: campaigns.length,
  }), [businesses.length, campaigns.length, causes.length, cities.length])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading city progress...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cities & Markets"
        description="See how each city is progressing across businesses, schools, causes, campaigns, and team coverage."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" /> Add City
          </Button>
        }
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-gradient-to-r from-surface-100 via-white to-surface-50 px-6 py-6">
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Cities</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900">{totals.cities}</p>
            </div>
            <div className={`rounded-2xl px-4 py-3 ring-1 ${businessTheme.ring} bg-white`}>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Businesses</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900">{totals.businesses}</p>
            </div>
            <div className={`rounded-2xl px-4 py-3 ring-1 ${causeTheme.ring} bg-white`}>
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Schools / Causes</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900">{totals.causes}</p>
            </div>
            <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-surface-200">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Campaigns</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900">{totals.campaigns}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search cities..."
          className="pl-9"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-danger-200 bg-danger-50 p-4 text-sm text-danger-700">
          Failed to load cities: {error}
        </div>
      )}

      {!error && filteredCities.length === 0 && (
        <EmptyState
          icon={<MapPin className="h-8 w-8" />}
          title="No cities yet"
          description="Add your first city to start tracking market expansion."
          action={{ label: 'Add City', onClick: () => setDialogOpen(true) }}
        />
      )}

      {!error && filteredCities.length > 0 && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {filteredCities.map(city => {
            const cityBusinesses = businesses.filter(business => business.city_id === city.id)
            const cityCauses = causes.filter(cause => cause.city_id === city.id)
            const cityCampaigns = campaigns.filter(campaign => campaign.city_id === city.id)
            const cityProfiles = profiles.filter(profile => profile.city_id === city.id)
            const cityBusinessIds = new Set(cityBusinesses.map(business => business.id))
            const cityOutreach = outreach.filter(activity =>
              activity.entity_type === 'business' && cityBusinessIds.has(activity.entity_id)
            )

            return (
              <Link key={city.id} href={`/crm/cities/${city.id}`} className="block">
                <Card className="group h-full overflow-hidden border-surface-200 transition-shadow hover:shadow-card-hover">
                  <div className="bg-gradient-to-r from-surface-50 via-white to-surface-100 px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-3">
                          <div className="rounded-2xl bg-surface-900 p-2 text-white">
                            <MapPin className="h-4 w-4" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-surface-900 transition-colors group-hover:text-brand-700">
                              {city.name}, {city.state}
                            </h3>
                            <p className="text-sm text-surface-500">Local progress snapshot</p>
                          </div>
                        </div>
                      </div>
                      <Badge variant={city.status === 'active' ? 'success' : 'warning'} dot>
                        {city.status}
                      </Badge>
                    </div>
                  </div>

                  <CardContent className="space-y-4 p-5">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className={`rounded-2xl border px-4 py-3 ${businessTheme.border} ${businessTheme.surface}`}>
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-amber-600" />
                          <p className="text-sm font-semibold text-surface-900">Businesses</p>
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-surface-900">{cityBusinesses.length}</p>
                        <p className="mt-1 text-xs text-surface-500">
                          {cityBusinesses.filter(business => business.stage === 'live').length} live, {cityBusinesses.filter(business => business.stage === 'in_progress').length} in progress
                        </p>
                      </div>
                      <div className={`rounded-2xl border px-4 py-3 ${causeTheme.border} ${causeTheme.surface}`}>
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4 text-pink-600" />
                          <p className="text-sm font-semibold text-surface-900">Schools / Causes</p>
                        </div>
                        <p className="mt-2 text-2xl font-semibold text-surface-900">{cityCauses.length}</p>
                        <p className="mt-1 text-xs text-surface-500">
                          {cityCauses.filter(cause => cause.type === 'school').length} schools, {cityCauses.filter(cause => cause.stage === 'onboarded' || cause.stage === 'live').length} active
                        </p>
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
                          <Megaphone className="h-3.5 w-3.5" />
                          Campaigns
                        </div>
                        <p className="mt-2 text-xl font-semibold text-surface-900">{cityCampaigns.length}</p>
                      </div>
                      <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
                          <Users className="h-3.5 w-3.5" />
                          Team
                        </div>
                        <p className="mt-2 text-xl font-semibold text-surface-900">{cityProfiles.length}</p>
                      </div>
                      <div className="rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
                        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-surface-500">
                          <TrendingUp className="h-3.5 w-3.5" />
                          Outreach
                        </div>
                        <p className="mt-2 text-xl font-semibold text-surface-900">{cityOutreach.length}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            )
          })}
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
