import { CheckCircle2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="System Settings"
        description="Manage the shared settings used across LocalVIP."
      />
      <Card className="max-w-2xl border-emerald-200 bg-emerald-50/60">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-emerald-950">
            <CheckCircle2 className="h-5 w-5 text-emerald-700" />
            Cause reporting uses totals
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-emerald-900">
          Monthly fundraising goals are turned off. Customer, cause, and admin views show the total amount raised instead.
        </CardContent>
      </Card>
    </div>
  )
}
