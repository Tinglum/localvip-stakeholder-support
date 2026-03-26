'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Store,
  Globe,
  MessageSquare,
  StickyNote,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BRANDS, ONBOARDING_STAGES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import {
  useBusinesses,
  useCauses,
  useCities,
  useNotes,
  useOutreach,
  useProfiles,
} from '@/lib/supabase/hooks'
import type { Cause } from '@/lib/types/database'

function getStageBadgeVariant(stage: string) {
  switch (stage) {
    case 'contacted':
    case 'interested':
      return 'info' as const
    case 'in_progress':
      return 'warning' as const
    case 'onboarded':
    case 'live':
      return 'success' as const
    case 'paused':
      return 'warning' as const
    case 'declined':
      return 'danger' as const
    default:
      return 'default' as const
  }
}

export default function CauseDetailPage() {
  const params = useParams()
  const causeId = params.id as string
  const { data: causes, loading } = useCauses()
  const { data: cities } = useCities()
  const { data: profiles } = useProfiles()
  const { data: businesses } = useBusinesses()
  const { data: outreach } = useOutreach()
  const { data: notes } = useNotes()

  const cause = causes.find(item => item.id === causeId) as Cause | undefined
  const city = cities.find(item => item.id === cause?.city_id)
  const owner = profiles.find(item => item.id === cause?.owner_id)
  const linkedBusinesses = businesses.filter(item => item.linked_cause_id === causeId)
  const causeOutreach = outreach.filter(item => item.entity_type === 'cause' && item.entity_id === causeId).slice(0, 8)
  const causeNotes = notes.filter(item => item.entity_type === 'cause' && item.entity_id === causeId).slice(0, 8)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        <span className="ml-2 text-sm text-surface-500">Loading cause...</span>
      </div>
    )
  }

  if (!cause) {
    return (
      <EmptyState
        icon={<Heart className="h-8 w-8" />}
        title="Cause not found"
        description="This cause record could not be loaded."
      />
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={cause.name}
        description="Cause profile, local business connections, and recent CRM activity."
        breadcrumb={[
          { label: 'CRM', href: '/crm/causes' },
          { label: 'Causes', href: '/crm/causes' },
          { label: cause.name },
        ]}
      />

      <Card className="overflow-hidden border-pink-200">
        <div className="bg-gradient-to-r from-pink-50 via-white to-rose-50 px-6 py-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={cause.brand === 'hato' ? 'hato' : 'info'}>
                  {BRANDS[cause.brand].label}
                </Badge>
                <Badge variant={getStageBadgeVariant(cause.stage)} dot>
                  {ONBOARDING_STAGES[cause.stage].label}
                </Badge>
                <Badge variant={cause.status === 'active' ? 'success' : 'default'} dot>
                  {cause.status}
                </Badge>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
                {city && (
                  <Link href={`/crm/cities/${city.id}`} className="inline-flex items-center gap-1 hover:text-surface-900">
                    <MapPin className="h-4 w-4" /> {city.name}, {city.state}
                  </Link>
                )}
                {owner && (
                  <Link href={`/admin/users/${owner.id}`} className="inline-flex items-center gap-1 hover:text-surface-900">
                    <Heart className="h-4 w-4" /> {owner.full_name}
                  </Link>
                )}
                <span className="capitalize">{cause.type}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-pink-100">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Businesses</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{linkedBusinesses.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-pink-100">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Outreach</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{causeOutreach.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-pink-100">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Notes</p>
                <p className="mt-1 text-2xl font-semibold text-surface-900">{causeNotes.length}</p>
              </div>
              <div className="rounded-2xl bg-white px-4 py-3 ring-1 ring-pink-100">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Created</p>
                <p className="mt-1 text-lg font-semibold text-surface-900">{formatDate(cause.created_at)}</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-pink-600" />
              <p className="text-sm font-semibold text-surface-900">Profile</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Email</p>
                <p className="mt-2 text-sm text-surface-800">
                  {cause.email ? <a href={`mailto:${cause.email}`} className="inline-flex items-center gap-1 hover:text-surface-900"><Mail className="h-4 w-4" /> {cause.email}</a> : 'Not provided'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Phone</p>
                <p className="mt-2 text-sm text-surface-800">
                  {cause.phone ? <a href={`tel:${cause.phone}`} className="inline-flex items-center gap-1 hover:text-surface-900"><Phone className="h-4 w-4" /> {cause.phone}</a> : 'Not provided'}
                </p>
              </div>
              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 sm:col-span-2">
                <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Website</p>
                <p className="mt-2 text-sm text-surface-800">
                  {cause.website ? (
                    <a
                      href={cause.website.startsWith('http') ? cause.website : `https://${cause.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-surface-900"
                    >
                      <Globe className="h-4 w-4" /> {cause.website}
                    </a>
                  ) : 'Not provided'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <Store className="h-4 w-4 text-amber-600" />
              <p className="text-sm font-semibold text-surface-900">Linked Businesses</p>
            </div>
            {linkedBusinesses.length > 0 ? (
              <div className="space-y-3">
                {linkedBusinesses.map(business => (
                  <Link key={business.id} href={`/crm/businesses/${business.id}`} className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-white">
                    <p className="font-medium text-surface-900">{business.name}</p>
                    <p className="text-sm text-surface-500">{business.category || 'Business record'}</p>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No businesses linked to this cause yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Recent Outreach</p>
            </div>
            {causeOutreach.length > 0 ? (
              <div className="space-y-3">
                {causeOutreach.map(activity => (
                  <div key={activity.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-medium text-surface-900">{activity.subject || activity.type.replace('_', ' ')}</p>
                      <Badge variant="default">{activity.type.replace('_', ' ')}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-surface-500">{activity.body || activity.outcome || 'No detail captured.'}</p>
                    <p className="mt-2 text-xs text-surface-400">{formatDate(activity.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No outreach logged for this cause yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-surface-500" />
              <p className="text-sm font-semibold text-surface-900">Recent Notes</p>
            </div>
            {causeNotes.length > 0 ? (
              <div className="space-y-3">
                {causeNotes.map(note => (
                  <div key={note.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                    <p className="text-sm text-surface-700">{note.content}</p>
                    <p className="mt-2 text-xs text-surface-400">{formatDate(note.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-400">No notes saved for this cause yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
