import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export async function GET(_: Request, {params}: {params: {file: string}}) {
  if (!/^cause-\d+-(?:[a-f0-9]{8}|[a-f0-9]{32})\.(mp4|png)$/.test(params.file)) return new NextResponse(null,{status:404})
  const base=process.env.CAUSE_VIDEO_RENDER_URL
  if (!base) return new NextResponse(null,{status:503})
  try {
    const result=await fetch(`${base.replace(/\/$/,'')}/generated/${params.file}`,{cache:'no-store',signal:AbortSignal.timeout(300000)})
    if (!result.ok) return new NextResponse(null,{status:result.status===404?404:502})
    const headers=new Headers({'content-type':params.file.endsWith('.mp4')?'video/mp4':'image/png','cache-control':'public, max-age=31536000, immutable'})
    const length=result.headers.get('content-length'); if(length) headers.set('content-length',length)
    return new NextResponse(result.body,{headers})
  } catch { return new NextResponse(null,{status:502}) }
}
