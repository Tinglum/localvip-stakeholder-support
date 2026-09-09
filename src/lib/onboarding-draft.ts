'use client'

const PREFIX = 'localvip:onboarding-draft:v1:'

function key(flow: string, scope: string) {
  return `${PREFIX}${flow}:${encodeURIComponent(scope)}`
}

export function readOnboardingDraft<T>(flow: string, scope: string): T | null {
  if (typeof window === 'undefined' || !scope) return null
  try {
    const value = JSON.parse(localStorage.getItem(key(flow, scope)) || 'null') as {
      version?: number
      scope?: string
      data?: T
    } | null
    return value?.version === 1 && value.scope === scope && value.data ? value.data : null
  } catch {
    return null
  }
}

export function writeOnboardingDraft<T>(flow: string, scope: string, data: T) {
  if (typeof window === 'undefined' || !scope) return
  try {
    localStorage.setItem(key(flow, scope), JSON.stringify({ version: 1, scope, updatedAt: Date.now(), data }))
  } catch {
    // Autosave to the server remains authoritative when browser storage is unavailable.
  }
}

export function clearOnboardingDraft(flow: string, scope: string) {
  if (typeof window === 'undefined' || !scope) return
  localStorage.removeItem(key(flow, scope))
}
