import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import {
  parseJsonRequest,
  qaRouteErrorResponse,
  requireQaRouteAccess,
} from '@/lib/server/qa-route'

export const dynamic = 'force-dynamic'

/**
 * Invite any node type into the business's network.
 *
 * A business can refer a customer, another business, or a cause — the backend
 * takes all three through one door, POST /api/mobile/v1/Referrals/invite, and
 * decides what kind of account to open from `inviteeType`.
 *
 * Business-to-business invites that should also open a CRM lead keep going
 * through /api/business-portal/referrals. This route is the network side: it
 * creates the invited account and hands back its referral code.
 */

const INVITE_PATH = '/api/mobile/v1/Referrals/invite'

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((value) => value || '')

const baseSchema = z.object({
  inviteeType: z.enum(['consumer', 'business', 'cause']),
  firstName: z.string().trim().min(1, 'A first name is required.').max(80),
  lastName: optionalText(80),
  email: z.string().trim().email('Enter a valid email address.'),
  phone: optionalText(40),
  address1: optionalText(200),
  address2: optionalText(200),
  city: optionalText(120),
  state: optionalText(80),
  zipCode: optionalText(20),
  country: optionalText(80),
  organizationName: optionalText(160),
})

// Business and cause invites open an organisation account, so the backend needs
// the name to label it and a street address to geocode it. A consumer invite
// needs neither.
const inviteSchema = baseSchema.superRefine((value, ctx) => {
  if (value.inviteeType === 'consumer') return

  const label = value.inviteeType === 'cause' ? 'cause' : 'business'
  if (!value.organizationName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['organizationName'],
      message: `Enter the ${label} name.`,
    })
  }
  if (!value.address1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['address1'],
      message: `Enter a street address so the ${label} can be placed on the map.`,
    })
  }
})

export interface NetworkInviteResult {
  success: boolean
  message: string | null
  invitedUserId: number | string | null
  invitedAccountId: number | string | null
  referralCode: string | null
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readId(source: Record<string, unknown>, key: string): number | string | null {
  const value = source[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) return value.trim()
  return null
}

export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess(['business', 'admin'])
  if ('error' in access) return access.error

  const body = await parseJsonRequest<unknown>(request)
  if (!body) {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = inviteSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json({ error: issue?.message || 'Invalid invite.' }, { status: 400 })
  }

  const input = parsed.data

  try {
    const response = await fetchQaApi(INVITE_PATH, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        inviteeType: input.inviteeType,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        address1: input.address1,
        address2: input.address2,
        city: input.city,
        state: input.state,
        zipCode: input.zipCode,
        country: input.country,
        organizationName: input.organizationName,
      }),
    })

    // parseQaResponse throws a QaApiError carrying the backend's own message and
    // status, so a 409 "already registered" reaches the composer verbatim rather
    // than as a generic failure.
    const payload = (await parseQaResponse<Record<string, unknown>>(response, 'This invite could not be sent.')) || {}

    const result: NetworkInviteResult = {
      success: payload.success === false ? false : true,
      message: readString(payload, 'message'),
      invitedUserId: readId(payload, 'invitedUserId'),
      invitedAccountId: readId(payload, 'invitedAccountId'),
      referralCode: readString(payload, 'referralCode'),
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.message || 'This invite could not be sent.' },
        { status: 400 },
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    return qaRouteErrorResponse(error, 'This invite could not be sent.')
  }
}
