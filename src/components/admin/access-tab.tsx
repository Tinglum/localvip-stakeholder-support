'use client'

/**
 * Access grants editor.
 *
 * Two kinds of grant are shown, and the distinction matters:
 *   - INHERITED — implied by the user's backend role. Rendered locked-on, because
 *     an explicit grant can only ever add; unchecking one here would imply a
 *     revocation the backend does not honour, so we never offer it.
 *   - EXPLICIT — rows in UserAccessGrants. These are what Save replaces.
 *
 * The change set is shown before saving so an admin editing a shared account can
 * see exactly what they are about to alter.
 */
import * as React from 'react'
import { Loader2, ShieldCheck, Lock } from 'lucide-react'
import type { QaNodeAccess } from '@/lib/auth/qa-api'

export function AccessTab({ userId }: { userId: number | string }) {
  const [data, setData] = React.useState<QaNodeAccess | null>(null)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [saved, setSaved] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/nodes/${encodeURIComponent(String(userId))}/access`, { cache: 'no-store' })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Access grants could not be loaded.')
        return
      }
      setData(json as QaNodeAccess)
      setSelected(new Set((json as QaNodeAccess).granted))
    } catch {
      setError('Access grants could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [userId])

  React.useEffect(() => { void load() }, [load])

  if (loading) return <p className="text-sm text-surface-500">Loading access…</p>
  if (error) return <p className="text-sm text-danger-600">{error}</p>
  if (!data) return null

  const inherited = new Set(data.inherited)
  const original = new Set(data.granted)
  const added = [...selected].filter((k) => !original.has(k))
  const removed = [...original].filter((k) => !selected.has(k))
  const dirty = added.length > 0 || removed.length > 0

  // Group the catalog by area for rendering, preserving catalog order.
  const areas: { area: string; items: QaNodeAccess['catalog'] }[] = []
  for (const item of data.catalog) {
    let group = areas.find((a) => a.area === item.area)
    if (!group) { group = { area: item.area, items: [] }; areas.push(group) }
    group.items.push(item)
  }

  function toggle(key: string) {
    setSaved(false)
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/dashboard/nodes/${encodeURIComponent(String(userId))}/access`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ grants: [...selected] }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json?.error || 'Access grants could not be saved.')
        return
      }
      setData(json as QaNodeAccess)
      setSelected(new Set((json as QaNodeAccess).granted))
      setSaved(true)
    } catch {
      setError('Access grants could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-surface-50 px-3 py-2 text-xs text-surface-600">
        Roles: <strong>{data.roles.length ? data.roles.join(', ') : 'none'}</strong>. Greyed
        items are granted by role and are always on. Anything you tick here is granted
        on top, and takes effect the next time they load their dashboard.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {areas.map((group) => (
          <section key={group.area} className="rounded-xl border border-surface-200 bg-white p-4">
            <h3 className="mb-3 text-sm font-semibold text-surface-900">{group.area}</h3>
            <ul className="space-y-2">
              {group.items.map((item) => {
                const isInherited = inherited.has(item.key)
                const checked = isInherited || selected.has(item.key)
                return (
                  <li key={item.key} className="flex items-center gap-2">
                    <input
                      id={`grant-${item.key}`}
                      type="checkbox"
                      checked={checked}
                      disabled={isInherited || saving}
                      onChange={() => toggle(item.key)}
                      className="h-4 w-4 rounded border-surface-300"
                    />
                    <label
                      htmlFor={`grant-${item.key}`}
                      className={`flex-1 text-sm ${isInherited ? 'text-surface-400' : 'text-surface-700'}`}
                    >
                      {item.label}
                    </label>
                    {isInherited ? (
                      <span title="Granted by role" className="text-surface-400">
                        <Lock className="h-3.5 w-3.5" />
                      </span>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>

      {dirty ? (
        <div className="rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm">
          <p className="font-medium text-brand-900">Pending changes</p>
          {added.length > 0 ? (
            <p className="mt-1 text-success-700">+ granting: {added.map(labelFor(data)).join(', ')}</p>
          ) : null}
          {removed.length > 0 ? (
            <p className="mt-1 text-danger-700">− revoking: {removed.map(labelFor(data)).join(', ')}</p>
          ) : null}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button
          onClick={() => void save()}
          disabled={!dirty || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Save access
        </button>
        {dirty ? (
          <button
            onClick={() => { setSelected(new Set(data.granted)); setSaved(false) }}
            disabled={saving}
            className="text-sm text-surface-500 hover:text-surface-700"
          >
            Reset
          </button>
        ) : null}
        {saved && !dirty ? <span className="text-sm text-success-700">Saved.</span> : null}
      </div>
    </div>
  )
}

function labelFor(data: QaNodeAccess) {
  return (key: string) => data.catalog.find((c) => c.key === key)?.label || key
}
