'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Building2, Heart, Loader2, Store, Users, Wallet } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import {
  getActivationLabel,
  getActivationTone,
  getBusinessLaunchPhase,
  resolveScopedBusiness,
} from '@/lib/business-portal'
import { formatCashbackLabel, resolveBusinessOffer } from '@/lib/offers'
import { useBusinesses, useBusinessUpdate, useCauses, useContacts, useOffers } from '@/lib/supabase/hooks'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function BusinessProfilePage() {
  const { profile } = useAuth()
  const businessFilters = React.useMemo<Record<string, string>>(
    () => {
      const filters: Record<string, string> = {}
      if (profile.business_id) {
        filters.id = profile.business_id
      } else {
        filters.owner_id = profile.id
      }
      return filters
    },
    [profile.business_id, profile.id]
  )
  const { data: businesses, loading: businessLoading } = useBusinesses(businessFilters)
  const business = React.useMemo(() => resolveScopedBusiness(profile, businesses), [businesses, profile])
  const { data: contacts } = useContacts({ business_id: business?.id || '__none__' })
  const { data: offers } = useOffers({ business_id: business?.id || '__none__' })
  const { data: causes } = useCauses()
  const { update } = useBusinessUpdate()

  const [saveState, setSaveState] = React.useState<SaveState>('idle')
  const [saveError, setSaveError] = React.useState<string | null>(null)
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [avgTicket, setAvgTicket] = React.useState('')
  const [products, setProducts] = React.useState('')
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const savedSnapshotRef = React.useRef('')

  React.useEffect(() => {
    if (!business) return

    const nextName = business.name || ''
    const nextCategory = business.category || ''
    const nextDescription = business.public_description || ''
    const nextAvgTicket = business.avg_ticket || ''
    const nextProducts = (business.products_services || []).join(', ')

    setName(nextName)
    setCategory(nextCategory)
    setDescription(nextDescription)
    setAvgTicket(nextAvgTicket)
    setProducts(nextProducts)
    savedSnapshotRef.current = JSON.stringify({
      name: nextName,
      category: nextCategory,
      description: nextDescription,
      avgTicket: nextAvgTicket,
      products: nextProducts,
    })
    setSaveState('idle')
    setSaveError(null)
  }, [business])

  const persistChanges = React.useCallback(async () => {
    if (!business) return

    try {
      setSaveState('saving')
      setSaveError(null)

      const nextProducts = products
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)

      const saved = await update(business.id, {
        name: name.trim() || business.name,
        category: category.trim() || null,
        public_description: description.trim() || null,
        avg_ticket: avgTicket.trim() || null,
        products_services: nextProducts,
      })

      if (!saved) {
        throw new Error('Changes could not be saved.')
      }

      savedSnapshotRef.current = JSON.stringify({
        name,
        category,
        description,
        avgTicket,
        products,
      })
      setSaveState('saved')
    } catch (error) {
      setSaveState('error')
      setSaveError(error instanceof Error ? error.message : 'Changes could not be saved.')
    }
  }, [avgTicket, business, category, description, name, products, update])

  React.useEffect(() => {
    if (!business) return

    const nextSnapshot = JSON.stringify({
      name,
      category,
      description,
      avgTicket,
      products,
    })

    if (!savedSnapshotRef.current || nextSnapshot === savedSnapshotRef.current) return

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void persistChanges()
    }, 700)

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [avgTicket, business, category, description, name, persistChanges, products])

  if (businessLoading) {
    return (
      <div className="flex min-h-[55vh] items-center justify-center">
        <div className="flex items-center gap-3 rounded-2xl border border-surface-200 bg-white px-5 py-4 text-sm text-surface-500 shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading your business profile...
        </div>
      </div>
    )
  }

  if (!business) {
    return (
      <EmptyState
        icon={<Store className="h-8 w-8" />}
        title="Your business profile is almost ready"
        description="A business needs to be linked to this account before this page can load."
      />
    )
  }

  const captureOffer = resolveBusinessOffer(business, offers, 'capture')
  const cashbackOffer = resolveBusinessOffer(business, offers, 'cashback')
  const launchPhase = getBusinessLaunchPhase(business, contacts)
  const activationTone = getActivationTone(business.activation_status || (launchPhase === 'setup' ? 'not_started' : launchPhase === 'live' || launchPhase === 'ready_to_go_live' ? 'active' : 'in_progress'))
  const activationLabel = getActivationLabel(business.activation_status || (launchPhase === 'setup' ? 'not_started' : launchPhase === 'live' || launchPhase === 'ready_to_go_live' ? 'active' : 'in_progress'))
  const linkedCause = causes.find((cause) => cause.id === business.linked_cause_id) || null

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Business"
        description="Keep your profile clean, your launch status clear, and your customer-facing story easy to understand."
        actions={
          <div className="flex items-center gap-3">
            <Badge variant={activationTone} dot>
              {activationLabel}
            </Badge>
            <span className={`text-sm ${saveState === 'error' ? 'text-danger-600' : saveState === 'saved' ? 'text-success-600' : 'text-surface-500'}`}>
              {saveState === 'saving' ? 'Saving changes...' : saveState === 'saved' ? 'All changes saved' : saveState === 'error' ? 'Autosave failed' : 'Changes save automatically'}
            </span>
          </div>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard label="Launch phase" value={launchPhaseLabel(launchPhase)} detail="Progress through setup, customer capture, and going live." icon={<Building2 className="h-5 w-5" />} />
        <InfoCard label="Customer capture offer" value={captureOffer.value_label || captureOffer.headline} detail="Used to get your first 100 customers." icon={<Users className="h-5 w-5" />} />
        <InfoCard label="LocalVIP cashback" value={formatCashbackLabel(cashbackOffer.cashback_percent)} detail="Used to generate ongoing sales." icon={<Wallet className="h-5 w-5" />} />
        <InfoCard label="Linked cause or school" value={linkedCause?.name || 'Customer chooses later'} detail={linkedCause ? 'This legacy link stays internal.' : 'Businesses do not choose the cause in setup.'} icon={<Heart className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Business profile</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Business name</label>
              <Input value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Category</label>
              <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Restaurant, coffee shop, salon..." />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Average ticket</label>
              <Input value={avgTicket} onChange={(event) => setAvgTicket(event.target.value)} placeholder="$12, $25, $60..." />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={5} />
            </div>
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Products / services</label>
              <Input value={products} onChange={(event) => setProducts(event.target.value)} placeholder="Coffee, pastries, lunch, catering" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Offer separation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-amber-700">Customer Capture Offer (Pre-launch)</p>
                <p className="mt-2 text-lg font-semibold text-surface-900">{captureOffer.headline}</p>
                <p className="mt-2 text-sm leading-6 text-surface-600">{captureOffer.description}</p>
              </div>
              <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.16em] text-brand-700">LocalVIP Cashback (Live)</p>
                <p className="mt-2 text-lg font-semibold text-surface-900">{formatCashbackLabel(cashbackOffer.cashback_percent)}</p>
                <p className="mt-2 text-sm leading-6 text-surface-600">{cashbackOffer.description}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>What to do next</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ActionLink href="/portal/setup" title="Open setup flow" description="Finish branding, capture offer, cashback, and activation." />
              <ActionLink href="/portal/clients" title="Open My 100 List" description="Collect customers through your QR and build toward 100." />
              <ActionLink href="/portal/grow" title="Grow with other businesses" description="Invite nearby businesses into the network with simple share copy." />
            </CardContent>
          </Card>
        </div>
      </div>

      {saveError && (
        <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {saveError}
        </div>
      )}
    </div>
  )
}

function InfoCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string
  value: React.ReactNode
  detail: string
  icon: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-surface-900">{value}</p>
          </div>
          <div className="rounded-2xl bg-surface-100 p-3 text-surface-600">{icon}</div>
        </div>
        <p className="text-sm text-surface-500">{detail}</p>
      </CardContent>
    </Card>
  )
}

function ActionLink({
  href,
  title,
  description,
}: {
  href: string
  title: string
  description: string
}) {
  return (
    <Link href={href} className="flex items-start justify-between gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-surface-300 hover:bg-surface-0">
      <div>
        <p className="text-sm font-semibold text-surface-900">{title}</p>
        <p className="mt-1 text-xs text-surface-500">{description}</p>
      </div>
      <Button variant="ghost" size="icon" className="shrink-0">
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  )
}

function launchPhaseLabel(value: string) {
  switch (value) {
    case 'capturing_100':
      return 'Capturing 100'
    case 'ready_to_go_live':
      return 'Ready To Go Live'
    case 'live':
      return 'Live'
    default:
      return 'Setup'
  }
}
