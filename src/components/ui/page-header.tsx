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
    <div className={cn('mb-6', className)}>
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-display text-surface-900">{title}</h1>
          {description && (
            <p className="mt-1 text-body text-surface-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
    </div>
  )
}
