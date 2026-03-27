'use client'

import * as React from 'react'
import { CheckCircle2, Heart, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PublicCommunitySupportFormProps {
  slug: string
  causeName: string
  headline: string
}

interface SupportSuccessPayload {
  causeName: string
  headline: string
  registeredAt: string
}

export function PublicCommunitySupportForm({
  slug,
  causeName,
  headline,
}: PublicCommunitySupportFormProps) {
  const [firstName, setFirstName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [wantsUpdates, setWantsUpdates] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState<SupportSuccessPayload | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/support/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          phone,
          email,
          wantsUpdates,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Your support could not be registered.')
      }

      setSubmitted(payload as SupportSuccessPayload)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your support could not be registered.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[2rem] border border-pink-200 bg-white p-6 shadow-[0_24px_80px_-35px_rgba(219,39,119,0.45)]">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-pink-100 text-pink-600 shadow-inner">
          <CheckCircle2 className="h-16 w-16" />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-pink-600">Supporter Registered</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-surface-900">YOU&apos;RE IN</h2>
          <p className="mt-3 text-base text-surface-600">
            You are now supporting <span className="font-semibold text-surface-900">{submitted.causeName}</span>.
          </p>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-pink-200 bg-gradient-to-br from-pink-50 to-white p-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-pink-700">Next step</p>
          <p className="mt-3 text-2xl font-bold leading-tight text-surface-900">{submitted.headline}</p>
          <p className="mt-3 text-sm leading-6 text-surface-600">
            Keep sharing this supporter page so more parents, families, and local supporters can join too.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[2rem] border border-white/80 bg-white/96 p-6 shadow-[0_24px_80px_-35px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-600">Support In Seconds</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-surface-900">{headline}</h2>
        <p className="mt-3 text-sm leading-6 text-surface-600">
          Enter your details and become a supporter for {causeName}.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-surface-800">First name</label>
          <Input value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Your first name" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-surface-800">Phone</label>
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(404) 555-0123" />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-surface-800">Email</label>
          <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" />
          <p className="mt-1 text-xs text-surface-500">Phone or email is enough. You do not need both.</p>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
          <input
            type="checkbox"
            checked={wantsUpdates}
            onChange={(event) => setWantsUpdates(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-surface-300 text-pink-600 focus:ring-pink-500"
          />
          <span className="text-sm leading-6 text-surface-700">
            Keep me updated with ways to support and share.
          </span>
        </label>

        {error && (
          <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="h-12 w-full rounded-2xl bg-pink-600 text-base font-semibold hover:bg-pink-700" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <Heart className="h-4 w-4" />
              Support This Community
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
