'use client'

import * as React from 'react'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PublicBusinessJoinFormProps {
  slug: string
  businessName: string
  offerTitle: string
  offerValue?: string | null
  supportLabel: string
}

interface JoinSuccessPayload {
  businessName: string
  offerTitle: string
  offerDescription: string
  offerValue?: string | null
}

export function PublicBusinessJoinForm({
  slug,
  businessName,
  offerTitle,
  offerValue,
  supportLabel,
}: PublicBusinessJoinFormProps) {
  const [firstName, setFirstName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [supportsLocalCauses, setSupportsLocalCauses] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState<JoinSuccessPayload | null>(null)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/join/${slug}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          firstName,
          phone,
          email,
          supportsLocalCauses,
        }),
      })

      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload.error || 'Your offer could not be claimed.')
      }

      setSubmitted(payload as JoinSuccessPayload)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your offer could not be claimed.')
    } finally {
      setSubmitting(false)
    }
  }

  const claimedOffer = submitted?.offerValue || submitted?.offerTitle || offerValue || offerTitle

  if (submitted) {
    return (
      <div className="rounded-[2rem] border border-emerald-200 bg-white/96 p-6 shadow-[0_24px_80px_-35px_rgba(16,185,129,0.55)] backdrop-blur">
        <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-inner">
          <CheckCircle2 className="h-16 w-16" />
        </div>

        <div className="mt-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600">Registered</p>
          <h2 className="mt-3 text-4xl font-black tracking-tight text-surface-900">REGISTERED</h2>
          <p className="mt-3 text-base text-surface-600">
            You&apos;re in for <span className="font-semibold text-surface-900">{submitted.businessName}</span>.
          </p>
        </div>

        <div className="mt-6 rounded-[1.75rem] border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">Show this to claim</p>
          <p className="mt-3 text-2xl font-bold leading-tight text-surface-900">{claimedOffer}</p>
          <p className="mt-3 text-sm leading-6 text-surface-600">
            Show this screen at checkout to claim your {submitted.offerTitle.toLowerCase()}.
          </p>
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-surface-200 bg-surface-50 p-4 text-center">
          <p className="text-sm font-semibold text-surface-900">You&apos;re part of something local now.</p>
          <p className="mt-2 text-sm leading-6 text-surface-600">
            {supportLabel}. Keep this screen open until your offer is redeemed.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-[2rem] border border-white/80 bg-white/96 p-6 shadow-[0_24px_80px_-35px_rgba(15,23,42,0.45)] backdrop-blur">
      <div className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-brand-600">Claim Offer</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-surface-900">{offerTitle}</h2>
        <p className="mt-3 text-sm leading-6 text-surface-600">
          Enter your details and we&apos;ll register you instantly for {businessName}.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-2 block text-sm font-semibold text-surface-800">First name</label>
          <Input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            placeholder="Your first name"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-surface-800">Phone</label>
          <Input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="(404) 555-0123"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-surface-800">Email</label>
          <Input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            type="email"
          />
          <p className="mt-1 text-xs text-surface-500">Phone or email is enough. You don&apos;t need both.</p>
        </div>

        <label className="flex items-start gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
          <input
            type="checkbox"
            checked={supportsLocalCauses}
            onChange={(event) => setSupportsLocalCauses(event.target.checked)}
            className="mt-1 h-4 w-4 rounded border-surface-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm leading-6 text-surface-700">
            I want to support local schools and causes.
          </span>
        </label>

        {error && (
          <div className="rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
            {error}
          </div>
        )}

        <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base font-semibold" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Registering...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Get My Offer
            </>
          )}
        </Button>
      </form>
    </div>
  )
}
