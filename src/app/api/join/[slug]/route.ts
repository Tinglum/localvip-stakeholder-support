import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServiceClient } from '@/lib/supabase/server'
import {
  ensureBusinessJoinResource,
  resolveBusinessByJoinIdentifier,
  upsertBusinessJoinContact,
} from '@/lib/server/business-capture'
import { normalizePhone } from '@/lib/utils'

const submissionSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80, 'Use a shorter first name.'),
  phone: z.string().trim().optional().or(z.literal('')),
  email: z.string().trim().optional().or(z.literal('')),
  supportsLocalCauses: z.boolean().optional().default(false),
}).superRefine((value, context) => {
  if (!value.phone && !value.email) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Add a phone number or email.',
      path: ['phone'],
    })
  }

  if (value.email && !z.string().email().safeParse(value.email).success) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid email address.',
      path: ['email'],
    })
  }

  if (value.phone && normalizePhone(value.phone).length < 10) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Enter a valid phone number.',
      path: ['phone'],
    })
  }
})

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const RATE_LIMIT_MAX = 8
const requestStore = new Map<string, { count: number; expiresAt: number }>()

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } },
) {
  const ipAddress = getClientIp(request)

  if (isRateLimited(ipAddress)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a little and try again.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  const parsed = submissionSchema.safeParse(body)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return NextResponse.json({ error: firstIssue?.message || 'Your details could not be submitted.' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const business = await resolveBusinessByJoinIdentifier(supabase, params.slug)

  if (!business) {
    return NextResponse.json({ error: 'This business offer page is no longer active.' }, { status: 404 })
  }

  const actorId = business.owner_user_id || business.owner_id || null
  const resource = await ensureBusinessJoinResource(supabase, business, actorId)
  const contact = await upsertBusinessJoinContact(supabase, business, {
    firstName: parsed.data.firstName,
    phone: parsed.data.phone || null,
    email: parsed.data.email || null,
    supportsLocalCauses: parsed.data.supportsLocalCauses,
  })

  await (supabase
    .from('qr_code_events') as any)
    .insert({
      qr_code_id: resource.qrCodeId,
      event_type: 'signup',
      ip_address: ipAddress,
      user_agent: request.headers.get('user-agent'),
      referrer: request.headers.get('referer'),
      metadata: {
        contact_id: contact.id,
        source: 'business_join_qr',
        supports_local_causes: parsed.data.supportsLocalCauses,
      },
    })

  return NextResponse.json({
    success: true,
    businessName: business.name,
    offerTitle: resource.offerTitle,
    offerDescription: resource.offerDescription,
    offerValue: resource.offerValue,
  })
}

function getClientIp(request: NextRequest) {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || '0.0.0.0'
  )
}

function isRateLimited(ipAddress: string) {
  const now = Date.now()
  const existing = requestStore.get(ipAddress)

  if (!existing || existing.expiresAt <= now) {
    requestStore.set(ipAddress, { count: 1, expiresAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  if (existing.count >= RATE_LIMIT_MAX) {
    return true
  }

  requestStore.set(ipAddress, { count: existing.count + 1, expiresAt: existing.expiresAt })
  return false
}
