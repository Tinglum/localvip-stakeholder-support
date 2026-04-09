'use client'

import * as React from 'react'
import { Database, FilePlus2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export interface QaImportedFact {
  label: string
  value: string | null | undefined
}

export interface QaWritebackRow {
  field: string
  currentValue: string
  qaNeed: string
  status: string
}

export function QaImportedFieldsPanel({
  title,
  description,
  facts,
  accentLabel = 'Live QA import',
}: {
  title: string
  description: string
  facts: QaImportedFact[]
  accentLabel?: string
}) {
  const visibleFacts = facts.filter((fact) => fact.value && String(fact.value).trim())

  if (visibleFacts.length === 0) return null

  return (
    <Card className="border-sky-200 bg-sky-50/70">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base text-sky-950">{title}</CardTitle>
            <p className="mt-1 text-sm text-sky-800">{description}</p>
          </div>
          <Badge variant="info" className="border-sky-200 bg-sky-100 text-sky-800">
            <Database className="mr-1 h-3.5 w-3.5" />
            {accentLabel}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {visibleFacts.map((fact) => (
          <div key={fact.label} className="rounded-xl border border-sky-200 bg-white/80 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.16em] text-sky-700">{fact.label}</p>
            <p className="mt-2 break-words text-sm font-medium text-sky-950">{fact.value}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export function QaWritebackWishlistTable({
  title,
  description,
  rows,
}: {
  title: string
  description: string
  rows: QaWritebackRow[]
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="mt-1 text-sm text-surface-500">{description}</p>
          </div>
          <Badge variant="outline">
            <FilePlus2 className="mr-1 h-3.5 w-3.5" />
            {rows.length} tracked
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-5 text-sm text-surface-500">
            No dashboard-only data is being tracked for QA writeback on this record yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-surface-200">
            <div className="grid grid-cols-[1.15fr,1.15fr,1.1fr,0.9fr] gap-4 border-b border-surface-200 bg-surface-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-surface-500">
              <span>Dashboard field</span>
              <span>Current value</span>
              <span>Needs in QA</span>
              <span>Status</span>
            </div>
            {rows.map((row) => (
              <div
                key={`${row.field}-${row.qaNeed}`}
                className="grid grid-cols-[1.15fr,1.15fr,1.1fr,0.9fr] gap-4 border-b border-surface-100 px-4 py-3 text-sm last:border-b-0"
              >
                <div className="font-medium text-surface-900">{row.field}</div>
                <div className="text-surface-700">{row.currentValue}</div>
                <div className="text-surface-600">{row.qaNeed}</div>
                <div>
                  <Badge variant="outline" className="justify-center">
                    {row.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
