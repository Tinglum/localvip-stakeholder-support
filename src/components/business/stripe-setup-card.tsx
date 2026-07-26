'use client'

import * as React from 'react'
import { CreditCard, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type SetupState = 'loading' | 'complete' | 'needed' | 'error'

// "Set up payments" gate — the first thing a business must do. Until the business
// has a completed Stripe Connect account it cannot receive customer payments, so
// this surfaces onboarding prominently at the top of the dashboard and sends the
// owner straight into Stripe's hosted onboarding.
export function StripeSetupCard({ businessId }: { businessId: string }) {
  const [state, setState] = React.useState<SetupState>('loading')
  const [starting, setStarting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    fetch(`/api/business-portal/stripe-onboarding?businessId=${encodeURIComponent(businessId)}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d?.error) { setError(d.error); setState('error'); return }
        if (d?.status === 'complete') { setState('complete'); return }
        setState('needed')
      })
      .catch(() => { if (!cancelled) { setError('Could not load Stripe setup right now.'); setState('error') } })
    return () => { cancelled = true }
  }, [businessId])

  async function startStripeSetup() {
    setStarting(true)
    setError(null)
    try {
      const response = await fetch(`/api/business-portal/stripe-onboarding?businessId=${encodeURIComponent(businessId)}`, { method: 'POST' })
      const payload = await response.json().catch(() => ({})) as { onboardingUrl?: string; error?: string }
      if (!response.ok || !payload.onboardingUrl) throw new Error(payload.error || 'Stripe setup could not be started.')
      window.location.assign(payload.onboardingUrl)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Stripe setup could not be started.')
      setStarting(false)
    }
  }

  // Hidden while checking and once payments are connected — it's only a gate.
  if (state === 'loading' || state === 'complete') return null

  return (
    <Card className="border-warning-300 bg-warning-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-warning-800">
          <CreditCard className="h-5 w-5" /> Set up payments to get paid
        </CardTitle>
        <p className="text-sm leading-6 text-warning-700">
          This is your first step. Before customers can pay you, connect your business to Stripe —
          it verifies your business and turns on payouts. It only takes a few minutes.
        </p>
      </CardHeader>
      <CardContent>
        {state === 'error' ? (
          <div className="flex items-center gap-2 text-sm text-warning-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {error || "Couldn't load Stripe setup right now. Refresh the page to try again."}
          </div>
        ) : (
          <Button
            onClick={() => void startStripeSetup()}
            disabled={starting}
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Start Stripe setup
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
