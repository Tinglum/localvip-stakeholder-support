'use client'

import * as React from 'react'

interface ResolveResponse {
  businessAccountId?: number
  businessName?: string
  offerTitle?: string
  offerDescription?: string
  error?: string
}

export default function BoomerangJoinPage({ params }: { params: { slug: string } }) {
  const slug = params.slug
  const [biz, setBiz] = React.useState<ResolveResponse | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [firstName, setFirstName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [supportsLocalCauses, setSupports] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState<'joined' | 'already' | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch(`/api/boomerang/${slug}`, { cache: 'no-store' })
      .then(async (r) => (r.ok ? r.json() : Promise.reject(await r.json().catch(() => ({})))))
      .then((data: ResolveResponse) => setBiz(data))
      .catch(() => setBiz({ error: 'This 100-list link is not valid.' }))
      .finally(() => setLoading(false))
  }, [slug])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!phone.trim() && !email.trim()) {
      setError('Please add a phone or email.')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch(`/api/boomerang/${slug}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ firstName, phone, email, supportsLocalCauses }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || 'Could not join right now.')
      setDone(data?.alreadyOnList ? 'already' : 'joined')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not join right now.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 px-4 py-10">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        {loading ? (
          <div className="space-y-3">
            <div className="h-6 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
          </div>
        ) : biz?.error || !biz?.businessName ? (
          <div className="text-center">
            <h1 className="text-lg font-semibold text-slate-900">Link not found</h1>
            <p className="mt-2 text-sm text-slate-500">This 100-list link is not valid or has expired.</p>
          </div>
        ) : done ? (
          <div className="text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</div>
            <h1 className="text-xl font-bold text-slate-900">
              {done === 'already' ? "You're already on the list" : "You're on the list!"}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {biz.businessName} will be in touch. You are on their launch list — you are not a customer yet,
              and nothing has been charged.
            </p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Join the launch list</p>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">{biz.businessName}</h1>
            {biz.offerTitle ? (
              <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{biz.offerTitle}</p>
            ) : null}
            <p className="mt-3 text-sm text-slate-500">
              Add your details to join {biz.businessName}&apos;s 100-list. This only puts you on their list —
              it does not create an account or charge you anything.
            </p>
            <form onSubmit={submit} className="mt-5 space-y-3">
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="Mobile number"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500"
                placeholder="Email (optional)"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" checked={supportsLocalCauses} onChange={(e) => setSupports(e.target.checked)} />
                I support local causes
              </label>
              {error ? <p className="text-sm text-rose-600">{error}</p> : null}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? 'Joining…' : 'Join the list'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
