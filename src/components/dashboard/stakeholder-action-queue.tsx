import Link from 'next/link'
import { ArrowRight, CheckCircle2, Clock3, Sparkles } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export interface StakeholderActionItem {
  id: string
  title: string
  detail: string
  href: string
  ctaLabel?: string
  priority?: 'high' | 'medium' | 'low'
  badge?: string
  dueLabel?: string
}

export interface StakeholderActionSuggestion {
  id: string
  title: string
  detail: string
  href: string
  ctaLabel?: string
}

function priorityVariant(priority: StakeholderActionItem['priority']) {
  switch (priority) {
    case 'high':
      return 'danger' as const
    case 'medium':
      return 'warning' as const
    default:
      return 'info' as const
  }
}

export function StakeholderActionQueue({
  title = 'Immediate next steps',
  description,
  items,
  suggestions,
}: {
  title?: string
  description?: string
  items: StakeholderActionItem[]
  suggestions: StakeholderActionSuggestion[]
}) {
  return (
    <Card className="border-surface-200">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-surface-900">{item.title}</p>
                    {item.priority ? (
                      <Badge variant={priorityVariant(item.priority)}>{item.priority === 'high' ? 'Immediate' : item.priority === 'medium' ? 'Next up' : 'Keep moving'}</Badge>
                    ) : null}
                    {item.badge ? <Badge variant="outline">{item.badge}</Badge> : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-surface-700">{item.detail}</p>
                  {item.dueLabel ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-surface-500">
                      <Clock3 className="h-3.5 w-3.5" />
                      <span>{item.dueLabel}</span>
                    </div>
                  ) : null}
                </div>
                <Button asChild size="sm">
                  <Link href={item.href}>
                    {item.ctaLabel || 'Open'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-success-200 bg-success-50 p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-success-100 p-2 text-success-700">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-base font-semibold text-success-800">You have finished all immediate items.</p>
                  <p className="mt-1 text-sm text-success-800/80">
                    It would be suggested to now do these three:
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {suggestions.slice(0, 3).map((suggestion) => (
                    <Link
                      key={suggestion.id}
                      href={suggestion.href}
                      className="rounded-2xl border border-success-200 bg-white/85 px-4 py-4 transition-colors hover:border-success-300 hover:bg-white"
                    >
                      <div className="flex items-start gap-3">
                        <div className="rounded-full bg-success-100 p-2 text-success-700">
                          <Sparkles className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-surface-900">{suggestion.title}</p>
                          <p className="mt-2 text-xs leading-5 text-surface-600">{suggestion.detail}</p>
                          <div className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-success-700">
                            <span>{suggestion.ctaLabel || 'Open'}</span>
                            <ArrowRight className="h-3.5 w-3.5" />
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
