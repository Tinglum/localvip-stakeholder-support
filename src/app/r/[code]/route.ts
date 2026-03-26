import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAppBaseUrl } from '@/lib/business-join'

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = params.code
  const supabase = createServiceClient()

  const { data: redirectRow } = await (supabase
    .from('redirects') as any)
    .select('*')
    .eq('short_code', code)
    .eq('status', 'active')
    .single()
  const redirect = redirectRow as {
    id: string
    destination_url: string | null
    qr_code_id: string | null
    click_count: number | null
  } | null

  if (!redirect?.destination_url) {
    return NextResponse.redirect(getAppBaseUrl())
  }

  if (redirect.qr_code_id) {
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null

    await (supabase.from('qr_code_events') as any).insert({
      qr_code_id: redirect.qr_code_id,
      event_type: 'scan',
      ip_address: ipAddress,
      user_agent: request.headers.get('user-agent'),
      referrer: request.headers.get('referer'),
      metadata: {
        short_code: code,
      },
    })

    const { data: qrCodeRow } = await (supabase
      .from('qr_codes') as any)
      .select('id, scan_count')
      .eq('id', redirect.qr_code_id)
      .single()
    const qrCode = qrCodeRow as { id: string; scan_count: number | null } | null

    if (qrCode) {
      await (supabase.from('qr_codes') as any)
        .update({ scan_count: (qrCode.scan_count || 0) + 1 })
        .eq('id', qrCode.id)
    }
  }

  await (supabase.from('redirects') as any)
    .update({ click_count: (redirect.click_count || 0) + 1 })
    .eq('id', redirect.id)

  return NextResponse.redirect(redirect.destination_url)
}
