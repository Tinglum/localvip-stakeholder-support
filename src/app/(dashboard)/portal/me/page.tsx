'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowRight, Heart, Info, Receipt, Users, Wallet } from 'lucide-react'
import { useAuth } from '@/lib/auth/context'
import { Card, CardContent } from '@/components/ui/card'

interface PortalLink {
  href: string
  title: string
  description: string
  icon: React.ElementType
}

const PORTAL_LINKS: PortalLink[] = [
  {
    href: '/portal/me/network',
    title: 'My Network',
    description: 'See the people you’ve referred and how your network is growing.',
    icon: Users,
  },
  {
    href: '/portal/me/wallet',
    title: 'My Wallet & Earnings',
    description: 'Track your cashback, network earnings, and cause impact.',
    icon: Wallet,
  },
  {
    href: '/portal/me/transactions',
    title: 'My Transactions',
    description: 'Review your purchases, donations, and ledger history.',
    icon: Receipt,
  },
  {
    href: '/portal/me/causes',
    title: 'My Causes',
    description: 'Choose the local causes your support flows to.',
    icon: Heart,
  },
]

export default function MyPortalPage() {
  const { profile } = useAuth()
  const firstName = profile.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display text-surface-900">My LocalVIP</h1>
        <p className="mt-1 text-body text-surface-500">
          Welcome back, {firstName}. Here’s your personal hub for your network, earnings, and the causes you support.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PORTAL_LINKS.map((link) => {
          const Icon = link.icon

          return (
            <Link key={link.href} href={link.href}>
              <Card className="group h-full cursor-pointer transition-shadow hover:shadow-card-hover">
                <CardContent className="flex items-start gap-4 py-5">
                  <div className="rounded-xl bg-brand-50 p-2.5 text-brand-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-surface-900 transition-colors group-hover:text-brand-700">
                      {link.title}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-surface-500">{link.description}</p>
                  </div>
                  <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-surface-300 transition-colors group-hover:text-brand-500" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" />
        <p className="text-xs leading-6 text-surface-500">
          Payments and purchases happen in the LocalVIP app, not here. This portal is for reviewing your network,
          earnings, transactions, and causes.
        </p>
      </div>
    </div>
  )
}
