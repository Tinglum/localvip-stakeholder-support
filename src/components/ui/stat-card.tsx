import { cn, formatNumber } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  change?: number
  changePeriod?: string
  icon?: React.ReactNode
  className?: string
  format?: 'number' | 'percent' | 'raw'
}

export function StatCard({
  label,
  value,
  change,
  changePeriod = 'vs last period',
  icon,
  className,
  format = 'number',
}: StatCardProps) {
  const displayValue = format === 'number' && typeof value === 'number'
    ? formatNumber(value)
    : format === 'percent' && typeof value === 'number'
    ? `${value.toFixed(1)}%`
    : value

  const TrendIcon = change === undefined || change === 0
    ? Minus
    : change > 0
    ? TrendingUp
    : TrendingDown

  const trendColor = change === undefined || change === 0
    ? 'text-surface-400'
    : change > 0
    ? 'text-success-500'
    : 'text-danger-500'

  return (
    <div className={cn('stat-card', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-surface-900">{displayValue}</p>
        </div>
        {icon && (
          <div className="rounded-2xl bg-surface-100 p-3 text-surface-500 shadow-inner">
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className={cn('mt-4 inline-flex items-center gap-1 rounded-full bg-surface-50 px-2.5 py-1 text-xs', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="font-medium">{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
          <span className="text-surface-400">{changePeriod}</span>
        </div>
      )}
    </div>
  )
}
