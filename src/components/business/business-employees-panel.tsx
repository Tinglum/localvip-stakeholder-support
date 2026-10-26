'use client'

/**
 * Employees of a business: who besides the owner can see it, and how much.
 *
 *   Staff  - signs in to the webapp and sees this business's transactions. Read only.
 *   Admin  - Staff, plus dashboard sign-in for this business. Stripe and payouts stay
 *            with the owner.
 *
 * The QA backend enforces who may manage this list (the owner or a LocalVIP admin).
 * When it answers 403 the panel renders nothing, so an Admin employee looking at
 * the business never sees a list they cannot change.
 */

import * as React from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate } from '@/lib/utils'

type AccessLevel = 'staff' | 'admin'

interface BusinessEmployee {
  id: number
  userId: number
  email: string
  firstName: string | null
  lastName: string | null
  accessLevel: AccessLevel
  isActive: boolean
  pendingInvite: boolean
  createdDate: string
}

const ACCESS_COPY: Record<AccessLevel, { label: string; detail: string }> = {
  staff: { label: 'Staff', detail: 'Webapp only. Sees transactions, changes nothing.' },
  admin: { label: 'Admin', detail: 'Staff, plus the dashboard for this business. No Stripe or payouts.' },
}

const selectClass =
  'h-9 rounded-lg border border-surface-300 bg-surface-0 px-2 text-sm hover:border-surface-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 disabled:opacity-50'

export function BusinessEmployeesPanel({
  businessId,
  frame = (content) => content,
}: {
  businessId: number | string
  /** Wraps the panel (e.g. in a section card). Skipped entirely when the viewer may not manage employees. */
  frame?: (content: React.ReactNode) => React.ReactNode
}) {
  const base = `/api/business-portal/employees?businessId=${encodeURIComponent(String(businessId))}`

  const [employees, setEmployees] = React.useState<BusinessEmployee[]>([])
  const [loading, setLoading] = React.useState(true)
  const [forbidden, setForbidden] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [notice, setNotice] = React.useState<string | null>(null)
  const [busyId, setBusyId] = React.useState<number | 'invite' | null>(null)

  const [email, setEmail] = React.useState('')
  const [firstName, setFirstName] = React.useState('')
  const [lastName, setLastName] = React.useState('')
  const [accessLevel, setAccessLevel] = React.useState<AccessLevel>('staff')

  const apply = React.useCallback(async (response: Response) => {
    const payload = await response.json().catch(() => ({}))
    if (response.status === 403) {
      setForbidden(true)
      return null
    }
    if (!response.ok) {
      setError(typeof payload.error === 'string' ? payload.error : 'Something went wrong. Try again.')
      return null
    }
    setError(null)
    if (Array.isArray(payload.employees)) setEmployees(payload.employees)
    return payload
  }, [])

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(base, { cache: 'no-store' })
      .then((response) => (cancelled ? null : apply(response)))
      .catch(() => !cancelled && setError('Could not load employees.'))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [apply, base])

  async function invite(event: React.FormEvent) {
    event.preventDefault()
    if (!email.trim()) return
    setBusyId('invite')
    setNotice(null)
    try {
      const payload = await apply(
        await fetch(base, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email: email.trim(), firstName, lastName, accessLevel }),
        }),
      )
      if (payload) {
        setNotice(
          payload.createdLogin
            ? payload.emailSent
              ? `Invite sent to ${email.trim()}. They set a password from the email.`
              : `Login created for ${email.trim()}, but the email did not send. They can use "Forgot password" to get in.`
            : `${email.trim()} already had a LocalVIP login and now has access.`,
        )
        setEmail('')
        setFirstName('')
        setLastName('')
        setAccessLevel('staff')
      }
    } catch {
      setError('Could not add the employee.')
    } finally {
      setBusyId(null)
    }
  }

  async function update(employee: BusinessEmployee, change: { accessLevel?: AccessLevel; isActive?: boolean }) {
    setBusyId(employee.id)
    setNotice(null)
    try {
      await apply(
        await fetch(`${base}&employeeId=${employee.id}`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(change),
        }),
      )
    } catch {
      setError('Could not update the employee.')
    } finally {
      setBusyId(null)
    }
  }

  async function revoke(employee: BusinessEmployee) {
    const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ') || employee.email
    if (!window.confirm(`Remove ${name}'s access to this business? Their LocalVIP login stays.`)) return
    setBusyId(employee.id)
    setNotice(null)
    try {
      await apply(await fetch(`${base}&employeeId=${employee.id}`, { method: 'DELETE' }))
    } catch {
      setError('Could not remove the employee.')
    } finally {
      setBusyId(null)
    }
  }

  if (forbidden) return null

  if (loading) {
    return (
      <>
        {frame(
          <div className="flex items-center gap-2 py-6 text-sm text-surface-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading employees...
          </div>,
        )}
      </>
    )
  }

  const active = employees.filter((employee) => employee.isActive)
  const removed = employees.filter((employee) => !employee.isActive)

  return <>{frame(
    <div className="space-y-5">
      <form onSubmit={invite} className="space-y-3 rounded-xl border border-surface-200 bg-surface-50 p-4">
        <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
          <Input
            type="email"
            required
            placeholder="employee@email.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="Employee email"
          />
          <Input placeholder="First name" value={firstName} onChange={(event) => setFirstName(event.target.value)} aria-label="First name" />
          <Input placeholder="Last name" value={lastName} onChange={(event) => setLastName(event.target.value)} aria-label="Last name" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm text-surface-600">
            <select
              className={selectClass}
              value={accessLevel}
              onChange={(event) => setAccessLevel(event.target.value as AccessLevel)}
              aria-label="Access level"
            >
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </select>
            <span>{ACCESS_COPY[accessLevel].detail}</span>
          </label>
          <Button type="submit" size="sm" disabled={busyId === 'invite' || !email.trim()} className="shrink-0">
            {busyId === 'invite' ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add employee
          </Button>
        </div>
      </form>

      {error ? (
        <p className="rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">{error}</p>
      ) : null}
      {notice ? (
        <p className="rounded-lg border border-success-200 bg-success-50 px-3 py-2 text-sm text-success-700">{notice}</p>
      ) : null}

      {active.length === 0 ? (
        <p className="text-sm text-surface-500">No employees yet. Only you can see this business.</p>
      ) : (
        <ul className="divide-y divide-surface-100 rounded-xl border border-surface-200">
          {active.map((employee) => (
            <EmployeeRow
              key={employee.id}
              employee={employee}
              busy={busyId === employee.id}
              onAccessChange={(level) => update(employee, { accessLevel: level })}
              onRemove={() => revoke(employee)}
            />
          ))}
        </ul>
      )}

      {removed.length > 0 ? (
        <details className="text-sm text-surface-500">
          <summary className="cursor-pointer select-none">Removed ({removed.length})</summary>
          <ul className="mt-2 space-y-2">
            {removed.map((employee) => (
              <li key={employee.id} className="flex items-center justify-between gap-3">
                <span className="truncate">{employee.email}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busyId === employee.id}
                  onClick={() => update(employee, { isActive: true })}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>,
  )}</>
}

function EmployeeRow({
  employee,
  busy,
  onAccessChange,
  onRemove,
}: {
  employee: BusinessEmployee
  busy: boolean
  onAccessChange: (level: AccessLevel) => void
  onRemove: () => void
}) {
  const name = [employee.firstName, employee.lastName].filter(Boolean).join(' ')
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium text-surface-900">{name || employee.email}</p>
          {employee.pendingInvite ? <Badge variant="warning">Invite pending</Badge> : null}
        </div>
        <p className="truncate text-xs text-surface-500">
          {name ? `${employee.email} · ` : ''}Added {formatDate(employee.createdDate)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {busy ? <Loader2 className="h-4 w-4 animate-spin text-surface-400" /> : null}
        <select
          className={selectClass}
          value={employee.accessLevel}
          disabled={busy}
          onChange={(event) => onAccessChange(event.target.value as AccessLevel)}
          aria-label={`Access level for ${employee.email}`}
          title={ACCESS_COPY[employee.accessLevel].detail}
        >
          <option value="staff">Staff</option>
          <option value="admin">Admin</option>
        </select>
        <Button variant="outline" size="sm" disabled={busy} onClick={onRemove}>
          Remove
        </Button>
      </div>
    </li>
  )
}
