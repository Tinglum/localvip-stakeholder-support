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
          <p className="text-caption text-surface-500 uppercase tracking-wider">{label}</p>
          <p className="mt-1 text-2xl font-bold text-surface-900">{displayValue}</p>
        </div>
        {icon && (
          <div className="rounded-lg bg-surface-100 p-2 text-surface-500">
            {icon}
          </div>
        )}
      </div>
      {change !== undefined && (
        <div className={cn('mt-3 flex items-center gap-1 text-xs', trendColor)}>
          <TrendIcon className="h-3.5 w-3.5" />
          <span className="font-medium">{change > 0 ? '+' : ''}{change.toFixed(1)}%</span>
          <span className="text-surface-400">{changePeriod}</span>
        </div>
      )}
    </div>
  )
}
