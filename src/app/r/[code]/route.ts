import { NextRequest, NextResponse } from 'next/server'

/**
 * QR Code / Short Link redirect handler.
 * URL pattern: /r/{short_code}
 *
 * In production, this:
 * 1. Looks up the short_code in the redirects table
 * 2. Records a qr_code_event (scan)
 * 3. Increments click_count
 * 4. Redirects to destination_url
 *
 * For now (demo mode), redirects to a default page.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const code = params.code

  // TODO: Replace with Supabase lookup
  // const supabase = createServiceClient()
  // const { data: redirect } = await supabase
  //   .from('redirects')
  //   .select('destination_url, qr_code_id')
  //   .eq('short_code', code)
  //   .eq('status', 'active')
  //   .single()
  //
  // if (redirect) {
  //   // Record scan event
  //   await supabase.from('qr_code_events').insert({
  //     qr_code_id: redirect.qr_code_id,
  //     event_type: 'scan',
  //     ip_address: request.headers.get('x-forwarded-for'),
  //     user_agent: request.headers.get('user-agent'),
  //     referrer: request.headers.get('referer'),
  //   })
  //
  //   // Increment counters
  //   await supabase.rpc('increment_click_count', { code })
  //
  //   return NextResponse.redirect(redirect.destination_url)
  // }

  // Demo: redirect to localvip.com
  return NextResponse.redirect('https://localvip.com?ref=' + code)
}
