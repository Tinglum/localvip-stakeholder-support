'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BRANDS } from '@/lib/constants'
import { createClient } from '@/lib/supabase/client'

const DEMO_ACCOUNTS = [
  { email: 'kenneth@localvip.com', name: 'Kenneth', role: 'Super Admin' },
  { email: 'rick@localvip.com', name: 'Rick', role: 'Internal Admin' },
  { email: 'principal@mlkschool.edu', name: 'Dr. Sarah Johnson', role: 'School Leader' },
  { email: 'director@communitystrong.org', name: 'Marcus Williams', role: 'Cause Leader' },
  { email: 'alex@partner.com', name: 'Alex Rivera', role: 'Onboarding Partner' },
  { email: 'maya@localvip.com', name: 'Maya Patel', role: 'College Intern' },
  { email: 'jordan@influencer.com', name: 'Jordan Taylor', role: 'Influencer' },
  { email: 'volunteer@example.com', name: 'Casey Adams', role: 'Volunteer' },
  { email: 'owner@mainstreetbakery.com', name: 'Lisa Chen', role: 'Business Owner' },
]

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  const loginAsDemo = async (demoEmail: string) => {
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: demoEmail,
      password: 'demo1234',
    })

    if (authError) {
      setError(authError.message === 'Invalid login credentials'
        ? 'Demo accounts not seeded yet. Run: npm run db:seed'
        : authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="flex min-h-screen">
      {/* Left panel — branding */}
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
            Everything your team needs.<br />
            One place. Zero friction.
          </h1>
          <p className="mt-4 max-w-md text-white/70">
            Marketing materials, QR codes, onboarding pipelines, analytics, and CRM —
            built for schools, causes, interns, influencers, volunteers, and partners.
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

      {/* Right panel — form */}
      <div className="flex flex-1 flex-col justify-center px-8 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-surface-900">Sign in</h2>
            <p className="mt-1 text-sm text-surface-500">
              Access your stakeholder dashboard
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

          {/* Demo accounts */}
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
