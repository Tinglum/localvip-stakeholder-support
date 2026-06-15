'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  ExternalLink,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  QrCode,
  Share2,
  Smartphone,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'

interface ConsumerSummary {
  consumer: {
    id: number
    firstName: string
    lastName: string
    email: string
    phoneNumber: string | null
    city: string | null
    state: string | null
    country: string | null
    referralCode: string | null
    sharedURL: string | null
    createdDate: string
    isEnabled: boolean
    consumerType: string
  }
  wallet: { availableAmount: number; currentAmount: number; walletStatus: string }
  stripeOnboarded: boolean
  lifetimeCashback: number
  lifetimeBonusCash: number
  counts: { transactions: number; friends: number; causes: number; devices: number }
}

interface WalletDetail {
  currentAmount: number
  availableAmount: number
  walletStatus?: string
  hasStripeOnboarding?: boolean
  bank: string | null
}

interface TransactionRow {
  id: number
  amount: number
  tip: number
  cashback: number
  txFee: number
  finalAmount: number
  transactionStatus: string | null
  createdDate: string | null
}

interface CashbackSummary {
  lifetimeTotal: number
  recent: { id: number; amount: number; accountId: number; createdDate: string | null }[]
}

interface FriendRow {
  id: number
  firstName: string
  lastName: string
  email: string
  isActive: boolean
}

interface CauseRow {
  id: number
  name: string
  ownerEmail: string | null
  isActive: boolean
}

interface DeviceRow {
  id: number
  deviceId: string
  createdDate: string | null
}

interface ConsumerDashboardPayload {
  consumerId: number
  summary: ConsumerSummary
  wallet: WalletDetail | null
  transactions: TransactionRow[]
  cashback: CashbackSummary | null
  bonusCash: CashbackSummary | null
  friends: FriendRow[]
  causes: CauseRow[]
  devices: DeviceRow[]
}

function formatMoney(value: number | undefined | null) {
  if (value == null) return '$0.00'
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function formatDate(value: string | null | undefined) {
  if (!value) return '-'
  try {
    return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return value
  }
}

export function ConsumerDashboardPage() {
  const { profile } = useAuth()
  const [data, setData] = React.useState<ConsumerDashboardPayload | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle')

  React.useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/qa/me/consumer-dashboard', { cache: 'no-store' })
        const payload = await response.json().catch(() => null)

        if (!response.ok) {
          throw new Error((payload as { error?: string } | null)?.error || 'Failed to load your dashboard.')
        }

        if (!cancelled) {
          setData(payload as ConsumerDashboardPayload)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load your dashboard.')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <EmptyState
        icon={<Wallet className="h-8 w-8" />}
        title="Your personal dashboard is still connecting"
        description={error || 'We could not load your money, sharing tools, and progress overview yet.'}
      />
    )
  }

  const consumer = data.summary.consumer
  const wallet = data.wallet || data.summary.wallet
  const payoutMethod = data.wallet?.bank || 'Not set up yet'
  const fullName = `${consumer.firstName} ${consumer.lastName}`.trim() || profile.full_name || consumer.email
  const shareUrl = consumer.sharedURL
  const walletReady = data.summary.stripeOnboarded
  const transactionPreview = data.transactions.slice(0, 6)
  const nextRewardStep = !walletReady
    ? 'Finish wallet setup so your money is ready when rewards arrive.'
    : data.summary.counts.friends < 5
      ? 'Invite one more friend to keep growing your network.'
      : data.summary.counts.causes < 10
        ? 'Pick another cause to grow your impact.'
        : 'Keep sharing your link and using LocalVIP.'
  const beginnerChecklist = [
    {
      title: 'Set up my wallet',
      description: 'This lets your available money pay out smoothly when rewards are ready.',
      complete: walletReady,
      href: '/portal/me/wallet',
      actionLabel: walletReady ? 'Wallet ready' : 'Open wallet',
    },
    {
      title: 'Invite my first 5 friends',
      description: 'Your first network milestone is 5 friends connected to your link.',
      complete: data.friends.length >= 5,
      href: '/portal/me/network',
      actionLabel: data.friends.length >= 5 ? 'Goal complete' : 'Open network',
    },
    {
      title: 'Choose my first 10 causes',
      description: 'Supporting causes is part of how your LocalVIP activity grows your impact.',
      complete: data.causes.length >= 10,
      href: '/portal/me/causes',
      actionLabel: data.causes.length >= 10 ? 'Goal complete' : 'Choose causes',
    },
  ]

  async function handleCopyLink() {
    if (!shareUrl) return

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopyState('copied')
      window.setTimeout(() => setCopyState('idle'), 2000)
    } catch {
      setCopyState('error')
      window.setTimeout(() => setCopyState('idle'), 2000)
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back, ${consumer.firstName || fullName}`}
        description="Your dashboard keeps the important things simple: your money, your next easy step, and your share tools."
        actions={
          <div className="flex flex-wrap gap-2">
            <Badge variant={consumer.isEnabled ? 'success' : 'default'} dot>
              {consumer.isEnabled ? 'Account active' : 'Account inactive'}
            </Badge>
            <Badge variant={walletReady ? 'success' : 'warning'}>
              {walletReady ? 'Wallet ready' : 'Wallet setup needed'}
            </Badge>
          </div>
        }
      />

      <Card className="overflow-hidden border-surface-200">
        <div className="bg-[linear-gradient(135deg,_rgba(59,130,246,0.12),_rgba(255,255,255,0.98)_42%,_rgba(16,185,129,0.12)_100%)] px-6 py-6">
          <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/85 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Your three main things
              </div>

              <div>
                <h2 className="text-3xl font-bold tracking-tight text-surface-900">Keep it simple</h2>
                <p className="mt-3 text-sm leading-7 text-surface-600 sm:text-base">
                  Check what money is ready, follow your easiest next step, and share your link when you want to grow.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <PriorityCard
                  icon={<Wallet className="h-4 w-4" />}
                  title="Money ready now"
                  value={formatMoney(wallet?.availableAmount)}
                  detail="This is the amount available for payout."
                />
                <PriorityCard
                  icon={<CheckCircle2 className="h-4 w-4" />}
                  title="Next easy step"
                  value={walletReady ? 'Share and grow' : 'Finish setup'}
                  detail={nextRewardStep}
                />
                <PriorityCard
                  icon={<Share2 className="h-4 w-4" />}
                  title="Your share tool"
                  value={shareUrl ? 'Link ready' : 'Link coming soon'}
                  detail={shareUrl ? 'Your personal share link is ready to copy.' : 'Your share link is not available yet.'}
                />
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/90 bg-white/90 p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="space-y-2">
                  <h3 className="text-2xl font-semibold text-surface-900">{fullName}</h3>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-surface-600">
                    <span className="inline-flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{consumer.email}</span>
                    {consumer.phoneNumber ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{consumer.phoneNumber}</span> : null}
                    {(consumer.city || consumer.state) ? (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {[consumer.city, consumer.state, consumer.country].filter(Boolean).join(', ')}
                      </span>
                    ) : null}
                  </div>
                  <div className="inline-flex items-center gap-1 text-sm text-surface-500">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined {formatDate(consumer.createdDate)}
                  </div>
                </div>

                <div className="rounded-2xl border border-surface-200 bg-white px-4 py-3 text-sm">
                  <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Referral code</p>
                  <p className="mt-1 font-mono font-semibold text-surface-900">{consumer.referralCode || '-'}</p>
                </div>
              </div>

              {!walletReady ? (
                <div className="mt-5 rounded-2xl border border-warning-200 bg-warning-50 px-4 py-4">
                  <p className="text-sm font-semibold text-warning-800">Finish wallet setup</p>
                  <p className="mt-1 text-sm leading-6 text-warning-800/90">
                    This is the last step needed before payouts can move smoothly when money becomes available.
                  </p>
                  <Button className="mt-3" asChild>
                    <Link href="/portal/me/wallet">
                      Finish wallet setup
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1fr,1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Your simple checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm leading-6 text-surface-500">
              If you are new here, finish these in order. One small step at a time is enough.
            </p>
            {beginnerChecklist.map((item, index) => (
              <ChecklistRow
                key={item.title}
                number={index + 1}
                title={item.title}
                description={item.description}
                complete={item.complete}
                href={item.href}
                actionLabel={item.actionLabel}
              />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Simple tools</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-surface-500">
              Use these when you want the fastest path to a common task.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <SimpleToolCard
                href="/portal/me/wallet"
                title="Open my wallet"
                description="Check your payout setup and any money ready now."
                icon={<Wallet className="h-4 w-4" />}
              />
              <SimpleToolCard
                href="/portal/me/network"
                title="Open my network"
                description="See friends connected to your link and invite more."
                icon={<Users className="h-4 w-4" />}
              />
              <SimpleToolCard
                href="/portal/me/causes"
                title="Choose my causes"
                description="Pick the causes you want your activity to support."
                icon={<Heart className="h-4 w-4" />}
              />
              <SimpleToolCard
                href="/portal/me/transactions"
                title="See full history"
                description="Review your purchases, cashback, and recent activity."
                icon={<CreditCard className="h-4 w-4" />}
              />
            </div>
            <details className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
              <summary className="cursor-pointer font-medium text-surface-700">Common first questions</summary>
              <div className="mt-3 space-y-2 leading-6">
                <p><strong>Where do I start?</strong> Start with your wallet if it is not ready yet. If it is ready, share your link.</p>
                <p><strong>What should I open most often?</strong> Usually your wallet, your network, and your transaction history.</p>
                <p><strong>Do I need to understand every number?</strong> No. Focus on available money, your next step, and whether your goals are moving.</p>
              </div>
            </details>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Money and payout</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <MoneyRow
              label="Available now"
              value={formatMoney(wallet?.availableAmount)}
              explanation="This is money that is ready to be paid out."
            />
            <MoneyRow
              label="Current balance"
              value={formatMoney(wallet?.currentAmount)}
              explanation="This includes money that may still be processing."
            />
            <MoneyRow
              label="Lifetime cashback"
              value={formatMoney(data.summary.lifetimeCashback)}
              explanation="This is the total cashback you have earned over time."
            />
            <MoneyRow
              label="Bonus cash"
              value={formatMoney(data.summary.lifetimeBonusCash)}
              explanation="This is extra reward money earned through sharing and network activity."
            />

            <details className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
              <summary className="cursor-pointer font-medium text-surface-700">What these money words mean</summary>
              <div className="mt-3 space-y-2 leading-6">
                <p><strong>Available now:</strong> money that is ready for payout.</p>
                <p><strong>Current balance:</strong> everything in your wallet, including money still moving through the system.</p>
                <p><strong>Payout method:</strong> where your money will go once it is paid out.</p>
              </div>
            </details>

            <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-surface-900">Payout method</p>
                  <p className="mt-1 text-sm text-surface-600">{payoutMethod}</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/portal/me/wallet">Open wallet</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Share your link</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-brand-100 bg-brand-50 px-4 py-4 text-sm leading-6 text-brand-800">
              The simplest way to grow is to share your personal link with people you already know.
            </div>

            <div className="rounded-2xl border border-surface-200 bg-white px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-surface-500">Your share link</p>
              <p className="mt-2 break-all text-sm text-surface-700">{shareUrl || 'Your share link is not available yet.'}</p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={() => { void handleCopyLink() }} disabled={!shareUrl}>
                <Copy className="h-4 w-4" />
                {copyState === 'copied' ? 'Copied' : copyState === 'error' ? 'Copy failed' : 'Copy link'}
              </Button>
              {shareUrl ? (
                <Button variant="outline" asChild>
                  <a href={`sms:?&body=${encodeURIComponent(`Here is my LocalVIP link: ${shareUrl}`)}`}>
                    Text my link
                    <Phone className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
              {shareUrl ? (
                <Button variant="outline" asChild>
                  <a href={`mailto:?subject=${encodeURIComponent('My LocalVIP link')}&body=${encodeURIComponent(`Here is my LocalVIP link: ${shareUrl}`)}`}>
                    Email my link
                    <Mail className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
              <Button variant="outline" asChild>
                <Link href="/portal/me/network">
                  See my network
                  <Users className="h-4 w-4" />
                </Link>
              </Button>
              {shareUrl ? (
                <Button variant="outline" asChild>
                  <a href={shareUrl} target="_blank" rel="noopener noreferrer">
                    Open share page
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>

            <details className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
              <summary className="cursor-pointer font-medium text-surface-700">What should I say when I share?</summary>
              <p className="mt-3 leading-6">
                Keep it short: &quot;Here&apos;s my LocalVIP link if you want to join with me.&quot; Short and personal usually works best.
              </p>
            </details>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <AchievementCard
          icon={<Users className="h-4 w-4" />}
          title="Your 5-friends goal"
          progress={data.friends.length}
          goal={5}
          nextStep={data.friends.length < 5 ? 'Invite one more friend to keep this moving.' : 'You reached your 5-friends goal.'}
        >
          {data.friends.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">No friends linked yet.</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/me/network">Open my network</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {data.friends.map((friend) => (
                <div key={friend.id} className="flex items-center justify-between rounded-xl border border-surface-200 p-3">
                  <div>
                    <div className="font-medium text-surface-900">{friend.firstName} {friend.lastName}</div>
                    <div className="text-xs text-surface-500">{friend.email}</div>
                  </div>
                  <Badge variant={friend.isActive ? 'success' : 'default'} dot>
                    {friend.isActive ? 'Active' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </AchievementCard>

        <AchievementCard
          icon={<Heart className="h-4 w-4" />}
          title="Your 10-causes goal"
          progress={data.causes.length}
          goal={10}
          nextStep={data.causes.length < 10 ? 'Pick another cause when you are ready to grow your impact.' : 'You reached your 10-causes goal.'}
        >
          {data.causes.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">No causes linked yet.</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/me/causes">Choose causes</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {data.causes.map((cause) => (
                <div key={cause.id} className="flex items-center justify-between rounded-xl border border-surface-200 p-3">
                  <div>
                    <div className="font-medium text-surface-900">{cause.name}</div>
                    <div className="text-xs text-surface-500">{cause.ownerEmail || 'No owner email available'}</div>
                  </div>
                  <Badge variant={cause.isActive ? 'success' : 'default'} dot>
                    {cause.isActive ? 'Active' : 'Pending'}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </AchievementCard>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <CardTitle>Recent activity and rewards</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/portal/me/transactions">Open full history</Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {transactionPreview.length === 0 ? (
            <p className="text-sm text-surface-500">No activity yet. Your purchases and rewards will appear here once you start using LocalVIP.</p>
          ) : (
            transactionPreview.map((transaction) => (
              <details key={transaction.id} className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-surface-900">{formatDate(transaction.createdDate)}</p>
                      <p className="text-sm text-surface-500">
                        You earned {formatMoney(transaction.cashback)} cashback on a {formatMoney(transaction.amount)} purchase.
                      </p>
                    </div>
                    <Badge variant={transaction.transactionStatus === 'completed' ? 'success' : 'default'}>
                      {transaction.transactionStatus || 'Pending'}
                    </Badge>
                  </div>
                </summary>
                <div className="mt-4 grid gap-2 rounded-2xl border border-white bg-white p-4 text-sm text-surface-600 sm:grid-cols-2">
                  <div><strong className="text-surface-800">Purchase amount:</strong> {formatMoney(transaction.amount)}</div>
                  <div><strong className="text-surface-800">Cashback earned:</strong> {formatMoney(transaction.cashback)}</div>
                  <div><strong className="text-surface-800">Tip:</strong> {formatMoney(transaction.tip)}</div>
                  <div><strong className="text-surface-800">Processing fee:</strong> {formatMoney(transaction.txFee)}</div>
                  <div><strong className="text-surface-800">Final total:</strong> {formatMoney(transaction.finalAmount)}</div>
                </div>
              </details>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.05fr,0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>Reward history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <RewardHistory
              title="Cashback"
              rows={data.cashback?.recent || []}
              emptyText="No cashback yet. It will show here after your first qualifying purchases."
            />
            <RewardHistory
              title="Bonus cash"
              rows={data.bonusCash?.recent || []}
              emptyText="No bonus cash yet. This grows through sharing and network activity."
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AccountRow icon={<QrCode className="h-4 w-4" />} label="Referral code" value={consumer.referralCode || '-'} mono />
            <AccountRow icon={<CreditCard className="h-4 w-4" />} label="Transactions" value={`${data.summary.counts.transactions}`} />
            <AccountRow icon={<Smartphone className="h-4 w-4" />} label="Registered devices" value={`${data.summary.counts.devices}`} />
            <details className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
              <summary className="cursor-pointer font-medium text-surface-700">What is my referral code?</summary>
              <p className="mt-3 leading-6">
                Your referral code is the short code tied to your account. You may see it in sharing tools, support tasks,
                or when someone is linking activity back to you.
              </p>
            </details>
            <details className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
              <summary className="cursor-pointer font-medium text-surface-700">Show device list</summary>
              <div className="mt-3 space-y-2">
                {data.devices.length === 0 ? (
                  <p>No devices registered yet.</p>
                ) : (
                  data.devices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between rounded-xl border border-white bg-white px-3 py-2">
                      <span className="font-mono text-xs text-surface-600">Device {device.deviceId}</span>
                      <span className="text-xs text-surface-500">{formatDate(device.createdDate)}</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ChecklistRow({
  number,
  title,
  description,
  complete,
  href,
  actionLabel,
}: {
  number: number
  title: string
  description: string
  complete: boolean
  href: string
  actionLabel: string
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex gap-3">
          <div className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${complete ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-700'}`}>
            {complete ? <CheckCircle2 className="h-4 w-4" /> : number}
          </div>
          <div>
            <p className="text-sm font-semibold text-surface-900">{title}</p>
            <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={complete ? 'success' : 'warning'}>{complete ? 'Done' : 'Next step'}</Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href={href}>{actionLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}

function PriorityCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: React.ReactNode
  title: string
  value: string
  detail: string
}) {
  return (
    <div className="rounded-2xl border border-white/90 bg-white/90 px-4 py-4 shadow-sm">
      <div className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-surface-900">{title}</p>
      <p className="mt-1 text-base font-semibold text-surface-900">{value}</p>
      <p className="mt-1 text-sm leading-6 text-surface-500">{detail}</p>
    </div>
  )
}

function SimpleToolCard({
  href,
  title,
  description,
  icon,
}: {
  href: string
  title: string
  description: string
  icon: React.ReactNode
}) {
  return (
    <Link href={href} className="rounded-2xl border border-surface-200 bg-white px-4 py-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="inline-flex rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</div>
      <p className="mt-3 text-sm font-semibold text-surface-900">{title}</p>
      <p className="mt-1 text-sm leading-6 text-surface-500">{description}</p>
      <div className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-brand-700">
        Open tool
        <ArrowRight className="h-4 w-4" />
      </div>
    </Link>
  )
}

function MoneyRow({
  label,
  value,
  explanation,
}: {
  label: string
  value: string
  explanation: string
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-baseline sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-surface-900">{label}</p>
          <p className="mt-1 text-sm leading-6 text-surface-500">{explanation}</p>
        </div>
        <p className="text-2xl font-bold text-surface-900">{value}</p>
      </div>
    </div>
  )
}

function AchievementCard({
  icon,
  title,
  progress,
  goal,
  nextStep,
  children,
}: {
  icon: React.ReactNode
  title: string
  progress: number
  goal: number
  nextStep: string
  children: React.ReactNode
}) {
  const percent = Math.min(100, Math.round((progress / goal) * 100))

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-brand-50 p-2 text-brand-700">{icon}</div>
          <div>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-surface-500">{progress} of {goal} completed</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-3 overflow-hidden rounded-full bg-surface-100">
          <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-sm leading-6 text-surface-600">{nextStep}</p>
        {children}
      </CardContent>
    </Card>
  )
}

function RewardHistory({
  title,
  rows,
  emptyText,
}: {
  title: string
  rows: { id: number; amount: number; accountId: number; createdDate: string | null }[]
  emptyText: string
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
      <p className="text-sm font-semibold text-surface-900">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-surface-500">{emptyText}</p>
      ) : (
        <div className="mt-3 space-y-2 text-sm">
          {rows.slice(0, 6).map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-xl border border-white bg-white px-3 py-2">
              <span className="text-surface-600">{formatDate(row.createdDate)}</span>
              <span className="font-medium text-emerald-600">+{formatMoney(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AccountRow({
  icon,
  label,
  value,
  mono = false,
}: {
  icon: React.ReactNode
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <div className="flex items-center gap-2 text-surface-700">
        <div className="rounded-lg bg-white p-2 text-brand-700">{icon}</div>
        <span className="text-sm font-medium">{label}</span>
      </div>
      <span className={mono ? 'font-mono text-sm text-surface-900' : 'text-sm text-surface-900'}>{value}</span>
    </div>
  )
}
