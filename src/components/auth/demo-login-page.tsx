'use client'

import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BRANDS } from '@/lib/constants'

const DEMO_ACCOUNTS = [
  { email: 'kenneth@localvip.com', name: 'Kenneth', role: 'Super Admin' },
  { email: 'rick@localvip.com', name: 'Rick', role: 'Internal Admin' },
  { email: 'principal@mlkschool.edu', name: 'Dr. Sarah Johnson', role: 'School Leader' },
  { email: 'director@communitystrong.org', name: 'Marcus Williams', role: 'Cause Leader' },
  { email: 'alex@partner.com', name: 'Alex Rivera', role: 'Onboarding Partner' },
  { email: 'maya@localvip.com', name: 'Maya Patel', role: 'College Intern' },
  { email: 'jordan@influencer.com', name: 'Jordan Taylor', role: 'Influencer' },
  { email: 'taylor@localvip.com', name: 'Taylor Morgan', role: 'VIP Client' },
  { email: 'volunteer@example.com', name: 'Casey Adams', role: 'Volunteer' },
  { email: 'owner@mainstreetbakery.com', name: 'Lisa Chen', role: 'Business Owner' },
]

export function DemoLoginPage() {
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const loginWithDemoSession = React.useCallback(async (payload: { email: string; password?: string }) => {
    const response = await fetch('/api/auth/demo-login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ...payload,
        returnTo: '/dashboard',
      }),
    }).catch(() => null)

    if (!response) {
      throw new Error('Demo login is unavailable right now. Please try again.')
    }

    const result = await response.json().catch(() => null)
    if (!response.ok || !result?.ok) {
      throw new Error(typeof result?.error === 'string' ? result.error : 'Demo login failed.')
    }

    window.location.assign(typeof result.redirectTo === 'string' ? result.redirectTo : '/dashboard')
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      await loginWithDemoSession({ email, password })
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Demo login failed.')
      setLoading(false)
    }
  }

  const loginAsDemo = async (demoEmail: string) => {
    setLoading(true)
    setError('')

    try {
      await loginWithDemoSession({ email: demoEmail })
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Demo login failed.')
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between bg-brand-700 p-12 text-white">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20" />
            <span className="text-xl font-bold">LocalVIP</span>
          </div>
          <p className="mt-1 text-sm text-white/60">Stakeholder Support Hub</p>
        </div>
        <div>
          <h1 className="text-3xl font-bold leading-tight">
            Demo access stays here.<br />
            QA auth lives on LocalVIP.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Use this page only for seeded demo accounts while the main dashboard login moves to the QA identity server.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: BRANDS.localvip.color }} />
            <span className="text-xs text-white/60">LocalVIP</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: BRANDS.hato.color }} />
            <span className="text-xs text-white/60">Help A Teacher Out</span>
          </div>
        </div>
      </div>

      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-surface-900">Demo sign in</h2>
            <p className="mt-1 text-sm text-surface-500">
              Use seeded demo accounts only. Production-style login now starts at QA.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Email</label>
              <Input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Password</label>
              <Input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
              />
            </div>
            {error && <p className="text-sm text-danger-500">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>

          <div className="mt-8 border-t border-surface-200 pt-6">
            <p className="mb-3 text-xs font-medium text-surface-400 uppercase tracking-wider">Demo Accounts</p>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((account) => (
                <button
                  key={account.email}
                  type="button"
                  onClick={() => loginAsDemo(account.email)}
                  disabled={loading}
                  className="flex flex-col items-start rounded-lg border border-surface-200 p-2.5 text-left text-xs hover:bg-surface-50 transition-colors disabled:opacity-50"
                >
                  <span className="font-medium text-surface-800">{account.name}</span>
                  <span className="text-surface-400">{account.role}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
