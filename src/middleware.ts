import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const referralCode = request.nextUrl.searchParams.get('ref')?.trim().slice(0, 64)
  const hostname = request.nextUrl.hostname.toLowerCase()
  const isPublicHome = (hostname === 'localvip.com' || hostname === 'www.localvip.com')
    && request.nextUrl.pathname === '/'
  const response = isPublicHome
    ? NextResponse.redirect(new URL(
        `/newmainpage5${referralCode ? `?ref=${encodeURIComponent(referralCode)}` : ''}`,
        'https://my.localvip.com',
      ))
    : await updateSession(request)
  if (referralCode) {
    response.cookies.set('lvip_refCode', referralCode, {
      domain: '.localvip.com',
      path: '/',
      maxAge: 60 * 60 * 24 * 365 * 10,
      sameSite: 'lax',
      secure: true,
    })
  }
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
