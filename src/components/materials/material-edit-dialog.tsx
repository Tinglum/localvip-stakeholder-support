'use client'

import * as React from 'react'
import { Loader2, PencilLine, Tags } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MaterialTagPicker } from '@/components/material-tags/material-tag-picker'
import { MaterialTargetingEditor } from '@/components/materials/material-targeting-editor'
import { useAuth } from '@/lib/auth/context'
import { MATERIAL_CATEGORIES, MATERIAL_USE_CASES } from '@/lib/constants'
import {
  AUTOMATION_TEMPLATE_STAKEHOLDER_TYPES,
  deriveMaterialAutomationStakeholderTypes,
  getMaterialAutomationTemplateConfig,
  materialSupportsAutomationTemplate,
  withUpdatedMaterialAutomationTemplate,
} from '@/lib/materials/automation-template'
import { MATERIAL_LIBRARY_FOLDERS } from '@/lib/material-engine'
import {
  MATERIAL_VISIBILITY_ROLE_OPTIONS,
  MATERIAL_VISIBILITY_SUBTYPE_OPTIONS,
  getMaterialCustomTags,
  withUpdatedMaterialCustomTags,
} from '@/lib/materials/material-targeting'
import { useMaterialUpdate } from '@/lib/supabase/hooks'
import { classificationToLegacy, classificationToStorageFields, getMaterialClassification, withMaterialClassification, type MaterialClassification } from '@/lib/materials/material-classification'
import type {
  Material,
  MaterialLibraryFolder,
  StakeholderType,
  UserRole,
  UserRoleSubtype,
} from '@/lib/types/database'

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
}

export function MaterialEditDialog({
  material,
  open,
  onOpenChange,
  onSaved,
}: {
  material: Material | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (material: Material) => void
}) {
  const { isAdmin } = useAuth()
  const { update, loading, error } = useMaterialUpdate()
  const [title, setTitle] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [category, setCategory] = React.useState('')
  const [useCase, setUseCase] = React.useState('')
  const [roleTags, setRoleTags] = React.useState<UserRole[]>([])
  const [subtypeTags, setSubtypeTags] = React.useState<UserRoleSubtype[]>([])
  const [customTags, setCustomTags] = React.useState('')
  const [automationEnabled, setAutomationEnabled] = React.useState(false)
  const [automationActive, setAutomationActive] = React.useState(true)
  const [automationStakeholderTypes, setAutomationStakeholderTypes] = React.useState<StakeholderType[]>([])
  const [automationLibraryFolder, setAutomationLibraryFolder] = React.useState<MaterialLibraryFolder>('share_with_customers')
  const [automationAudienceTags, setAutomationAudienceTags] = React.useState('')
  const [feedback, setFeedback] = React.useState<string | null>(null)
  const [materialTagIds, setMaterialTagIds] = React.useState<number[]>([])
  const [classification, setClassification] = React.useState<MaterialClassification>({ audiences: ['everyone'], purpose: '', availability: { mode: 'everywhere', entityIds: [] }, delivery: 'ready' })
  const [reachReviewed, setReachReviewed] = React.useState(false)

  React.useEffect(() => {
    if (!material) return
    const automation = getMaterialAutomationTemplateConfig(material)
    setTitle(material.title || '')
    setDescription(material.description || '')
    setCategory(material.category || '')
    setUseCase(material.use_case || '')
    setRoleTags([...(material.target_roles || [])])
    setSubtypeTags([...(material.target_subtypes || [])])
    setCustomTags(getMaterialCustomTags(material).join(', '))
    setAutomationEnabled(automation.enabled)
    setAutomationActive(automation.isActive)
    setAutomationStakeholderTypes(automation.stakeholderTypes)
    setAutomationLibraryFolder(automation.libraryFolder)
    setAutomationAudienceTags(automation.audienceTags.join(', '))
    setFeedback(null)
    setMaterialTagIds([])
    setClassification(getMaterialClassification(material))
    setReachReviewed(false)
  }, [material])

  function toggleRoleTag(role: UserRole) {
    setRoleTags((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    )
  }

  function toggleSubtypeTag(subtype: UserRoleSubtype) {
    setSubtypeTags((current) =>
      current.includes(subtype)
        ? current.filter((item) => item !== subtype)
        : [...current, subtype],
    )
  }

  function toggleAutomationStakeholderType(stakeholderType: StakeholderType) {
    setAutomationStakeholderTypes((current) =>
      current.includes(stakeholderType)
        ? current.filter((item) => item !== stakeholderType)
        : [...current, stakeholderType],
    )
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault()
    if (!material) return

    const legacyTargeting = classificationToLegacy(classification)

    const supportsAutomation = materialSupportsAutomationTemplate(material)
    const nextAutomationEnabled = isAdmin && classification.delivery !== 'ready'
    const nextTargetSubtypes = legacyTargeting.target_subtypes
    const inferredStakeholderTypes = deriveMaterialAutomationStakeholderTypes({
      ...material,
      target_roles: legacyTargeting.target_roles,
      target_subtypes: nextTargetSubtypes,
      metadata: withUpdatedMaterialCustomTags(material, parseTags(customTags)),
    })

    const updatedMaterial = await update(material.id, {
      title: title.trim(),
      description: description.trim() || null,
      category: category || null,
      target_roles: legacyTargeting.target_roles,
      target_subtypes: nextTargetSubtypes,
      use_case: legacyTargeting.use_case,
      campaign_id: classification.availability.mode === 'campaigns' ? classification.availability.entityIds[0] || null : null,
      city_id: classification.availability.mode === 'cities' ? classification.availability.entityIds[0] || null : null,
      is_template: nextAutomationEnabled,
      metadata: withUpdatedMaterialAutomationTemplate(
        {
          ...material,
          metadata: withMaterialClassification(withUpdatedMaterialCustomTags(material, parseTags(customTags)), classification),
        },
        {
          enabled: nextAutomationEnabled,
          isActive: automationActive,
          stakeholderTypes: automationStakeholderTypes.length > 0 ? automationStakeholderTypes : inferredStakeholderTypes,
          audienceTags: classification.audiences,
          libraryFolder: automationLibraryFolder,
        },
      ),
      ...classificationToStorageFields(classification),
    } as Partial<Material>)

    if (!updatedMaterial) return

    setFeedback('Material details and availability updated.')
    onSaved(updatedMaterial)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PencilLine className="h-5 w-5 text-brand-600" />
            Edit Material
          </DialogTitle>
          <DialogDescription>
            Update what this is, who it is for, and where it should appear.
          </DialogDescription>
        </DialogHeader>

        {material && (
          <form onSubmit={handleSave} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              {false && <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Title</label>
                <Input value={title} onChange={(event) => setTitle(event.target.value)} required />
              </div>}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Category</label>
                <select
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                >
                  <option value="">None</option>
                  {MATERIAL_CATEGORIES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-surface-700">Description</label>
                <Textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  placeholder="What is this material for?"
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-surface-700">Use case</label>
                  <select
                    value={useCase}
                    onChange={(event) => setUseCase(event.target.value)}
                    className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                  >
                    <option value="">None</option>
                    {MATERIAL_USE_CASES.map((item) => (
                      <option key={item.value} value={item.value}>{item.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-surface-700">
                    <Tags className="h-4 w-4 text-brand-600" />
                    Audience / search tags
                  </label>
                  <Input
                    value={customTags}
                    onChange={(event) => setCustomTags(event.target.value)}
                    placeholder="customers, coffee, poster, launch"
                  />
                  <p className="mt-1 text-xs text-surface-500">
                    Use comma-separated tags to make the material easier to find and describe.
                  </p>
                </div>
              </div>
            </div>

            {false && <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
              <p className="text-sm font-semibold text-surface-900">Visibility tags</p>
              <p className="mt-1 text-xs text-surface-500">
                Add more stakeholder roles here to make this material visible in more stakeholder libraries.
              </p>

              <div className="mt-4 space-y-4">
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-surface-500">Stakeholder roles</p>
                  <div className="flex flex-wrap gap-2">
                    {MATERIAL_VISIBILITY_ROLE_OPTIONS.map((option) => {
                      const active = roleTags.includes(option.value)
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleRoleTag(option.value)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            active
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-surface-500">Subtype tags</p>
                  <div className="flex flex-wrap gap-2">
                    {MATERIAL_VISIBILITY_SUBTYPE_OPTIONS.map((option) => {
                      const active = subtypeTags.includes(option.value)
                      return (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => toggleSubtypeTag(option.value)}
                          className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                            active
                              ? 'border-success-500 bg-success-50 text-success-700'
                              : 'border-surface-200 bg-white text-surface-600 hover:border-success-300 hover:text-success-700'
                          }`}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-1 text-xs text-surface-500">
                    Use subtype tags when a material should only show for a narrower audience like interns, volunteers, schools, or causes.
                  </p>
                </div>
              </div>
            </div>}

            {false && <MaterialTagPicker
              materialId={material!.id}
              selectedTagIds={materialTagIds}
              onChange={setMaterialTagIds}
            />}

            {false && <div className="flex flex-wrap gap-2">
              {roleTags.length > 0 && roleTags.map((role) => (
                <Badge key={role} variant="info">{role}</Badge>
              ))}
              {subtypeTags.filter(Boolean).map((subtype) => (
                <Badge key={subtype} variant="success">{subtype}</Badge>
              ))}
              {parseTags(customTags).map((tag) => (
                <Badge key={tag} variant="default">{tag}</Badge>
              ))}
            </div>}

            {false && isAdmin && material && (
              <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-surface-900">Automation Template</p>
                    <p className="mt-1 text-xs text-surface-500">
                      Use this uploaded material as a reusable stakeholder template. The saved QR zones become the automatic QR placement layout.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (materialSupportsAutomationTemplate(material)) {
                        setAutomationEnabled((current) => !current)
                      }
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                      automationEnabled
                        ? 'border-brand-500 bg-brand-50 text-brand-700'
                        : 'border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-700'
                    }`}
                  >
                    {automationEnabled ? 'Template Enabled' : 'Enable as Template'}
                  </button>
                </div>

                {!materialSupportsAutomationTemplate(material) && (
                  <div className="mt-3 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700">
                    Save at least one QR zone on this material before using it as an automation template.
                  </div>
                )}

                {automationEnabled && materialSupportsAutomationTemplate(material) && (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Delivery folder</label>
                        <select
                          value={automationLibraryFolder}
                          onChange={(event) => setAutomationLibraryFolder(event.target.value as MaterialLibraryFolder)}
                          className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                        >
                          {MATERIAL_LIBRARY_FOLDERS.map((folder) => (
                            <option key={folder.value} value={folder.value}>{folder.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-surface-700">Template status</label>
                        <select
                          value={automationActive ? 'active' : 'inactive'}
                          onChange={(event) => setAutomationActive(event.target.value === 'active')}
                          className="h-10 w-full rounded-lg border border-surface-300 bg-surface-0 px-3 text-sm"
                        >
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-surface-500">Stakeholder types</p>
                      <div className="flex flex-wrap gap-2">
                        {AUTOMATION_TEMPLATE_STAKEHOLDER_TYPES.map((option) => {
                          const active = automationStakeholderTypes.includes(option)
                          return (
                            <button
                              key={option}
                              type="button"
                              onClick={() => toggleAutomationStakeholderType(option)}
                              className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                active
                                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                                  : 'border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-700'
                              }`}
                            >
                              {option.replace(/_/g, ' ')}
                            </button>
                          )
                        })}
                      </div>
                    </div>

                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-surface-700">Automation audience tags</label>
                      <Input
                        value={automationAudienceTags}
                        onChange={(event) => setAutomationAudienceTags(event.target.value)}
                        placeholder="customers, parents, pta"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <MaterialTargetingEditor value={classification} onChange={setClassification} materialId={material.id} onReachReviewed={setReachReviewed} />
            {classification.delivery !== 'ready' && !materialSupportsAutomationTemplate(material) && (
              <div className="rounded-xl border border-warning-200 bg-warning-50 p-3 text-sm text-warning-700">
                Add a QR placement zone before saving this as a customizable or automatic material.
              </div>
            )}

            {(feedback || error) && (
              <div className={`rounded-xl px-3 py-2 text-sm ${error ? 'border border-danger-200 bg-danger-50 text-danger-700' : 'border border-success-200 bg-success-50 text-success-700'}`}>
                {error || feedback}
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !classification.purpose || (classification.delivery !== 'ready' && !materialSupportsAutomationTemplate(material)) || (classification.delivery === 'automatic' && !reachReviewed)}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PencilLine className="h-4 w-4" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
