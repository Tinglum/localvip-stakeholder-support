'use client'

import * as React from 'react'
import {
  TrendingUp, Store, Heart, QrCode, Users, Send,
  Download, Loader2,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth/context'
import { createClient } from '@/lib/supabase/client'
import { useCount, useCities, useProfiles } from '@/lib/supabase/hooks'
import type { Business, City, Profile } from '@/lib/types/database'
import { ONBOARDING_STAGES } from '@/lib/constants'

// ─── Period helpers ──────────────────────────────────────────

function periodToDate(period: string): string | null {
  if (period === 'all') return null
  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
  now.setDate(now.getDate() - days)
  return now.toISOString()
}

const STAGE_COLORS: Record<string, string> = {
  lead: '#94a3b8',
  contacted: '#60a5fa',
  interested: '#38bdf8',
  in_progress: '#fbbf24',
  onboarded: '#34d399',
  live: '#22c55e',
  paused: '#fb923c',
  declined: '#f87171',
}

const PIE_COLORS = ['#2563eb', '#7c3aed', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#8b5cf6', '#ef4444']

// ─── CSV helper ──────────────────────────────────────────────

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Main component ─────────────────────────────────────────

export default function AnalyticsPage() {
  const { isAdmin } = useAuth()
  const [period, setPeriod] = React.useState('30d')
  const supabase = React.useMemo(() => createClient(), [])

  // Real counts
  const businessCount = useCount('businesses')
  const causeCount = useCount('causes')
  const profileCount = useCount('profiles')
  const qrCount = useCount('qr_codes')
  const outreachCount = useCount('outreach_activities')

  // Businesses (full list for grouping)
  const [businesses, setBusinesses] = React.useState<Business[]>([])
  const [loading, setLoading] = React.useState(true)

  // Cities lookup
  const { data: cities } = useCities()
  const cityMap = React.useMemo(() => {
    const m: Record<string, string> = {}
    cities.forEach(c => { m[c.id] = `${c.name}, ${c.state}` })
    return m
  }, [cities])

  // Profiles lookup
  const { data: profiles } = useProfiles()

  // Fetch businesses with optional period filter
  React.useEffect(() => {
    async function load() {
      setLoading(true)
      let query = supabase.from('businesses').select('*')
      const since = periodToDate(period)
      if (since) query = query.gte('created_at', since)
      const { data } = await query
      setBusinesses((data || []) as Business[])
      setLoading(false)
    }
    load()
  }, [supabase, period])

  // ─── Derived data ──────────────────────────────────────────

  // Businesses by stage
  const stageData = React.useMemo(() => {
    const counts: Record<string, number> = {}
    businesses.forEach(b => {
      counts[b.stage] = (counts[b.stage] || 0) + 1
    })
    return Object.entries(ONBOARDING_STAGES)
      .map(([key, meta]) => ({
        stage: meta.label,
        key,
        count: counts[key] || 0,
        fill: STAGE_COLORS[key] || '#94a3b8',
      }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count)
  }, [businesses])

  // Businesses by city
  const cityData = React.useMemo(() => {
    const counts: Record<string, number> = {}
    businesses.forEach(b => {
      if (b.city_id) counts[b.city_id] = (counts[b.city_id] || 0) + 1
    })
    return Object.entries(counts)
      .map(([cityId, count]) => ({
        city: cityMap[cityId] || 'Unknown',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
  }, [businesses, cityMap])

  // Top performers: profiles with business ownership counts
  const performerData = React.useMemo(() => {
    const ownerCounts: Record<string, number> = {}
    businesses.forEach(b => {
      if (b.owner_id) ownerCounts[b.owner_id] = (ownerCounts[b.owner_id] || 0) + 1
    })
    return profiles
      .filter(p => ownerCounts[p.id])
      .map(p => ({
        name: p.full_name,
        role: p.role,
        businesses: ownerCounts[p.id] || 0,
      }))
      .sort((a, b) => b.businesses - a.businesses)
      .slice(0, 8)
  }, [profiles, businesses])

  // ─── Export CSV ────────────────────────────────────────────

  function handleExport() {
    const headers = ['Stage', 'Count']
    const rows = stageData.map(d => [d.stage, d.count] as (string | number)[])
    downloadCSV(`analytics-${period}.csv`, headers, rows)
  }

  // ─── Render ────────────────────────────────────────────────

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
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="all">All time</option>
            </select>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </div>
        }
      />

      {/* Top-level stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Businesses" value={businessCount} icon={<Store className="h-5 w-5" />} />
        <StatCard label="Causes" value={causeCount} icon={<Heart className="h-5 w-5" />} />
        <StatCard label="Stakeholders" value={profileCount} icon={<Users className="h-5 w-5" />} />
        <StatCard label="QR Codes" value={qrCount} icon={<QrCode className="h-5 w-5" />} />
        <StatCard label="Outreach Activities" value={outreachCount} icon={<Send className="h-5 w-5" />} />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-surface-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading analytics...
        </div>
      ) : (
        <>
          {/* Businesses by Stage - horizontal bar chart */}
          <Card>
            <CardHeader>
              <CardTitle>Businesses by Stage</CardTitle>
            </CardHeader>
            <CardContent>
              {stageData.length === 0 ? (
                <p className="text-sm text-surface-400 py-8 text-center">No businesses found for this period.</p>
              ) : (
                <ResponsiveContainer width="100%" height={stageData.length * 48 + 20}>
                  <BarChart data={stageData} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
                    <XAxis type="number" allowDecimals={false} />
                    <YAxis type="category" dataKey="stage" width={100} tick={{ fontSize: 13 }} />
                    <Tooltip formatter={(value: number) => [value, 'Businesses']} />
                    <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                      {stageData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Businesses by City - pie chart */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Businesses by City</CardTitle>
                </CardHeader>
                <CardContent>
                  {cityData.length === 0 ? (
                    <p className="text-sm text-surface-400 py-8 text-center">No city data available.</p>
                  ) : (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="60%" height={260}>
                        <PieChart>
                          <Pie
                            data={cityData}
                            dataKey="count"
                            nameKey="city"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            label={({ city, count }) => `${city} (${count})`}
                            labelLine
                          >
                            {cityData.map((_, idx) => (
                              <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-2">
                        {cityData.map((c, idx) => (
                          <div key={c.city} className="flex items-center gap-2 text-sm">
                            <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: PIE_COLORS[idx % PIE_COLORS.length] }} />
                            <span className="text-surface-700 truncate">{c.city}</span>
                            <span className="ml-auto font-semibold text-surface-900">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Top Performers */}
            {isAdmin && (
              <Card>
                <CardHeader>
                  <CardTitle>Top Performers</CardTitle>
                </CardHeader>
                <CardContent>
                  {performerData.length === 0 ? (
                    <p className="text-sm text-surface-400 py-8 text-center">No performer data yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Role</th>
                            <th className="text-right">Businesses Owned</th>
                          </tr>
                        </thead>
                        <tbody>
                          {performerData.map((p, idx) => (
                            <tr key={idx}>
                              <td className="font-medium text-surface-800">{p.name}</td>
                              <td><Badge variant="default">{p.role.replace('_', ' ')}</Badge></td>
                              <td className="text-right font-semibold">{p.businesses}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Stage breakdown as bar chart (vertical) */}
            <Card>
              <CardHeader>
                <CardTitle>Stage Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {stageData.length === 0 ? (
                  <p className="text-sm text-surface-400 py-8 text-center">No data.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={stageData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                      <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} />
                      <Tooltip formatter={(value: number) => [value, 'Businesses']} />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
                        {stageData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Total counts summary card */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-2 border-b border-surface-100">
                    <span className="text-sm text-surface-600">Businesses in period</span>
                    <span className="text-lg font-bold text-surface-900">{businesses.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-surface-100">
                    <span className="text-sm text-surface-600">Cities with businesses</span>
                    <span className="text-lg font-bold text-surface-900">{cityData.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-surface-100">
                    <span className="text-sm text-surface-600">Active stages</span>
                    <span className="text-lg font-bold text-surface-900">{stageData.length}</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-surface-600">Performers tracked</span>
                    <span className="text-lg font-bold text-surface-900">{performerData.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
