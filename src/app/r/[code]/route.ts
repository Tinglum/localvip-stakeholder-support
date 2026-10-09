import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { getAppBaseUrl } from '@/lib/business-join'

// ─── Helpers ────────────────────────────────────────────────

function parseDeviceType(ua: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!ua) return 'desktop'
  const u = ua.toLowerCase()
  if (/ipad|tablet/.test(u)) return 'tablet'
  if (/mobile|android|iphone|ipod/.test(u)) return 'mobile'
  return 'desktop'
}

function parseBrowser(ua: string | null): string {
  if (!ua) return 'unknown'
  if (/edg\//i.test(ua)) return 'edge'
  if (/opr\//i.test(ua)) return 'opera'
  if (/chrome/i.test(ua)) return 'chrome'
  if (/safari/i.test(ua)) return 'safari'
  if (/firefox/i.test(ua)) return 'firefox'
  return 'other'
}

function parseOS(ua: string | null): string {
  if (!ua) return 'unknown'
  if (/windows/i.test(ua)) return 'windows'
  if (/macintosh|mac os/i.test(ua)) return 'macos'
  if (/iphone|ipad/i.test(ua)) return 'ios'
  if (/android/i.test(ua)) return 'android'
  if (/linux/i.test(ua)) return 'linux'
  return 'other'
}

function parseReferrerSource(ref: string | null): string {
  if (!ref) return 'direct'
  const r = ref.toLowerCase()
  if (/facebook|instagram|twitter|x\.com|tiktok|linkedin|youtube|whatsapp|t\.co|snapchat/.test(r)) return 'social'
  if (/google|bing|yahoo|duckduckgo|yandex/.test(r)) return 'search'
  if (/mail\.google|outlook|yahoo\.com\/mail|mail\.|webmail/.test(r)) return 'email'
  return 'other'
}

function parseReferrerDomain(ref: string | null): string | null {
  if (!ref) return null
  try {
    return new URL(ref).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// ─── Handler ────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } },
) {
  const code = params.code
  if (process.env.NEXT_PUBLIC_DEPLOY_ENV === 'qa') {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(code)) return new NextResponse('Not found', { status: 404 })
    const base = process.env.NEXT_PUBLIC_QA_AUTH_BASE_URL
    if (!base) return new NextResponse('QA backend unavailable', { status: 503 })
    const result = await fetch(`${base}/api/dashboard/v1/Redirect/resolve/${encodeURIComponent(code)}`, { cache: 'no-store' })
    if (!result.ok) return new NextResponse('Not found', { status: 404 })
    const data = await result.json() as { destinationUrl?: string; DestinationUrl?: string }
    const destination = data.destinationUrl || data.DestinationUrl
    if (!destination) return new NextResponse('Not found', { status: 404 })
    let target: URL
    try { target = new URL(destination) } catch { return new NextResponse('Invalid destination', { status: 400 }) }
    if (!['http:', 'https:'].includes(target.protocol)) return new NextResponse('Invalid destination', { status: 400 })
    if (['my.localvip.com', 'dashboard.localvip.com', 'qa.localvip.com'].includes(target.hostname)) {
      return new NextResponse('This QA code points to a live environment', { status: 409 })
    }
    return NextResponse.redirect(target)
  }
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
    const ua = request.headers.get('user-agent')
    const referer = request.headers.get('referer')
    const ipAddress =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || null

    // Fire both the event insert and scan_count update in parallel
    const [, qrCodeRow] = await Promise.all([
      (supabase.from('qr_code_events') as any).insert({
        qr_code_id: redirect.qr_code_id,
        event_type: 'scan',
        ip_address: ipAddress,
        user_agent: ua,
        referrer: referer,
        metadata: {
          short_code: code,
          device: parseDeviceType(ua),
          browser: parseBrowser(ua),
          os: parseOS(ua),
          referrer_source: parseReferrerSource(referer),
          referrer_domain: parseReferrerDomain(referer),
        },
      }),
      (supabase.from('qr_codes') as any)
        .select('id, scan_count')
        .eq('id', redirect.qr_code_id)
        .single(),
    ])

    const qrCode = qrCodeRow?.data as { id: string; scan_count: number | null } | null
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
