'use client'

import * as React from 'react'
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Filter,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { PageHeader } from '@/components/ui/page-header'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  useCampaigns,
  useCities,
  useMaterialTemplates,
  useTemplateRules,
  useTemplateRuleInsert,
  useTemplateRuleUpdate,
  useTemplateRuleDelete,
} from '@/lib/supabase/hooks'
import { useAuth } from '@/lib/auth/context'
import type { MaterialTemplate, TemplateRule, TemplateRuleType } from '@/lib/types/database'
import { formatDate } from '@/lib/utils'
import { MATERIAL_LIBRARY_FOLDERS } from '@/lib/material-engine'

const STAKEHOLDER_TYPES = [
  { value: 'business', label: 'Business' },
  { value: 'school', label: 'School' },
  { value: 'cause', label: 'Cause' },
  { value: 'community', label: 'Community' },
  { value: 'field', label: 'Field' },
  { value: 'launch_partner', label: 'Launch Partner' },
  { value: 'influencer', label: 'Influencer' },
]

const RULE_TYPES: { value: TemplateRuleType; label: string; color: string }[] = [
  { value: 'include', label: 'Include', color: 'bg-success-100 text-success-700 border-success-200' },
  { value: 'exclude', label: 'Exclude', color: 'bg-danger-100 text-danger-700 border-danger-200' },
]

interface RuleFormState {
  name: string
  stakeholder_type: string
  city_id: string
  campaign_id: string
  audience_tag: string
  template_id: string
  rule_type: TemplateRuleType
  priority: number
}

const EMPTY_FORM: RuleFormState = {
  name: '',
  stakeholder_type: '',
  city_id: '',
  campaign_id: '',
  audience_tag: '',
  template_id: '',
  rule_type: 'include',
  priority: 0,
}

export function MaterialSettingsPage() {
  const { profile } = useAuth()
  const { data: rules, refetch: refetchRules } = useTemplateRules()
  const { data: templates } = useMaterialTemplates()
  const { data: cities } = useCities()
  const { data: campaigns } = useCampaigns()
  const { insert: insertRule, loading: inserting } = useTemplateRuleInsert()
  const { update: updateRule } = useTemplateRuleUpdate()
  const { remove: deleteRule } = useTemplateRuleDelete()

  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [form, setForm] = React.useState<RuleFormState>(EMPTY_FORM)
  const [filterType, setFilterType] = React.useState<string>('')
  const [previewType, setPreviewType] = React.useState<string>('business')
  const [previewCity, setPreviewCity] = React.useState<string>('')
  const [previewCampaign, setPreviewCampaign] = React.useState<string>('')

  const activeTemplates = templates.filter((t) => t.is_active)
  const templateMap = React.useMemo(() => new Map(templates.map((t) => [t.id, t])), [templates])
  const cityMap = React.useMemo(() => new Map(cities.map((c) => [c.id, c])), [cities])
  const campaignMap = React.useMemo(() => new Map(campaigns.map((c) => [c.id, c])), [campaigns])

  const filteredRules = filterType
    ? rules.filter((r) => r.stakeholder_type === filterType)
    : rules

  // Preview: compute the final template set for given conditions
  const previewTemplates = React.useMemo(() => {
    const baseTemplates = activeTemplates.filter((t) => {
      if (t.stakeholder_types.length > 0 && !t.stakeholder_types.includes(previewType as any)) return false
      if (t.scope_global) return true
      if (previewCity && t.scope_cities?.includes(previewCity)) return true
      if (previewCampaign && t.scope_campaigns?.includes(previewCampaign)) return true
      if (!t.scope_cities?.length && !t.scope_campaigns?.length && !t.scope_categories?.length) return true
      return false
    })

    const matchingRules = rules.filter((r) => {
      if (!r.is_active) return false
      if (r.stakeholder_type && r.stakeholder_type !== previewType) return false
      if (r.city_id && r.city_id !== previewCity) return false
      if (r.campaign_id && r.campaign_id !== previewCampaign) return false
      return true
    })

    const excludeIds = new Set(matchingRules.filter((r) => r.rule_type === 'exclude').map((r) => r.template_id))
    const includeIds = new Set(matchingRules.filter((r) => r.rule_type === 'include').map((r) => r.template_id))

    let result = baseTemplates.filter((t) => !excludeIds.has(t.id))

    if (includeIds.size > 0) {
      const resultIds = new Set(result.map((t) => t.id))
      for (const id of includeIds) {
        if (!resultIds.has(id)) {
          const template = templateMap.get(id)
          if (template?.is_active) result.push(template)
        }
      }
    }

    return result
  }, [activeTemplates, rules, previewType, previewCity, previewCampaign, templateMap])

  function openCreate() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setDialogOpen(true)
  }

  function openEdit(rule: TemplateRule) {
    setEditingId(rule.id)
    setForm({
      name: rule.name,
      stakeholder_type: rule.stakeholder_type || '',
      city_id: rule.city_id || '',
      campaign_id: rule.campaign_id || '',
      audience_tag: rule.audience_tag || '',
      template_id: rule.template_id,
      rule_type: rule.rule_type,
      priority: rule.priority,
    })
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.template_id) return

    const payload = {
      name: form.name.trim(),
      stakeholder_type: form.stakeholder_type || null,
      city_id: form.city_id || null,
      campaign_id: form.campaign_id || null,
      audience_tag: form.audience_tag || null,
      template_id: form.template_id,
      rule_type: form.rule_type,
      priority: form.priority,
      is_active: true,
      created_by: profile.id,
    }

    if (editingId) {
      await updateRule(editingId, payload)
    } else {
      await insertRule(payload)
    }

    setDialogOpen(false)
    refetchRules({ silent: true })
  }

  async function handleDelete(id: string) {
    await deleteRule(id)
    refetchRules({ silent: true })
  }

  async function handleToggleActive(rule: TemplateRule) {
    await updateRule(rule.id, { is_active: !rule.is_active })
    refetchRules({ silent: true })
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Material Settings" description="Configure template assignment rules and preview how templates resolve for different stakeholders." />

      <div className="grid gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        {/* Rule Builder */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>Template rules</CardTitle>
              <p className="mt-1 text-sm text-surface-500">Rules control which templates are included or excluded for stakeholders based on type, city, and campaign.</p>
            </div>
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Add rule
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-surface-400" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="rounded-lg border border-surface-200 bg-white px-3 py-1.5 text-sm text-surface-700"
              >
                <option value="">All types</option>
                {STAKEHOLDER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {filteredRules.length === 0 ? (
              <div className="rounded-xl border border-surface-200 bg-surface-50 px-4 py-8 text-center text-sm text-surface-500">
                No rules configured. Templates will use default scope-based hierarchy (Global → City → Campaign).
              </div>
            ) : (
              <div className="space-y-2">
                {filteredRules.map((rule) => {
                  const template = templateMap.get(rule.template_id)
                  const ruleTypeConfig = RULE_TYPES.find((r) => r.value === rule.rule_type) || RULE_TYPES[0]
                  return (
                    <div
                      key={rule.id}
                      className={`rounded-xl border px-4 py-3 transition ${rule.is_active ? 'border-surface-200 bg-white' : 'border-surface-100 bg-surface-50 opacity-60'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-surface-900">{rule.name}</p>
                            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${ruleTypeConfig.color}`}>
                              {ruleTypeConfig.label}
                            </span>
                            {!rule.is_active ? <Badge variant="default">Disabled</Badge> : null}
                          </div>
                          <p className="text-xs text-surface-500">
                            Template: {template?.name || rule.template_id.slice(0, 8)}
                            {rule.stakeholder_type ? ` · ${STAKEHOLDER_TYPES.find((t) => t.value === rule.stakeholder_type)?.label || rule.stakeholder_type}` : ''}
                            {rule.city_id ? ` · ${cityMap.get(rule.city_id)?.name || 'City'}` : ''}
                            {rule.campaign_id ? ` · ${campaignMap.get(rule.campaign_id)?.name || 'Campaign'}` : ''}
                            {rule.audience_tag ? ` · Tag: ${rule.audience_tag}` : ''}
                            {` · Priority: ${rule.priority}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" onClick={() => openEdit(rule)}>
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleToggleActive(rule)}>
                            {rule.is_active ? <X className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleDelete(rule.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Preview Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Template preview</CardTitle>
            <p className="mt-1 text-sm text-surface-500">See which templates would be assigned for a given stakeholder configuration.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-surface-500">Stakeholder type</label>
              <select
                value={previewType}
                onChange={(e) => setPreviewType(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700"
              >
                {STAKEHOLDER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-surface-500">City</label>
              <select
                value={previewCity}
                onChange={(e) => setPreviewCity(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700"
              >
                <option value="">Any city</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}, {c.state}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-surface-500">Campaign</label>
              <select
                value={previewCampaign}
                onChange={(e) => setPreviewCampaign(e.target.value)}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm text-surface-700"
              >
                <option value="">Any campaign</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="border-t border-surface-200 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wider text-surface-500">Result: {previewTemplates.length} templates</p>
                <Badge variant={previewTemplates.length > 0 ? 'success' : 'warning'}>
                  {previewTemplates.length > 0 ? 'Templates available' : 'No templates'}
                </Badge>
              </div>
              <div className="mt-3 space-y-2">
                {previewTemplates.length === 0 ? (
                  <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-4 text-center text-sm text-warning-700">
                    <AlertTriangle className="mx-auto mb-2 h-5 w-5" />
                    No templates match this configuration. The system will create a fallback template.
                  </div>
                ) : (
                  previewTemplates.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-lg border border-surface-200 bg-white px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-surface-900">{t.name}</p>
                        <p className="text-xs text-surface-500">{t.library_folder.replace(/_/g, ' ')} · {t.output_format.toUpperCase()}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        {t.scope_global ? <Badge variant="info">Global</Badge> : null}
                        {t.tiers.map((tier) => (
                          <Badge key={tier} variant="outline">{tier}</Badge>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-surface-200 pt-4">
              <p className="text-xs font-medium uppercase tracking-wider text-surface-500">Hierarchy explanation</p>
              <div className="mt-3 space-y-2 text-sm text-surface-600">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-brand-500" />
                  <span><strong>Global</strong> templates apply to all stakeholders</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-brand-500" />
                  <span><strong>City</strong> templates add to global for that city</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-brand-500" />
                  <span><strong>Campaign</strong> templates add to city + global for that campaign</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-brand-500" />
                  <span><strong>Rules</strong> override: include forces a template, exclude removes it</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rule Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit rule' : 'Create rule'}</DialogTitle>
            <DialogDescription>Define conditions that include or exclude a template for specific stakeholder configurations.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Rule name</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Exclude flyer for schools in Atlanta" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Rule type</label>
                <select
                  value={form.rule_type}
                  onChange={(e) => setForm({ ...form, rule_type: e.target.value as TemplateRuleType })}
                  className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
                >
                  {RULE_TYPES.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Priority</label>
                <Input type="number" value={form.priority} onChange={(e) => setForm({ ...form, priority: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Template</label>
              <select
                value={form.template_id}
                onChange={(e) => setForm({ ...form, template_id: e.target.value })}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Select template...</option>
                {activeTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.library_folder.replace(/_/g, ' ')})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Stakeholder type</label>
              <select
                value={form.stakeholder_type}
                onChange={(e) => setForm({ ...form, stakeholder_type: e.target.value })}
                className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
              >
                <option value="">Any type</option>
                {STAKEHOLDER_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">City</label>
                <select
                  value={form.city_id}
                  onChange={(e) => setForm({ ...form, city_id: e.target.value })}
                  className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Any city</option>
                  {cities.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}, {c.state}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Campaign</label>
                <select
                  value={form.campaign_id}
                  onChange={(e) => setForm({ ...form, campaign_id: e.target.value })}
                  className="w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Any campaign</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-surface-700">Audience tag</label>
              <Input value={form.audience_tag} onChange={(e) => setForm({ ...form, audience_tag: e.target.value })} placeholder="e.g. customers, parents" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => void handleSave()} disabled={inserting || !form.name.trim() || !form.template_id}>
              {inserting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {editingId ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
