'use client'
import * as React from 'react'
import { Button } from '@/components/ui/button'

export function StripeDashboardButton({ businessId }: { businessId: string }) {
  const [opening, setOpening] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  async function openDashboard() {
    setOpening(true)
    setError(null)
    try {
      const response = await fetch(`/api/business-portal/stripe-dashboard?businessId=${encodeURIComponent(businessId)}`, { method: 'POST', cache: 'no-store' })
      const payload = await response.json()
      if (!response.ok || !payload.url) throw new Error(payload.error || 'Could not open Stripe.')
      const url = new URL(payload.url)
      if (url.protocol !== 'https:' || (url.hostname !== 'stripe.com' && !url.hostname.endsWith('.stripe.com'))) throw new Error('Invalid Stripe link.')
      window.location.assign(url.href)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not open Stripe.')
      setOpening(false)
    }
  }
  return <div className="mt-4"><Button onClick={() => void openDashboard()} disabled={opening}>{opening ? 'Opening Stripe…' : 'Open Stripe dashboard'}</Button>{error ? <p role="alert" className="mt-2 text-sm text-red-700">{error}</p> : null}</div>
}
