'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Copy,
  CreditCard,
  Download,
  Eye,
  ExternalLink,
  Gift,
  Heart,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Printer,
  QrCode,
  RefreshCw,
  Search,
  Share2,
  Smartphone,
  Sparkles,
  Target,
  Trophy,
  Users,
  Wallet,
  X,
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
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [copyState, setCopyState] = React.useState<'idle' | 'copied' | 'error'>('idle')
  const [actionMessage, setActionMessage] = React.useState<string | null>(null)
  const [activeSection, setActiveSection] = React.useState<'overview' | 'share' | 'money' | 'network' | 'activity'>('overview')
  const [transactionStatusFilter, setTransactionStatusFilter] = React.useState<'all' | 'completed' | 'pending'>('all')
  const [rewardFilter, setRewardFilter] = React.useState<'all' | 'cashback' | 'bonus'>('all')
  const [networkSearch, setNetworkSearch] = React.useState('')
  const [simulatedSpend, setSimulatedSpend] = React.useState(50)
  const [simulatedCashbackPercent, setSimulatedCashbackPercent] = React.useState(10)
  const [simulatedFriends, setSimulatedFriends] = React.useState(1)
  const [showTips, setShowTips] = React.useState(true)

  const loadDashboard = React.useCallback(async (silent = false) => {
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/qa/me/consumer-dashboard', { cache: 'no-store' })
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error((payload as { error?: string } | null)?.error || 'Failed to load your dashboard.')
      }

      setData(payload as ConsumerDashboardPayload)
      if (silent) {
        setActionMessage('Dashboard refreshed from QA.')
        window.setTimeout(() => setActionMessage(null), 2500)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your dashboard.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  React.useEffect(() => {
    void loadDashboard()
  }, [loadDashboard])

  React.useEffect(() => {
    const stored = window.localStorage.getItem('localvip-consumer-dashboard-tips')
    if (stored === 'hidden') setShowTips(false)
  }, [])

  React.useEffect(() => {
    const hash = window.location.hash.replace('#', '')
    if (hash === 'share' || hash === 'money' || hash === 'network' || hash === 'activity') {
      setActiveSection(hash)
      window.setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }, [])

  React.useEffect(() => {
    const handle = (event: HashChangeEvent) => {
      const hash = new URL(event.newURL).hash.replace('#', '')
      if (hash === 'overview' || hash === 'share' || hash === 'money' || hash === 'network' || hash === 'activity') {
        setActiveSection(hash)
      }
    }
    window.addEventListener('hashchange', handle)
    return () => {
      window.removeEventListener('hashchange', handle)
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
  const normalizedNetworkSearch = networkSearch.trim().toLowerCase()
  const filteredFriends = data.friends.filter((friend) =>
    `${friend.firstName} ${friend.lastName} ${friend.email}`.toLowerCase().includes(normalizedNetworkSearch)
  )
  const filteredCauses = data.causes.filter((cause) =>
    `${cause.name} ${cause.ownerEmail || ''}`.toLowerCase().includes(normalizedNetworkSearch)
  )
  const filteredTransactions = data.transactions.filter((transaction) => {
    if (transactionStatusFilter === 'all') return true
    const status = (transaction.transactionStatus || 'pending').toLowerCase()
    return transactionStatusFilter === 'completed' ? status === 'completed' : status !== 'completed'
  })
  const transactionPreview = filteredTransactions.slice(0, 6)
  const totalFilteredCashback = filteredTransactions.reduce((sum, transaction) => sum + (transaction.cashback || 0), 0)
  const rewardRows = [
    ...(rewardFilter === 'all' || rewardFilter === 'cashback'
      ? (data.cashback?.recent || []).map((row) => ({ ...row, kind: 'Cashback' as const }))
      : []),
    ...(rewardFilter === 'all' || rewardFilter === 'bonus'
      ? (data.bonusCash?.recent || []).map((row) => ({ ...row, kind: 'Bonus cash' as const }))
      : []),
  ].sort((a, b) => new Date(b.createdDate || '').getTime() - new Date(a.createdDate || '').getTime())
  const timeline = [
    ...data.transactions.slice(0, 6).map((transaction) => ({
      id: `tx-${transaction.id}`,
      title: `${formatMoney(transaction.cashback)} cashback`,
      detail: `${formatMoney(transaction.amount)} purchase${transaction.transactionStatus ? ` / ${transaction.transactionStatus}` : ''}`,
      at: transaction.createdDate,
      href: '/portal/me/transactions',
      tone: 'success' as const,
    })),
    ...data.friends.slice(0, 4).map((friend) => ({
      id: `friend-${friend.id}`,
      title: `${friend.firstName} ${friend.lastName}`.trim() || 'Friend connected',
      detail: friend.isActive ? 'Active friend in your network' : 'Friend pending activation',
      at: null,
      href: '/portal/me/network',
      tone: friend.isActive ? 'success' as const : 'warning' as const,
    })),
    ...data.causes.slice(0, 4).map((cause) => ({
      id: `cause-${cause.id}`,
      title: cause.name,
      detail: cause.isActive ? 'Active selected cause' : 'Cause pending activation',
      at: null,
      href: '/portal/me/causes',
      tone: cause.isActive ? 'success' as const : 'warning' as const,
    })),
  ].slice(0, 10)
  const simulatedCashback = simulatedSpend * (simulatedCashbackPercent / 100)
  const simulatedNetworkLift = simulatedCashback * Math.max(1, simulatedFriends)
  const milestonePercent = Math.round(((Number(walletReady) + Math.min(5, data.friends.length) / 5 + Math.min(10, data.causes.length) / 10) / 3) * 100)
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

  async function handleCopyCode() {
    if (!consumer.referralCode) return
    try {
      await navigator.clipboard.writeText(consumer.referralCode)
      setActionMessage('Referral code copied.')
      window.setTimeout(() => setActionMessage(null), 2000)
    } catch {
      setActionMessage('Could not copy the referral code.')
      window.setTimeout(() => setActionMessage(null), 2000)
    }
  }

  async function handleNativeShare() {
    if (!shareUrl) return
    if (navigator.share) {
      await navigator.share({
        title: 'Join me on LocalVIP',
        text: 'Here is my LocalVIP link.',
        url: shareUrl,
      }).catch(() => null)
      return
    }
    await handleCopyLink()
  }

  function handleSectionJump(section: typeof activeSection) {
    setActiveSection(section)
    window.history.replaceState(null, '', `#${section}`)
    document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleExportTransactions() {
    const headers = ['Date', 'Amount', 'Tip', 'Cashback', 'Fee', 'Final', 'Status']
    const rows = filteredTransactions.map((transaction) => [
      formatDate(transaction.createdDate),
      transaction.amount,
      transaction.tip,
      transaction.cashback,
      transaction.txFee,
      transaction.finalAmount,
      transaction.transactionStatus || 'pending',
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'localvip-transactions.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  function handleDismissTips() {
    setShowTips(false)
    window.localStorage.setItem('localvip-consumer-dashboard-tips', 'hidden')
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
            <Button variant="outline" size="sm" onClick={() => void loadDashboard(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh QA
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print
            </Button>
          </div>
        }
      />

      {actionMessage ? (
        <div className="rounded-2xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-800">
          {actionMessage}
        </div>
      ) : null}

      <div className="sticky top-0 z-20 -mx-2 flex gap-2 overflow-x-auto bg-surface-0/90 px-2 py-2 backdrop-blur">
        {[
          { key: 'overview' as const, label: 'Overview', icon: <Eye className="h-4 w-4" /> },
          { key: 'share' as const, label: 'Share', icon: <Share2 className="h-4 w-4" /> },
          { key: 'money' as const, label: 'Money', icon: <Wallet className="h-4 w-4" /> },
          { key: 'network' as const, label: 'Network', icon: <Users className="h-4 w-4" /> },
          { key: 'activity' as const, label: 'Activity', icon: <Bell className="h-4 w-4" /> },
        ].map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => handleSectionJump(item.key)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition-colors ${
              activeSection === item.key
                ? 'border-brand-300 bg-brand-50 text-brand-700'
                : 'border-surface-200 bg-white text-surface-600 hover:border-brand-200 hover:text-brand-700'
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {showTips ? (
        <div className="flex flex-col gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              Tip: this dashboard is live against QA. Use Refresh QA after you change wallet, causes, network, or purchase data.
            </p>
          </div>
          <button type="button" onClick={handleDismissTips} className="inline-flex items-center gap-1 font-semibold text-sky-800 hover:text-sky-950">
            Hide <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <Card id="overview" className="scroll-mt-24 overflow-hidden border-surface-200">
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

      <div id="money" className="grid scroll-mt-24 gap-6 xl:grid-cols-[1.05fr,0.95fr]">
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

        <Card id="share" className="scroll-mt-24">
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
              <Button variant="outline" onClick={() => { void handleCopyCode() }} disabled={!consumer.referralCode}>
                <QrCode className="h-4 w-4" />
                Copy code
              </Button>
              <Button variant="outline" onClick={() => { void handleNativeShare() }} disabled={!shareUrl}>
                <Share2 className="h-4 w-4" />
                Share
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

      <div className="grid gap-6 xl:grid-cols-[0.95fr,1.05fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Gift className="h-4 w-4" /> Reward simulator</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-surface-500">
              Estimate what a purchase or a few friends could mean. This does not change QA data; it helps customers understand the system.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <NumberControl label="Purchase amount" value={simulatedSpend} min={1} max={500} step={5} prefix="$" onChange={setSimulatedSpend} />
              <NumberControl label="Cashback %" value={simulatedCashbackPercent} min={1} max={30} step={1} suffix="%" onChange={setSimulatedCashbackPercent} />
              <NumberControl label="Friends sharing" value={simulatedFriends} min={1} max={25} step={1} onChange={setSimulatedFriends} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <ResultTile label="Estimated cashback" value={formatMoney(simulatedCashback)} />
              <ResultTile label="Network example" value={formatMoney(simulatedNetworkLift)} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Trophy className="h-4 w-4" /> Progress snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold text-surface-900">Overall customer setup</span>
                <span className="font-bold text-brand-700">{milestonePercent}%</span>
              </div>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-100">
                <div className="h-full rounded-full bg-gradient-to-r from-brand-500 to-emerald-500" style={{ width: `${milestonePercent}%` }} />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniMilestone label="Wallet" complete={walletReady} href="/portal/me/wallet" />
              <MiniMilestone label="5 friends" complete={data.friends.length >= 5} href="/portal/me/network" />
              <MiniMilestone label="10 causes" complete={data.causes.length >= 10} href="/portal/me/causes" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div id="network" className="grid scroll-mt-24 gap-6 xl:grid-cols-2">
        <div className="xl:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-surface-900">Find people or causes</p>
                <p className="mt-1 text-sm text-surface-500">Search your connected friends and selected causes from the QA dashboard payload.</p>
              </div>
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-400" />
                <input
                  value={networkSearch}
                  onChange={(event) => setNetworkSearch(event.target.value)}
                  placeholder="Search network..."
                  className="h-10 w-full rounded-xl border border-surface-200 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
                />
              </div>
            </CardContent>
          </Card>
        </div>
        <AchievementCard
          icon={<Users className="h-4 w-4" />}
          title="Your 5-friends goal"
          progress={data.friends.length}
          goal={5}
          nextStep={data.friends.length < 5 ? 'Invite one more friend to keep this moving.' : 'You reached your 5-friends goal.'}
        >
          {filteredFriends.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">{networkSearch ? 'No friends match your search.' : 'No friends linked yet.'}</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/me/network">Open my network</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFriends.map((friend) => (
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
          {filteredCauses.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">{networkSearch ? 'No causes match your search.' : 'No causes linked yet.'}</p>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/me/causes">Choose causes</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredCauses.map((cause) => (
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

      <Card id="activity" className="scroll-mt-24">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Recent activity and rewards</CardTitle>
              <p className="mt-1 text-sm text-surface-500">
                Showing {filteredTransactions.length} transactions and {formatMoney(totalFilteredCashback)} filtered cashback.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={transactionStatusFilter}
                onChange={(event) => setTransactionStatusFilter(event.target.value as typeof transactionStatusFilter)}
                className="h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-700"
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
              <Button variant="outline" size="sm" onClick={handleExportTransactions} disabled={filteredTransactions.length === 0}>
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal/me/transactions">Open full history</Link>
              </Button>
            </div>
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Reward history</CardTitle>
              <select
                value={rewardFilter}
                onChange={(event) => setRewardFilter(event.target.value as typeof rewardFilter)}
                className="h-9 rounded-lg border border-surface-200 bg-white px-3 text-sm text-surface-700"
              >
                <option value="all">All rewards</option>
                <option value="cashback">Cashback only</option>
                <option value="bonus">Bonus only</option>
              </select>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <MergedRewardHistory rows={rewardRows} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-surface-900">Need help?</p>
                  <p className="mt-1 text-sm text-surface-500">Open a pre-filled email to LocalVIP support.</p>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href={`mailto:support@localvip.com?subject=${encodeURIComponent('Help with my LocalVIP customer dashboard')}&body=${encodeURIComponent(`Hi LocalVIP,\n\nI need help with my customer dashboard.\n\nAccount: ${consumer.email}\nReferral code: ${consumer.referralCode || 'not available'}\n`)}`}>
                    Contact support
                  </a>
                </Button>
              </div>
            </div>
            <AccountRow icon={<QrCode className="h-4 w-4" />} label="Your share code" value={consumer.referralCode || '-'} mono />
            <AccountRow icon={<CreditCard className="h-4 w-4" />} label="Purchases tracked" value={`${data.summary.counts.transactions}`} />
            <AccountRow icon={<Smartphone className="h-4 w-4" />} label="Phones signed in" value={`${data.summary.counts.devices}`} />
            <details className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
              <summary className="cursor-pointer font-medium text-surface-700">What is my share code?</summary>
              <p className="mt-3 leading-6">
                This is your personal code for inviting friends. When someone joins with it, the people you invite are
                linked to you - that is how your network and bonus cash grow.
              </p>
            </details>
            <details className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 text-sm text-surface-600">
              <summary className="cursor-pointer font-medium text-surface-700">See my phones &amp; devices</summary>
              <div className="mt-3 space-y-2">
                {data.devices.length === 0 ? (
                  <p>No phones signed in yet. They&apos;ll show up here after you log in on a device.</p>
                ) : (
                  data.devices.map((device) => (
                    <div key={device.id} className="flex items-center justify-between rounded-xl border border-white bg-white px-3 py-2">
                      <span className="text-xs text-surface-600">Signed-in device</span>
                      <span className="text-xs text-surface-500">{formatDate(device.createdDate)}</span>
                    </div>
                  ))
                )}
              </div>
            </details>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-4 w-4" /> What changed recently</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {timeline.length === 0 ? (
            <p className="text-sm text-surface-500">Nothing has happened yet. Once you shop, share, or choose causes, your timeline will show it here.</p>
          ) : (
            timeline.map((item) => (
              <Link key={item.id} href={item.href} className="flex gap-3 rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3 transition-colors hover:border-brand-200 hover:bg-brand-50">
                <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${item.tone === 'success' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-surface-900">{item.title}</span>
                  <span className="block text-sm text-surface-500">{item.detail}</span>
                  {item.at ? <span className="mt-1 block text-xs text-surface-400">{formatDate(item.at)}</span> : null}
                </span>
                <ArrowRight className="ml-auto mt-1 h-4 w-4 shrink-0 text-surface-400" />
              </Link>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function NumberControl({
  label,
  value,
  min,
  max,
  step,
  prefix = '',
  suffix = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  prefix?: string
  suffix?: string
  onChange: (value: number) => void
}) {
  return (
    <label className="block rounded-2xl border border-surface-200 bg-surface-50 px-4 py-3">
      <span className="text-xs uppercase tracking-[0.14em] text-surface-500">{label}</span>
      <span className="mt-2 flex items-center gap-2">
        <span className="text-sm font-semibold text-surface-500">{prefix}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Math.min(max, Math.max(min, Number(event.target.value) || min)))}
          className="h-10 min-w-0 flex-1 rounded-xl border border-surface-200 bg-white px-3 text-sm font-semibold text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-300"
        />
        <span className="text-sm font-semibold text-surface-500">{suffix}</span>
      </span>
    </label>
  )
}

function ResultTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.14em] text-emerald-700">{label}</p>
      <p className="mt-2 text-2xl font-bold text-emerald-900">{value}</p>
    </div>
  )
}

function MiniMilestone({ label, complete, href }: { label: string; complete: boolean; href: string }) {
  return (
    <Link href={href} className={`rounded-2xl border px-4 py-3 transition-colors ${complete ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50 hover:bg-amber-100'}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-sm font-semibold ${complete ? 'text-emerald-800' : 'text-amber-900'}`}>{label}</span>
        {complete ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <Target className="h-4 w-4 text-amber-700" />}
      </div>
      <p className={`mt-1 text-xs ${complete ? 'text-emerald-700' : 'text-amber-800'}`}>{complete ? 'Complete' : 'Open next step'}</p>
    </Link>
  )
}

function MergedRewardHistory({
  rows,
}: {
  rows: Array<{ id: number; amount: number; accountId: number; createdDate: string | null; kind: 'Cashback' | 'Bonus cash' }>
}) {
  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 px-4 py-4">
      {rows.length === 0 ? (
        <p className="text-sm text-surface-500">No matching rewards yet. Cashback and bonus cash will show here after qualifying activity.</p>
      ) : (
        <div className="space-y-2 text-sm">
          {rows.slice(0, 10).map((row) => (
            <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between rounded-xl border border-white bg-white px-3 py-2">
              <div>
                <p className="font-medium text-surface-900">{row.kind}</p>
                <p className="text-xs text-surface-500">{formatDate(row.createdDate)} / Account {row.accountId}</p>
              </div>
              <span className="font-medium text-emerald-600">+{formatMoney(row.amount)}</span>
            </div>
          ))}
        </div>
      )}
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
