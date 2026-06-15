import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  breadcrumb?: { label: string; href?: string }[]
  className?: string
}

export function PageHeader({ title, description, actions, breadcrumb, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6 rounded-[1.75rem] border border-surface-200/90 bg-white/80 p-5 shadow-sm backdrop-blur-sm sm:p-6', className)}>
      {breadcrumb && (
        <nav className="mb-2 flex items-center gap-1.5 text-xs text-surface-400">
          {breadcrumb.map((item, idx) => (
            <span key={idx} className="flex items-center gap-1.5">
              {idx > 0 && <span>/</span>}
              {item.href ? (
                <a href={item.href} className="hover:text-surface-600 transition-colors">
                  {item.label}
                </a>
              ) : (
                <span className="text-surface-600">{item.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">Overview</p>
          <h1 className="mt-2 text-display text-surface-900">{title}</h1>
          {description && (
            <p className="mt-2 max-w-3xl text-body text-surface-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
