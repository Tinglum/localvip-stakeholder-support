'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { Copy, ExternalLink, Network } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import type { Business } from '@/lib/types/database'

interface BusinessNetworkLinkCardProps {
  business: Business
}

// The LocalVIP network (node) referral — for inviting friends, causes, and other
// businesses to join LocalVIP under this business. Deliberately separate from the
// 100-list customer join link (which lives in the "My 100 list" view) so the
// business doesn't confuse the two.
export function BusinessNetworkLinkCard({ business }: BusinessNetworkLinkCardProps) {
  const [referralCode, setReferralCode] = React.useState<string>('')
  const [appReferralUrl, setAppReferralUrl] = React.useState<string>('')
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/business-portal/collect?businessId=${business.id}`)
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return
        setReferralCode(typeof data?.shortCode === 'string' ? data.shortCode : '')
        setAppReferralUrl(typeof data?.appReferralUrl === 'string' ? data.appReferralUrl : '')
      } catch {
        // leave blank — the card simply shows "not assigned yet"
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [business.id])

  async function copy(value: string, message: string) {
    try {
      await navigator.clipboard.writeText(value)
      toast.success(message)
    } catch {
      toast.error('Could not copy to clipboard.')
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="h-4 w-4 text-brand-600" /> Grow the LocalVIP network
        </CardTitle>
        <p className="text-sm leading-6 text-surface-500">
          Share this to invite friends, causes, and other businesses to join LocalVIP under you.
          This is <span className="font-medium">not</span> your customer 100-list link — you&apos;ll find
          that in <span className="font-medium">My 100 list</span>.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Your referral code</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="rounded border border-surface-200 bg-surface-50 px-2 py-1 text-sm font-semibold text-surface-900">
              {referralCode || (loading ? '…' : '—')}
            </code>
            {referralCode ? (
              <Button size="sm" variant="ghost" onClick={() => void copy(referralCode, 'Referral code copied')}>
                <Copy className="h-3.5 w-3.5" /> Copy
              </Button>
            ) : null}
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Join LocalVIP link</p>
          <div className="mt-1 flex items-center gap-2">
            <code className="flex-1 truncate rounded border border-surface-200 bg-surface-50 px-2 py-1 text-xs text-surface-700">
              {appReferralUrl || (loading ? '…' : '—')}
            </code>
            {appReferralUrl ? (
              <>
                <Button size="sm" variant="ghost" onClick={() => void copy(appReferralUrl, 'LocalVIP join link copied')}>
                  <Copy className="h-3.5 w-3.5" /> Copy
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={appReferralUrl} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                </Button>
              </>
            ) : null}
          </div>
          {!loading && !appReferralUrl ? (
            <p className="mt-1 text-[11px] text-surface-400">Your LocalVIP referral link isn&apos;t set up yet.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}
