'use client'

import * as React from 'react'
import { KeyRound, Save, ShieldOff, ShieldCheck, Wrench } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuditLogInsert } from '@/lib/supabase/hooks'

/**
 * The destructive half of customer admin: edit details, suspend, reset a
 * password, and repair attribution.
 *
 * Each of these had an endpoint on the backend or none at all, and no way to
 * reach it from the CRM - support fixed a misspelled name or a
 * wrongly-attributed sponsor by hand in the database.
 *
 * Every action writes an audit line. These change who can sign in and who earns
 * from someone's activity, so "who did this and why" has to survive the click.
 */

interface Props {
  userId: number
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  phone?: string | null
  isEnabled?: boolean
  onChanged?: () => void
}

export function CustomerAdminActions({
  userId,
  email,
  firstName,
  lastName,
  phone,
  isEnabled = true,
  onChanged,
}: Props) {
  const { insert: writeAudit } = useAuditLogInsert()

  const [form, setForm] = React.useState({
    firstName: firstName || '',
    lastName: lastName || '',
    email: email || '',
    phoneNumber: phone || '',
  })
  const [busy, setBusy] = React.useState<string | null>(null)
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  const [repairOpen, setRepairOpen] = React.useState(false)
  const [repairId, setRepairId] = React.useState('')
  const [repairReason, setRepairReason] = React.useState('')

  const say = (tone: 'ok' | 'err', text: string) => setMessage({ tone, text })

  /** Audit failures never block the action they describe - the action already happened. */
  const audit = React.useCallback(
    async (action: string, newValues: Record<string, unknown>) => {
      try {
        await writeAudit({
          action,
          entity_type: 'user',
          entity_id: String(userId),
          new_values: newValues,
        })
      } catch {
        // swallowed on purpose
      }
    },
    [writeAudit, userId],
  )

  async function call(url: string, init: RequestInit, label: string) {
    const res = await fetch(url, init)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error((data as { error?: string }).error || `${label} failed.`)
    return data
  }

  async function saveProfile() {
    setBusy('profile')
    setMessage(null)
    try {
      await call(
        `/api/qa/users/${userId}/profile`,
        {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(form),
        },
        'Saving the profile',
      )
      await audit('user.profile_updated', { ...form })
      say('ok', 'Profile saved.')
      onChanged?.()
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not save the profile.')
    } finally {
      setBusy(null)
    }
  }

  async function toggleActive() {
    const next = !isEnabled
    if (!next && !confirm('Suspend this account? They will not be able to sign in.')) return
    setBusy('status')
    setMessage(null)
    try {
      await call(
        `/api/qa/users/${userId}/status`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ active: next }),
        },
        next ? 'Enabling the account' : 'Suspending the account',
      )
      await audit(next ? 'user.enabled' : 'user.suspended', { active: next })
      say('ok', next ? 'Account enabled.' : 'Account suspended.')
      onChanged?.()
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not change the account status.')
    } finally {
      setBusy(null)
    }
  }

  async function sendReset() {
    if (!form.email) return say('err', 'This account has no email address.')
    setBusy('reset')
    setMessage(null)
    try {
      await call(
        '/api/qa/user/forgot-password',
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: form.email }),
        },
        'Sending the reset email',
      )
      await audit('user.password_reset_sent', { email: form.email })
      say('ok', `Password reset sent to ${form.email}.`)
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not send the reset email.')
    } finally {
      setBusy(null)
    }
  }

  async function repairReferrer() {
    const target = Number(repairId)
    if (!target) return say('err', 'Enter the user id of the correct referrer.')
    if (!repairReason.trim()) return say('err', 'A reason is required.')
    setBusy('repair')
    setMessage(null)
    try {
      const data = await call(
        `/api/qa/users/${userId}/repair-referrer`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ referrerUserId: target, reason: repairReason.trim() }),
        },
        'Repairing the referrer',
      )
      await audit('user.referrer_repaired', {
        referrerUserId: target,
        previousReferrerId: (data as { previousReferrerId?: number }).previousReferrerId ?? null,
        reason: repairReason.trim(),
      })
      say('ok', 'Referrer updated.')
      setRepairOpen(false)
      setRepairId('')
      setRepairReason('')
      onChanged?.()
    } catch (e) {
      say('err', e instanceof Error ? e.message : 'Could not repair the referrer.')
    } finally {
      setBusy(null)
    }
  }

  const field = 'w-full rounded-lg border border-surface-200 px-3 py-2 text-sm outline-none focus:border-brand-500'

  return (
    <div className="space-y-4">
      <div className="rounded-[1.5rem] border border-surface-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-surface-900">Customer details</h2>
        <p className="mt-1 text-xs text-surface-500">
          Changing the email changes the address this person signs in with.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="space-y-1">
            <span className="text-xs font-medium text-surface-600">First name</span>
            <input className={field} value={form.firstName}
              onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-surface-600">Last name</span>
            <input className={field} value={form.lastName}
              onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-surface-600">Email</span>
            <input className={field} type="email" value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-medium text-surface-600">Phone</span>
            <input className={field} value={form.phoneNumber}
              onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} />
          </label>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" disabled={busy === 'profile'} onClick={() => void saveProfile()}>
            <Save className="h-3.5 w-3.5" />
            {busy === 'profile' ? 'Saving…' : 'Save details'}
          </Button>
          <Button size="sm" variant="outline" disabled={busy === 'reset'} onClick={() => void sendReset()}>
            <KeyRound className="h-3.5 w-3.5" />
            {busy === 'reset' ? 'Sending…' : 'Send password reset'}
          </Button>
        </div>
      </div>

      <div className="rounded-[1.5rem] border border-surface-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-surface-900">Account &amp; attribution</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={busy === 'status'}
            onClick={() => void toggleActive()}
          >
            {isEnabled ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
            {isEnabled ? 'Suspend account' : 'Enable account'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRepairOpen((v) => !v)}>
            <Wrench className="h-3.5 w-3.5" />
            Repair referrer
          </Button>
        </div>

        {repairOpen && (
          <div className="mt-4 space-y-3 rounded-xl border border-surface-200 p-3">
            <p className="text-xs text-surface-500">
              Moves this person under a different referrer. This changes who earns from their
              activity, so it is logged with the reason. It moves one edge only and does not
              rebuild referral levels.
            </p>
            <input className={field} placeholder="Correct referrer's user id"
              value={repairId} inputMode="numeric"
              onChange={(e) => setRepairId(e.target.value)} />
            <input className={field} placeholder="Why is this being changed?"
              value={repairReason}
              onChange={(e) => setRepairReason(e.target.value)} />
            <Button size="sm" disabled={busy === 'repair'} onClick={() => void repairReferrer()}>
              {busy === 'repair' ? 'Updating…' : 'Update referrer'}
            </Button>
          </div>
        )}
      </div>

      {message && (
        <p className={`rounded-lg px-3 py-2 text-xs ${
          message.tone === 'ok' ? 'bg-success-50 text-success-800' : 'bg-danger-50 text-danger-700'
        }`}>
          {message.text}
        </p>
      )}
    </div>
  )
}
