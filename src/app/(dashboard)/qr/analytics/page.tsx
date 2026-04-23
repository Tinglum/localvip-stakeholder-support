'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Heart,
  Laptop,
  Loader2,
  MousePointer,
  QrCode,
  Smartphone,
  Store,
  Tablet,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { BRANDS } from '@/lib/constants'
import { useQrCodes } from '@/lib/supabase/hooks'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import type { QrCodeEvent } from '@/lib/types/database'

// ─── Parsing helpers ─────────────────────────────────────────

type DeviceType = 'mobile' | 'tablet' | 'desktop'
type ReferrerCategory = 'Direct' | 'Social' | 'Search' | 'Email' | 'Other'

function parseDevice(ua: string | null): DeviceType {
  if (!ua) return 'desktop'
  const u = ua.toLowerCase()
  if (/ipad|tablet/.test(u)) return 'tablet'
  if (/mobile|android|iphone|ipod/.test(u)) return 'mobile'
  return 'desktop'
}

function parseBrowser(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (/edg\//i.test(ua)) return 'Edge'
  if (/opr\//i.test(ua)) return 'Opera'
  if (/chrome/i.test(ua)) return 'Chrome'
  if (/safari/i.test(ua)) return 'Safari'
  if (/firefox/i.test(ua)) return 'Firefox'
  return 'Other'
}

function parseOS(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (/windows/i.test(ua)) return 'Windows'
  if (/macintosh|mac os/i.test(ua)) return 'macOS'
  if (/iphone|ipad/i.test(ua)) return 'iOS'
  if (/android/i.test(ua)) return 'Android'
  if (/linux/i.test(ua)) return 'Linux'
  return 'Other'
}

function parseReferrerCategory(ref: string | null): ReferrerCategory {
  if (!ref) return 'Direct'
  const r = ref.toLowerCase()
  if (/facebook|instagram|twitter|x\.com|tiktok|linkedin|youtube|whatsapp|t\.co|snapchat/.test(r)) return 'Social'
  if (/google|bing|yahoo|duckduckgo|yandex/.test(r)) return 'Search'
  if (/mail\.google|outlook|yahoo\.com\/mail|mail\.|webmail/.test(r)) return 'Email'
  return 'Other'
}

function parseReferrerDomain(ref: string | null): string {
  if (!ref) return 'Direct'
  try {
    return new URL(ref).hostname.replace(/^www\./, '')
  } catch {
    return ref.slice(0, 40)
  }
}

// ─── Data hook ───────────────────────────────────────────────

interface AnalyticsData {
  events: QrCodeEvent[]
  businessNames: Map<string, string>
  causeNames: Map<string, string>
  loading: boolean
}

function useAnalyticsData(days: number): AnalyticsData {
  const supabase = React.useMemo(() => createClient(), [])
  const [events, setEvents] = React.useState<QrCodeEvent[]>([])
  const [businessNames, setBusinessNames] = React.useState<Map<string, string>>(new Map())
  const [causeNames, setCauseNames] = React.useState<Map<string, string>>(new Map())
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - days)

    async function load() {
      const [eventsRes, bizRes, causeRes] = await Promise.all([
        (supabase as any)
          .from('qr_code_events')
          .select('*')
          .gte('scanned_at', since.toISOString())
          .order('scanned_at', { ascending: false })
          .limit(10000),
        (supabase as any).from('businesses').select('id, name').eq('status', 'active'),
        (supabase as any).from('causes').select('id, name'),
      ])

      setEvents((eventsRes.data || []) as QrCodeEvent[])
      setBusinessNames(new Map((bizRes.data || []).map((b: { id: string; name: string }) => [b.id, b.name])))
      setCauseNames(new Map((causeRes.data || []).map((c: { id: string; name: string }) => [c.id, c.name])))
      setLoading(false)
    }

    void load()
  }, [supabase, days])

  return { events, businessNames, causeNames, loading }
}

// ─── Small UI components ─────────────────────────────────────

function StatCard({ label, value, sub, icon, accent = false }: {
  label: string; value: string | number; sub?: string; icon: React.ReactNode; accent?: boolean
}) {
  return (
    <Card className={accent ? 'border-brand-200 bg-brand-50' : ''}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.16em] text-surface-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold truncate ${accent ? 'text-brand-700' : 'text-surface-900'}`}>
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            {sub && <p className="mt-0.5 text-xs text-surface-500">{sub}</p>}
          </div>
          <div className={`shrink-0 rounded-xl p-2.5 ${accent ? 'bg-brand-100 text-brand-600' : 'bg-surface-100 text-surface-500'}`}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function MiniBar({ label, value, total, color = 'bg-brand-500' }: {
  label: string; value: number; total: number; color?: string
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 shrink-0 truncate text-sm text-surface-700">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-surface-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-10 text-right text-xs font-medium text-surface-600">{value}</span>
      <span className="w-8 text-right text-xs text-surface-400">{pct}%</span>
    </div>
  )
}

const DEVICE_COLOR: Record<DeviceType, string> = {
  mobile: 'bg-pink-500',
  tablet: 'bg-violet-500',
  desktop: 'bg-brand-500',
}
const DEVICE_ICON: Record<DeviceType, React.ReactNode> = {
  mobile: <Smartphone className="h-4 w-4" />,
  tablet: <Tablet className="h-4 w-4" />,
  desktop: <Laptop className="h-4 w-4" />,
}
const REF_COLOR: Record<ReferrerCategory, string> = {
  Direct: 'bg-surface-500',
  Social: 'bg-pink-500',
  Search: 'bg-brand-500',
  Email: 'bg-amber-500',
  Other: 'bg-violet-500',
}

// ─── Main page ───────────────────────────────────────────────

const TIME_RANGES = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
] as const

const ENTITY_FILTERS = ['All', 'Business', 'Cause'] as const
type EntityFilter = typeof ENTITY_FILTERS[number]

export default function QrAnalyticsPage() {
  const [timeRange, setTimeRange] = React.useState<7 | 30 | 90>(30)
  const [entityFilter, setEntityFilter] = React.useState<EntityFilter>('All')
  const [expandedQr, setExpandedQr] = React.useState<string | null>(null)
  const [showAllEvents, setShowAllEvents] = React.useState(false)

  const { data: allQrCodes, loading: qrLoading } = useQrCodes()
  const { events, businessNames, causeNames, loading: dataLoading } = useAnalyticsData(timeRange)
  const loading = qrLoading || dataLoading

  // Apply entity filter to QR codes
  const qrCodes = React.useMemo(() => {
    if (entityFilter === 'Business') return allQrCodes.filter(q => q.business_id)
    if (entityFilter === 'Cause') return allQrCodes.filter(q => q.cause_id)
    return allQrCodes
  }, [allQrCodes, entityFilter])

  const qrIdSet = React.useMemo(() => new Set(qrCodes.map(q => q.id)), [qrCodes])

  // Filter events to the visible QR codes
  const filteredEvents = React.useMemo(
    () => events.filter(e => qrIdSet.has(e.qr_code_id)),
    [events, qrIdSet],
  )

  const scanEvents = React.useMemo(
    () => filteredEvents.filter(e => e.event_type === 'scan' || e.event_type === 'redirect'),
    [filteredEvents],
  )

  const signupEvents = React.useMemo(
    () => filteredEvents.filter(e => {
      const t = e.event_type as string
      return t === 'signup' || t === 'support_signup' || t === 'conversion'
    }),
    [filteredEvents],
  )

  // ── Summary stats ──
  const totalScans = React.useMemo(
    () => qrCodes.reduce((s, q) => s + (q.scan_count || 0), 0),
    [qrCodes],
  )

  const periodScans = scanEvents.length
  const periodSignups = signupEvents.length

  const uniqueVisitors = React.useMemo(() => {
    const ips = new Set(scanEvents.filter(e => e.ip_address).map(e => e.ip_address!))
    return ips.size
  }, [scanEvents])

  const convRate = periodScans > 0 ? ((periodSignups / periodScans) * 100).toFixed(1) : '0.0'

  const topQr = React.useMemo(
    () => qrCodes.length === 0 ? null : [...qrCodes].sort((a, b) => (b.scan_count || 0) - (a.scan_count || 0))[0],
    [qrCodes],
  )

  const lastScanTime = React.useMemo(
    () => scanEvents.length > 0 ? scanEvents[0].scanned_at : null,
    [scanEvents],
  )

  // ── Trend chart ──
  const trendData = React.useMemo(() => {
    const counts: Record<string, { scans: number; signups: number }> = {}
    const now = new Date()
    for (let i = timeRange - 1; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      counts[d.toISOString().split('T')[0]] = { scans: 0, signups: 0 }
    }
    for (const ev of filteredEvents) {
      const key = ev.scanned_at.split('T')[0]
      if (!(key in counts)) continue
      if (ev.event_type === 'scan' || ev.event_type === 'redirect') counts[key].scans++
      if (['signup', 'support_signup', 'conversion'].includes(ev.event_type as string)) counts[key].signups++
    }
    return Object.entries(counts).map(([date, vals]) => ({ date, ...vals }))
  }, [filteredEvents, timeRange])

  const trendMax = Math.max(...trendData.map(d => d.scans), 1)

  // ── Device breakdown ──
  const deviceCounts = React.useMemo(() => {
    const counts: Record<DeviceType, number> = { mobile: 0, tablet: 0, desktop: 0 }
    for (const ev of scanEvents) counts[parseDevice(ev.user_agent)]++
    return counts
  }, [scanEvents])

  // ── Browser breakdown ──
  const browserCounts = React.useMemo(() => {
    const counts: Record<string, number> = {}
    for (const ev of scanEvents) {
      const b = parseBrowser(ev.user_agent)
      counts[b] = (counts[b] || 0) + 1
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5)
  }, [scanEvents])

  // ── Referrer breakdown ──
  const referrerCounts = React.useMemo(() => {
    const cats: Record<ReferrerCategory, number> = { Direct: 0, Social: 0, Search: 0, Email: 0, Other: 0 }
    const domains: Record<string, number> = {}
    for (const ev of scanEvents) {
      cats[parseReferrerCategory(ev.referrer)]++
      const d = parseReferrerDomain(ev.referrer)
      domains[d] = (domains[d] || 0) + 1
    }
    const topDomains = Object.entries(domains).sort((a, b) => b[1] - a[1]).slice(0, 6)
    return { cats, topDomains }
  }, [scanEvents])

  // ── Hour-of-day heatmap ──
  const hourCounts = React.useMemo(() => {
    const counts = new Array(24).fill(0)
    for (const ev of scanEvents) {
      const h = new Date(ev.scanned_at).getHours()
      counts[h]++
    }
    return counts as number[]
  }, [scanEvents])

  const hourMax = Math.max(...hourCounts, 1)

  const peakHour = hourCounts.indexOf(Math.max(...hourCounts))

  // ── Day-of-week breakdown ──
  const dowCounts = React.useMemo(() => {
    const counts = new Array(7).fill(0)
    for (const ev of scanEvents) counts[new Date(ev.scanned_at).getDay()]++
    return counts as number[]
  }, [scanEvents])

  const dowMax = Math.max(...dowCounts, 1)
  const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const peakDay = DOW_LABELS[dowCounts.indexOf(Math.max(...dowCounts))]

  // ── Per-QR performance ──
  const qrPerformance = React.useMemo(() => {
    const byId: Record<string, {
      scans: number
      uniqueIps: Set<string>
      signups: number
      lastScan: string | null
      events: QrCodeEvent[]
    }> = {}

    for (const ev of filteredEvents) {
      if (!byId[ev.qr_code_id]) {
        byId[ev.qr_code_id] = { scans: 0, uniqueIps: new Set(), signups: 0, lastScan: null, events: [] }
      }
      const entry = byId[ev.qr_code_id]
      entry.events.push(ev)
      if (ev.event_type === 'scan' || ev.event_type === 'redirect') {
        entry.scans++
        if (ev.ip_address) entry.uniqueIps.add(ev.ip_address)
        if (!entry.lastScan || ev.scanned_at > entry.lastScan) entry.lastScan = ev.scanned_at
      }
      if (['signup', 'support_signup', 'conversion'].includes(ev.event_type as string)) {
        entry.signups++
      }
    }

    return [...qrCodes]
      .sort((a, b) => (b.scan_count || 0) - (a.scan_count || 0))
      .map(qr => ({
        qr,
        periodScans: byId[qr.id]?.scans || 0,
        unique: byId[qr.id]?.uniqueIps.size || 0,
        signups: byId[qr.id]?.signups || 0,
        lastScan: byId[qr.id]?.lastScan || null,
        recentEvents: (byId[qr.id]?.events || [])
          .filter(e => e.event_type === 'scan' || e.event_type === 'redirect')
          .slice(0, 15),
        entityLabel: qr.business_id
          ? businessNames.get(qr.business_id) || 'Business'
          : qr.cause_id
            ? causeNames.get(qr.cause_id) || 'Cause'
            : null,
        entityType: qr.business_id ? 'business' : qr.cause_id ? 'cause' : null,
        entityId: qr.business_id || qr.cause_id || null,
      }))
  }, [qrCodes, filteredEvents, businessNames, causeNames])

  // ── Recent events feed ──
  const recentEvents = React.useMemo(() => {
    const qrMap = new Map(allQrCodes.map(q => [q.id, q]))
    return filteredEvents
      .filter(e => ['scan', 'redirect', 'signup', 'support_signup', 'conversion'].includes(e.event_type as string))
      .slice(0, showAllEvents ? 200 : 50)
      .map(ev => ({
        ev,
        qr: qrMap.get(ev.qr_code_id) || null,
        device: parseDevice(ev.user_agent),
        browser: parseBrowser(ev.user_agent),
        os: parseOS(ev.user_agent),
        refCat: parseReferrerCategory(ev.referrer),
        refDomain: parseReferrerDomain(ev.referrer),
        isScan: ev.event_type === 'scan' || ev.event_type === 'redirect',
      }))
  }, [filteredEvents, allQrCodes, showAllEvents])

  // ── Render ──────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <PageHeader title="QR Analytics" description="Loading scan data…" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="QR Code Analytics"
        description="Scans, signups, devices, referrers, and timing — for every QR code across business and cause."
      />

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-surface-200 bg-white overflow-hidden">
          {TIME_RANGES.map(({ label, days }) => (
            <button
              key={days}
              onClick={() => setTimeRange(days as 7 | 30 | 90)}
              className={`px-4 py-2 text-sm font-medium transition-colors ${timeRange === days ? 'bg-brand-600 text-white' : 'text-surface-600 hover:bg-surface-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex rounded-lg border border-surface-200 bg-white overflow-hidden">
          {ENTITY_FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setEntityFilter(f)}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${entityFilter === f ? 'bg-surface-900 text-white' : 'text-surface-600 hover:bg-surface-50'}`}
            >
              {f === 'Business' && <Store className="h-3.5 w-3.5" />}
              {f === 'Cause' && <Heart className="h-3.5 w-3.5" />}
              {f}
            </button>
          ))}
        </div>
        <p className="text-sm text-surface-500">
          {qrCodes.length} QR code{qrCodes.length !== 1 ? 's' : ''} · {periodScans.toLocaleString()} scans in last {timeRange}d
        </p>
      </div>

      {/* ── Summary stat cards ── */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="All-Time Scans" value={totalScans} icon={<MousePointer className="h-5 w-5" />} accent />
        <StatCard label={`Scans (${timeRange}d)`} value={periodScans} icon={<Activity className="h-5 w-5" />} />
        <StatCard label="Unique Visitors" value={uniqueVisitors} icon={<Users className="h-5 w-5" />} sub="by IP address" />
        <StatCard label="Signups" value={periodSignups} icon={<CheckCircle2 className="h-5 w-5" />} sub={`${convRate}% conv. rate`} />
        <StatCard label="Peak Hour" value={`${peakHour}:00`} icon={<Clock className="h-5 w-5" />} sub={`${peakDay}s are busiest`} />
        <StatCard label="Active QR Codes" value={qrCodes.filter(q => q.status === 'active').length} icon={<QrCode className="h-5 w-5" />} sub={`of ${qrCodes.length} total`} />
      </div>

      {/* ── Trend chart ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Scan Trend — Last {timeRange} Days</CardTitle>
            {lastScanTime && (
              <p className="text-xs text-surface-500">Last scan {formatDateTime(lastScanTime)}</p>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {trendData.every(d => d.scans === 0 && d.signups === 0) ? (
            <div className="flex flex-col items-center justify-center py-10 text-surface-400">
              <BarChart3 className="h-8 w-8 mb-2" />
              <p className="text-sm">No scan data in this period</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-end gap-1" style={{ height: '100px' }}>
                {trendData.map((d, i) => {
                  const h = Math.max((d.scans / trendMax) * 100, d.scans > 0 ? 4 : 0)
                  const sh = Math.max((d.signups / trendMax) * 100, d.signups > 0 ? 3 : 0)
                  const showLabel = timeRange <= 14 || i % Math.ceil(timeRange / 14) === 0 || i === trendData.length - 1
                  return (
                    <div key={d.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                      {/* Tooltip */}
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col items-center z-10">
                        <div className="bg-surface-900 text-white text-[10px] rounded-lg px-2 py-1.5 whitespace-nowrap shadow-lg">
                          <p className="font-medium">{d.date}</p>
                          <p>{d.scans} scan{d.scans !== 1 ? 's' : ''}</p>
                          {d.signups > 0 && <p className="text-success-300">{d.signups} signup{d.signups !== 1 ? 's' : ''}</p>}
                        </div>
                      </div>
                      {/* Bars */}
                      <div className="w-full flex items-end justify-center gap-0.5" style={{ height: '90px' }}>
                        <div
                          className="flex-1 max-w-[18px] rounded-t bg-brand-500 opacity-80 group-hover:opacity-100 transition-opacity"
                          style={{ height: `${h}%` }}
                        />
                        {sh > 0 && (
                          <div
                            className="flex-1 max-w-[8px] rounded-t bg-success-400"
                            style={{ height: `${sh}%` }}
                          />
                        )}
                      </div>
                      {showLabel && (
                        <span className="text-[9px] text-surface-400 truncate w-full text-center">
                          {d.date.slice(5)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
              <div className="flex items-center gap-4 text-xs text-surface-500 pt-1">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-brand-500" /> Scans</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-success-400" /> Signups</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Breakdown grid ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Device breakdown */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-surface-500" /> Device Types</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {scanEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No scan data yet</p>
            ) : (
              <>
                {(['mobile', 'desktop', 'tablet'] as DeviceType[]).map(d => (
                  <div key={d} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2 text-surface-700 capitalize">
                        {DEVICE_ICON[d]} {d}
                      </span>
                      <span className="font-medium">{deviceCounts[d].toLocaleString()}</span>
                    </div>
                    <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${DEVICE_COLOR[d]}`}
                        style={{ width: `${scanEvents.length > 0 ? (deviceCounts[d] / scanEvents.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                ))}
                <div className="pt-2 border-t border-surface-100 space-y-1.5">
                  <p className="text-xs font-medium text-surface-600">Browser</p>
                  {browserCounts.map(([browser, count]) => (
                    <MiniBar key={browser} label={browser} value={count} total={scanEvents.length} color="bg-violet-500" />
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Referrer breakdown */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-4 w-4 text-surface-500" /> Traffic Sources</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {scanEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No scan data yet</p>
            ) : (
              <>
                {(Object.entries(referrerCounts.cats) as [ReferrerCategory, number][])
                  .sort((a, b) => b[1] - a[1])
                  .map(([cat, count]) => (
                    <MiniBar key={cat} label={cat} value={count} total={scanEvents.length} color={REF_COLOR[cat]} />
                  ))}
                {referrerCounts.topDomains.length > 0 && (
                  <div className="pt-2 border-t border-surface-100 space-y-1.5">
                    <p className="text-xs font-medium text-surface-600">Top referring domains</p>
                    {referrerCounts.topDomains.map(([domain, count]) => (
                      <MiniBar key={domain} label={domain} value={count} total={scanEvents.length} color="bg-amber-400" />
                    ))}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Time patterns */}
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-4 w-4 text-surface-500" /> When People Scan</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {scanEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-surface-400">No scan data yet</p>
            ) : (
              <>
                {/* Hour of day */}
                <div>
                  <p className="mb-2 text-xs font-medium text-surface-600">By hour of day</p>
                  <div className="flex items-end gap-[2px]" style={{ height: '50px' }}>
                    {hourCounts.map((count, h) => (
                      <div key={h} className="group relative flex-1 flex items-end">
                        <div
                          className={`w-full rounded-t transition-colors ${h === peakHour ? 'bg-brand-600' : 'bg-brand-300 group-hover:bg-brand-500'}`}
                          style={{ height: `${Math.max((count / hourMax) * 100, count > 0 ? 8 : 1)}%` }}
                        />
                        {count > 0 && (
                          <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
                            <div className="bg-surface-900 text-white text-[10px] rounded px-1.5 py-1 whitespace-nowrap">
                              {h}:00 · {count}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-surface-400">
                    <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>11pm</span>
                  </div>
                </div>
                {/* Day of week */}
                <div>
                  <p className="mb-2 text-xs font-medium text-surface-600">By day of week</p>
                  <div className="flex items-end gap-1" style={{ height: '40px' }}>
                    {dowCounts.map((count, d) => (
                      <div key={d} className="group relative flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className={`w-full rounded-t transition-colors ${DOW_LABELS[d] === peakDay ? 'bg-pink-500' : 'bg-pink-300 group-hover:bg-pink-500'}`}
                          style={{ height: `${Math.max((count / dowMax) * 100, count > 0 ? 10 : 1)}%` }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="mt-1 flex justify-between text-[9px] text-surface-400">
                    {DOW_LABELS.map(d => <span key={d}>{d}</span>)}
                  </div>
                </div>
                <div className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs text-brand-700">
                  Best time: <span className="font-semibold">{peakDay}s around {peakHour}:00</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── QR Performance table ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-surface-500" /> QR Code Performance</CardTitle>
            <Badge variant="default">{qrCodes.length} codes</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {qrPerformance.length === 0 ? (
            <EmptyState
              icon={<QrCode className="h-8 w-8" />}
              title="No QR codes yet"
              description="Generate your first QR code to start tracking."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100">
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-surface-400">QR Code</th>
                    <th className="pb-3 text-left text-xs font-semibold uppercase tracking-[0.12em] text-surface-400">Linked To</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-surface-400">All-Time</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-surface-400">{timeRange}d Scans</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-surface-400">Unique</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-surface-400">Signups</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-surface-400">Conv %</th>
                    <th className="pb-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-surface-400">Last Scan</th>
                    <th className="pb-3 w-6" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-50">
                  {qrPerformance.map(({ qr, periodScans: ps, unique, signups, lastScan, recentEvents, entityLabel, entityType, entityId }) => {
                    const allTime = qr.scan_count || 0
                    const rate = ps > 0 ? ((signups / ps) * 100).toFixed(1) : '0.0'
                    const isExpanded = expandedQr === qr.id
                    return (
                      <React.Fragment key={qr.id}>
                        <tr
                          className={`cursor-pointer transition-colors hover:bg-surface-50 ${isExpanded ? 'bg-brand-50' : ''}`}
                          onClick={() => setExpandedQr(isExpanded ? null : qr.id)}
                        >
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              {isExpanded
                                ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                                : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-surface-300" />}
                              <div>
                                <p className="font-medium text-surface-900">{qr.name}</p>
                                <Badge variant={qr.brand === 'hato' ? 'hato' : 'info'} className="text-[10px]">
                                  {BRANDS[qr.brand]?.label || qr.brand}
                                </Badge>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4">
                            {entityLabel && entityId ? (
                              <Link
                                href={`/crm/${entityType === 'business' ? 'businesses' : 'causes'}/${entityId}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1.5 text-xs text-brand-700 hover:underline"
                              >
                                {entityType === 'business' ? <Store className="h-3 w-3" /> : <Heart className="h-3 w-3" />}
                                {entityLabel}
                                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                              </Link>
                            ) : (
                              <span className="text-xs text-surface-400">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold text-surface-900">{allTime.toLocaleString()}</td>
                          <td className="py-3 pr-4 text-right">
                            <span className={ps > 0 ? 'font-medium text-brand-700' : 'text-surface-400'}>{ps}</span>
                          </td>
                          <td className="py-3 pr-4 text-right text-surface-600">{unique}</td>
                          <td className="py-3 pr-4 text-right">
                            {signups > 0
                              ? <Badge variant="success">{signups}</Badge>
                              : <span className="text-surface-400">0</span>}
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <Badge variant={Number(rate) >= 5 ? 'success' : Number(rate) > 0 ? 'warning' : 'default'}>
                              {rate}%
                            </Badge>
                          </td>
                          <td className="py-3 pr-4 text-right text-xs text-surface-500">
                            {lastScan ? formatDateTime(lastScan) : <span className="text-surface-300">Never</span>}
                          </td>
                          <td className="py-3">
                            <Badge variant={qr.status === 'active' ? 'success' : 'default'} dot />
                          </td>
                        </tr>

                        {/* Expanded row: recent scans for this QR */}
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="px-6 pb-4 pt-0 bg-brand-50">
                              <div className="rounded-xl border border-brand-100 bg-white overflow-hidden">
                                {recentEvents.length === 0 ? (
                                  <p className="px-4 py-4 text-sm text-surface-400 text-center">No scan events recorded in this period.</p>
                                ) : (
                                  <table className="w-full text-xs">
                                    <thead>
                                      <tr className="border-b border-surface-100 bg-surface-50">
                                        <th className="px-4 py-2 text-left font-medium text-surface-500">Time</th>
                                        <th className="px-4 py-2 text-left font-medium text-surface-500">Device</th>
                                        <th className="px-4 py-2 text-left font-medium text-surface-500">Browser / OS</th>
                                        <th className="px-4 py-2 text-left font-medium text-surface-500">Source</th>
                                        <th className="px-4 py-2 text-left font-medium text-surface-500">Referrer</th>
                                        <th className="px-4 py-2 text-left font-medium text-surface-500">IP</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-surface-50">
                                      {recentEvents.map(ev => {
                                        const dev = parseDevice(ev.user_agent)
                                        return (
                                          <tr key={ev.id} className="hover:bg-surface-50">
                                            <td className="px-4 py-2 text-surface-600 whitespace-nowrap">{formatDateTime(ev.scanned_at)}</td>
                                            <td className="px-4 py-2">
                                              <span className="flex items-center gap-1 capitalize text-surface-700">
                                                {DEVICE_ICON[dev]} {dev}
                                              </span>
                                            </td>
                                            <td className="px-4 py-2 text-surface-600">
                                              {parseBrowser(ev.user_agent)} · {parseOS(ev.user_agent)}
                                            </td>
                                            <td className="px-4 py-2">
                                              <Badge variant="default">{parseReferrerCategory(ev.referrer)}</Badge>
                                            </td>
                                            <td className="px-4 py-2 text-surface-500 truncate max-w-[160px]">
                                              {parseReferrerDomain(ev.referrer)}
                                            </td>
                                            <td className="px-4 py-2 font-mono text-surface-400">{ev.ip_address || '—'}</td>
                                          </tr>
                                        )
                                      })}
                                    </tbody>
                                  </table>
                                )}
                                <div className="px-4 py-2 border-t border-surface-100 bg-surface-50 flex items-center justify-between">
                                  <p className="text-xs text-surface-500">Showing last {recentEvents.length} scan events</p>
                                  <Link
                                    href={`/qr/mine`}
                                    className="text-xs text-brand-600 hover:underline flex items-center gap-1"
                                    onClick={e => e.stopPropagation()}
                                  >
                                    Manage QR <ExternalLink className="h-3 w-3" />
                                  </Link>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Conversion funnel ── */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Zap className="h-4 w-4 text-surface-500" /> Conversion Funnel ({timeRange}d)</CardTitle></CardHeader>
        <CardContent>
          {periodScans === 0 ? (
            <p className="py-4 text-center text-sm text-surface-400">No data in this period</p>
          ) : (
            <div className="space-y-3">
              {[
                { label: 'QR Scans', value: periodScans, pct: 100, color: 'bg-brand-500' },
                { label: 'Unique Visitors', value: uniqueVisitors, pct: periodScans > 0 ? Math.round((uniqueVisitors / periodScans) * 100) : 0, color: 'bg-brand-400' },
                { label: 'Signups / Conversions', value: periodSignups, pct: periodScans > 0 ? Math.round((periodSignups / periodScans) * 100) : 0, color: 'bg-success-500' },
              ].map(step => (
                <div key={step.label} className="flex items-center gap-4">
                  <div className="w-48 shrink-0">
                    <div className="h-9 rounded-xl overflow-hidden bg-surface-100">
                      <div
                        className={`h-full rounded-xl flex items-center px-3 transition-all ${step.color}`}
                        style={{ width: `${Math.max(step.pct, 3)}%` }}
                      >
                        <span className="text-xs font-semibold text-white whitespace-nowrap">{step.value.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="h-9 rounded-xl overflow-hidden bg-surface-50 border border-surface-100">
                      <div
                        className={`h-full rounded-xl ${step.color} opacity-20`}
                        style={{ width: `${step.pct}%` }}
                      />
                    </div>
                  </div>
                  <div className="w-32 shrink-0">
                    <p className="text-sm font-medium text-surface-800">{step.label}</p>
                    <p className="text-xs text-surface-500">{step.pct}% of scans</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Recent Events feed ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-surface-500" /> Live Event Feed
            </CardTitle>
            <p className="text-xs text-surface-500">
              {filteredEvents.length.toLocaleString()} event{filteredEvents.length !== 1 ? 's' : ''} in period
            </p>
          </div>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="py-6 text-center text-sm text-surface-400">No events recorded yet. Scan a QR code to see data appear here.</p>
          ) : (
            <div className="space-y-1.5">
              {recentEvents.map(({ ev, qr, device, browser, os, refCat, refDomain, isScan }) => (
                <div key={ev.id} className="flex items-start gap-3 rounded-xl border border-surface-100 bg-surface-50 px-4 py-2.5 hover:bg-white transition-colors">
                  <div className="mt-0.5 shrink-0">
                    {isScan
                      ? <div className="h-6 w-6 rounded-full bg-brand-100 flex items-center justify-center"><MousePointer className="h-3 w-3 text-brand-600" /></div>
                      : <div className="h-6 w-6 rounded-full bg-success-100 flex items-center justify-center"><CheckCircle2 className="h-3 w-3 text-success-600" /></div>}
                  </div>
                  <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0.5">
                    <div className="col-span-2 sm:col-span-1">
                      <p className="text-xs text-surface-500">{formatDateTime(ev.scanned_at)}</p>
                      <p className="text-sm font-medium text-surface-900 truncate">{qr?.name || 'Unknown QR'}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-surface-400">Device</p>
                      <p className="text-xs text-surface-700 flex items-center gap-1 capitalize">
                        {DEVICE_ICON[device]} {device} · {browser}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-surface-400">Source</p>
                      <p className="text-xs text-surface-700">{refCat} {refDomain !== 'Direct' ? `· ${refDomain}` : ''}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-wide text-surface-400">Type</p>
                      <Badge variant={isScan ? 'info' : 'success'} className="text-[10px]">
                        {isScan ? 'Scan' : (ev.event_type as string) === 'support_signup' ? 'Community signup' : 'Business signup'}
                      </Badge>
                    </div>
                  </div>
                  {ev.ip_address && (
                    <p className="shrink-0 self-center font-mono text-[10px] text-surface-400 hidden lg:block">
                      {ev.ip_address}
                    </p>
                  )}
                </div>
              ))}
              {filteredEvents.length > 50 && (
                <button
                  onClick={() => setShowAllEvents(!showAllEvents)}
                  className="mt-2 w-full rounded-xl border border-dashed border-surface-300 py-3 text-sm text-surface-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
                >
                  {showAllEvents ? 'Show fewer events' : `Show all ${filteredEvents.length.toLocaleString()} events`}
                </button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
