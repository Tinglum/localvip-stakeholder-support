'use client'

import * as React from 'react'
import {
  TrendingUp, Store, Heart, QrCode, Users, Send,
  BarChart3, ArrowUpRight, ArrowDownRight, Minus,
  Download, Calendar, Filter,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'

// ─── Demo analytics data ────────────────────────────────────

const TOP_STATS = [
  { label: 'Businesses Onboarded', value: 34, change: 13.5, icon: <Store className="h-5 w-5" /> },
  { label: 'Causes Active', value: 12, change: 20.0, icon: <Heart className="h-5 w-5" /> },
  { label: 'QR Code Scans', value: 8421, change: 28.3, icon: <QrCode className="h-5 w-5" /> },
  { label: 'Active Stakeholders', value: 84, change: 15.2, icon: <Users className="h-5 w-5" /> },
  { label: 'Outreach Activities', value: 342, change: 8.7, icon: <Send className="h-5 w-5" /> },
  { label: 'Conversion Rate', value: 23.4, change: 2.1, icon: <TrendingUp className="h-5 w-5" />, format: 'percent' as const },
]

const TOP_PERFORMERS = [
  { name: 'Alex Rivera', role: 'Onboarding Partner', businesses: 12, scans: 845, signups: 23 },
  { name: 'Jordan Taylor', role: 'Influencer', businesses: 8, scans: 1240, signups: 45 },
  { name: 'Dr. Sarah Johnson', role: 'School Leader', businesses: 6, scans: 520, signups: 18 },
  { name: 'Casey Adams', role: 'Volunteer', businesses: 5, scans: 312, signups: 8 },
  { name: 'Marcus Williams', role: 'Cause Leader', businesses: 4, scans: 284, signups: 12 },
]

const TOP_QR_CODES = [
  { name: 'Main Street Campaign', scans: 1420, conversions: 82, rate: 5.8 },
  { name: 'HATO School Flyer QR', scans: 890, conversions: 45, rate: 5.1 },
  { name: "Jordan's Referral Link", scans: 720, conversions: 38, rate: 5.3 },
  { name: 'Atlanta Launch Poster', scans: 654, conversions: 28, rate: 4.3 },
  { name: 'Business One-Pager QR', scans: 542, conversions: 22, rate: 4.1 },
]

const CITY_PERFORMANCE = [
  { city: 'Atlanta', businesses: 18, causes: 5, scans: 3200, stakeholders: 32 },
  { city: 'Charlotte', businesses: 8, causes: 3, scans: 1800, stakeholders: 18 },
  { city: 'Nashville', businesses: 5, causes: 2, scans: 1420, stakeholders: 14 },
  { city: 'Birmingham', businesses: 3, causes: 2, scans: 890, stakeholders: 12 },
]

const CAMPAIGN_PERFORMANCE = [
  { name: 'Q1 Atlanta Launch', brand: 'localvip', businesses: 12, scans: 2100, status: 'active' },
  { name: 'HATO Spring Drive', brand: 'hato', businesses: 6, scans: 1450, status: 'active' },
  { name: 'Charlotte Pilot', brand: 'localvip', businesses: 8, scans: 980, status: 'active' },
  { name: 'Holiday Campaign', brand: 'localvip', businesses: 8, scans: 1890, status: 'completed' },
]

const MONTHLY_TREND = [
  { month: 'Oct', scans: 1200, businesses: 8, outreach: 45 },
  { month: 'Nov', scans: 1800, businesses: 12, outreach: 62 },
  { month: 'Dec', scans: 2400, businesses: 15, outreach: 78 },
  { month: 'Jan', scans: 2900, businesses: 18, outreach: 85 },
  { month: 'Feb', scans: 3600, businesses: 24, outreach: 98 },
  { month: 'Mar', scans: 4200, businesses: 34, outreach: 118 },
]

export default function AnalyticsPage() {
  const { isAdmin, profile } = useAuth()
  const [dateRange, setDateRange] = React.useState('30d')

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description={isAdmin
          ? 'System-wide performance. Identify what works, who produces, and where to focus.'
          : 'Your personal performance and impact metrics.'
        }
        actions={
          <div className="flex items-center gap-2">
            <select
              value={dateRange}
              onChange={e => setDateRange(e.target.value)}
              className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="ytd">Year to date</option>
              <option value="all">All time</option>
            </select>
            <Button variant="outline" size="sm">
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        }
      />

      {/* Top-level stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {TOP_STATS.map((stat, idx) => (
          <StatCard
            key={idx}
            label={stat.label}
            value={stat.value}
            change={stat.change}
            changePeriod="vs prev period"
            icon={stat.icon}
            format={stat.format || 'number'}
          />
        ))}
      </div>

      {/* Trend chart (visual representation) */}
      <Card>
        <CardHeader>
          <CardTitle>Growth Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-40">
            {MONTHLY_TREND.map((m, idx) => {
              const maxScans = Math.max(...MONTHLY_TREND.map(x => x.scans))
              const height = (m.scans / maxScans) * 100
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs text-surface-500 font-medium">{m.scans.toLocaleString()}</span>
                  <div className="w-full flex items-end justify-center" style={{ height: '120px' }}>
                    <div
                      className="w-full max-w-[40px] rounded-t-md bg-brand-500 transition-all hover:bg-brand-600"
                      style={{ height: `${height}%` }}
                    />
                  </div>
                  <span className="text-xs text-surface-400">{m.month}</span>
                </div>
              )
            })}
          </div>
          <div className="mt-4 flex items-center justify-center gap-6 text-xs text-surface-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> QR Scans
            </span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top Performers */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Top Performers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th className="text-right">Businesses</th>
                      <th className="text-right">QR Scans</th>
                      <th className="text-right">Signups</th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOP_PERFORMERS.map((p, idx) => (
                      <tr key={idx}>
                        <td className="font-medium text-surface-800">{p.name}</td>
                        <td><Badge variant="default">{p.role}</Badge></td>
                        <td className="text-right">{p.businesses}</td>
                        <td className="text-right">{p.scans.toLocaleString()}</td>
                        <td className="text-right">{p.signups}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Top QR Codes */}
        <Card>
          <CardHeader>
            <CardTitle>Top QR Codes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>QR Code</th>
                    <th className="text-right">Scans</th>
                    <th className="text-right">Conversions</th>
                    <th className="text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {TOP_QR_CODES.map((qr, idx) => (
                    <tr key={idx}>
                      <td className="font-medium text-surface-800">{qr.name}</td>
                      <td className="text-right">{qr.scans.toLocaleString()}</td>
                      <td className="text-right">{qr.conversions}</td>
                      <td className="text-right">
                        <Badge variant="success">{qr.rate}%</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* City Performance */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Performance by City</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>City</th>
                      <th className="text-right">Businesses</th>
                      <th className="text-right">Causes</th>
                      <th className="text-right">QR Scans</th>
                      <th className="text-right">Stakeholders</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CITY_PERFORMANCE.map((c, idx) => (
                      <tr key={idx}>
                        <td className="font-medium text-surface-800">{c.city}</td>
                        <td className="text-right">{c.businesses}</td>
                        <td className="text-right">{c.causes}</td>
                        <td className="text-right">{c.scans.toLocaleString()}</td>
                        <td className="text-right">{c.stakeholders}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Campaign Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign</th>
                    <th>Brand</th>
                    <th className="text-right">Businesses</th>
                    <th className="text-right">QR Scans</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {CAMPAIGN_PERFORMANCE.map((c, idx) => (
                    <tr key={idx}>
                      <td className="font-medium text-surface-800">{c.name}</td>
                      <td>
                        <Badge variant={c.brand === 'hato' ? 'hato' : 'info'}>
                          {c.brand === 'hato' ? 'HATO' : 'LocalVIP'}
                        </Badge>
                      </td>
                      <td className="text-right">{c.businesses}</td>
                      <td className="text-right">{c.scans.toLocaleString()}</td>
                      <td>
                        <Badge variant={c.status === 'active' ? 'success' : 'default'} dot>
                          {c.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
