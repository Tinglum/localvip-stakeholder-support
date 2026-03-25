'use client'

import * as React from 'react'
import { FileText, Download, Eye, ArrowRight, Sparkles } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { useAuth } from '@/lib/auth/context'
import { BRANDS, ROLES } from '@/lib/constants'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'

const MY_MATERIALS = [
  {
    id: '1', title: 'LocalVIP Business One-Pager', type: 'one_pager', brand: 'localvip',
    description: 'Hand this to any business owner.', file_name: 'localvip-business-onepager.pdf',
    assigned_at: '2024-03-01',
  },
  {
    id: '3', title: 'Business Outreach Script', type: 'script', brand: 'localvip',
    description: 'Step-by-step cold call/visit script.', file_name: 'outreach-script.pdf',
    assigned_at: '2024-03-01',
  },
  {
    id: '8', title: 'Business Follow-Up Email', type: 'email_template', brand: 'localvip',
    description: 'Follow-up after initial meeting.', file_name: 'business-followup-email.html',
    assigned_at: '2024-03-10',
  },
]

export default function MyMaterialsPage() {
  const { profile } = useAuth()

  return (
    <div>
      <PageHeader
        title="My Materials"
        description="Your assigned marketing materials and outreach tools. Download what you need."
        actions={
          <Link href="/materials/library">
            <Button variant="outline">
              Browse Library <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        }
      />

      {/* Recommended action */}
      <Card className="mb-6 border-l-4 border-l-brand-500">
        <CardContent className="flex items-center gap-4 py-4">
          <div className="rounded-lg bg-brand-50 p-2.5 text-brand-600">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-surface-800">Ready for outreach?</p>
            <p className="text-xs text-surface-500">Download your outreach script and one-pager before visiting businesses.</p>
          </div>
          <Button size="sm">
            <Download className="h-3.5 w-3.5" /> Download Kit
          </Button>
        </CardContent>
      </Card>

      {MY_MATERIALS.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-8 w-8" />}
          title="No materials assigned yet"
          description="Your admin will assign materials to your toolkit. Check back soon."
          action={{ label: 'Browse Library', onClick: () => {} }}
        />
      ) : (
        <div className="space-y-3">
          {MY_MATERIALS.map(material => (
            <Card key={material.id} className="transition-shadow hover:shadow-card-hover">
              <CardContent className="flex items-center gap-4 py-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface-100 text-surface-400">
                  <FileText className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-surface-800">{material.title}</h3>
                  <p className="text-xs text-surface-500">{material.description}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variant={material.brand === 'hato' ? 'hato' : 'info'}>
                      {BRANDS[material.brand as keyof typeof BRANDS].label}
                    </Badge>
                    <span className="text-xs text-surface-400">
                      Assigned {formatDate(material.assigned_at)}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="ghost" size="icon-sm" title="Preview">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm">
                    <Download className="h-3.5 w-3.5" /> Download
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
