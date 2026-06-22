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
export function StripeSetupCard() {
  const [state, setState] = React.useState<SetupState>('loading')
  const [url, setUrl] = React.useState<string | null>(null)
  const [starting, setStarting] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    fetch('/api/business-portal/stripe-onboarding', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return
        if (d?.error) { setState('error'); return }
        if (d?.isOnboardingComplete) { setState('complete'); return }
        setUrl(typeof d?.onboardingUrl === 'string' ? d.onboardingUrl : null)
        setState('needed')
      })
      .catch(() => { if (!cancelled) setState('error') })
    return () => { cancelled = true }
  }, [])

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
            Couldn&apos;t load Stripe setup right now. Refresh the page to try again.
          </div>
        ) : (
          <Button
            onClick={() => { if (url) { setStarting(true); window.location.href = url } }}
            disabled={!url || starting}
          >
            {starting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
            Start Stripe setup
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
