'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Heart, Loader2, Search, UserCheck, Users } from 'lucide-react'
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
  className?: string
  inputClassName?: string
  showShortcut?: boolean
  /** Command-palette quick links shown when the query is empty. */
  quickLinks?: { label: string; href: string }[]
}

export const TopbarSearch = React.forwardRef<HTMLInputElement, TopbarSearchProps>(
  function TopbarSearch(
    {
      value,
      onChange,
      placeholder,
      onSubmit,
      className,
      inputClassName,
      showShortcut = true,
      quickLinks = [],
    },
    ref
  ) {
    const router = useRouter()
    const [results, setResults] = React.useState<SearchResult[]>([])
    const [loading, setLoading] = React.useState(false)
    const [open, setOpen] = React.useState(false)
    const [activeIdx, setActiveIdx] = React.useState(0)
    const containerRef = React.useRef<HTMLDivElement>(null)

    React.useEffect(() => {
      const trimmed = value.trim()
      if (trimmed.length < 2) {
        setResults([])
        setLoading(false)
        // Keep the panel controllable by focus so quick-link commands can show
        // for an empty query (command-palette behaviour).
        return
      }

      let cancelled = false
      setLoading(true)

      const timer = window.setTimeout(async () => {
        try {
          const res = await fetch(`/api/qa/search?q=${encodeURIComponent(trimmed)}`, { cache: 'no-store' })
          if (!res.ok) {
            if (!cancelled) {
              setResults([])
              setOpen(true)
            }
            return
          }

          const json = await res.json()
          if (!cancelled) {
            const list = Array.isArray(json?.results) ? json.results.slice(0, 12) : []
            setResults(list as SearchResult[])
            setOpen(true)
            setActiveIdx(0)
          }
        } catch {
          if (!cancelled) {
            setResults([])
            setOpen(true)
          }
        } finally {
          if (!cancelled) {
            setLoading(false)
          }
        }
      }, 200)

      return () => {
        cancelled = true
        window.clearTimeout(timer)
      }
    }, [value])

    React.useEffect(() => {
      function onPointerDown(event: PointerEvent) {
        if (!containerRef.current?.contains(event.target as Node)) {
          setOpen(false)
        }
      }

      document.addEventListener('pointerdown', onPointerDown)
      return () => document.removeEventListener('pointerdown', onPointerDown)
    }, [])

    function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIdx((index) => Math.min(results.length - 1, index + 1))
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIdx((index) => Math.max(0, index - 1))
        return
      }

      if (event.key === 'Enter') {
        if (open && results[activeIdx]) {
          const result = results[activeIdx]
          router.push(HREFS[result.type](result.id))
          setOpen(false)
          onChange('')
          return
        }

        onSubmit(value)
        return
      }

      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    return (
      <div ref={containerRef} className={cn('relative w-full max-w-xs', className)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (results.length > 0 || quickLinks.length > 0) {
              setOpen(true)
            }
          }}
          placeholder={placeholder}
          className={cn(
            'h-9 w-full rounded-xl bg-surface-100 pl-9 pr-14 text-sm text-surface-700 placeholder:text-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500',
            inputClassName
          )}
        />
        {showShortcut ? (
          <kbd className="absolute right-2 top-1/2 hidden -translate-y-1/2 items-center rounded bg-surface-200 px-1.5 py-0.5 text-[10px] font-medium text-surface-400 sm:inline-flex">
            {typeof navigator !== 'undefined' && /Mac/i.test(navigator.userAgent) ? 'Cmd' : 'Ctrl'}+K
          </kbd>
        ) : null}

        {open ? (
          <div
            className="absolute left-0 right-0 top-11 z-50 max-h-96 overflow-y-auto rounded-xl border border-surface-200 bg-white shadow-lg ring-1 ring-black/5 animate-fade-in"
            role="listbox"
          >
            {value.trim().length < 2 && results.length === 0 ? (
              quickLinks.length > 0 ? (
                <div>
                  <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-surface-400">Quick actions</p>
                  <ul className="py-1">
                    {quickLinks.map((link) => (
                      <li
                        key={link.href}
                        role="option"
                        aria-selected={false}
                        onMouseDown={(event) => {
                          event.preventDefault()
                          router.push(link.href)
                          setOpen(false)
                          onChange('')
                        }}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-surface-700 transition-colors hover:bg-surface-50"
                      >
                        <Search className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                        <span className="truncate font-medium">{link.label}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="px-3 pb-2 text-[11px] text-surface-400">Or type at least 2 letters to search records.</p>
                </div>
              ) : (
                <div className="px-3 py-3 text-xs text-surface-400">Type at least 2 letters to search.</div>
              )
            ) : loading && results.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-3 text-xs text-surface-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Searching...
              </div>
            ) : results.length === 0 ? (
              <div className="px-3 py-3 text-xs text-surface-400">
                No matches yet. Press Enter to search the full section.
              </div>
            ) : (
              <ul className="py-1">
                {results.map((result, index) => {
                  const Icon = ICONS[result.type]

                  return (
                    <li
                      key={`${result.type}-${result.id}`}
                      role="option"
                      aria-selected={index === activeIdx}
                      onMouseEnter={() => setActiveIdx(index)}
                      onMouseDown={(event) => {
                        event.preventDefault()
                        router.push(HREFS[result.type](result.id))
                        setOpen(false)
                        onChange('')
                      }}
                      className={cn(
                        'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm transition-colors',
                        index === activeIdx ? 'bg-brand-50 text-brand-800' : 'text-surface-700 hover:bg-surface-50'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0 text-surface-400" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{result.name}</div>
                        {result.subtitle ? (
                          <div className="truncate text-xs text-surface-400">{result.subtitle}</div>
                        ) : null}
                      </div>
                      <span className="rounded bg-surface-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-surface-500">
                        {result.type}
                      </span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    )
  }
)
