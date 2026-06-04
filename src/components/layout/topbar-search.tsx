'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Search, Building2, Heart, Users, UserCheck, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SearchResult {
  type: 'business' | 'cause' | 'contact' | 'stakeholder'
  id: number | string
  name: string
  subtitle?: string | null
}

const ICONS: Record<SearchResult['type'], React.ElementType> = {
  business: Building2,
  cause: Heart,
  contact: Users,
  stakeholder: UserCheck,
}

const HREFS: Record<SearchResult['type'], (id: string | number) => string> = {
  business: (id) => `/crm/businesses/${id}`,
  cause: (id) => `/crm/causes/${id}`,
  contact: (id) => `/crm/contacts/${id}`,
  stakeholder: (id) => `/crm/stakeholders/${id}`,
}

interface TopbarSearchProps {
  value: string
  onChange: (next: string) => void
  placeholder: string
  onSubmit: (query: string) => void
}

export const TopbarSearch = React.forwardRef<HTMLInputElement, TopbarSearchProps>(
  function TopbarSearch({ value, onChange, placeholder, onSubmit }, ref) {
    const router = useRouter()
    const [results, setResults] = React.useState<SearchResult[]>([])
    const [loading, setLoading] = React.useState(false)
    const [open, setOpen] = React.useState(false)
    const [activeIdx, setActiveIdx] = React.useState(0)
    const containerRef = React.useRef<HTMLDivElement>(null)

    // Debounced fetch
    React.useEffect(() => {
      const trimmed = value.trim()
      if (trimmed.length < 2) {
        setResults([])
        setOpen(false)
        return
      }
      let cancelled = false
      setLoading(true)
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/qa/search?q=${encodeURIComponent(trimmed)}`, { cache: 'no-store' })
          if (!res.ok) { if (!cancelled) { setResults([]); setOpen(true) } ; return }
          const json = await res.json()
          if (!cancelled) {
            const list = Array.isArray(json?.results) ? json.results.slice(0, 12) : []
            setResults(list as SearchResult[])
            setOpen(true)
            setActiveIdx(0)
          }
        } catch {
          if (!cancelled) { setResults([]); setOpen(true) }
        } finally {
          if (!cancelled) setLoading(false)
        }
      }, 200)
      return () => { cancelled = true; clearTimeout(timer) }
    }, [value])

    // Click-outside
    React.useEffect(() => {
      function onPointerDown(e: PointerEvent) {
        if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
      }
      document.addEventListener('pointerdown', onPointerDown)
      return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [])

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(results.length - 1, i + 1)) }
      else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(0, i - 1)) }
      else if (e.key === 'Enter') {
        if (open && results[activeIdx]) {
          const r = results[activeIdx]
          router.push(HREFS[r.type](r.id))
          setOpen(false)
          onChange('')
        } else {
          onSubmit(value)
        }
      } else if (e.key === 'Escape') {
        setOpen(false)
      }
    }

    return (
      <div ref={containerRef} className="relative max-w-xs w-72 hidden sm:block">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400 pointer-events-none" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder={placeholder}
          className="h-8 w-full rounded-lg bg-surface-100 pl-9 pr-14 text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500"
        />
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center rounded bg-surface-200 px-1.5 py-0.5 text-[10px] font-medium text-surface-400">
          {typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? '⌘' : 'Ctrl+'}K
        </kbd>

        {open && (
          <div
            className="absolute left-0 right-0 top-10 z-50 max-h-96 overflow-y-auto rounded-lg border border-surface-200 bg-white shadow-lg ring-1 ring-black/5 animate-fade-in"
            role="listbox"
          >
            {loading && results.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-surface-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching…
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-3 text-xs text-surface-400">No matches. Press Enter to search everywhere.</div>
            ) : (
              <ul className="py-1">
                {results.map((r, idx) => {
                  const Icon = ICONS[r.type]
                  return (
                    <li
                      key={`${r.type}-${r.id}`}
                      role="option"
                      aria-selected={idx === activeIdx}
                      onMouseEnter={() => setActiveIdx(idx)}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        router.push(HREFS[r.type](r.id))
                        setOpen(false)
                        onChange('')
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors',
                        idx === activeIdx ? 'bg-brand-50 text-brand-800' : 'text-surface-700 hover:bg-surface-50',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.name}</div>
                        {r.subtitle && <div className="truncate text-xs text-surface-400">{r.subtitle}</div>}
                      </div>
                      <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-surface-500">
                        {r.type}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    )
  }
)
