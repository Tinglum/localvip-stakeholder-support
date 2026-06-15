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
  helperLabel: string
}

const PORTAL_LINKS: PortalLink[] = [
  {
    href: '/portal/me/wallet',
    title: 'Check My Money',
    description: 'See how much cashback and rewards you have earned so far.',
    icon: Wallet,
    helperLabel: 'Best first step',
  },
  {
    href: '/portal/me/network',
    title: 'See My People',
    description: 'View the people you invited and how your community is growing.',
    icon: Users,
    helperLabel: 'Easy next step',
  },
  {
    href: '/portal/me/transactions',
    title: 'View My Activity',
    description: 'Look back at your purchases, rewards, and account activity.',
    icon: Receipt,
    helperLabel: 'Helpful anytime',
  },
  {
    href: '/portal/me/causes',
    title: 'Choose My Causes',
    description: 'Pick the local causes you want your support to help.',
    icon: Heart,
    helperLabel: 'Set this up once',
  },
]

export default function MyPortalPage() {
  const { profile } = useAuth()
  const firstName = profile.full_name?.split(' ')[0] || 'there'

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <h1 className="text-display text-surface-900">My LocalVIP</h1>
        <p className="text-body text-surface-500">
          Welcome back, {firstName}. This is your personal home page for checking your rewards, seeing your people,
          and choosing where your support goes.
        </p>
        <p className="max-w-3xl text-sm leading-6 text-surface-500">
          If you are not sure where to start, begin with your money, then look at your people, then choose your
          causes. Each page keeps things simple and shows only what you need.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-brand-100 bg-brand-50/60 shadow-sm">
          <CardContent className="space-y-4 py-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Start here</p>
              <h2 className="text-xl font-semibold text-surface-900">Three easy things to do first</h2>
              <p className="text-sm leading-6 text-surface-600">
                You do not need to learn anything technical. Just work through these in order.
              </p>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <p className="text-sm font-semibold text-surface-900">1. Check your money</p>
                <p className="mt-1 text-sm leading-6 text-surface-600">
                  See what you have earned so far and whether there is anything ready for you.
                </p>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <p className="text-sm font-semibold text-surface-900">2. See your people</p>
                <p className="mt-1 text-sm leading-6 text-surface-600">
                  Look at who joined through you and how your community is growing.
                </p>
              </div>
              <div className="rounded-2xl bg-white/90 px-4 py-3">
                <p className="text-sm font-semibold text-surface-900">3. Choose your causes</p>
                <p className="mt-1 text-sm leading-6 text-surface-600">
                  Make sure your support goes to the local causes you care about most.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardContent className="space-y-4 py-6">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-surface-500">Quick help</p>
              <h2 className="text-xl font-semibold text-surface-900">What this page is for</h2>
            </div>
            <div className="space-y-3 text-sm leading-6 text-surface-600">
              <p>This page helps you review your progress and make simple choices.</p>
              <p>You can safely click any card below. Nothing here will charge you or change your account by mistake.</p>
              <p>
                When you want to understand your rewards, start with{' '}
                <span className="font-semibold text-surface-900">Check My Money</span>.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-xl font-semibold text-surface-900">Choose what you want to do</h2>
          <p className="mt-1 text-sm leading-6 text-surface-500">
            Pick one action below. Each card explains what you will see before you open it.
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
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
                        {link.helperLabel}
                      </p>
                      <p className="text-sm font-semibold text-surface-900 transition-colors group-hover:text-brand-700">
                        {link.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-surface-500">{link.description}</p>
                    </div>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-surface-300 transition-colors group-hover:text-brand-500" />
                  </CardContent>
                </Card>
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-surface-200 bg-surface-50 px-4 py-3">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-surface-400" />
        <p className="text-sm leading-6 text-surface-500">
          You cannot make payments or purchases on this page. This area is only for checking your rewards, your
          activity, your people, and your causes.
        </p>
      </div>
    </div>
  )
}
