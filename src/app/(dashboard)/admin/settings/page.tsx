'use client'

import * as React from 'react'
import { CalendarRange, HeartHandshake, Loader2, Save, Target } from 'lucide-react'
import { toast } from 'sonner'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { RippleReadinessPanel } from '@/components/admin/ripple-readiness-panel'

interface FundraisingGoal {
  year: number
  month: number
  goalAmount: number
  updatedOn?: string | null
  updatedBy?: string | null
}

const currencyFormatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

function formatMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function currentPeriod() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function splitPeriod(period: string) {
  const [year, month] = period.split('-').map(Number)
  return { year, month }
}

export default function AdminSettingsPage() {
  const [period, setPeriod] = React.useState(currentPeriod)
  const [goalAmount, setGoalAmount] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [updatedOn, setUpdatedOn] = React.useState<string | null>(null)
  const [goals, setGoals] = React.useState<FundraisingGoal[]>([])
  const [goalsLoading, setGoalsLoading] = React.useState(true)

  const thisPeriod = React.useMemo(() => splitPeriod(currentPeriod()), [])

  const loadGoals = React.useCallback(async () => {
    setGoalsLoading(true)
    try {
      const response = await fetch('/api/admin/fundraising-goal/list', { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as { goals?: FundraisingGoal[]; error?: string } | null
      if (!response.ok) throw new Error(payload?.error || 'The fundraising goals could not be loaded.')
      setGoals(Array.isArray(payload?.goals) ? payload.goals : [])
    } catch (error) {
      setGoals([])
      toast.error(error instanceof Error ? error.message : 'The fundraising goals could not be loaded.')
    } finally {
      setGoalsLoading(false)
    }
  }, [])

  React.useEffect(() => { void loadGoals() }, [loadGoals])

  const loadGoal = React.useCallback(async () => {
    setLoading(true)
    const { year, month } = splitPeriod(period)
    try {
      const response = await fetch(`/api/admin/fundraising-goal?year=${year}&month=${month}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null) as FundraisingGoal | { error?: string } | null
      if (!response.ok) throw new Error(payload && 'error' in payload ? payload.error : 'The fundraising goal could not be loaded.')
      const goal = payload as FundraisingGoal
      setGoalAmount(String(Number(goal.goalAmount) || 0))
      setUpdatedOn(goal.updatedOn || null)
    } catch (error) {
      setGoalAmount('')
      toast.error(error instanceof Error ? error.message : 'The fundraising goal could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [period])

  React.useEffect(() => { void loadGoal() }, [loadGoal])

  async function saveGoal(event: React.FormEvent) {
    event.preventDefault()
    const { year, month } = splitPeriod(period)
    const amount = Number(goalAmount)
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error('Enter a non-negative monthly goal.')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/admin/fundraising-goal', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ year, month, goalAmount: amount }),
      })
      const payload = await response.json().catch(() => null) as FundraisingGoal | { error?: string } | null
      if (!response.ok) throw new Error(payload && 'error' in payload ? payload.error : 'The fundraising goal could not be saved.')
      const saved = payload as FundraisingGoal
      setGoalAmount(String(Number(saved.goalAmount) || 0))
      setUpdatedOn(saved.updatedOn || null)
      toast.success('Monthly fundraising goal saved.')
      await loadGoals()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'The fundraising goal could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader title="System Settings" description="Set the community-wide targets used across LocalVIP consumer fundraising progress." />
      <RippleReadinessPanel />
      <Card className="max-w-2xl overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-brand-600" />
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-emerald-50 p-2.5 text-emerald-700"><HeartHandshake className="h-5 w-5" /></div>
            <div>
              <CardTitle>Monthly cause fundraising goal</CardTitle>
              <CardDescription className="mt-1">This shared target drives the progress shown on consumer Home and Your Causes.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={saveGoal}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-surface-700">
                <span>Month</span>
                <Input type="month" value={period} onChange={(event) => setPeriod(event.target.value)} disabled={loading || saving} />
              </label>
              <label className="space-y-2 text-sm font-medium text-surface-700">
                <span>Goal amount</span>
                <div className="relative"><span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-surface-400">$</span><Input className="pl-7" type="number" min="0" step="0.01" value={goalAmount} onChange={(event) => setGoalAmount(event.target.value)} disabled={loading || saving} /></div>
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-surface-100 pt-4">
              <p className="flex items-center gap-2 text-xs text-surface-500"><Target className="h-4 w-4" />{updatedOn ? `Last updated ${new Date(updatedOn).toLocaleString()}` : 'No saved update timestamp'}</p>
              <Button type="submit" disabled={loading || saving || goalAmount === ''}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'Saving' : 'Save goal'}</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="max-w-2xl overflow-hidden">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-brand-50 p-2.5 text-brand-700"><CalendarRange className="h-5 w-5" /></div>
            <div>
              <CardTitle>Goals already set</CardTitle>
              <CardDescription className="mt-1">Every monthly cause fundraising goal on record, newest first.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {goalsLoading ? (
            <p className="flex items-center gap-2 py-6 text-sm text-surface-500"><Loader2 className="h-4 w-4 animate-spin" />Loading goals</p>
          ) : goals.length === 0 ? (
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title="No goals set yet"
              description="Save a monthly goal above and it will appear here."
            />
          ) : (
            <div className="max-h-96 overflow-auto rounded-lg border border-surface-100">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Monthly cause fundraising goals, newest first</caption>
                <thead className="sticky top-0 bg-surface-50 text-xs uppercase tracking-wide text-surface-500">
                  <tr>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">Month</th>
                    <th scope="col" className="px-4 py-2.5 text-right font-medium">Goal</th>
                    <th scope="col" className="px-4 py-2.5 text-left font-medium">Last updated</th>
                  </tr>
                </thead>
                <tbody>
                  {goals.map((goal) => {
                    const isCurrent = goal.year === thisPeriod.year && goal.month === thisPeriod.month
                    return (
                      <tr
                        key={`${goal.year}-${goal.month}`}
                        className={`border-t border-surface-100 ${isCurrent ? 'bg-brand-50/60' : ''}`}
                      >
                        <th scope="row" className="px-4 py-2.5 text-left font-medium text-surface-800">
                          <span className="flex items-center gap-2">
                            {formatMonth(goal.year, goal.month)}
                            {isCurrent && <Badge variant="info">Current month</Badge>}
                          </span>
                        </th>
                        <td className="px-4 py-2.5 text-right tabular-nums text-surface-700">
                          {currencyFormatter.format(Number(goal.goalAmount) || 0)}
                        </td>
                        <td className="px-4 py-2.5 text-surface-500">
                          {goal.updatedOn ? new Date(goal.updatedOn).toLocaleDateString() : '—'}
                          {goal.updatedBy ? <span className="block text-xs text-surface-400">by {goal.updatedBy}</span> : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
