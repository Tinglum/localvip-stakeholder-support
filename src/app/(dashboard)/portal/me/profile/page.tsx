'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, CloudOff, Loader2, Save, UserRound } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'

interface ConsumerProfile {
  email: string
  phoneNumber: string | null
  firstName: string
  middleName: string | null
  lastName: string
  address1?: string | null
  address2?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  zipCode?: string | null
  referralCode: string | null
  sharedURL: string | null
}

interface ProfileForm {
  firstName: string
  lastName: string
  phoneNumber: string
  city: string
  state: string
  zipCode: string
  country: string
}

const EMPTY_FORM: ProfileForm = {
  firstName: '',
  lastName: '',
  phoneNumber: '',
  city: '',
  state: '',
  zipCode: '',
  country: '',
}

function toForm(profile: ConsumerProfile | null): ProfileForm {
  if (!profile) return EMPTY_FORM
  return {
    firstName: profile.firstName || '',
    lastName: profile.lastName || '',
    phoneNumber: profile.phoneNumber || '',
    city: profile.city || '',
    state: profile.state || '',
    zipCode: profile.zipCode || '',
    country: profile.country || '',
  }
}

export default function ConsumerProfilePage() {
  const [profile, setProfile] = React.useState<ConsumerProfile | null>(null)
  const [form, setForm] = React.useState<ProfileForm>(EMPTY_FORM)
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [message, setMessage] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)

  const load = React.useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/qa/user/profile', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Could not load your profile.')
      setProfile(payload as ConsumerProfile)
      setForm(toForm(payload as ConsumerProfile))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your profile.')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void load()
  }, [load])

  function updateField(field: keyof ProfileForm, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/qa/user/profile', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || 'Could not save your profile.')
      setProfile((prev) => prev ? { ...prev, ...form } : prev)
      setMessage('Profile saved.')
      window.setTimeout(() => setMessage(null), 2200)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Edit Profile"
        description="Update the contact details LocalVIP uses for your account, rewards, and support."
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Me', href: '/portal/me' }, { label: 'Edit Profile' }]}
        actions={
          <Button variant="outline" asChild>
            <Link href="/portal/me">
              <ArrowLeft className="h-4 w-4" />
              Back to dashboard
            </Link>
          </Button>
        }
      />

      {error ? (
        <div className="flex items-center gap-2 rounded-2xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          <CloudOff className="h-4 w-4" />
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="flex items-center gap-2 rounded-2xl border border-success-200 bg-success-50 px-4 py-3 text-sm text-success-700">
          <Check className="h-4 w-4" />
          {message}
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <UserRound className="h-5 w-5 text-brand-600" />
                Personal details
              </CardTitle>
              <CardDescription>Name, phone, and location details that QA currently allows customers to edit.</CardDescription>
            </div>
            {profile?.email ? <Badge variant="default">{profile.email}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-surface-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading profile...
            </div>
          ) : (
            <form onSubmit={saveProfile} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-surface-700">First name</span>
                  <Input value={form.firstName} onChange={(event) => updateField('firstName', event.target.value)} required />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-surface-700">Last name</span>
                  <Input value={form.lastName} onChange={(event) => updateField('lastName', event.target.value)} required />
                </label>
              </div>

              <label className="block space-y-1">
                <span className="text-sm font-medium text-surface-700">Phone number</span>
                <Input value={form.phoneNumber} onChange={(event) => updateField('phoneNumber', event.target.value)} placeholder="Phone number" />
              </label>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-sm font-medium text-surface-700">City</span>
                  <Input value={form.city} onChange={(event) => updateField('city', event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-surface-700">State / region</span>
                  <Input value={form.state} onChange={(event) => updateField('state', event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-surface-700">ZIP / postal code</span>
                  <Input value={form.zipCode} onChange={(event) => updateField('zipCode', event.target.value)} />
                </label>
                <label className="space-y-1">
                  <span className="text-sm font-medium text-surface-700">Country</span>
                  <Input value={form.country} onChange={(event) => updateField('country', event.target.value)} />
                </label>
              </div>

              <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
                Email, referral code, share link, payout method, causes, and wallet controls live in their own sections so customers do not accidentally break account-critical data.
              </div>

              <div className="flex flex-wrap justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(toForm(profile))} disabled={saving}>
                  Reset
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save profile
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
