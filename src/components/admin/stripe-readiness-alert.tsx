'use client'

import * as React from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowRight, CheckCircle2, EyeOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/lib/auth/context'
import { formatDateTime } from '@/lib/utils'
import {
  classifyStripeBlock,
  sortByUrgency,
  stripeBlockDetail,
  stripeBlockLabel,
  STRIPE_READINESS_UNAVAILABLE,
  type StripeReadinessReport,
} from '@/lib/stripe-readiness'

const PREVIEW_COUNT = 6

/**
 * Admin-only alarm: businesses Stripe will not let take a payment are filtered
 * out of the consumer webapp, so every row here is a business no customer can
 * find. Rendered high on the admin dashboard because it is a revenue outage,
 * not a report.
 */
export function StripeReadinessAlert() {
  const { profile, isAdmin } = useAuth()
  const [report, setReport] = React.useState<StripeReadinessReport | null>(null)
  const [expanded, setExpanded] = React.useState(false)

  React.useEffect(() => {
    if (!isAdmin) return
    let cancelled = false

    fetch('/api/admin/stripe-readiness', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return
        setReport(json && typeof json === 'object' ? (json as StripeReadinessReport) : STRIPE_READINESS_UNAVAILABLE)
      })
      .catch(() => {
        if (!cancelled) setReport(STRIPE_READINESS_UNAVAILABLE)
      })

    return () => { cancelled = true }
  }, [isAdmin, profile.id])

  if (!isAdmin || !report) return null

  // No data is not good news — say so plainly rather than implying an all clear.
  if (report.unavailable) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <EyeOff className="h-4 w-4 shrink-0 text-surface-400" />
          <div>
            <p className="text-sm font-medium text-surface-700">Payment readiness check unavailable</p>
            <p className="text-xs text-surface-500">
              We could not reach Stripe Connect, so we cannot confirm which businesses customers can see.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const failing = sortByUrgency(report.businesses.filter((business) => !business.isReady))

  if (failing.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-4">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-500" />
          <div>
            <p className="text-sm font-medium text-surface-700">All businesses can accept payments</p>
            <p className="text-xs text-surface-500">
              {report.totalBusinesses} business{report.totalBusinesses === 1 ? '' : 'es'} cleared by Stripe
              {report.checkedOn ? ` · checked ${formatDateTime(report.checkedOn)}` : ''}.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const visible = expanded ? failing : failing.slice(0, PREVIEW_COUNT)

  return (
    <Card className="border-l-4 border-l-danger-500">
      <CardContent className="py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger-500" />
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-surface-900">
                  {failing.length} business{failing.length === 1 ? '' : 'es'} cannot accept payments
                </h3>
                <Badge variant="danger" dot>Hidden from customers</Badge>
              </div>
              <p className="max-w-2xl text-sm leading-6 text-surface-600">
                The app hides any business that cannot take a Stripe payment. These
                {failing.length === 1 ? ' one is' : ` ${failing.length} are`} invisible in the customer
                feed right now and earn nothing until Stripe clears them.
              </p>
            </div>
          </div>
          <div className="shrink-0 rounded-xl bg-danger-50 px-4 py-2 text-right">
            <p className="text-2xl font-semibold text-danger-700">{failing.length}</p>
            <p className="text-xs text-danger-700">of {report.totalBusinesses} hidden</p>
          </div>
        </div>

        <div className="mt-4 divide-y divide-surface-100 border-t border-surface-100">
          {visible.map((business) => {
            const kind = classifyStripeBlock(business)

            return (
              <Link
                key={business.accountId}
                href={`/crm/businesses/${business.accountId}`}
                className="group flex items-start gap-3 py-3 transition-colors hover:bg-surface-50"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-medium text-surface-900 group-hover:text-brand-700">
                      {business.businessName}
                    </p>
                    <Badge variant={kind === 'no_account' || kind === 'charges_disabled' ? 'danger' : 'warning'}>
                      {stripeBlockLabel(kind)}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-surface-500">
                    {business.ownerEmail || 'No owner email on file'}
                  </p>
                  <p className="text-xs leading-5 text-surface-600">{stripeBlockDetail(business, kind)}</p>
                </div>
                <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-surface-300 transition-colors group-hover:text-brand-500" />
              </Link>
            )
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-surface-400">
            {report.checkedOn ? `Stripe checked ${formatDateTime(report.checkedOn)}` : 'Live from Stripe Connect'}
          </p>
          {failing.length > PREVIEW_COUNT ? (
            <Button variant="outline" size="sm" onClick={() => setExpanded((value) => !value)}>
              {expanded ? 'Show fewer' : `Show all ${failing.length}`}
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
