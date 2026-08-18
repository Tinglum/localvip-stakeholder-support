'use client'

import * as React from 'react'
import { Flame, Loader2, Mail, MapPin, Phone, Quote, User } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/utils'

export const NOMINATION_STATUSES = [
  { value: 'received', label: 'Received', variant: 'warning' as const },
  { value: 'contacted', label: 'Contacted', variant: 'info' as const },
  { value: 'onboarding', label: 'Onboarding', variant: 'info' as const },
  { value: 'joined', label: 'Joined', variant: 'success' as const },
  { value: 'declined', label: 'Declined', variant: 'default' as const },
]

export interface Nomination {
  id: string | number
  businessName?: string | null
  city?: string | null
  contactName?: string | null
  contactEmail?: string | null
  contactPhone?: string | null
  reason?: string | null
  relationship?: string | null
  status?: string | null
  nominationCount?: number | null
  createdAtUtc?: string | null
  nominatedByUserId?: string | null
  nominatedByName?: string | null
}

export const statusLabel = (v: string) => NOMINATION_STATUSES.find((s) => s.value === v)?.label || v
export const statusVariant = (v: string) => NOMINATION_STATUSES.find((s) => s.value === v)?.variant || 'default'

const accent = (status: string) =>
  status === 'received' ? 'border-l-warning-400 bg-warning-50/30'
    : status === 'contacted' ? 'border-l-brand-400 bg-brand-50/30'
    : status === 'onboarding' ? 'border-l-brand-500 bg-brand-50/40'
    : status === 'joined' ? 'border-l-success-400 bg-success-50/20'
    : 'border-l-surface-300'

export function NominationCard({ nomination, saving, onStatusChange }: {
  nomination: Nomination
  saving: boolean
  onStatusChange: (id: string | number, status: string) => void
}) {
  const status = String(nomination.status || 'received')
  const count = Number(nomination.nominationCount || 1)
  const hot = count >= 3

  return (
    <Card className={`border-l-4 p-5 ${accent(status)}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold text-surface-900">{nomination.businessName || 'Unnamed business'}</h3>
            <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>
            {nomination.relationship && <Badge variant="outline">{nomination.relationship}</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-surface-500">
            {nomination.city && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{nomination.city}</span>}
            {nomination.contactName && <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{nomination.contactName}</span>}
            {nomination.contactEmail && (
              <a href={`mailto:${nomination.contactEmail}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                <Mail className="h-3.5 w-3.5" />{nomination.contactEmail}
              </a>
            )}
            {nomination.contactPhone && (
              <a href={`tel:${nomination.contactPhone}`} className="inline-flex items-center gap-1 hover:text-brand-600">
                <Phone className="h-3.5 w-3.5" />{nomination.contactPhone}
              </a>
            )}
            <span>{nomination.createdAtUtc ? formatDate(nomination.createdAtUtc) : '—'}</span>
          </div>
        </div>

        {/* The key sales signal: how many different people asked for this business. */}
        <div className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2 ${hot ? 'border-danger-200 bg-danger-50' : count > 1 ? 'border-brand-200 bg-brand-50' : 'border-surface-200 bg-surface-50'}`}>
          <span className={`text-3xl font-semibold leading-none ${hot ? 'text-danger-600' : count > 1 ? 'text-brand-700' : 'text-surface-800'}`}>{count}</span>
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-surface-500">
            {hot && <Flame className="h-3 w-3 text-danger-500" />}
            {count === 1 ? 'nomination' : 'nominations'}
          </span>
        </div>
      </div>

      {nomination.reason && (
        <blockquote className="mt-4 flex gap-2 rounded-xl border border-surface-200 bg-white px-4 py-3 text-sm text-surface-700">
          <Quote className="h-4 w-4 shrink-0 text-surface-300" />
          <span>
            <span className="italic">{nomination.reason}</span>
            {nomination.nominatedByName && <span className="mt-1 block text-xs not-italic text-surface-400">— {nomination.nominatedByName}</span>}
          </span>
        </blockquote>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs text-surface-400">Move to:</span>
        {NOMINATION_STATUSES.filter((s) => s.value !== status).map((s) => (
          <button
            key={s.value}
            disabled={saving}
            onClick={() => onStatusChange(nomination.id, s.value)}
            className="rounded-lg border border-surface-200 bg-white px-2.5 py-1 text-xs font-medium text-surface-600 hover:bg-surface-50 disabled:opacity-50"
          >
            {s.label}
          </button>
        ))}
        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin text-surface-400" />}
      </div>
    </Card>
  )
}
