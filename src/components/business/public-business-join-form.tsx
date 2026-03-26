'use client'

import * as React from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface PublicBusinessJoinFormProps {
  slug: string
  offerTitle: string
}

export function PublicBusinessJoinForm({ slug, offerTitle }: PublicBusinessJoinFormProps) {
  const [firstName, setFirstName] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [supportsLocalCauses, setSupportsLocalCauses] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

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

      setSubmitted(true)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Your offer could not be claimed.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="rounded-[2rem] border border-emerald-200 bg-white/95 p-6 shadow-xl">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-emerald-100 p-3 text-emerald-700">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <p className="text-2xl font-bold text-surface-900">You&apos;re in</p>
            <p className="mt-2 text-sm leading-6 text-surface-600">
              Show this at checkout and mention <span className="font-semibold text-surface-900">{offerTitle}</span>.
            </p>
            <p className="mt-3 text-sm text-surface-500">
              You&apos;ll receive your offer shortly, and you&apos;re now part of something local.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-[2rem] border border-white/80 bg-white/95 p-6 shadow-xl">
      <div className="space-y-4">
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
          <p className="mt-1 text-xs text-surface-500">Add a phone number or an email. One is enough.</p>
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
              Saving your spot...
            </>
          ) : (
            'Get My Offer'
          )}
        </Button>
      </div>
    </form>
  )
}
