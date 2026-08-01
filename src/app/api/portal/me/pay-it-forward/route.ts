import { NextResponse } from 'next/server'
import { fetchQaApi, parseQaJsonResponse } from '@/lib/auth/qa-api'
import { qaRouteErrorResponse, requireQaRouteAccess } from '@/lib/server/qa-route'
import { toQaNumber } from '@/lib/server/qa-consumer'

/**
 * Pay it Forward circle for the signed-in consumer.
 *
 * Backing QA endpoint: GET /api/mobile/v1/Payment/PayItForward (bearer-scoped to
 * the caller, so no consumer id is resolved here). It returns the slot counts, the
 * share percentage, the settled money totals and the per-friend breakdown:
 *
 *   { maxSlots, usedSlots, sharePercent, totalSent, totalSentToFormerFriends,
 *     totalReceived,
 *     friends: [{ friendId, name, email, joinedDate, totalSent, lastSentDate }] }
 *
 * This route is a pass-through by design. It previously APPROXIMATED the forwarded
 * total as 5% of the consumer's lifetime marketing fees, because no endpoint
 * exposed the real figure. That approximation is gone: with a real source there
 * must not be a second one that quietly disagrees with it. Every number below comes
 * from the endpoint, including sharePercent and maxSlots — do not reintroduce local
 * constants for them.
 *
 * All money figures are SETTLED-only, and totalSent equals the sum of the
 * per-friend totals by construction, so the page can present them together without
 * reconciling anything.
 */
const ENDPOINT = '/api/mobile/v1/Payment/PayItForward'

interface RawFriend {
  friendId?: unknown
  FriendId?: unknown
  name?: unknown
  Name?: unknown
  email?: unknown
  Email?: unknown
  joinedDate?: unknown
  JoinedDate?: unknown
  totalSent?: unknown
  TotalSent?: unknown
  lastSentDate?: unknown
  LastSentDate?: unknown
}

interface RawPayItForward {
  maxSlots?: unknown
  MaxSlots?: unknown
  usedSlots?: unknown
  UsedSlots?: unknown
  sharePercent?: unknown
  SharePercent?: unknown
  totalSent?: unknown
  TotalSent?: unknown
  totalSentToFormerFriends?: unknown
  TotalSentToFormerFriends?: unknown
  totalReceived?: unknown
  TotalReceived?: unknown
  friends?: unknown
  Friends?: unknown
}

export interface PayItForwardMember {
  friendId: number | null
  name: string | null
  email: string | null
  joinedDate: string | null
  totalSent: number | null
  lastSentDate: string | null
}

function toNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Null rather than 0 when the field is absent: "no data" is not "zero dollars". */
function toNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null
  const parsed = toQaNumber(value)
  return Number.isFinite(parsed) ? parsed : null
}

function toId(value: unknown): number | null {
  const parsed = toNullableNumber(value)
  return parsed !== null && parsed > 0 ? Math.round(parsed) : null
}

function mapFriend(entry: unknown): PayItForwardMember | null {
  if (!entry || typeof entry !== 'object') return null
  const raw = entry as RawFriend
  return {
    friendId: toId(raw.friendId ?? raw.FriendId),
    name: toNullableString(raw.name ?? raw.Name),
    email: toNullableString(raw.email ?? raw.Email),
    joinedDate: toNullableString(raw.joinedDate ?? raw.JoinedDate),
    totalSent: toNullableNumber(raw.totalSent ?? raw.TotalSent),
    lastSentDate: toNullableString(raw.lastSentDate ?? raw.LastSentDate),
  }
}

export async function GET() {
  const access = await requireQaRouteAccess(['consumer'])
  if ('error' in access) return access.error

  try {
    const res = await fetchQaApi(ENDPOINT)
    const payload = await parseQaJsonResponse<RawPayItForward>(
      res,
      'Your Pay it Forward circle could not be loaded.',
    )

    const rawFriends = payload?.friends ?? payload?.Friends
    const members = (Array.isArray(rawFriends) ? rawFriends : [])
      .map(mapFriend)
      .filter((member): member is PayItForwardMember => Boolean(member))

    return NextResponse.json({
      ok: true,
      endpoint: ENDPOINT,
      maxSlots: toNullableNumber(payload?.maxSlots ?? payload?.MaxSlots),
      // Fall back to the number of rows actually returned rather than to a
      // constant — the two should agree, and the list is the thing being rendered.
      usedSlots: toNullableNumber(payload?.usedSlots ?? payload?.UsedSlots) ?? members.length,
      sharePercent: toNullableNumber(payload?.sharePercent ?? payload?.SharePercent),
      totalSent: toNullableNumber(payload?.totalSent ?? payload?.TotalSent),
      totalSentToFormerFriends: toNullableNumber(
        payload?.totalSentToFormerFriends ?? payload?.TotalSentToFormerFriends,
      ),
      totalReceived: toNullableNumber(payload?.totalReceived ?? payload?.TotalReceived),
      members,
    })
  } catch (error) {
    return qaRouteErrorResponse(error, 'Your Pay it Forward circle could not be loaded.')
  }
}
