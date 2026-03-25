'use client'

import * as React from 'react'
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Filter, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Input } from './input'
import { Button } from './button'
import { Badge } from './badge'

// ─── Types ───────────────────────────────────────────────────

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  width?: string
  render?: (item: T) => React.ReactNode
  className?: string
}

export interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField: string
  searchable?: boolean
  searchPlaceholder?: string
  onRowClick?: (item: T) => void
  emptyState?: React.ReactNode
  loading?: boolean
  filters?: FilterDef[]
  activeFilters?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  actions?: React.ReactNode
}

interface FilterDef {
  key: string
  label: string
  options: { value: string; label: string }[]
}

// ─── Component ───────────────────────────────────────────────

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  searchable = true,
  searchPlaceholder = 'Search...',
  onRowClick,
  emptyState,
  loading = false,
  filters,
  activeFilters = {},
  onFilterChange,
  actions,
}: DataTableProps<T>) {
  const [search, setSearch] = React.useState('')
  const [sortKey, setSortKey] = React.useState<string | null>(null)
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc')

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const filtered = React.useMemo(() => {
    let result = data
    if (search) {
      const q = search.toLowerCase()
      result = result.filter(item =>
        Object.values(item).some(v =>
          String(v ?? '').toLowerCase().includes(q)
        )
      )
    }
    if (sortKey) {
      result = [...result].sort((a, b) => {
        const av = String(a[sortKey] ?? '')
        const bv = String(b[sortKey] ?? '')
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return result
  }, [data, search, sortKey, sortDir])

  const hasActiveFilters = Object.values(activeFilters).some(v => v !== '')

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        {searchable && (
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="pl-9"
            />
          </div>
        )}
        {filters?.map(f => (
          <select
            key={f.key}
            value={activeFilters[f.key] || ''}
            onChange={e => onFilterChange?.(f.key, e.target.value)}
            className="h-9 rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm text-surface-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">{f.label}</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => filters?.forEach(f => onFilterChange?.(f.key, ''))}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {actions}
        </div>
      </div>

      {/* Count */}
      <div className="flex items-center gap-2 text-xs text-surface-500">
        <span>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        {hasActiveFilters && (
          <Badge variant="info" dot>Filtered</Badge>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-card border border-surface-200 bg-surface-0">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(col.sortable && 'cursor-pointer select-none', col.className)}
                  onClick={() => col.sortable && handleSort(col.key)}
                >
                  <span className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortKey === col.key
                        ? (sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />)
                        : <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center text-surface-400">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
                    Loading...
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="py-12 text-center">
                  {emptyState || (
                    <div className="text-surface-400">
                      <p className="text-sm font-medium">No results found</p>
                      <p className="mt-1 text-xs">Try adjusting your search or filters</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filtered.map(item => (
                <tr
                  key={String(item[keyField])}
                  onClick={() => onRowClick?.(item)}
                  className={cn(onRowClick && 'cursor-pointer')}
                >
                  {columns.map(col => (
                    <td key={col.key} className={col.className}>
                      {col.render ? col.render(item) : String(item[col.key] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
