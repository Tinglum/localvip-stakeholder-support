import { notFound } from 'next/navigation'
import { Heart } from 'lucide-react'
import { createServiceClient } from '@/lib/supabase/server'
import { resolveCommunityBySupportIdentifier } from '@/lib/server/community-support'
import { buildCommunitySupportResource } from '@/lib/community-support'
import { PublicCommunitySupportForm } from '@/components/community/public-community-support-form'

export const dynamic = 'force-dynamic'

export default async function CommunitySupportPage({
  params,
}: {
  params: { slug: string }
}) {
  const supabase = createServiceClient()
  const cause = await resolveCommunityBySupportIdentifier(supabase, params.slug)

  if (!cause) {
    notFound()
  }

  const resource = buildCommunitySupportResource(cause, {
    supportSlug: params.slug,
    shortCode: 'preview',
    redirectUrl: '',
    qrCodeId: 'preview',
  })

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.22),_transparent_28%),linear-gradient(180deg,_#fff7fb_0%,_#fff1f7_48%,_#ffffff_100%)] px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-pink-300/20 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-rose-200/20 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center justify-center">
        <div className="w-full rounded-[2.25rem] border border-white/50 bg-white/70 p-3 shadow-[0_40px_120px_-45px_rgba(219,39,119,0.35)] backdrop-blur-xl">
          <div className="rounded-[2rem] border border-white/70 bg-white/92 p-5 shadow-xl sm:p-6">
            <div className="rounded-[1.75rem] bg-gradient-to-br from-pink-600 via-pink-500 to-rose-500 p-5 text-white shadow-lg">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-3xl border border-white/25 bg-white/95 shadow-sm">
                  <Heart className="h-7 w-7 text-pink-600" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-white/70">Support Local</p>
                  <h1 className="mt-2 text-3xl font-black tracking-tight text-white">{cause.name}</h1>
                  <p className="mt-2 text-sm text-white/85">Join the supporter list in seconds and help grow local momentum.</p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-white/15 bg-white/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/70">Public supporter page</p>
                <p className="mt-2 text-2xl font-bold leading-tight text-white">{resource.headline}</p>
                <p className="mt-3 text-sm leading-6 text-white/85">{resource.description}</p>
              </div>
            </div>

            <div className="mt-5">
              <PublicCommunitySupportForm
                slug={params.slug}
                causeName={cause.name}
                headline={resource.headline}
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
