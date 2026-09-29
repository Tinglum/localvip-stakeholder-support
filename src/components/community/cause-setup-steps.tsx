'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  CheckCircle2, Clock3, Copy, ExternalLink, FileText, ImageIcon, Loader2,
  Palette, QrCode, Rocket, Upload, Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  CAUSE_ACCOUNT_STEPS,
  CAUSE_ORGANIZATION_TYPES,
  canSubmitCauseForReview,
  isCauseAwaitingReview,
  isCauseLive,
  isCauseSetupStepComplete,
  type CauseSetupSignals,
  type CauseSetupStepKey,
} from '@/lib/cause-setup'
import { isHexColor, type BrandTriple } from '@/lib/brand-colors'

/* ─── Shared bits ─────────────────────────────────────────────── */

export function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-surface-800">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-surface-500">{hint}</span> : null}
    </label>
  )
}

function StepFooter({ busy, dirty, onSave, saveLabel = 'Save and continue', disabled }: {
  busy: boolean; dirty?: boolean; onSave: () => void; saveLabel?: string; disabled?: boolean
}) {
  return (
    <div className="flex items-center justify-end gap-3 border-t border-surface-100 pt-5">
      {dirty === false ? <span className="text-xs text-surface-400">No unsaved changes</span> : null}
      <Button onClick={onSave} disabled={busy || disabled}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {saveLabel}
      </Button>
    </div>
  )
}

const selectClass = 'h-10 w-full rounded-lg border border-surface-300 bg-white px-3 text-sm text-surface-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500'

/* ─── Account track ───────────────────────────────────────────── */

export function ProfileStep({ initial, busy, onSave }: {
  initial: { name: string; category: string; headline: string; description: string }
  busy: boolean
  onSave: (patch: { name: string; type: string; headline: string; description: string }) => void
}) {
  const [name, setName] = React.useState(initial.name)
  const [type, setType] = React.useState(initial.category)
  const [headline, setHeadline] = React.useState(initial.headline)
  const [description, setDescription] = React.useState(initial.description)
  const knownType = CAUSE_ORGANIZATION_TYPES.some((t) => t.toLowerCase() === type.toLowerCase())
  const ready = name.trim() && type.trim() && headline.trim()

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Organization name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Lincoln Elementary PTA" /></Field>
        <Field label="Type of organization">
          <select className={selectClass} value={knownType ? CAUSE_ORGANIZATION_TYPES.find((t) => t.toLowerCase() === type.toLowerCase()) : type} onChange={(e) => setType(e.target.value)}>
            <option value="">Choose one</option>
            {!knownType && type ? <option value={type}>{type}</option> : null}
            {CAUSE_ORGANIZATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Your mission in one line" hint={`Shown to families when they choose who to support. ${headline.length}/140`}>
        <Input value={headline} maxLength={140} onChange={(e) => setHeadline(e.target.value)} placeholder="Funding field trips and classroom supplies for every student." />
      </Field>
      <Field label="About your organization" hint="Optional. A few sentences for your landing page.">
        <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
      </Field>
      <StepFooter busy={busy} disabled={!ready} onSave={() => onSave({ name: name.trim(), type, headline: headline.trim(), description: description.trim() })} />
    </div>
  )
}

export function ContactStep({ initial, email, busy, onSave }: {
  initial: { city: string; state: string; phone: string; website: string }
  email: string
  busy: boolean
  onSave: (patch: { city_name: string; city_state: string; phone: string; website: string }) => void
}) {
  const [city, setCity] = React.useState(initial.city)
  const [state, setState] = React.useState(initial.state)
  const [phone, setPhone] = React.useState(initial.phone)
  const [website, setWebsite] = React.useState(initial.website)

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-[1fr_140px]">
        <Field label="City"><Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Springfield" /></Field>
        <Field label="State"><Input value={state} onChange={(e) => setState(e.target.value)} placeholder="KS" /></Field>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Phone"><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(913) 555-0100" /></Field>
        <Field label="Website" hint="Optional"><Input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></Field>
      </div>
      <div className="rounded-xl bg-surface-50 px-4 py-3 text-sm text-surface-600">
        <span className="font-medium text-surface-800">Login email:</span> {email || 'Not set'}
        <span className="block text-xs text-surface-500">This is how you sign in. To change it, contact your LocalVIP representative.</span>
      </div>
      <StepFooter busy={busy} disabled={!city.trim()} onSave={() => onSave({ city_name: city.trim(), city_state: state.trim(), phone: phone.trim(), website: website.trim() })} />
    </div>
  )
}

export function SharingStep({ referralCode, joinUrl, onContinue }: { referralCode: string; joinUrl: string; onContinue: () => void }) {
  const [copied, setCopied] = React.useState<string | null>(null)
  const copy = (value: string, key: string) => {
    void navigator.clipboard.writeText(value).then(() => { setCopied(key); window.setTimeout(() => setCopied(null), 1600) })
  }

  if (!referralCode) {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-warning-200 bg-warning-50 px-4 py-4 text-sm text-warning-800">
        <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Your sharing code is being created by LocalVIP. It appears here automatically, with nothing for you to do.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-surface-600">Everyone who signs up with your code or link is linked to you, and their everyday purchases support you. Your QR code and flyers use this same link.</p>
      {[['Your code', referralCode, 'code'], ['Your sign-up link', joinUrl, 'link']].map(([label, value, key]) => (
        <div key={key} className="flex items-center gap-3 rounded-xl border border-surface-200 bg-white px-4 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-surface-400">{label}</p>
            <p className="truncate font-mono text-sm text-surface-900">{value}</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => copy(value, key)}>
            {copied === key ? <CheckCircle2 className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
            {copied === key ? 'Copied' : 'Copy'}
          </Button>
        </div>
      ))}
      <StepFooter busy={false} saveLabel="Looks good, continue" onSave={onContinue} />
    </div>
  )
}

export function GoLiveStep({ name, signals, busy, onSubmit, onOpenStep }: {
  name: string
  signals: CauseSetupSignals
  busy: boolean
  onSubmit: () => void
  onOpenStep: (key: CauseSetupStepKey) => void
}) {
  if (isCauseLive(signals)) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-success-200 bg-success-50 px-5 py-5">
        <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-success-600" />
        <div>
          <p className="font-semibold text-success-900">{name} is live</p>
          <p className="mt-1 text-sm text-success-800">Supporters can now choose you, and their everyday shopping supports you.</p>
        </div>
      </div>
    )
  }

  if (isCauseAwaitingReview(signals)) {
    return (
      <div className="flex items-start gap-4 rounded-2xl border border-brand-200 bg-brand-50 px-5 py-5">
        <Clock3 className="mt-0.5 h-6 w-6 shrink-0 text-brand-600" />
        <div>
          <p className="font-semibold text-brand-900">Submitted for review</p>
          <p className="mt-1 text-sm text-brand-800">LocalVIP is checking your account. This page updates when you are approved. Meanwhile, set up your brand and materials so you are ready to promote on day one.</p>
        </div>
      </div>
    )
  }

  const prerequisites = CAUSE_ACCOUNT_STEPS.filter((step) => step.key !== 'golive')
  const ready = canSubmitCauseForReview(signals)

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-surface-100 rounded-xl border border-surface-200">
        {prerequisites.map((step) => {
          const done = isCauseSetupStepComplete(step.key, signals)
          return (
            <li key={step.key} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-2 text-sm text-surface-800">
                {done ? <CheckCircle2 className="h-4 w-4 text-success-600" /> : <span className="h-4 w-4 rounded-full border-2 border-surface-300" />}
                {step.label}
              </span>
              {!done ? <Button variant="ghost" size="sm" onClick={() => onOpenStep(step.key)}>Finish</Button> : null}
            </li>
          )
        })}
      </ul>
      <p className="text-sm text-surface-600">No bank or tax details are needed now. LocalVIP asks for those when your first check is ready.</p>
      <div className="flex justify-end border-t border-surface-100 pt-5">
        <Button onClick={onSubmit} disabled={busy || !ready}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
          Submit for LocalVIP review
        </Button>
      </div>
    </div>
  )
}

/* ─── Brand track ─────────────────────────────────────────────── */

export function ImagesStep({ logoSrc, coverSrc, busy, onUpload, onContinue }: {
  logoSrc: string; coverSrc: string; busy: boolean
  onUpload: (kind: 'logo' | 'cover_photo', file: File) => void
  onContinue: () => void
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null)
  const kindRef = React.useRef<'logo' | 'cover_photo'>('logo')
  const pick = (kind: 'logo' | 'cover_photo') => { kindRef.current = kind; inputRef.current?.click() }

  return (
    <div className="space-y-5">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden"
        onChange={(e) => { const file = e.target.files?.[0]; if (file) onUpload(kindRef.current, file); e.target.value = '' }} />
      <div className="grid gap-4 md:grid-cols-[220px_1fr]">
        <ImageSlot label="Logo" hint="Transparent PNG or SVG works best." src={logoSrc} fit="contain" busy={busy} onPick={() => pick('logo')} />
        <ImageSlot label="Cover photo" hint="A wide photo of your real students, families or volunteers." src={coverSrc} fit="cover" busy={busy} onPick={() => pick('cover_photo')} />
      </div>
      <StepFooter busy={busy} disabled={!logoSrc || !coverSrc} saveLabel="Continue" onSave={onContinue} />
    </div>
  )
}

function ImageSlot({ label, hint, src, fit, busy, onPick }: { label: string; hint: string; src: string; fit: 'contain' | 'cover'; busy: boolean; onPick: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-surface-200 bg-white">
      <div className="flex h-40 items-center justify-center bg-surface-50">
        {src
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={src} alt={`${label} preview`} className={`h-full w-full ${fit === 'contain' ? 'object-contain p-4' : 'object-cover'}`} />
          : <ImageIcon className="h-8 w-8 text-surface-300" />}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-surface-900">{label}</p>
          <p className="text-xs text-surface-500">{hint}</p>
        </div>
        <Button variant="outline" size="sm" onClick={onPick} disabled={busy}><Upload className="h-4 w-4" />{src ? 'Replace' : 'Upload'}</Button>
      </div>
    </div>
  )
}

export function ColorsStep({ initial, confirmed, logoSrc, name, busy, onExtract, onSave }: {
  initial: BrandTriple
  confirmed: boolean
  logoSrc: string
  name: string
  busy: boolean
  onExtract: () => Promise<BrandTriple | null>
  onSave: (colors: BrandTriple) => void
}) {
  const [colors, setColors] = React.useState<BrandTriple>(initial)
  const [extracting, setExtracting] = React.useState(false)
  const [note, setNote] = React.useState<string | null>(null)
  const tried = React.useRef(false)

  const pull = React.useCallback(async () => {
    setExtracting(true); setNote(null)
    try {
      const found = await onExtract()
      if (found) { setColors(found); setNote('Pulled from your logo. Adjust anything that looks off, then save.') }
      else setNote('We could not read colors from your logo. Pick them below.')
    } catch {
      setNote('We could not read colors from your logo. Pick them below.')
    } finally { setExtracting(false) }
  }, [onExtract])

  // No colours chosen yet but a logo exists: pull them from the logo straight away.
  React.useEffect(() => {
    if (confirmed || !logoSrc || tried.current) return
    tried.current = true
    void pull()
  }, [confirmed, logoSrc, pull])

  const valid = isHexColor(colors.primary) && isHexColor(colors.secondary) && isHexColor(colors.accent)
  const slots: Array<[keyof BrandTriple, string, string]> = [
    ['primary', 'Main color', 'Backgrounds and headlines'],
    ['secondary', 'Second color', 'Panels and details'],
    ['accent', 'Accent', 'Buttons and highlights'],
  ]

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-3">
          {slots.map(([key, label, hint]) => (
            <Field key={key} label={label} hint={hint}>
              <div className="flex gap-2">
                <input type="color" aria-label={`${label} picker`} value={isHexColor(colors[key]) ? colors[key] : '#000000'}
                  onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value.toUpperCase() }))}
                  className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-surface-300 bg-white" />
                <Input value={colors[key]} onChange={(e) => setColors((c) => ({ ...c, [key]: e.target.value }))} className="font-mono uppercase" />
              </div>
            </Field>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" onClick={() => void pull()} disabled={!logoSrc || extracting}>
            {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
            Use colors from my logo
          </Button>
          {!logoSrc ? <span className="text-xs text-surface-500">Upload your logo first to pull colors from it.</span> : null}
        </div>
        {note ? <p role="status" className="text-sm text-surface-600">{note}</p> : null}
        <StepFooter busy={busy} disabled={!valid} saveLabel={confirmed ? 'Save colors' : 'Use these colors'} onSave={() => onSave(colors)} />
      </div>
      <FlyerPreview colors={colors} logoSrc={logoSrc} name={name} />
    </div>
  )
}

function FlyerPreview({ colors, logoSrc, name }: { colors: BrandTriple; logoSrc: string; name: string }) {
  const ok = (c: string) => (isHexColor(c) ? c : '#CBD5E1')
  return (
    <div aria-label="Flyer preview in your colors" className="overflow-hidden rounded-2xl border border-surface-200 shadow-sm">
      <div className="px-5 pb-6 pt-5 text-white" style={{ backgroundColor: ok(colors.primary) }}>
        {logoSrc
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={logoSrc} alt="" className="mb-4 h-10 w-24 rounded bg-white/95 object-contain p-1" />
          : <Palette className="mb-4 h-8 w-8 opacity-80" />}
        <p className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: ok(colors.accent) }}>Shop local. Give back.</p>
        <p className="mt-1 text-lg font-bold leading-tight">Support {name || 'your school'} every time you shop</p>
      </div>
      <div className="space-y-3 bg-white p-5">
        <div className="h-2 w-3/4 rounded-full" style={{ backgroundColor: ok(colors.secondary) }} />
        <div className="h-2 w-1/2 rounded-full bg-surface-200" />
        <div className="flex items-center justify-between pt-2">
          <span className="rounded-full px-3 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: ok(colors.accent) }}>Scan to join</span>
          <QrCode className="h-10 w-10 text-surface-800" />
        </div>
      </div>
    </div>
  )
}

export function LinkStep({ icon, done, doneText, todoText, actionHref, actionLabel, secondary }: {
  icon: React.ReactNode
  done: boolean
  doneText: string
  todoText: string
  actionHref: string
  actionLabel: string
  secondary?: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <div className={`flex items-start gap-4 rounded-2xl border px-5 py-5 ${done ? 'border-success-200 bg-success-50' : 'border-surface-200 bg-surface-50'}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${done ? 'bg-success-600 text-white' : 'bg-white text-brand-600 shadow-sm'}`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </span>
        <p className={`text-sm ${done ? 'text-success-900' : 'text-surface-700'}`}>{done ? doneText : todoText}</p>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-surface-100 pt-5">
        {secondary}
        <Button asChild variant={done ? 'outline' : 'default'}>
          <Link href={actionHref}>{actionLabel}<ExternalLink className="h-4 w-4" /></Link>
        </Button>
      </div>
    </div>
  )
}

export function MaterialsStep({ count, busy, progress, error, onGenerate }: {
  count: number; busy: boolean; progress: string | null; error: string | null; onGenerate: () => void
}) {
  return (
    <div className="space-y-5">
      <div className={`flex items-start gap-4 rounded-2xl border px-5 py-5 ${count > 0 ? 'border-success-200 bg-success-50' : 'border-surface-200 bg-surface-50'}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${count > 0 ? 'bg-success-600 text-white' : 'bg-white text-brand-600 shadow-sm'}`}>
          {count > 0 ? <CheckCircle2 className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
        </span>
        <p className={`text-sm ${count > 0 ? 'text-success-900' : 'text-surface-700'}`}>
          {count > 0
            ? `${count} material${count === 1 ? ' is' : 's are'} ready. Regenerate after you change your logo or colors.`
            : 'Create your flyers for families and local businesses. They use your logo, your colors and your QR code.'}
        </p>
      </div>
      {progress ? <p role="status" className="text-sm text-surface-600">{progress}</p> : null}
      {error ? <p role="alert" className="text-sm text-danger-600">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-surface-100 pt-5">
        {count > 0 ? <Button asChild variant="outline"><Link href="/materials/mine">See my materials</Link></Button> : null}
        <Button onClick={onGenerate} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
          {count > 0 ? 'Regenerate materials' : 'Generate my materials'}
        </Button>
      </div>
    </div>
  )
}
