'use client'

/**
 * Money panel for the business dashboard.
 *
 * Reads `/api/business-portal/stripe-summary`, which proxies the backend's
 * StripeConnect summary. That route is deliberately failure-proof, so this
 * component only ever sees three shapes: unavailable, not-connected, connected.
 * Unavailable renders a quiet placeholder, never an error.
 *
 * There is no lifetime-volume figure upstream — "Last 30 days" is the only
 * volume this panel can honestly show.
 */

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, ChevronDown, ChevronRight, CreditCard, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn, formatDate } from '@/lib/utils'

interface StripePayment {
  id: string
  amount: number
  currency: string
  created: string
  customerName: string | null
  status: string
}

interface StripeSummary {
  connected?: boolean
  unavailable?: boolean
  currency?: string
  availableBalance?: number
  pendingBalance?: number
  nextPayoutAmount?: number | null
  nextPayoutDate?: string | null
  last30DaysVolume?: number
  last30DaysCount?: number
  recentPayments?: StripePayment[]
}

function formatMoney(value: number | null | undefined, currency = 'USD') {
  const amount = typeof value === 'number' && Number.isFinite(value) ? value : 0
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD' }).format(amount)
  } catch {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }
}

export function StripeFinancialCard() {
  const [summary, setSummary] = React.useState<StripeSummary | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [openPaymentId, setOpenPaymentId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/business-portal/stripe-summary', { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: StripeSummary | null) => {
        if (cancelled) return
        setSummary(json && typeof json === 'object' ? json : { unavailable: true })
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setSummary({ unavailable: true })
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const currency = summary?.currency || 'USD'
  const payments = summary?.recentPayments || []

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-surface-400" />
            Your money
          </CardTitle>
          {summary?.connected ? <Badge variant="success">Stripe connected</Badge> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-surface-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Checking your payment account...
          </p>
        ) : !summary || summary.unavailable ? (
          <QuietPlaceholder body="Payment figures aren't available yet. They will appear here automatically once payouts are reporting." />
        ) : !summary.connected ? (
          <div className="space-y-3">
            <QuietPlaceholder body="Connect your business to Stripe and your balance, next payout, and recent payments will show up here." />
            <Button variant="outline" size="sm" asChild>
              <Link href="/portal/setup">
                Finish payment setup
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <MoneyFact label="Available now" value={formatMoney(summary.availableBalance, currency)} />
              <MoneyFact label="Pending" value={formatMoney(summary.pendingBalance, currency)} />
              <MoneyFact
                label="Next payout"
                value={formatMoney(summary.nextPayoutAmount, currency)}
                detail={summary.nextPayoutDate ? `Expected ${formatDate(summary.nextPayoutDate)}` : 'No payout scheduled'}
              />
              <MoneyFact
                label="Last 30 days"
                value={formatMoney(summary.last30DaysVolume, currency)}
                detail={`${summary.last30DaysCount ?? 0} successful ${summary.last30DaysCount === 1 ? 'payment' : 'payments'}`}
              />
            </div>

            {payments.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">Recent payments</p>
                {payments.slice(0, 4).map((payment) => (
                  <PaymentRow
                    key={payment.id}
                    payment={payment}
                    currency={currency}
                    open={openPaymentId === payment.id}
                    onToggle={() => setOpenPaymentId((current) => (current === payment.id ? null : payment.id))}
                  />
                ))}
              </div>
            ) : (
              <p className="text-sm text-surface-500">No payments have come through yet.</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function QuietPlaceholder({ body }: { body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-surface-300 bg-surface-50 px-4 py-4">
      <p className="text-sm leading-6 text-surface-500">{body}</p>
    </div>
  )
}

function MoneyFact({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-surface-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-surface-500">{detail}</p> : null}
    </div>
  )
}

// Stripe sends succeeded, pending and failed charges in this list, but only
// succeeded ones count toward the 30-day total. A failed payment must never
// read as money received, so the row carries its own status.
function paymentTone(status: string) {
  const value = (status || '').toLowerCase()
  if (value === 'succeeded') {
    return { label: 'Paid', showBadge: false, badgeClass: '', amountClass: 'text-success-700' }
  }
  if (value === 'failed') {
    return {
      label: 'Failed',
      showBadge: true,
      badgeClass: 'bg-danger-50 text-danger-700',
      amountClass: 'text-surface-400 line-through',
    }
  }
  return {
    label: value === 'pending' ? 'Pending' : status || 'Unknown',
    showBadge: true,
    badgeClass: 'bg-warning-50 text-warning-700',
    amountClass: 'text-surface-600',
  }
}

function PaymentRow({
  payment,
  currency,
  open,
  onToggle,
}: {
  payment: StripePayment
  currency: string
  open: boolean
  onToggle: () => void
}) {
  const panelId = `stripe-payment-${payment.id}`
  const who = payment.customerName || 'Customer payment'
  const tone = paymentTone(payment.status)

  return (
    <div className="overflow-hidden rounded-2xl border border-surface-200 bg-surface-50">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${open ? 'Hide' : 'Show'} details for the ${tone.label.toLowerCase()} payment from ${who}`}
        className={cn(
          'flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors',
          'hover:bg-surface-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
          open && 'bg-surface-100',
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-surface-900">{who}</p>
          <p className="text-xs text-surface-500">{payment.created ? formatDate(payment.created) : 'Date pending'}</p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {tone.showBadge ? (
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', tone.badgeClass)}>{tone.label}</span>
          ) : null}
          <span className={cn('text-sm font-semibold', tone.amountClass)}>
            {formatMoney(payment.amount, payment.currency || currency)}
          </span>
          {open ? <ChevronDown className="h-4 w-4 text-surface-400" /> : <ChevronRight className="h-4 w-4 text-surface-400" />}
        </div>
      </button>
      {open ? (
        <div id={panelId} className="border-t border-surface-200 bg-surface-0 px-4 py-3 text-sm text-surface-600">
          <p>
            Status: <span className="font-medium text-surface-900">{payment.status}</span>
          </p>
          <p className="mt-1 break-all text-xs text-surface-500">Reference: {payment.id}</p>
        </div>
      ) : null}
    </div>
  )
}
