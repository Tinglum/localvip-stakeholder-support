'use client'

/**
 * Who can see a material — the role chips, and the subtype chips nested under
 * the role each one belongs to.
 *
 * The old version rendered six subtype chips in one flat row with nothing
 * indicating which role owned which. That hid the only rule that matters: a
 * subtype narrows exactly one role. People read "narrower audience" as additive,
 * ticked Super/Internal alongside a Business role, and silently made the
 * material invisible to every business.
 *
 * Nesting them makes the ownership visible, and deselecting a role now takes its
 * subtypes with it so a chip cannot be left behind doing nothing.
 *
 * Rendered by both the upload dialog and the edit dialog so the two cannot drift.
 */

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import {
  MATERIAL_VISIBILITY_ROLE_OPTIONS,
  getInertSubtypeTags,
  getSubtypeLabel,
  getSubtypeOptionsForVisibilityRole,
} from '@/lib/materials/material-targeting'
import type { UserRole, UserRoleSubtype } from '@/lib/types/database'

export function MaterialVisibilityPicker({
  roleTags,
  subtypeTags,
  onChange,
}: {
  roleTags: UserRole[]
  subtypeTags: UserRoleSubtype[]
  onChange: (next: { roleTags: UserRole[]; subtypeTags: UserRoleSubtype[] }) => void
}) {
  function toggleRole(role: UserRole) {
    const selected = roleTags.includes(role)
    if (!selected) {
      onChange({ roleTags: [...roleTags, role], subtypeTags })
      return
    }
    // Deselecting a role drops its subtypes too. Leaving them behind is how a
    // chip ends up selected with no effect and no explanation.
    const owned = new Set(getSubtypeOptionsForVisibilityRole(role).map((option) => option.value))
    onChange({
      roleTags: roleTags.filter((item) => item !== role),
      subtypeTags: subtypeTags.filter((item) => !item || !owned.has(item)),
    })
  }

  function toggleSubtype(subtype: UserRoleSubtype) {
    onChange({
      roleTags,
      subtypeTags: subtypeTags.includes(subtype)
        ? subtypeTags.filter((item) => item !== subtype)
        : [...subtypeTags, subtype],
    })
  }

  // Only possible for a material saved before subtypes were nested under roles.
  const inert = getInertSubtypeTags(roleTags, subtypeTags)

  return (
    <div className="rounded-2xl border border-surface-200 bg-surface-50 p-4">
      <p className="text-sm font-semibold text-surface-900">Who can see this</p>
      <p className="mt-1 text-xs text-surface-500">
        Pick the roles whose libraries this material belongs in. Select nothing to show it to everyone.
      </p>

      <div className="mt-4 space-y-2">
        {MATERIAL_VISIBILITY_ROLE_OPTIONS.map((option) => {
          const active = roleTags.includes(option.value)
          const subtypeOptions = getSubtypeOptionsForVisibilityRole(option.value)
          return (
            <div
              key={option.value}
              className={`rounded-xl border p-3 transition-colors ${
                active ? 'border-brand-300 bg-white' : 'border-surface-200 bg-white/60'
              }`}
            >
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleRole(option.value)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-surface-200 bg-white text-surface-600 hover:border-brand-300 hover:text-brand-700'
                  }`}
                >
                  {option.label}
                </button>
                {active && subtypeOptions.length === 0 ? (
                  <span className="text-xs text-surface-500">Everyone in this role</span>
                ) : null}
              </div>

              {/* A role's subtypes only exist once the role itself is selected —
                  they cannot narrow a role that is not targeted. */}
              {active && subtypeOptions.length > 0 ? (
                <div className="mt-3 border-t border-surface-100 pt-3">
                  <p className="text-xs text-surface-500">
                    Optional: show only to some {option.label.toLowerCase()} users. Leave these off for all of them.
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {subtypeOptions.map((subtype) => {
                      const subtypeActive = subtypeTags.includes(subtype.value)
                      return (
                        <button
                          key={subtype.value}
                          type="button"
                          aria-pressed={subtypeActive}
                          onClick={() => toggleSubtype(subtype.value)}
                          className={`rounded-full border px-3 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success-500 focus-visible:ring-offset-2 ${
                            subtypeActive
                              ? 'border-success-500 bg-success-50 text-success-700'
                              : 'border-surface-200 bg-white text-surface-600 hover:border-success-300 hover:text-success-700'
                          }`}
                        >
                          {subtype.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>

      {inert.length > 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-xl border border-warning-200 bg-warning-50 p-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-700" />
          <p className="text-xs text-warning-800">
            <span className="font-semibold">
              {inert.map(getSubtypeLabel).join(', ')} {inert.length === 1 ? 'is' : 'are'} doing nothing.
            </span>{' '}
            The role {inert.length === 1 ? 'it belongs' : 'they belong'} to is not selected, so nobody is matched by{' '}
            {inert.length === 1 ? 'it' : 'them'}. Saving will clear {inert.length === 1 ? 'it' : 'them'}.
          </p>
        </div>
      ) : null}
    </div>
  )
}

/** Drops inert subtypes so they are never written back. Use on save. */
export function cleanVisibilitySubtypes(roleTags: UserRole[], subtypeTags: UserRoleSubtype[]) {
  const inert = new Set(getInertSubtypeTags(roleTags, subtypeTags))
  return subtypeTags.filter(
    (subtype): subtype is Exclude<UserRoleSubtype, null> =>
      !!subtype && !inert.has(subtype),
  )
}
