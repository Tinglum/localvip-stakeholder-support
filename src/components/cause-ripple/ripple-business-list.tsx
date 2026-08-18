import { Store } from 'lucide-react'

export type RippleBusiness = {
  businessAccountId: number
  businessName: string
  causeCents: number
}

const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100)

/**
 * The businesses whose customers' recommendations produced Ripple-attributed
 * funding for this cause, largest contributor first (the API already sorts
 * this way — this component does not re-sort).
 */
export function RippleBusinessList({ businesses }: { businesses: RippleBusiness[] }) {
  if (businesses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No business has produced Ripple-attributed funding for this cause yet.
      </p>
    )
  }

  return (
    <div className="space-y-1.5">
      {businesses.map((business) => (
        <div
          key={business.businessAccountId}
          className="flex items-center justify-between gap-4 text-sm"
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <Store className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{business.businessName || 'A business'}</span>
          </span>
          <span className="shrink-0 font-semibold tabular-nums">{money(business.causeCents)}</span>
        </div>
      ))}
    </div>
  )
}
