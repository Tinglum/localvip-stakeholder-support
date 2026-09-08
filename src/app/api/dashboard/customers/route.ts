import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { fetchQaApi, parseQaResponse } from '@/lib/auth/qa-api'
import { requireQaRouteAccess } from '@/lib/server/qa-route'

const createCustomerSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required.').max(80),
  lastName: z.string().trim().max(80).optional().default(''),
  email: z.string().trim().email('Enter a valid email address.'),
  phoneNumber: z.string().trim().max(30).optional().default(''),
  refCode: z.string().trim().min(1, 'Select who referred this customer.'),
})

export async function POST(request: NextRequest) {
  const access = await requireQaRouteAccess(['admin'])
  if ('error' in access) return access.error

  const body = await request.json().catch(() => null)
  const parsed = createCustomerSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid customer details.' }, { status: 400 })
  }

  try {
    const response = await fetchQaApi('/api/dashboard/v1/User/invite', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        ...parsed.data,
        fullName: `${parsed.data.firstName} ${parsed.data.lastName}`.trim(),
        role: 'Consumer',
        accountType: 'Consumer',
        brand: 'localvip',
        notes: 'Created from Dashboard customer directory.',
      }),
    })
    const created = await parseQaResponse<Record<string, unknown>>(response, 'The customer could not be created.')
    return NextResponse.json({ success: true, customer: created })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'The customer could not be created.' },
      { status: 500 },
    )
  }
}
