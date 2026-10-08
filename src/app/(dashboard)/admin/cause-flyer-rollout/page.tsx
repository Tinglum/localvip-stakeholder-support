'use client'

import * as React from 'react'

type Cause = { id: number; name: string; ready: boolean; missing: string[]; excluded: boolean }
type Result = { id: number; name: string; count: number; status: string; detail: string }

export default function CauseFlyerRolloutPage() {
  const [items, setItems] = React.useState<Cause[]>([])
  const [results, setResults] = React.useState<Result[]>([])
  const [error, setError] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [running, setRunning] = React.useState(false)

  React.useEffect(() => {
    fetch('/api/admin/cause-flyer-rollout', { cache: 'no-store' })
      .then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Could not check causes.')
        setItems(body.items)
      })
      .catch(cause => setError(cause instanceof Error ? cause.message : 'Could not check causes.'))
      .finally(() => setLoading(false))
  }, [])

  const ready = items.filter(item => item.ready && !item.excluded)
  const waiting = items.filter(item => !item.ready && !item.excluded)

  async function regenerate() {
    setRunning(true)
    setResults([])
    for (const cause of ready) {
      try {
        const response = await fetch(`/api/crm/causes/${cause.id}/launch-materials?flyersOnly=1`, { method: 'POST' })
        const body = await response.json()
        if (!response.ok) throw new Error(body.error || 'Generation failed.')
        const statusResponse = await fetch(`/api/crm/causes/${cause.id}/launch-materials`, { cache: 'no-store' })
        const status = statusResponse.ok ? await statusResponse.json() : null
        const flyer = body.steps?.flyers
        setResults(current => [...current, {
          id: cause.id, name: cause.name, count: status?.flyerCount || 0,
          status: flyer?.status || 'unknown', detail: flyer?.detail || '',
        }])
      } catch (failure) {
        setResults(current => [...current, {
          id: cause.id, name: cause.name, count: 0, status: 'failed',
          detail: failure instanceof Error ? failure.message : String(failure),
        }])
      }
    }
    setRunning(false)
  }

  return <main className="mx-auto max-w-4xl space-y-6 p-8">
    <h1 className="text-3xl font-semibold">Cause flyer rollout</h1>
    <p>Generate the four audiences and three designs for every ready cause. Olathe West is excluded. This action creates flyers only; it does not edit landing pages or start videos.</p>
    {loading ? <p>Checking cause artwork and referral codes…</p> : error ? <p role="alert">{error}</p> : <>
      <p>{ready.length} ready · {waiting.length} waiting for assets or codes · {items.filter(item => item.excluded).length} Olathe West record(s) excluded</p>
      <button className="rounded-lg bg-brand-600 px-5 py-3 font-semibold text-white disabled:opacity-50" disabled={running || ready.length === 0} onClick={() => void regenerate()}>
        {running ? `Generating ${results.length}/${ready.length}…` : `Regenerate ${ready.length} ready cause sets`}
      </button>
      <section aria-label="Regeneration results" className="space-y-2">
        {results.map(result => <p key={result.id}><strong>{result.name}:</strong> {result.count}/12, {result.status}. {result.detail}</p>)}
      </section>
      <details><summary>{waiting.length} causes waiting for assets or codes</summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">{waiting.map(cause => <li key={cause.id}>{cause.name}: {cause.missing.join(', ')}</li>)}</ul>
      </details>
    </>}
  </main>
}
