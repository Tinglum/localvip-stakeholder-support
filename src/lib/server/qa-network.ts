import type { QaNetworkTree, QaNetworkMonthlySpend } from '@/lib/auth/qa-api'

export type QaNetworkPeriod = 'day' | 'week' | 'month' | 'year' | 'all' | 'custom'

export interface QaNetworkSpendFilter {
  period?: QaNetworkPeriod
  startDate?: string | null
  endDate?: string | null
}

export interface QaNetworkProjectionPoint {
  monthLabel: string
  projectedSpend: number
  projectedIncome: number | null
}

export interface QaNetworkProjection {
  basis: 'all_time_average' | 'selected_period'
  period: QaNetworkPeriod
  startDate: string | null
  endDate: string | null
  currentWindowSpend: number
  previousWindowSpend: number | null
  currentMonthlySpendRate: number
  currentMonthlyIncomeRate: number | null
  previousMonthlySpendRate: number | null
  observedGrowthRate: number
  incomeConversionRate: number | null
  projected12MonthSpend: number
  projected12MonthIncome: number | null
  next12Months: QaNetworkProjectionPoint[]
}

type NetworkTreeWithSpend = QaNetworkTree & {
  totalNetworkSpend?: number
  projection?: QaNetworkProjection
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

function normalizeDateOnly(value: string | null | undefined) {
  if (!value) return null
  const trimmed = value.trim()
  return DATE_ONLY_PATTERN.test(trimmed) ? trimmed : null
}

export function normalizeQaNetworkSpendFilter(filter?: QaNetworkSpendFilter) {
  return {
    period: filter?.period ?? 'all',
    startDate: normalizeDateOnly(filter?.startDate),
    endDate: normalizeDateOnly(filter?.endDate),
  }
}

function subtractPeriod(now: Date, period: Exclude<QaNetworkPeriod, 'all' | 'custom'>) {
  const date = new Date(now)
  switch (period) {
    case 'day': date.setUTCDate(date.getUTCDate() - 1); break
    case 'week': date.setUTCDate(date.getUTCDate() - 7); break
    case 'month': date.setUTCMonth(date.getUTCMonth() - 1); break
    case 'year': date.setUTCFullYear(date.getUTCFullYear() - 1); break
  }
  return date
}

/**
 * Resolve the selected period into concrete start/end date strings the QA
 * backend can filter on. The backend does the per-member spend aggregation in
 * one query, so we never fetch transactions per node here.
 */
export function resolveQaNetworkWindow(filter?: QaNetworkSpendFilter): {
  period: QaNetworkPeriod
  startDate: string | null
  endDate: string | null
} {
  const normalized = normalizeQaNetworkSpendFilter(filter)
  const now = new Date()

  if (normalized.period === 'all') {
    return { period: 'all', startDate: null, endDate: null }
  }
  if (normalized.period === 'custom') {
    const { startDate, endDate } = normalized
    const reversed = startDate && endDate && startDate > endDate
    return {
      period: 'custom',
      startDate: reversed ? endDate : startDate,
      endDate: reversed ? startDate : endDate,
    }
  }
  return {
    period: normalized.period,
    startDate: subtractPeriod(now, normalized.period).toISOString().slice(0, 10),
    endDate: now.toISOString().slice(0, 10),
  }
}

function sortMonthly(series: QaNetworkMonthlySpend[]) {
  return series.slice().sort((a, b) => a.year - b.year || a.month - b.month)
}

function averageSpend(series: QaNetworkMonthlySpend[]) {
  if (series.length === 0) return 0
  return series.reduce((sum, m) => sum + m.spend, 0) / series.length
}

function buildProjectionSeries(baseMonthlySpend: number, incomeConversionRate: number | null) {
  const points: QaNetworkProjectionPoint[] = []
  const start = new Date()
  const current = Math.max(baseMonthlySpend, 0)
  for (let i = 0; i < 12; i += 1) {
    const monthDate = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i + 1, 1))
    points.push({
      monthLabel: monthDate.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
      projectedSpend: current,
      projectedIncome: incomeConversionRate == null ? null : current * incomeConversionRate,
    })
  }
  return points
}

/**
 * Build the 12-month forecast from the backend's monthly spend series.
 * This is intentionally a flat annualization of the current monthly pace,
 * not a compounding growth forecast.
 */
function buildProjection(
  tree: QaNetworkTree,
  window: ReturnType<typeof resolveQaNetworkWindow>,
): QaNetworkProjection {
  const monthly = sortMonthly(tree.monthlyNetworkSpend ?? [])
  const totalNetworkEarnings = typeof tree.totalNetworkEarnings === 'number' ? tree.totalNetworkEarnings : null
  const currentWindowSpend = typeof tree.totalNetworkSpend === 'number' ? tree.totalNetworkSpend : 0

  const allTimeSpend = monthly.reduce((sum, m) => sum + m.spend, 0)
  const incomeConversionRate =
    allTimeSpend > 0 && totalNetworkEarnings != null && totalNetworkEarnings > 0
      ? totalNetworkEarnings / allTimeSpend
      : null

  const recent = monthly.slice(-3)
  const prior = monthly.slice(-6, -3)
  const currentMonthlySpendRate = recent.length > 0 ? averageSpend(recent) : (monthly.length > 0 ? averageSpend(monthly.slice(-1)) : 0)
  const previousMonthlySpendRate = prior.length > 0 ? averageSpend(prior) : null
  const currentMonthlyIncomeRate = incomeConversionRate == null ? null : currentMonthlySpendRate * incomeConversionRate

  const rawGrowth =
    previousMonthlySpendRate && previousMonthlySpendRate > 0
      ? (currentMonthlySpendRate - previousMonthlySpendRate) / previousMonthlySpendRate
      : 0
  const observedGrowthRate = rawGrowth

  const next12Months = buildProjectionSeries(currentMonthlySpendRate, incomeConversionRate)
  const projected12MonthSpend = currentMonthlySpendRate * 12
  const projected12MonthIncome = currentMonthlyIncomeRate == null ? null : currentMonthlyIncomeRate * 12

  return {
    basis: window.period === 'all' ? 'all_time_average' : 'selected_period',
    period: window.period,
    startDate: window.startDate,
    endDate: window.endDate,
    currentWindowSpend,
    previousWindowSpend: previousMonthlySpendRate,
    currentMonthlySpendRate,
    currentMonthlyIncomeRate,
    previousMonthlySpendRate,
    observedGrowthRate,
    incomeConversionRate,
    projected12MonthSpend,
    projected12MonthIncome,
    next12Months,
  }
}

/**
 * Attach the period window + 12-month projection to a tree the backend has
 * already enriched with per-member spend. No per-node fetching — the backend
 * aggregates spend in a single query, so this scales to large networks.
 */
export function enrichQaNetworkTreeWithSpend(tree: QaNetworkTree, filter?: QaNetworkSpendFilter): NetworkTreeWithSpend {
  const window = resolveQaNetworkWindow(filter)
  return {
    ...tree,
    period: window.period,
    startDate: window.startDate,
    endDate: window.endDate,
    spendById: tree.spendById ?? [],
    totalNetworkSpend: typeof tree.totalNetworkSpend === 'number' ? tree.totalNetworkSpend : 0,
    projection: buildProjection(tree, window),
  }
}
