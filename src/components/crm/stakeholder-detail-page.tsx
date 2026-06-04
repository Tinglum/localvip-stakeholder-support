'use client'

import * as React from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Loader2, Save, UserCog, Building2, Heart } from 'lucide-react'
import { PageHeader } from '@/components/ui/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useRecord, useProfiles, useBusinesses, useCauses } from '@/lib/supabase/hooks'
import { formatDate } from '@/lib/utils'
import type { Stakeholder, Profile, Business, Cause } from '@/lib/types/database'

const STAGES = ['lead', 'contacted', 'interested', 'in_progress', 'onboarded', 'live', 'paused', 'declined']

export default function StakeholderDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params?.id
  const router = useRouter()

  const { data: stakeholder, loading } = useRecord<Stakeholder>('stakeholders', id || null)
  const { data: profiles } = useProfiles()
  const { data: businesses } = useBusinesses()
  const { data: causes } = useCauses()

  const [stage, setStage] = React.useState<string>('')
  const [ownerId, setOwnerId] = React.useState<string>('')
  const [businessId, setBusinessId] = React.useState<string>('')
  const [causeId, setCauseId] = React.useState<string>('')
  const [saving, setSaving] = React.useState(false)
  const [savedMsg, setSavedMsg] = React.useState<string | null>(null)
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!stakeholder) return
    const sk = stakeholder as Stakeholder & Record<string, unknown>
    setStage(typeof sk.stage === 'string' ? sk.stage : 'lead')
    setOwnerId(sk.profile_id ? String(sk.profile_id) : '')
    setBusinessId(sk.business_id ? String(sk.business_id) : '')
    setCauseId(sk.cause_id ? String(sk.cause_id) : '')
  }, [stakeholder])

  async function handleAssign() {
    if (!stakeholder) return
    setSaving(true)
    setSavedMsg(null)
    setErrorMsg(null)
    try {
      const res = await fetch(`/api/qa/stakeholder/${encodeURIComponent(stakeholder.id)}/assign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          profileUserId: ownerId ? Number(ownerId) : null,
          businessAccountId: businessId ? Number(businessId) : null,
          causeAccountId: causeId ? Number(causeId) : null,
          stage,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || `HTTP ${res.status}`)
      }
      setSavedMsg('Assignment saved.')
      router.refresh()
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-surface-400" />
      </div>
    )
  }

  if (!stakeholder) {
    return (
      <div className="space-y-4">
        <Link href="/crm/stakeholders" className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700">
          <ArrowLeft className="h-4 w-4" /> Back to stakeholders
        </Link>
        <p className="text-sm text-surface-500">Stakeholder not found.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link href="/crm/stakeholders" className="inline-flex items-center gap-1 text-sm text-surface-500 hover:text-surface-700">
        <ArrowLeft className="h-4 w-4" /> Back to stakeholders
      </Link>

      <PageHeader
        title={stakeholder.name || 'Stakeholder'}
        description={`${stakeholder.type} · Created ${formatDate(stakeholder.created_at)}`}
      />
      <Badge variant="info">{stakeholder.type}</Badge>

      {/* Assignment / reassignment card */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center gap-2 text-sm font-semibold text-surface-700">
            <UserCog className="h-4 w-4" /> Assignment
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-surface-700">Stage</label>
              <Select value={stage} onValueChange={setStage}>
                <SelectTrigger><SelectValue placeholder="Pick a stage" /></SelectTrigger>
                <SelectContent>
                  {STAGES.map(s => <SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-surface-700">Owner (profile)</label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {(profiles as Profile[] || []).slice(0, 200).map(p => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.full_name || p.email || `User ${p.id}`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-surface-700">
                <Building2 className="mr-1 inline h-3.5 w-3.5" />
                Linked Business
              </label>
              <Select value={businessId} onValueChange={(v) => { setBusinessId(v); if (v) setCauseId('') }}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {(businesses as Business[] || []).slice(0, 300).map(b => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-surface-700">
                <Heart className="mr-1 inline h-3.5 w-3.5" />
                Linked Cause
              </label>
              <Select value={causeId} onValueChange={(v) => { setCauseId(v); if (v) setBusinessId('') }}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">— None —</SelectItem>
                  {(causes as Cause[] || []).slice(0, 300).map(c => (
                    <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleAssign} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? 'Saving…' : 'Save assignment'}
            </Button>
            {savedMsg && <span className="text-xs text-success-600">{savedMsg}</span>}
            {errorMsg && <span className="text-xs text-danger-600">{errorMsg}</span>}
          </div>
        </CardContent>
      </Card>

      {/* Metadata view */}
      <Card>
        <CardContent className="p-6">
          <div className="text-sm font-semibold text-surface-700 mb-3">Identity</div>
          <dl className="grid gap-3 text-sm md:grid-cols-2">
            <div><dt className="text-xs text-surface-500">Type</dt><dd>{stakeholder.type}</dd></div>
            <div><dt className="text-xs text-surface-500">Status</dt><dd>{stakeholder.status}</dd></div>
            {(() => {
              const sk = stakeholder as Stakeholder & Record<string, unknown>
              return <>
                <div><dt className="text-xs text-surface-500">Brand</dt><dd>{(sk.brand as string) || '—'}</dd></div>
                <div><dt className="text-xs text-surface-500">Source</dt><dd>{(sk.source as string) || '—'}</dd></div>
                <div><dt className="text-xs text-surface-500">External ID</dt><dd>{(sk.external_id as string) || '—'}</dd></div>
              </>
            })()}
            <div><dt className="text-xs text-surface-500">Updated</dt><dd>{formatDate(stakeholder.updated_at)}</dd></div>
          </dl>
        </CardContent>
      </Card>
    </div>
  )
}
