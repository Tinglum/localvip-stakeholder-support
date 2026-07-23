import Link from 'next/link'
import { cn, formatNumber } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

interface StatCardProps {
  label: string
  value: number | string
  change?: number
  changePeriod?: string
  /** A small plain-language line under the value, e.g. "+3 new this week". */
  subtitle?: string
  icon?: React.ReactNode
  className?: string
  format?: 'number' | 'percent' | 'raw'
  /**
   * Where the number leads. When set, the whole card becomes one link — a number
   * on a dashboard is a question ("which 101 businesses?"), and the answer should
   * be one click away. Optional: cards that summarise something with no list
   * behind it (e.g. diagnostics counts) stay non-interactive rather than linking
   * somewhere that doesn't answer the question.
   */
  href?: string
}

export function StatCard({
  label,
  value,
  change,
  changePeriod = 'vs last period',
  subtitle,
  icon,
  className,
  format = 'number',
  href,
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

  const card = (
    <div
      className={cn(
        'stat-card h-full',
        // Only show affordance when the card actually goes somewhere.
        href && 'transition-shadow hover:shadow-card-hover focus-visible:shadow-card-hover',
        className,
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-surface-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-surface-900">{displayValue}</p>
          {subtitle && <p className="mt-1 text-xs text-surface-500">{subtitle}</p>}
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

  if (!href) return card

  return (
    <Link
      href={href}
      // The label already says what the number is; naming the destination tells a
      // screen-reader user where the click goes, which the number alone does not.
      aria-label={`${label}: ${displayValue}. View details`}
      className="block rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
    >
      {card}
    </Link>
  )
}
