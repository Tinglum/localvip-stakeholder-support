'use client'

import * as React from 'react'
import Link from 'next/link'
import { Network, TrendingUp } from 'lucide-react'
import { NetworkTreeView } from '@/components/network/network-tree-view'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function MyNetworkPage() {
  const [refreshKey, setRefreshKey] = React.useState(0)

  return (
    <div className="space-y-8">
      <PageHeader
        title="My Network"
        description="See the people connected to you and the spend flowing through your network over time."
        actions={
          <Button variant="outline" onClick={() => setRefreshKey((value) => value + 1)}>
            <TrendingUp className="h-4 w-4" /> Refresh
          </Button>
        }
      />

      <Card className="border-brand-100 bg-brand-50/60">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-surface-900">Start here</p>
            <p className="text-sm leading-6 text-surface-600">
              This page shows your people in levels. Level 1 means people directly connected to you. Higher levels are
              people connected through them.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href="/portal/me">Back to my home</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/me/wallet">Check my money</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Network className="h-4 w-4 text-surface-400" />
            What the numbers mean
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm leading-6 text-surface-600">
          <p><strong className="text-surface-900">Level 1:</strong> people directly connected to you.</p>
          <p><strong className="text-surface-900">Level 2 and above:</strong> people connected through someone else in your network.</p>
          <p><strong className="text-surface-900">Spend:</strong> tracked transaction value tied to each person in the network.</p>
          <p className="rounded-xl bg-surface-50 px-3 py-2 text-xs text-surface-500">
            Start with Level 1 if you only want the most direct view, then expand deeper levels only when you need them.
          </p>
        </CardContent>
      </Card>

      <NetworkTreeView key={refreshKey} fetchUrl="/api/portal/me/network" nodeLabel="person" />
    </div>
  )
}
