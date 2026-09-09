import type { QrCode } from '@/lib/types/database'

/**
 * The join/referral details a cause or business shows its community.
 *
 * REPLACES the retired `stakeholder_codes` table. When the dashboard moved off
 * Supabase to the QA backend, `stakeholders` and `stakeholder_codes` were parked
 * in EMPTY_FALLBACK_TABLES — they returned [] unconditionally, so every page
 * reading them rendered "not set up" no matter what the account actually had.
 * The data was never missing; it lives on the QR record.
 *
 * Everything below is derived from the account's own QR row rather than a
 * parallel table, so there is one source of truth and nothing to keep in sync.
 */
export interface CommunityCodes {
  /** The owner's referral code, carried in the QR's signup link. */
  referral_code: string | null
  /** The short code the QR resolves through. */
  connection_code: string | null
  /** Where a supporter lands after scanning. */
  join_url: string | null
  /** Incidental QR metadata; absent when codes are derived from a referral code alone. */
  scan_count?: number
  status?: string | null
}

function readRef(url: string | null | undefined): string | null {
  if (!url) return null
  // Deliberately tolerant: these URLs are stored as plain strings and older rows
  // may be relative or malformed, which `new URL()` would throw on.
  const match = /[?&]ref=([^&#]+)/i.exec(url)
  if (!match) return null
  try {
    const value = decodeURIComponent(match[1]).trim()
    return value.length > 0 ? value : null
  } catch {
    return match[1].trim() || null
  }
}

/**
 * Picks the QR belonging to this account and reads its codes.
 *
 * Matching is on entity id alone. Causes and businesses share one Accounts id
 * space, so the id is already unambiguous, and a business owns several QR kinds
 * (`business_capture`, `business_network_referral`) which an entity_type filter
 * would have to enumerate.
 *
 * Returns null when the account genuinely has no QR — which the caller should
 * render as "not set up yet", not as an error.
 */
export function deriveCommunityCodes(
  qrCodes: QrCode[] | null | undefined,
  entityId: string | number | null | undefined,
): CommunityCodes | null {
  if (!qrCodes?.length || entityId == null || entityId === '') return null

  const wanted = String(entityId)
  const owned = qrCodes.filter((qr) => qr.entity_id != null && String(qr.entity_id) === wanted)
  if (owned.length === 0) return null

  // An active code is the one a supporter can actually use; fall back to the
  // first so an archived-but-present QR still shows rather than vanishing.
  const qr = owned.find((entry) => (entry.status || '').toLowerCase() === 'active') || owned[0]

  const joinUrl = qr.destination_url || qr.redirect_url || null
  return {
    referral_code: readRef(joinUrl),
    connection_code: qr.short_code || null,
    join_url: joinUrl,
    scan_count: typeof qr.scan_count === 'number' ? qr.scan_count : 0,
    status: qr.status ?? null,
  }
}
