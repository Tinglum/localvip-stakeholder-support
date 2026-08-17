'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'

type RiskReport = { unavailable?: boolean; activeCases?: number; exposureCents?: number }

export function PaymentRiskAlert() {
  const { isAdmin } = useAuth()
  const [report, setReport] = React.useState<RiskReport | null>(null)

  React.useEffect(() => {
    if (!isAdmin) return
    fetch('/api/admin/payment-risk', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : null)
      .then((value) => setReport(value && typeof value === 'object' ? value : { unavailable: true }))
      .catch(() => setReport({ unavailable: true }))
  }, [isAdmin])

  if (!isAdmin || !report || report.unavailable || !report.activeCases) return null
  const exposure = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format((report.exposureCents ?? 0) / 100)
  return (
    <section className="rounded-[2rem] border-2 border-danger-300 bg-danger-50 p-6 text-danger-950 shadow-sm">
      <div className="flex items-start gap-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-danger-100">
          <AlertTriangle className="h-6 w-6" />
        </span>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-danger-700">Payment risk</p>
          <h2 className="mt-1 text-xl font-bold">{report.activeCases} unresolved payment {report.activeCases === 1 ? 'case' : 'cases'}</h2>
          <p className="mt-2 text-sm leading-6">Current unrecovered business exposure: {exposure}. Review Stripe recovery before approving or relying on payouts.</p>
        </div>
      </div>
    </section>
  )
}
