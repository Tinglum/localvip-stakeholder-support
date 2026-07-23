'use client'

/**
 * "Who's driving?" picker for the shared SuperAdmin login.
 *
 * Several people sign in as SuperAdmin, so actions taken from it need to be
 * attributed to a person. This picker sets a session-bound cookie (see
 * `lib/auth/operator-identity`); the server stamps the chosen name onto writes such
 * as bug-report notes.
 *
 * Renders nothing for non-super-admin sessions.
 */
import * as React from 'react'
import { UserCircle2 } from 'lucide-react'

interface OperatorResponse {
  operator: string | null
  since?: string | null
  options?: readonly string[]
}

export function OperatorPicker({ className = '' }: { className?: string }) {
  const [operator, setOperator] = React.useState<string | null>(null)
  const [options, setOptions] = React.useState<readonly string[]>([])
  const [available, setAvailable] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/admin/operator', { cache: 'no-store' })
        // 401/403 => not a shared super-admin session; the picker stays hidden.
        if (!res.ok) return
        const data = (await res.json()) as OperatorResponse
        if (cancelled) return
        setOperator(data.operator ?? null)
        setOptions(data.options ?? [])
        setAvailable(true)
      } catch {
        /* leave hidden */
      }
    })()
    return () => { cancelled = true }
  }, [])

  async function choose(next: string) {
    setSaving(true)
    try {
      if (!next) {
        await fetch('/api/admin/operator', { method: 'DELETE' })
        setOperator(null)
      } else {
        const res = await fetch('/api/admin/operator', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ operator: next }),
        })
        if (res.ok) setOperator(((await res.json()) as OperatorResponse).operator ?? null)
      }
    } finally {
      setSaving(false)
    }
  }

  if (!available) return null

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <UserCircle2 className="h-4 w-4 text-surface-400" aria-hidden />
      <label htmlFor="operator-picker" className="sr-only">
        Who is using the SuperAdmin account
      </label>
      <select
        id="operator-picker"
        value={operator ?? ''}
        disabled={saving}
        onChange={(e) => void choose(e.target.value)}
        className={`rounded-md border px-2 py-1 text-xs ${
          operator
            ? 'border-surface-200 bg-white text-surface-700'
            : 'border-warning-300 bg-warning-50 text-warning-800'
        }`}
        title={
          operator
            ? `Actions from this shared login are attributed to ${operator}.`
            : 'Pick who you are so your changes are attributed to you.'
        }
      >
        <option value="">Who are you?</option>
        {options.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </div>
  )
}
