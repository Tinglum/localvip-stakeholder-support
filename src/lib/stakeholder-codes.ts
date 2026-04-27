import { normalizeStakeholderCode } from '@/lib/material-engine'

const PLACEHOLDER_TOKENS = new Set(['string', 'null', 'undefined'])

function trimToNull(value: string | null | undefined) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed || null
}

function isPlaceholderToken(value: string) {
  return PLACEHOLDER_TOKENS.has(value.toLowerCase())
}

function parseStakeholderUrl(value: string) {
  try {
    return new URL(value)
  } catch {
    try {
      return new URL(value, 'https://localvip.invalid')
    } catch {
      return null
    }
  }
}

export function sanitizeStakeholderCodeValue(value: string | null | undefined) {
  const trimmed = trimToNull(value)
  if (!trimmed) return null

  const normalized = normalizeStakeholderCode(trimmed)
  if (!normalized || isPlaceholderToken(normalized)) return null
  return normalized
}

export function sanitizeStakeholderUrl(value: string | null | undefined) {
  const trimmed = trimToNull(value)
  if (!trimmed || isPlaceholderToken(trimmed)) return null

  const parsed = parseStakeholderUrl(trimmed)
  if (!parsed) return null

  const lastSegment = parsed.pathname.split('/').filter(Boolean).pop() || ''
  if (lastSegment && !sanitizeStakeholderCodeValue(lastSegment)) return null

  return trimmed
}

export function sanitizeStakeholderCodeFields<
  T extends { referral_code?: string | null; connection_code?: string | null; join_url?: string | null },
>(value: T): T {
  return {
    ...value,
    referral_code: sanitizeStakeholderCodeValue(value.referral_code),
    connection_code: sanitizeStakeholderCodeValue(value.connection_code),
    join_url: sanitizeStakeholderUrl(value.join_url),
  }
}
