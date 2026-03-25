'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BRANDS } from '@/lib/constants'
import { DEMO_PROFILES } from '@/lib/auth/demo-profiles'
import { ROLES } from '@/lib/constants'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // TODO: Replace with Supabase auth
    // For now, demo mode
    const profile = Object.values(DEMO_PROFILES).find(p => p.email === email)
    if (profile) {
      localStorage.setItem('demo_profile', JSON.stringify(profile))
      router.push('/dashboard')
    } else {
      setError('Invalid credentials. Try a demo account below.')
    }
    setLoading(false)
  }

  const loginAsDemo = (key: string) => {
    const profile = DEMO_PROFILES[key]
    localStorage.setItem('demo_profile', JSON.stringify(profile))
    router.push('/dashboard')
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
            built for schools, causes, influencers, volunteers, and partners.
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
              {Object.entries(DEMO_PROFILES).map(([key, profile]) => (
                <button
                  key={key}
                  onClick={() => loginAsDemo(key)}
                  className="flex flex-col items-start rounded-lg border border-surface-200 p-2.5 text-left text-xs hover:bg-surface-50 transition-colors"
                >
                  <span className="font-medium text-surface-800">{profile.full_name.split(' (')[0]}</span>
                  <span className="text-surface-400">{ROLES[profile.role].label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
