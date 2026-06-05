'use client'

import * as React from 'react'
import {
  Download,
  Heart,
  Loader2,
  QrCode,
  Send,
  Store,
  TrendingUp,
  Users,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { SystemDiagnosticsTab } from '@/components/admin/system-diagnostics-tab'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { PageHeader } from '@/components/ui/page-header'
import { StatCard } from '@/components/ui/stat-card'
import { ONBOARDING_STAGES } from '@/lib/constants'
import { useAuth } from '@/lib/auth/context'
import { useBusinesses, useCities, useCount, useProfiles } from '@/lib/supabase/hooks'

type AnalyticsTab = 'overview' | 'system_diagnostics'

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

function periodToDate(period: string): string | null {
  if (period === 'all') return null
  const now = new Date()
  const days = period === '7d' ? 7 : period === '30d' ? 30 : period === '90d' ? 90 : 365
  now.setDate(now.getDate() - days)
  return now.toISOString()
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const csv = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function AnalyticsPage() {
  const { isAdmin, profile } = useAuth()
  const [period, setPeriod] = React.useState('30d')
  const [activeTab, setActiveTab] = React.useState<AnalyticsTab>('overview')

  const canViewSystemDiagnostics = isAdmin
    && ['admin', 'super_admin', 'internal_admin'].includes(profile.role)

  React.useEffect(() => {
    if (activeTab === 'system_diagnostics' && !canViewSystemDiagnostics) {
      setActiveTab('overview')
    }
  }, [activeTab, canViewSystemDiagnostics])

  const tabs = React.useMemo(() => {
    const items: Array<{ id: AnalyticsTab; label: string; badge?: string }> = [
      { id: 'overview', label: 'Overview' },
    ]

    if (canViewSystemDiagnostics) {
      items.push({ id: 'system_diagnostics', label: 'System Diagnostics', badge: 'Live' })
    }

    return items
  }, [canViewSystemDiagnostics])

  const businessCount = useCount('businesses')
  const causeCount = useCount('causes')
  const profileCount = useCount('profiles')
  const qrCount = useCount('qr_codes')
  const outreachCount = useCount('outreach_activities')

  const { data: allBusinesses, loading } = useBusinesses()
  const businesses = React.useMemo(() => {
    const since = periodToDate(period)
    if (!since) return allBusinesses
    return allBusinesses.filter((business) => {
      const createdAt = (business as { created_at?: string }).created_at
      return createdAt && createdAt >= since
    })
  }, [allBusinesses, period])

  const { data: cities } = useCities()
  const cityMap = React.useMemo(() => {
    const result: Record<string, string> = {}
    cities.forEach((city) => {
      result[city.id] = `${city.name}, ${city.state}`
    })
    return result
  }, [cities])

  const { data: profiles } = useProfiles()

  const stageData = React.useMemo(() => {
    const counts: Record<string, number> = {}
    businesses.forEach((business) => {
      counts[business.stage] = (counts[business.stage] || 0) + 1
    })

    return Object.entries(ONBOARDING_STAGES)
      .map(([key, meta]) => ({
        stage: meta.label,
        key,
        count: counts[key] || 0,
        fill: STAGE_COLORS[key] || '#94a3b8',
      }))
      .filter((entry) => entry.count > 0)
      .sort((left, right) => right.count - left.count)
  }, [businesses])

  const cityData = React.useMemo(() => {
    const counts: Record<string, number> = {}
    businesses.forEach((business) => {
      if (business.city_id) counts[business.city_id] = (counts[business.city_id] || 0) + 1
    })

    return Object.entries(counts)
      .map(([cityId, count]) => ({
        city: cityMap[cityId] || 'Unknown',
        count,
      }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 10)
  }, [businesses, cityMap])

  const performerData = React.useMemo(() => {
    const ownerCounts: Record<string, number> = {}
    businesses.forEach((business) => {
      if (business.owner_id) ownerCounts[business.owner_id] = (ownerCounts[business.owner_id] || 0) + 1
    })

    return profiles
      .filter((entry) => ownerCounts[entry.id])
      .map((entry) => ({
        name: entry.full_name,
        role: entry.role,
        businesses: ownerCounts[entry.id] || 0,
      }))
      .sort((left, right) => right.businesses - left.businesses)
      .slice(0, 8)
  }, [profiles, businesses])

  function handleExport() {
    const headers = ['Stage', 'Count']
    const rows = stageData.map((entry) => [entry.stage, entry.count] as (string | number)[])
    downloadCSV(`analytics-${period}.csv`, headers, rows)
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Analytics"
        description={
          activeTab === 'system_diagnostics'
            ? 'A live cooperation panel for the routes, bridges, and services that keep the admin experience working.'
            : isAdmin
              ? 'System-wide performance. Identify what works, who produces, and where to focus.'
              : 'Your personal performance and impact metrics.'
        }
        actions={
          activeTab === 'overview' ? (
            <div className="flex items-center gap-2">
              <select
                value={period}
                onChange={(event) => setPeriod(event.target.value)}
                className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
              >
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
                <option value="90d">Last 90 days</option>
                <option value="all">All time</option>
              </select>
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </Button>
            </div>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            variant={activeTab === tab.id ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.badge && <Badge variant="info">{tab.badge}</Badge>}
          </Button>
        ))}
      </div>

      {activeTab === 'system_diagnostics' ? (
        <SystemDiagnosticsTab active />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Businesses" value={businessCount} icon={<Store className="h-5 w-5" />} />
            <StatCard label="Causes" value={causeCount} icon={<Heart className="h-5 w-5" />} />
            <StatCard label="Stakeholders" value={profileCount} icon={<Users className="h-5 w-5" />} />
            <StatCard label="QR Codes" value={qrCount} icon={<QrCode className="h-5 w-5" />} />
            <StatCard label="Outreach Activities" value={outreachCount} icon={<Send className="h-5 w-5" />} />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-surface-400">
              <Loader2 className="mr-2 h-6 w-6 animate-spin" />
              Loading analytics...
            </div>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Businesses by Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  {stageData.length === 0 ? (
                    <p className="py-8 text-center text-sm text-surface-400">No businesses found for this period.</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={stageData.length * 48 + 20}>
                      <BarChart data={stageData} layout="vertical" margin={{ left: 20, right: 30, top: 5, bottom: 5 }}>
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis type="category" dataKey="stage" width={100} tick={{ fontSize: 13 }} />
                        <Tooltip formatter={(value: number) => [value, 'Businesses']} />
                        <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={28}>
                          {stageData.map((entry, index) => (
                            <Cell key={index} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                {isAdmin && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Businesses by City</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {cityData.length === 0 ? (
                        <p className="py-8 text-center text-sm text-surface-400">No city data available.</p>
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
                                {cityData.map((_, index) => (
                                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip />
                            </PieChart>
                          </ResponsiveContainer>
                          <div className="flex-1 space-y-2">
                            {cityData.map((entry, index) => (
                              <div key={entry.city} className="flex items-center gap-2 text-sm">
                                <span
                                  className="h-3 w-3 shrink-0 rounded-sm"
                                  style={{ background: PIE_COLORS[index % PIE_COLORS.length] }}
                                />
                                <span className="truncate text-surface-700">{entry.city}</span>
                                <span className="ml-auto font-semibold text-surface-900">{entry.count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                {isAdmin && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Top Performers</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {performerData.length === 0 ? (
                        <p className="py-8 text-center text-sm text-surface-400">No performer data yet.</p>
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
                              {performerData.map((entry, index) => (
                                <tr key={index}>
                                  <td className="font-medium text-surface-800">{entry.name}</td>
                                  <td><Badge variant="default">{entry.role.replace('_', ' ')}</Badge></td>
                                  <td className="text-right font-semibold">{entry.businesses}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader>
                    <CardTitle>Stage Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stageData.length === 0 ? (
                      <p className="py-8 text-center text-sm text-surface-400">No data.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height={260}>
                        <BarChart data={stageData} margin={{ left: 0, right: 10, top: 5, bottom: 5 }}>
                          <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} />
                          <Tooltip formatter={(value: number) => [value, 'Businesses']} />
                          <Bar dataKey="count" radius={[6, 6, 0, 0]} barSize={36}>
                            {stageData.map((entry, index) => (
                              <Cell key={index} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Quick Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-surface-100 py-2">
                        <span className="text-sm text-surface-600">Businesses in period</span>
                        <span className="text-lg font-bold text-surface-900">{businesses.length}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-surface-100 py-2">
                        <span className="text-sm text-surface-600">Cities with businesses</span>
                        <span className="text-lg font-bold text-surface-900">{cityData.length}</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-surface-100 py-2">
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
        </>
      )}
    </div>
  )
}
