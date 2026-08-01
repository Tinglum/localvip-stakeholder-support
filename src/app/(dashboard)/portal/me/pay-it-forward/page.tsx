'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  HandHeart,
  Loader2,
  CloudOff,
  Users,
  Percent,
  Sparkles,
  CircleSlash,
  Gift,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

/**
 * Every figure on this page comes from GET /api/portal/me/pay-it-forward, which is
 * a pass-through of the QA Payment/PayItForward endpoint. Money is settled-only and
 * `totalSent` is the sum of the per-member totals, so the summary and the table
 * cannot disagree. Nothing here is derived or estimated — the page shows a dash
 * rather than inventing a number, and there is no local 5% constant any more.
 *
 * Framing to preserve: the consumer's own spending EARNS this bonus, and they
 * choose to forward it. It is never money out of their pocket.
 */
interface CircleMember {
  friendId: number | null
  name: string | null
  email: string | null
  joinedDate: string | null
  totalSent: number | null
  lastSentDate: string | null
}

interface PayItForwardPayload {
  members: CircleMember[]
  maxSlots: number | null
  usedSlots: number | null
  sharePercent: number | null
  totalSent: number | null
  totalSentToFormerFriends: number | null
  totalReceived: number | null
}

/** Display-only fallback for the slot meter when the API omits maxSlots. */
const FALLBACK_MAX_SLOTS = 5

function formatUsd(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatPercent(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return '-'
  const rounded = Math.round(value * 100) / 100
  return `${rounded}%`
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function memberName(member: CircleMember): string {
  return member.name?.trim() || member.email || 'Circle member'
}

function initials(member: CircleMember): string {
  const parts = memberName(member).split(/[\s@.]+/).filter(Boolean)
  const letters = (parts[0]?.[0] || '') + (parts.length > 1 ? parts[1][0] : '')
  return letters.toUpperCase() || '?'
}

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export default function PayItForwardPage() {
  const [data, setData] = React.useState<PayItForwardPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [loadError, setLoadError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const res = await fetch('/api/portal/me/pay-it-forward', { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok) {
          throw new Error(json?.error || 'Your Pay it Forward circle could not be loaded.')
        }
        if (!active) return
        setData({
          members: Array.isArray(json?.members) ? json.members : [],
          maxSlots: toNullableNumber(json?.maxSlots),
          usedSlots: toNullableNumber(json?.usedSlots),
          sharePercent: toNullableNumber(json?.sharePercent),
          totalSent: toNullableNumber(json?.totalSent),
          totalSentToFormerFriends: toNullableNumber(json?.totalSentToFormerFriends),
          totalReceived: toNullableNumber(json?.totalReceived),
        })
      } catch (error) {
        if (!active) return
        setLoadError(error instanceof Error ? error.message : 'Your Pay it Forward circle could not be loaded.')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => {
      active = false
    }
  }, [])

  const members = data?.members ?? []
  const maxSlots = data?.maxSlots ?? FALLBACK_MAX_SLOTS
  const usedSlots = data?.usedSlots ?? members.length
  const freeSlots = Math.max(0, maxSlots - usedSlots)
  const sharePercent = data?.sharePercent ?? null
  // Each person's share comes from the API's own share percentage, shown only when
  // both numbers are known — never guessed from a hardcoded 5%.
  const sharePerMember = sharePercent !== null && usedSlots > 0 ? sharePercent / usedSlots : null

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Pay it Forward"
        description="Every purchase you make earns a bonus. You choose to forward it to the people in your circle - it is never money out of your pocket."
        breadcrumb={[{ label: 'Portal', href: '/portal' }, { label: 'Pay it Forward' }]}
      />

      <Card className="mb-6 border-brand-100 bg-brand-50/60">
        <CardContent className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-surface-900">How this works</p>
            <p className="text-sm leading-6 text-surface-600">
              Every LocalVIP purchase you make earns you a bonus
              {sharePercent !== null ? ` of ${formatPercent(sharePercent)}` : ''}. You forward it evenly
              to your circle - up to {maxSlots} people. Fewer people in the circle means a bigger share
              each. Amounts below are settled payments only.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/me/network">View my network</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/portal/me/wallet">View wallet summary</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6 overflow-hidden">
        <CardContent className="flex items-center gap-4 p-5">
          <div
            className={cn(
              'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl',
              usedSlots > 0 ? 'bg-brand-50 text-brand-600' : 'bg-surface-100 text-surface-400'
            )}
          >
            <HandHeart className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            {loading ? (
              <div className="h-10 w-56 animate-pulse rounded-lg bg-surface-100" />
            ) : usedSlots > 0 ? (
              <>
                <p className="text-subheading text-surface-900">
                  Forwarding your bonus to {usedSlots} {usedSlots === 1 ? 'person' : 'people'}
                </p>
                <p className="text-body text-surface-500">
                  {freeSlots > 0
                    ? `${freeSlots} of ${maxSlots} slot${freeSlots === 1 ? '' : 's'} still free. Adding someone splits the same bonus further.`
                    : `Your circle is full at ${maxSlots} people.`}
                </p>
              </>
            ) : (
              <>
                <p className="text-subheading text-surface-900">No one in your circle yet</p>
                <p className="text-body text-surface-500">
                  All {maxSlots} slots are free. Nothing is being forwarded until you invite someone.
                </p>
              </>
            )}
          </div>
          {!loading && (
            <Badge variant={usedSlots === 0 ? 'default' : freeSlots === 0 ? 'success' : 'info'} className="shrink-0">
              <Users className="h-3 w-3" />
              {usedSlots} of {maxSlots} slots used
            </Badge>
          )}
        </CardContent>
      </Card>

      {loadError && (
        <Card className="mb-6 border-danger-200 bg-danger-50">
          <CardContent className="flex items-center gap-3 p-4 text-sm text-danger-700">
            <CloudOff className="h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5 text-brand-600" />
              Each person&apos;s share
            </CardTitle>
            <CardDescription>
              Share of the bonus your purchases earn, per person in your circle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-32 animate-pulse rounded-lg bg-surface-100" />
            ) : (
              <>
                <p className="text-3xl font-bold tabular-nums text-surface-900">
                  {formatPercent(sharePerMember)}
                </p>
                <p className="mt-1 text-sm text-surface-500">
                  {usedSlots > 0 && sharePercent !== null
                    ? `${formatPercent(sharePercent)} split evenly across ${usedSlots} ${usedSlots === 1 ? 'person' : 'people'}.`
                    : sharePercent !== null
                      ? `Invite one person and they would receive the full ${formatPercent(sharePercent)}.`
                      : 'Your share percentage is not available right now.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-warning-600" />
              Bonus forwarded to date
            </CardTitle>
            <CardDescription>
              Settled bonus your spending has earned and forwarded to your circle.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-32 animate-pulse rounded-lg bg-surface-100" />
            ) : (
              <>
                <p className="text-3xl font-bold tabular-nums text-surface-900">
                  {formatUsd(data?.totalSent ?? null)}
                </p>
                <p className="mt-1 text-sm text-surface-500">
                  {data?.totalSentToFormerFriends
                    ? `Includes ${formatUsd(data.totalSentToFormerFriends)} forwarded to people who have since left your circle.`
                    : 'Across everyone currently in your circle.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-success-600" />
              Forwarded to you
            </CardTitle>
            <CardDescription>
              Settled bonus other people have chosen to forward to you.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-10 w-32 animate-pulse rounded-lg bg-surface-100" />
            ) : (
              <>
                <p className="text-3xl font-bold tabular-nums text-surface-900">
                  {formatUsd(data?.totalReceived ?? null)}
                </p>
                <p className="mt-1 text-sm text-surface-500">
                  From the circles you have been added to.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your circle</CardTitle>
          <CardDescription>
            {usedSlots > 0 && sharePerMember !== null
              ? `The same bonus is split evenly, so each person currently receives ${formatPercent(sharePerMember)} of every purchase you make.`
              : 'Up to five people can receive a share of the bonus your spending earns.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-surface-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading your circle...</span>
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              icon={<HandHeart className="h-6 w-6" />}
              title="No one in your circle yet"
              description="When you invite someone, an account is created under your referral code and they start receiving a share of the bonus your purchases earn. The first person would receive the full share."
            />
          ) : (
            <>
              <div className="-mx-1 overflow-x-auto px-1">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <caption className="sr-only">
                    People in your Pay it Forward circle, when they joined, and how much of your
                    purchase bonus has been forwarded to each of them
                  </caption>
                  <thead>
                    <tr className="border-b border-surface-200 text-left text-xs font-medium uppercase tracking-wide text-surface-500">
                      <th scope="col" className="px-3 py-2">Person</th>
                      <th scope="col" className="px-3 py-2">Email</th>
                      <th scope="col" className="px-3 py-2">Joined</th>
                      <th scope="col" className="px-3 py-2">Last forwarded</th>
                      <th scope="col" className="px-3 py-2 text-right">Share per purchase</th>
                      <th scope="col" className="px-3 py-2 text-right">Forwarded to date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map((member, index) => (
                      <tr
                        key={member.friendId ?? `${member.email ?? 'member'}-${index}`}
                        className="border-b border-surface-100 last:border-0"
                      >
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              aria-hidden="true"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold text-brand-600"
                            >
                              {initials(member)}
                            </span>
                            <span className="font-medium text-surface-900">{memberName(member)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-3 text-surface-500">{member.email || '-'}</td>
                        <td className="px-3 py-3 tabular-nums text-surface-500">{formatDate(member.joinedDate)}</td>
                        <td className="px-3 py-3 tabular-nums text-surface-500">{formatDate(member.lastSentDate)}</td>
                        <td className="px-3 py-3 text-right font-semibold tabular-nums text-surface-900">
                          {formatPercent(sharePerMember)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-surface-600">
                          {formatUsd(member.totalSent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-surface-500">
                  <span>
                    {sharePercent !== null
                      ? `How the ${formatPercent(sharePercent)} splits today`
                      : 'How your bonus splits today'}
                  </span>
                  <span className="tabular-nums">
                    {usedSlots} used - {freeSlots} free
                  </span>
                </div>
                <div
                  className="flex gap-1"
                  role="img"
                  aria-label={`${usedSlots} of ${maxSlots} circle slots used${sharePerMember !== null ? `, each receiving ${formatPercent(sharePerMember)} of every purchase` : ''}`}
                >
                  {Array.from({ length: maxSlots }).map((_, index) => (
                    <div
                      key={index}
                      className={cn(
                        'h-2 flex-1 rounded-full',
                        index < usedSlots ? 'bg-brand-600' : 'bg-surface-100'
                      )}
                    />
                  ))}
                </div>
                {freeSlots > 0 && (
                  <p className="flex items-center gap-1.5 text-xs text-surface-500">
                    <CircleSlash className="h-3.5 w-3.5" />
                    {freeSlots} free slot{freeSlots === 1 ? '' : 's'}. Adding someone splits the same
                    bonus further
                    {sharePercent !== null
                      ? ` - each person would then receive ${formatPercent(sharePercent / (usedSlots + 1))}.`
                      : '.'}
                  </p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
