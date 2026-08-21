'use client'

/**
 * ── Materials for Enablers ───────────────────────────────────────────────────
 *
 * "Enablers" (Field, Launch Partner, Influencer) work on behalf of a business or
 * cause without being one. The QA backend already lets them generate a
 * `GeneratedMaterial` for any account they hold an active
 * `DashboardStakeholderAssignment` on (`GeneratedMaterialController
 * .CanAccessAccountAsync` — operator OR account owner OR active assignment), but
 * the dashboard exposed no way to reach it: the only route to a business's
 * materials was `LogInAsButton`, i.e. stop being yourself first.
 *
 * This module is the whole Enabler-facing surface, in one place so the standalone
 * Materials tab and the onboarding screens cannot drift apart:
 *
 *  - `useMyAssignedAccounts` — the accounts THIS user may act for.
 *  - `MaterialGenerateLauncher` — pick a template, generate, for a fixed account.
 *  - `EnablerMaterialsPage` — the tab: pick an account, browse templates and
 *    generate, and see what has already been generated for each account.
 *
 * ── The id rule, which this feature gets wrong if ignored ─────────────────────
 * `StakeholderAssignment.entity_id`, `GeneratedMaterial.business_id/cause_id`
 * and the `accountId` in a `MaterialGenerateScope` are all the QA NUMERIC
 * account id. A local/Supabase-era UUID in any of those positions matches
 * nothing and fails silently — an empty list rather than an error. Assignment
 * rows carrying a non-numeric entity_id are therefore skipped and counted, not
 * quietly rendered as an account nobody can generate for.
 */

import * as React from 'react'
import Link from 'next/link'
import { Download, FileDown, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { MaterialPreviewFrame } from '@/components/ui/material-preview-frame'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { TemplateGenerateDialog, type MaterialGenerateScope } from '@/components/portal/template-library-page'
import { isReadyGeneratedMaterial } from '@/components/materials/my-materials-page'
import { usePortalTemplates, type PortalTemplate } from '@/lib/materials/portal-templates'
import { useAuth } from '@/lib/auth/context'
import {
  useBusinesses,
  useCauses,
  useGeneratedMaterials,
  useStakeholderAssignments,
} from '@/lib/supabase/hooks'
import { formatDate } from '@/lib/utils'
import type { GeneratedMaterial } from '@/lib/types/database'

export type { MaterialGenerateScope }

export interface AssignedAccount {
  /** Stable list key — an id alone collides across businesses and causes. */
  key: string
  entityType: 'business' | 'cause'
  /** QA numeric account id. */
  accountId: string
  name: string | null
}

function isNumericId(value: unknown): value is string {
  return typeof value === 'string' && /^\d+$/.test(value.trim())
}

/**
 * The businesses and causes the signed-in user is actively assigned to.
 *
 * Scoped by `stakeholder_id` = the caller's own QA user id (`localProfileId`;
 * `profile.id` is a derived UUID and matches nothing). This must never be an
 * unscoped assignment list — that would offer an Enabler every account in the
 * system as a generate target and only fail later, at the backend.
 */
export function useMyAssignedAccounts() {
  const { localProfileId } = useAuth()
  const { data: assignments, loading: assignmentsLoading, error } = useStakeholderAssignments(
    { stakeholder_id: localProfileId || '', status: 'active' },
    { enabled: !!localProfileId },
  )

  const rows = React.useMemo(
    () =>
      assignments.filter(
        (assignment) =>
          (assignment.entity_type === 'business' || assignment.entity_type === 'cause')
          && assignment.status === 'active',
      ),
    [assignments],
  )
  const businessIds = React.useMemo(
    () => rows.filter((r) => r.entity_type === 'business' && isNumericId(r.entity_id)).map((r) => r.entity_id),
    [rows],
  )
  const causeIds = React.useMemo(
    () => rows.filter((r) => r.entity_type === 'cause' && isNumericId(r.entity_id)).map((r) => r.entity_id),
    [rows],
  )
  // Names only. Both lists are fetched solely so an account reads as its name
  // instead of "Business #4182"; a miss is cosmetic and never blocks generating.
  const { data: businesses, loading: businessesLoading } = useBusinesses(undefined, {
    enabled: businessIds.length > 0,
  })
  const { data: causes, loading: causesLoading } = useCauses(undefined, { enabled: causeIds.length > 0 })

  const accounts = React.useMemo<AssignedAccount[]>(() => {
    const businessNames = new Map(businesses.map((b) => [String(b.id), b.name]))
    const causeNames = new Map(causes.map((c) => [String(c.id), c.name]))
    const seen = new Set<string>()
    const out: AssignedAccount[] = []
    for (const row of rows) {
      if (!isNumericId(row.entity_id)) continue
      const entityType = row.entity_type as 'business' | 'cause'
      const accountId = row.entity_id.trim()
      const key = `${entityType}:${accountId}`
      // Two assignments to the same account (re-assigned, different roles) are
      // one target, not two identical rows in the picker.
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        key,
        entityType,
        accountId,
        name: (entityType === 'business' ? businessNames.get(accountId) : causeNames.get(accountId)) || null,
      })
    }
    return out.sort((a, b) => (a.name || a.accountId).localeCompare(b.name || b.accountId))
  }, [rows, businesses, causes])

  return {
    accounts,
    /** Assignments written against a non-QA id — they can never resolve. */
    unusableCount: rows.filter((row) => !isNumericId(row.entity_id)).length,
    loading: assignmentsLoading || businessesLoading || causesLoading,
    error,
  }
}

export function accountLabel(account: AssignedAccount) {
  return account.name || `${account.entityType === 'cause' ? 'Cause' : 'Business'} #${account.accountId}`
}

// ─── Template picker + generate, for one fixed account ────────────────────────

/**
 * "Generate materials" for one known account: opens a template picker, then the
 * shared generate dialog with the account already fixed.
 *
 * This is the entry point the onboarding screens use, where the business/cause
 * is whichever one is being onboarded and must NOT be re-pickable.
 */
export function MaterialGenerateLauncher({
  scope,
  label = 'Generate materials',
  size = 'sm',
  variant = 'outline',
  onGenerated,
}: {
  scope: MaterialGenerateScope | null
  label?: string
  size?: 'sm' | 'default'
  variant?: 'outline' | 'default'
  onGenerated?: () => void
}) {
  const [picking, setPicking] = React.useState(false)
  const [active, setActive] = React.useState<PortalTemplate | null>(null)
  const [justGenerated, setJustGenerated] = React.useState(false)

  // Not fetched until the button is pressed: onboarding renders many of these at
  // once and the template list is one detail request per template server-side.
  const { templates, loading, error, unusableCount } = usePortalTemplates({
    enabled: picking,
    entityType: scope?.entityType,
    accountId: scope?.accountId,
  })

  if (!scope) {
    return (
      <Button size={size} variant={variant} disabled title="This record has no QA account yet, so nothing can be generated for it.">
        <Sparkles className="h-3.5 w-3.5" /> {label}
      </Button>
    )
  }

  return (
    <>
      <Button size={size} variant={variant} onClick={() => setPicking(true)}>
        <Sparkles className="h-3.5 w-3.5" /> {label}
      </Button>
      {justGenerated ? (
        <span className="text-xs font-medium text-success-700">Material generated.</span>
      ) : null}

      <Dialog open={picking} onOpenChange={(open) => { if (!open) setPicking(false) }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose a template</DialogTitle>
            <DialogDescription>
              The finished material is saved to {scope.name || 'this account'}&apos;s library.
            </DialogDescription>
          </DialogHeader>
          <TemplateGrid
            templates={templates}
            loading={loading}
            error={error}
            unusableCount={unusableCount}
            onPick={setActive}
          />
        </DialogContent>
      </Dialog>

      <TemplateGenerateDialog
        template={active}
        initialQrId={null}
        scope={scope}
        onClose={() => setActive(null)}
        onGenerated={() => {
          setActive(null)
          setPicking(false)
          setJustGenerated(true)
          onGenerated?.()
        }}
      />
    </>
  )
}

// ─── Shared template grid ────────────────────────────────────────────────────

function TemplateGrid({
  templates,
  loading,
  error,
  unusableCount,
  onPick,
  disabledReason,
}: {
  templates: PortalTemplate[]
  loading: boolean
  error: string | null
  unusableCount: number
  onPick: (template: PortalTemplate) => void
  disabledReason?: string | null
}) {
  if (error) {
    return <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">{error}</div>
  }
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <div className="h-40 bg-surface-100" />
            <CardContent className="space-y-2 p-4">
              <div className="h-4 w-2/3 rounded bg-surface-100" />
              <div className="h-8 w-full rounded bg-surface-50" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }
  if (templates.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-8 w-8" />}
        title="No templates available yet"
        description="Once your team publishes a template you will be able to generate it here."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid max-h-[60vh] grid-cols-1 gap-4 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
        {templates.map((template) => (
          <Card key={template.id} className="group overflow-hidden transition-shadow hover:shadow-card-hover">
            <div className="h-40 w-full border-b border-surface-100 bg-surface-50">
              {template.sourcePath ? (
                <MaterialPreviewFrame
                  src={template.sourcePath}
                  mimeType={template.outputFormat}
                  title={template.name}
                  className="h-full w-full"
                  fit="contain"
                />
              ) : null}
            </div>
            <CardContent className="space-y-3 p-4">
              <h3 className="truncate text-sm font-semibold text-surface-900">{template.name}</h3>
              <Button
                className="w-full"
                disabled={!!disabledReason}
                title={disabledReason || undefined}
                onClick={() => onPick(template)}
              >
                <Sparkles className="h-4 w-4" /> Generate
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
      {unusableCount > 0 ? (
        <p className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
          {unusableCount === 1 ? '1 template is' : `${unusableCount} templates are`} hidden because
          the design file could not be loaded. Your LocalVIP contact can fix this — nothing is wrong
          with your account.
        </p>
      ) : null}
    </div>
  )
}

// ─── Already-generated materials, one assigned account at a time ─────────────

/**
 * What has ALREADY been generated for one assigned account.
 *
 * A component per account on purpose: `useGeneratedMaterials` must be called
 * once per account (the backend rejects an unscoped listing outright — it will
 * not return "everything across my accounts" in one call), and hooks cannot be
 * called in a loop. Rendering one child per account is how the loop is expressed.
 */
function AssignedAccountMaterials({
  account,
  refreshKey,
}: {
  account: AssignedAccount
  refreshKey: number
}) {
  const filters = React.useMemo<Record<string, string>>(
    // One scoped filter, never both: the backend requires exactly one of
    // businessAccountId / causeAccountId and rejects an unscoped listing.
    () => (account.entityType === 'business'
      ? { business_id: account.accountId } as Record<string, string>
      : { cause_id: account.accountId } as Record<string, string>),
    [account.entityType, account.accountId],
  )
  const { data: rows, loading, error, refetch } = useGeneratedMaterials(filters)

  // Re-read after the user generates something on this page, so the new file
  // appears where they expect it instead of only after a reload.
  const seenRefreshKey = React.useRef(refreshKey)
  React.useEffect(() => {
    if (seenRefreshKey.current === refreshKey) return
    seenRefreshKey.current = refreshKey
    refetch({ silent: true })
  }, [refreshKey, refetch])

  const ready = React.useMemo(() => rows.filter(isReadyGeneratedMaterial), [rows])

  return (
    <div className="space-y-3 rounded-2xl border border-surface-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-surface-900">{accountLabel(account)}</h3>
          <Badge variant={account.entityType === 'cause' ? 'success' : 'info'}>
            {account.entityType === 'cause' ? 'Cause' : 'Business'}
          </Badge>
        </div>
        <span className="text-xs text-surface-500">
          {loading ? 'Loading…' : `${ready.length} ready`}
        </span>
      </div>

      {error ? (
        <p className="text-xs text-danger-600">{error}</p>
      ) : loading ? (
        <div className="flex items-center gap-2 text-xs text-surface-500">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading materials…
        </div>
      ) : ready.length === 0 ? (
        <p className="text-xs text-surface-400">Nothing has been generated for this account yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ready.map((row) => (
            <GeneratedMaterialCard key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  )
}

function GeneratedMaterialCard({ row }: { row: GeneratedMaterial }) {
  const title = row.generated_file_name || row.library_folder?.replaceAll('_', ' ') || 'Generated material'
  return (
    <Card className="overflow-hidden">
      <div className="h-32 w-full border-b border-surface-100 bg-surface-50">
        {row.generated_file_url ? (
          <MaterialPreviewFrame
            src={row.generated_file_url}
            title={title}
            className="h-full w-full"
            fit="contain"
            showPdfBadge
          />
        ) : null}
      </div>
      <CardContent className="space-y-2 p-3">
        <p className="truncate text-xs font-medium text-surface-800" title={title}>{title}</p>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-surface-400">
            {formatDate(row.generated_at || row.updated_at)}
          </span>
          {row.generated_file_url ? (
            <Button variant="ghost" size="icon-sm" title="Download" asChild>
              <a href={row.generated_file_url} download>
                <Download className="h-3.5 w-3.5" />
              </a>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  )
}

// ─── The Materials tab ───────────────────────────────────────────────────────

export function EnablerMaterialsPage() {
  const { accounts, unusableCount: unusableAssignments, loading: accountsLoading, error: accountsError } =
    useMyAssignedAccounts()
  const [tab, setTab] = React.useState<'templates' | 'generated'>('templates')
  const [selectedKey, setSelectedKey] = React.useState('')
  const [active, setActive] = React.useState<PortalTemplate | null>(null)
  const [generatedNonce, setGeneratedNonce] = React.useState(0)
  const selected = accounts.find((account) => account.key === selectedKey) || null
  const { templates, unusableCount, loading, error, reload } = usePortalTemplates({
    enabled: !!selected,
    entityType: selected?.entityType,
    accountId: selected?.accountId,
  })

  // Auto-select when there is exactly one — with several, leaving it blank is
  // deliberate: silently defaulting to the first is how a material gets pushed
  // to the wrong business.
  React.useEffect(() => {
    if (!selectedKey && accounts.length === 1) setSelectedKey(accounts[0].key)
  }, [accounts, selectedKey])

  const scope = React.useMemo<MaterialGenerateScope | null>(
    () => (selected
      ? { entityType: selected.entityType, accountId: selected.accountId, name: accountLabel(selected) }
      : null),
    [selected],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => setTab('templates')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'templates' ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          }`}
        >
          Templates
        </button>
        <button
          onClick={() => setTab('generated')}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === 'generated' ? 'bg-brand-600 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
          }`}
        >
          Already generated
        </button>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/materials/mine"><Button variant="outline">My Materials</Button></Link>
          {tab === 'templates' ? (
            <Button variant="outline" onClick={() => void reload()} disabled={loading}>
              <RefreshCw className={loading ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} /> Refresh
            </Button>
          ) : null}
        </div>
      </div>

      {accountsError ? (
        <div className="rounded-xl border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700">
          {accountsError}
        </div>
      ) : null}

      {!accountsLoading && accounts.length === 0 ? (
        <EmptyState
          icon={<FileDown className="h-8 w-8" />}
          title="You are not assigned to any business or cause yet"
          description="An operator assigns you from a business or cause page. Once assigned, their templates and generated materials appear here."
        />
      ) : (
        <>
          {unusableAssignments > 0 ? (
            <p className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800">
              {unusableAssignments === 1 ? '1 of your assignments is' : `${unusableAssignments} of your assignments are`}{' '}
              recorded against a record with no LocalVIP account, so nothing can be generated for
              {unusableAssignments === 1 ? ' it' : ' them'} yet. Your LocalVIP contact can relink
              {unusableAssignments === 1 ? ' it' : ' them'}.
            </p>
          ) : null}

          {tab === 'templates' ? (
            <>
              <div className="space-y-1 rounded-2xl border border-surface-200 bg-white p-4">
                <label className="text-xs font-medium text-surface-600" htmlFor="enabler-account">
                  Business or cause this material is for <span className="text-danger-500">*</span>
                </label>
                <select
                  id="enabler-account"
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="h-9 w-full max-w-md rounded-lg border border-surface-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">{accountsLoading ? 'Loading your assignments…' : 'Select an account…'}</option>
                  {accounts.map((account) => (
                    <option key={account.key} value={account.key}>
                      {accountLabel(account)} ({account.entityType === 'cause' ? 'Cause' : 'Business'})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-surface-500">
                  Only the businesses and causes you are actively assigned to are listed.
                </p>
              </div>

              <TemplateGrid
                templates={templates}
                loading={loading}
                error={error}
                unusableCount={unusableCount}
                onPick={setActive}
                disabledReason={selected ? null : 'Choose which business or cause this material is for first.'}
              />
            </>
          ) : (
            <div className="space-y-4">
              {accountsLoading ? (
                <div className="flex items-center gap-2 text-sm text-surface-500">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading your assignments…
                </div>
              ) : (
                accounts.map((account) => (
                  <AssignedAccountMaterials key={account.key} account={account} refreshKey={generatedNonce} />
                ))
              )}
            </div>
          )}
        </>
      )}

      <TemplateGenerateDialog
        template={active}
        initialQrId={null}
        scope={scope}
        onClose={() => setActive(null)}
        onGenerated={() => {
          setActive(null)
          setGeneratedNonce((n) => n + 1)
          // Land on the list that now contains the new file, rather than leaving
          // the template grid looking exactly as it did before the click.
          setTab('generated')
        }}
      />
    </div>
  )
}
