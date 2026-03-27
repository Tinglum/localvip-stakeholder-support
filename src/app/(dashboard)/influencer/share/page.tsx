'use client'

import { Megaphone } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function InfluencerSharePage() {
  return (
    <div className="space-y-8">
      <PageHeader title="Share LocalVIP" description="Use clear local language and one clean call to action when you share LocalVIP publicly." />
      <Card>
        <CardHeader>
          <CardTitle>Share guidance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            'Lead with the local impact, not the platform.',
            'Keep the message short enough to copy into a story, DM, or text.',
            'Use one main link or QR so the tracking stays clean.',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-700">
              <div className="flex items-center gap-2 font-medium text-surface-900">
                <Megaphone className="h-4 w-4" />
                {item}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
