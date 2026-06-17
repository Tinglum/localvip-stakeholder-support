'use client'

import * as React from 'react'

export default function BoomerangConvertPage({ params }: { params: { token: string } }) {
  const [state, setState] = React.useState<'idle' | 'working' | 'done' | 'already' | 'error'>('idle')
  const [error, setError] = React.useState<string | null>(null)

  const complete = async () => {
    setState('working')
    setError(null)
    try {
      const res = await fetch(`/api/boomerang/convert/${params.token}`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not complete sign-up.')
      setState(data?.alreadyConverted ? 'already' : 'done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete sign-up.')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        {state === 'done' || state === 'already' ? (
          <>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <h1 className="text-xl font-bold text-slate-900">You&apos;re all set!</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your LocalVIP account is active and connected to the business that invited you. You can now
              earn cashback and support your causes.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-bold text-slate-900">Activate your LocalVIP account</h1>
            <p className="mt-2 text-sm text-slate-600">
              A business has invited you to become a LocalVIP customer. Tap below to activate — this creates
              your account and links you to them. You were only on their launch list until now.
            </p>
            {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
            <button
              onClick={complete}
              disabled={state === 'working'}
              className="mt-5 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {state === 'working' ? 'Activating…' : 'Activate my account'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
