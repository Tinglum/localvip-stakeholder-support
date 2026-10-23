'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { markUnlockedThisSession } from '@/lib/auth/biometric-unlock'

export default function SysadminPinPage() {
  const [mode, setMode] = useState<'loading' | 'setup' | 'unlock' | 'login'>('loading')
  const [pin, setPin] = useState(''), [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState(''), [busy, setBusy] = useState(false)
  useEffect(() => {
    fetch('/api/auth/sysadmin-pin', { cache: 'no-store' }).then(async response => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error)
      setMode(data.mode)
    }).catch(() => { setMode('login'); setError('PIN access is unavailable. Please sign in with your password.') })
  }, [])
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const response = await fetch('/api/auth/sysadmin-pin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: mode, pin, confirmPin }) })
      const data = await response.json()
      if (!response.ok) { if (data.loginRequired) setMode('login'); throw new Error(data.error) }
      // The verified PIN already unlocked this tab; avoid a second, optional
      // local biometric prompt left over from an earlier enrollment.
      try { markUnlockedThisSession() } catch { /* Storage may be disabled. */ }
      window.location.assign('/dashboard')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not verify PIN.'); setPin(''); setConfirmPin(''); setBusy(false) }
  }
  async function forget() {
    setBusy(true)
    const response = await fetch('/api/auth/sysadmin-pin', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'forget' }) }).catch(() => null)
    if (response?.ok) window.location.assign('/login?manual=1')
    else { setBusy(false); setError('Could not forget this browser. Try again.') }
  }
  return <main className="flex min-h-screen items-center justify-center bg-surface-50 p-6">
    <section className="w-full max-w-sm rounded-3xl border border-surface-200 bg-white p-8 shadow-sm" aria-labelledby="pin-title">
      <p className="mb-3 text-sm font-semibold text-brand-700">LocalVIP · Sysadmin</p>
      <h1 id="pin-title" className="text-2xl font-bold text-surface-900">{mode === 'setup' ? 'Set a PIN for this browser' : mode === 'login' ? 'Sign in to continue' : 'Unlock your dashboard'}</h1>
      <p className="mt-3 text-sm leading-6 text-surface-600">{mode === 'setup' ? 'Choose four digits. This browser will remember your sysadmin login and ask for this PIN when you return.' : mode === 'login' ? 'Use your full sysadmin login to register this browser or reset a forgotten PIN.' : 'Enter the four-digit PIN you set on this browser.'}</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      {mode === 'loading' && <p role="status" className="mt-6 text-sm text-surface-600">Checking this browser…</p>}
      {(mode === 'setup' || mode === 'unlock') && <form onSubmit={submit} className="mt-6 space-y-4">
        <div><label htmlFor="pin" className="mb-2 block text-sm font-medium text-surface-800">{mode === 'setup' ? 'Create a four-digit PIN' : 'Four-digit PIN'}</label>
          <Input id="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="off" value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required autoFocus disabled={busy} className="h-12 text-center text-2xl tracking-[0.5em]" /></div>
        {mode === 'setup' && <div><label htmlFor="confirm-pin" className="mb-2 block text-sm font-medium text-surface-800">Confirm PIN</label>
          <Input id="confirm-pin" type="password" inputMode="numeric" pattern="[0-9]{4}" minLength={4} maxLength={4} autoComplete="off" value={confirmPin} onChange={e => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))} required disabled={busy} className="h-12 text-center text-2xl tracking-[0.5em]" /></div>}
        <Button type="submit" disabled={busy} className="h-12 w-full">{busy ? 'Please wait…' : mode === 'setup' ? 'Save PIN and open dashboard' : 'Unlock dashboard'}</Button>
      </form>}
      <a href="/login?manual=1" className="mt-6 flex min-h-11 items-center justify-center rounded-lg text-sm font-medium text-brand-700 underline focus-visible:outline focus-visible:outline-2">Sign in with password</a>
      {mode === 'unlock' && <button type="button" disabled={busy} onClick={forget} className="mt-2 min-h-11 w-full rounded-lg text-sm text-surface-600 underline focus-visible:outline focus-visible:outline-2">Forget this browser</button>}
    </section>
  </main>
}
