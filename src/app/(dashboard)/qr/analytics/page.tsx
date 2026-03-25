'use client'

import * as React from 'react'
import { QrCode, BarChart3, TrendingUp, Eye, MousePointer, Users } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BRANDS } from '@/lib/constants'

const TOP_QR_STATS = [
  { label: 'Total Scans', value: 8421, change: 28.3, icon: <MousePointer className="h-5 w-5" /> },
  { label: 'Unique Visitors', value: 5234, change: 22.1, icon: <Users className="h-5 w-5" /> },
  { label: 'Top QR Code', value: 'Main Street Campaign', icon: <QrCode className="h-5 w-5" />, format: 'raw' as const },
  { label: 'Avg Scans/Code', value: 156, change: 15.4, icon: <BarChart3 className="h-5 w-5" /> },
]

const QR_PERFORMANCE = [
  { name: 'Main Street Campaign', brand: 'localvip', scans: 1420, unique: 890, conversions: 82, rate: 5.8 },
  { name: 'HATO School Flyer', brand: 'hato', scans: 890, unique: 545, conversions: 45, rate: 5.1 },
  { name: "Jordan's Referral Link", brand: 'localvip', scans: 720, unique: 480, conversions: 38, rate: 5.3 },
  { name: 'Atlanta Launch Poster', brand: 'localvip', scans: 654, unique: 412, conversions: 28, rate: 4.3 },
  { name: 'Business One-Pager QR', brand: 'localvip', scans: 542, unique: 320, conversions: 22, rate: 4.1 },
  { name: 'HATO Donation Poster', brand: 'hato', scans: 498, unique: 310, conversions: 18, rate: 3.6 },
  { name: 'Volunteer Table Tent', brand: 'localvip', scans: 312, unique: 198, conversions: 12, rate: 3.8 },
  { name: 'Alex Business Card', brand: 'localvip', scans: 234, unique: 156, conversions: 8, rate: 3.4 },
]

const DAILY_SCANS = [
  { day: 'Mon', scans: 180 },
  { day: 'Tue', scans: 220 },
  { day: 'Wed', scans: 195 },
  { day: 'Thu', scans: 310 },
  { day: 'Fri', scans: 280 },
  { day: 'Sat', scans: 145 },
  { day: 'Sun', scans: 120 },
]

export default function QrAnalyticsPage() {
  const [dateRange, setDateRange] = React.useState('30d')

  return (
    <div className="space-y-8">
      <PageHeader
        title="QR Code Analytics"
        description="See which QR codes drive scans, visits, and conversions."
        actions={
          <select
            value={dateRange}
            onChange={e => setDateRange(e.target.value)}
            className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {TOP_QR_STATS.map((stat, idx) => (
          <StatCard key={idx} label={stat.label} value={stat.value} change={stat.change} icon={stat.icon} format={stat.format || 'number'} />
        ))}
      </div>

      {/* Weekly scan chart */}
      <Card>
        <CardHeader><CardTitle>Scans This Week</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 h-32">
            {DAILY_SCANS.map((d, idx) => {
              const max = Math.max(...DAILY_SCANS.map(x => x.scans))
              const height = (d.scans / max) * 100
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-surface-500">{d.scans}</span>
                  <div className="w-full flex items-end justify-center" style={{ height: '90px' }}>
                    <div className="w-full max-w-[36px] rounded-t-md bg-brand-500 hover:bg-brand-600 transition-colors" style={{ height: `${height}%` }} />
                  </div>
                  <span className="text-xs text-surface-400">{d.day}</span>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* QR performance table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>QR Code Performance</CardTitle>
            <Badge variant="default">{QR_PERFORMANCE.length} QR codes</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>QR Code</th>
                  <th>Brand</th>
                  <th className="text-right">Total Scans</th>
                  <th className="text-right">Unique</th>
                  <th className="text-right">Conversions</th>
                  <th className="text-right">Conv. Rate</th>
                </tr>
              </thead>
              <tbody>
                {QR_PERFORMANCE.map((qr, idx) => (
                  <tr key={idx}>
                    <td className="font-medium text-surface-800">{qr.name}</td>
                    <td><Badge variant={qr.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[qr.brand as keyof typeof BRANDS].label}</Badge></td>
                    <td className="text-right font-medium">{qr.scans.toLocaleString()}</td>
                    <td className="text-right">{qr.unique.toLocaleString()}</td>
                    <td className="text-right">{qr.conversions}</td>
                    <td className="text-right"><Badge variant="success">{qr.rate}%</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
