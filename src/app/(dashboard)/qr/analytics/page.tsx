'use client'

import * as React from 'react'
import { QrCode, BarChart3, MousePointer, Users, Loader2, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BRANDS } from '@/lib/constants'
import { useQrCodes } from '@/lib/supabase/hooks'
import { createClient } from '@/lib/supabase/client'
import type { QrCodeEvent } from '@/lib/types/database'

function useQrEvents() {
  const supabase = React.useMemo(() => createClient(), [])
  const [events, setEvents] = React.useState<QrCodeEvent[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('qr_code_events')
        .select('*')
        .order('scanned_at', { ascending: false })
        .limit(5000)
      setEvents((data || []) as QrCodeEvent[])
      setLoading(false)
    }
    fetch()
  }, [supabase])

  return { events, loading }
}

export default function QrAnalyticsPage() {
  const { data: qrCodes, loading: qrLoading } = useQrCodes()
  const { events, loading: eventsLoading } = useQrEvents()
  const loading = qrLoading || eventsLoading

  // Compute stats from real data
  const totalScans = React.useMemo(() =>
    qrCodes.reduce((sum, qr) => sum + (qr.scan_count || 0), 0),
  [qrCodes])

  const uniqueVisitors = React.useMemo(() => {
    const ips = new Set(events.filter(e => e.ip_address).map(e => e.ip_address))
    return ips.size
  }, [events])

  const topQr = React.useMemo(() => {
    if (qrCodes.length === 0) return null
    return [...qrCodes].sort((a, b) => (b.scan_count || 0) - (a.scan_count || 0))[0]
  }, [qrCodes])

  const avgScans = qrCodes.length > 0 ? Math.round(totalScans / qrCodes.length) : 0

  // Performance table: QR codes sorted by scan count
  const qrPerformance = React.useMemo(() =>
    [...qrCodes]
      .sort((a, b) => (b.scan_count || 0) - (a.scan_count || 0))
      .slice(0, 20),
  [qrCodes])

  // Compute per-QR event breakdown
  const eventsByQr = React.useMemo(() => {
    const map: Record<string, { scans: number; unique: Set<string>; conversions: number }> = {}
    for (const ev of events) {
      if (!map[ev.qr_code_id]) map[ev.qr_code_id] = { scans: 0, unique: new Set(), conversions: 0 }
      const entry = map[ev.qr_code_id]
      if (ev.event_type === 'scan' || ev.event_type === 'redirect') {
        entry.scans++
        if (ev.ip_address) entry.unique.add(ev.ip_address)
      }
      if (ev.event_type === 'conversion' || ev.event_type === 'signup') {
        entry.conversions++
      }
    }
    return map
  }, [events])

  // Daily scans for the last 7 days
  const dailyScans = React.useMemo(() => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const counts: Record<string, number> = {}
    const now = new Date()

    // Initialize last 7 days
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      counts[key] = 0
    }

    for (const ev of events) {
      if (ev.event_type === 'scan' || ev.event_type === 'redirect') {
        const key = ev.scanned_at.split('T')[0]
        if (key in counts) counts[key]++
      }
    }

    return Object.entries(counts).map(([date, scans]) => ({
      day: days[new Date(date).getDay()],
      scans,
      date,
    }))
  }, [events])

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="QR Code Analytics" description="See which QR codes drive scans, visits, and conversions." />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="QR Code Analytics"
        description="See which QR codes drive scans, visits, and conversions."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Scans" value={totalScans} icon={<MousePointer className="h-5 w-5" />} format="number" />
        <StatCard label="Unique Visitors" value={uniqueVisitors} icon={<Users className="h-5 w-5" />} format="number" />
        <StatCard label="Top QR Code" value={topQr?.name || 'None yet'} icon={<QrCode className="h-5 w-5" />} format="raw" />
        <StatCard label="Avg Scans/Code" value={avgScans} icon={<BarChart3 className="h-5 w-5" />} format="number" />
      </div>

      {/* Weekly scan chart */}
      <Card>
        <CardHeader><CardTitle>Scans This Week</CardTitle></CardHeader>
        <CardContent>
          {dailyScans.every(d => d.scans === 0) ? (
            <div className="flex flex-col items-center justify-center py-8 text-surface-400">
              <BarChart3 className="h-8 w-8 mb-2" />
              <p className="text-sm">No scan data yet this week</p>
              <p className="text-xs">Scans will appear here as QR codes get used</p>
            </div>
          ) : (
            <div className="flex items-end gap-3 h-32">
              {dailyScans.map((d, idx) => {
                const max = Math.max(...dailyScans.map(x => x.scans), 1)
                const height = (d.scans / max) * 100
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs text-surface-500">{d.scans}</span>
                    <div className="w-full flex items-end justify-center" style={{ height: '90px' }}>
                      <div
                        className="w-full max-w-[36px] rounded-t-md bg-brand-500 hover:bg-brand-600 transition-colors"
                        style={{ height: `${Math.max(height, 2)}%` }}
                      />
                    </div>
                    <span className="text-xs text-surface-400">{d.day}</span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* QR performance table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>QR Code Performance</CardTitle>
            <Badge variant="default">{qrCodes.length} QR codes</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {qrPerformance.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-8 w-8" />}
              title="No QR codes yet"
              description="Generate your first QR code to start tracking performance."
            />
          ) : (
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
                  {qrPerformance.map(qr => {
                    const ev = eventsByQr[qr.id]
                    const scans = qr.scan_count || ev?.scans || 0
                    const unique = ev?.unique.size || 0
                    const conversions = ev?.conversions || 0
                    const rate = scans > 0 ? ((conversions / scans) * 100).toFixed(1) : '0.0'
                    return (
                      <tr key={qr.id}>
                        <td className="font-medium text-surface-800">{qr.name}</td>
                        <td><Badge variant={qr.brand === 'hato' ? 'hato' : 'info'}>{BRANDS[qr.brand]?.label || qr.brand}</Badge></td>
                        <td className="text-right font-medium">{scans.toLocaleString()}</td>
                        <td className="text-right">{unique.toLocaleString()}</td>
                        <td className="text-right">{conversions}</td>
                        <td className="text-right"><Badge variant={Number(rate) > 0 ? 'success' : 'default'}>{rate}%</Badge></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
