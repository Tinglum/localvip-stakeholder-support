'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Clock3, Rocket } from 'lucide-react'
import {
  CAUSE_ACCOUNT_STEPS,
  isCauseSetupStepComplete,
  type CauseSetupSignals,
} from '@/lib/cause-setup'

/**
 * Home-page nudge into /community/setup. Account progress only (it is what
 * gates going live); hidden once the cause is live.
 */
export function CauseSetupPrompt({ causeId }: { causeId: string | null }) {
  const [detail, setDetail] = React.useState<Record<string, unknown> | null>(null)

  React.useEffect(() => {
    if (!causeId) return
    let cancelled = false
    fetch(`/api/qa/nonprofits/${causeId}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch(() => { /* the prompt is optional; stay hidden */ })
    return () => { cancelled = true }
  }, [causeId])

  if (!detail) return null
  const t = (k: string) => (typeof detail[k] === 'string' ? (detail[k] as string) : '')
  const signals = {
    name: t('name'), category: t('category'), headline: t('headline'), city: t('city'),
    email: t('ownerEmail'), phone: t('ownerPhone'), referralCode: t('referralCode'),
    crmStage: t('crmStage'), crmStatus: t('crmStatus'),
  } as CauseSetupSignals
  if (signals.crmStage.toLowerCase() === 'live') return null

  const pending = signals.crmStatus === 'pending_live_review'
  const done = CAUSE_ACCOUNT_STEPS.filter((s) => isCauseSetupStepComplete(s.key, signals)).length
  const total = CAUSE_ACCOUNT_STEPS.length

  return (
    <Link href="/community/setup"
      className="group flex items-center gap-4 rounded-2xl border border-brand-200 bg-gradient-to-r from-brand-50 via-white to-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-600 text-white">
        {pending ? <Clock3 className="h-5 w-5" /> : <Rocket className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-surface-950">{pending ? 'LocalVIP is reviewing your account' : 'Finish setting up your account'}</p>
        <p className="mt-0.5 text-sm text-surface-600">
          {pending
            ? 'While you wait, get your logo, colors and flyers ready to promote.'
            : `${done} of ${total} steps done. Finish them to go live.`}
        </p>
      </div>
      <span className="hidden items-center gap-1 text-sm font-semibold text-brand-700 sm:inline-flex">
        {pending ? 'Brand & materials' : 'Continue setup'}
        <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  )
}
